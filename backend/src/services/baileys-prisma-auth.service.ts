import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma/client';
import { LoggerService } from './logger.service';

let _baileys: any = null;
async function getBaileys(): Promise<any> {
  if (!_baileys) {
    const dynamicImport = new Function('m', 'return import(m)');
    _baileys = await dynamicImport('@whiskeysockets/baileys');
  }
  return _baileys;
}

/**
 * Database-backed Baileys Authentication State Adapter using Prisma.
 * Persists session credentials and signal keys across ephemeral cloud container restarts.
 */
export async function usePrismaAuthState() {
  const baileys = await getBaileys();
  const { BufferJSON, initAuthCreds, proto } = baileys;

  // 1. Auto-seed from local disk if database has no active session but local files exist
  await seedFromLocalFilesIfEmpty();

  // Helper functions for reading/writing single keys in database
  const writeData = async (data: any, key: string): Promise<void> => {
    try {
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      await prisma.whatsAppSession.upsert({
        where: { key },
        update: { value: serialized },
        create: { key, value: serialized },
      });
    } catch (error: any) {
      LoggerService.error('PRISMA_AUTH', `Failed to write key "${key}" to database: ${error.message}`);
    }
  };

  const readData = async (key: string): Promise<any | null> => {
    try {
      const record = await prisma.whatsAppSession.findUnique({
        where: { key },
      });
      if (!record || !record.value) return null;
      return JSON.parse(record.value, BufferJSON.reviver);
    } catch (error: any) {
      LoggerService.error('PRISMA_AUTH', `Failed to read key "${key}" from database: ${error.message}`);
      return null;
    }
  };

  const removeData = async (key: string): Promise<void> => {
    try {
      await prisma.whatsAppSession.delete({
        where: { key },
      }).catch(() => {});
    } catch {
      // Ignore not-found deletions
    }
  };

  // Load existing credentials from database, or initialize new ones
  const creds = (await readData('creds.json')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: { [id: string]: any } = {};
          if (!ids || ids.length === 0) return data;

          try {
            const keysToFetch = ids.map((id) => `${type}-${id}.json`);
            const records = await prisma.whatsAppSession.findMany({
              where: {
                key: { in: keysToFetch },
              },
            });

            const recordMap = new Map<string, string>();
            for (const r of records) {
              recordMap.set(r.key, r.value);
            }

            for (const id of ids) {
              const fileKey = `${type}-${id}.json`;
              const raw = recordMap.get(fileKey);
              if (raw) {
                try {
                  let value = JSON.parse(raw, BufferJSON.reviver);
                  if (type === 'app-state-sync-key' && value && proto?.Message?.AppStateSyncKeyData) {
                    value = proto.Message.AppStateSyncKeyData.fromObject(value);
                  }
                  data[id] = value;
                } catch (e: any) {
                  LoggerService.warn('PRISMA_AUTH', `Error parsing key ${fileKey}: ${e.message}`);
                }
              }
            }
          } catch (error: any) {
            LoggerService.error('PRISMA_AUTH', `Error in keys.get for type "${type}": ${error.message}`);
          }

          return data;
        },
        set: async (data: any) => {
          const upserts: Array<{ key: string; value: string }> = [];
          const deletes: string[] = [];

          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const fileKey = `${category}-${id}.json`;
              if (value) {
                upserts.push({
                  key: fileKey,
                  value: JSON.stringify(value, BufferJSON.replacer),
                });
              } else {
                deletes.push(fileKey);
              }
            }
          }

          // Execute deletions
          if (deletes.length > 0) {
            try {
              await prisma.whatsAppSession.deleteMany({
                where: { key: { in: deletes } },
              });
            } catch (err: any) {
              LoggerService.warn('PRISMA_AUTH', `Error deleting session keys: ${err.message}`);
            }
          }

          // Execute upserts in parallel chunks to optimize performance
          const CHUNK_SIZE = 50;
          for (let i = 0; i < upserts.length; i += CHUNK_SIZE) {
            const chunk = upserts.slice(i, i + CHUNK_SIZE);
            await Promise.all(
              chunk.map(({ key, value }) =>
                prisma.whatsAppSession.upsert({
                  where: { key },
                  update: { value },
                  create: { key, value },
                }).catch((err: any) => {
                  LoggerService.warn('PRISMA_AUTH', `Upsert error for key ${key}: ${err.message}`);
                })
              )
            );
          }
        },
      },
    },
    saveCreds: async () => {
      const serialized = JSON.stringify(creds, BufferJSON.replacer);
      await prisma.whatsAppSession.upsert({
        where: { key: 'creds.json' },
        update: { value: serialized },
        create: { key: 'creds.json', value: serialized },
      });
    },
    clearAuthState: async () => {
      LoggerService.warn('PRISMA_AUTH', 'Purging all WhatsApp session data from database...');
      try {
        await prisma.whatsAppSession.deleteMany({});
        LoggerService.info('PRISMA_AUTH', 'WhatsApp session table cleared successfully.');
      } catch (err: any) {
        LoggerService.error('PRISMA_AUTH', `Failed to clear WhatsApp session: ${err.message}`);
      }
    },
  };
}

/**
 * Automatically inspects the local storage folder (storage/baileys_auth).
 * If the database has no creds.json but local files exist, seeds all keys into database.
 */
export async function seedFromLocalFilesIfEmpty(): Promise<boolean> {
  try {
    const existingCreds = await prisma.whatsAppSession.findUnique({
      where: { key: 'creds.json' },
    });

    if (existingCreds) {
      // Database already has session credentials
      return false;
    }

    const localAuthDir = path.resolve(__dirname, '../../storage/baileys_auth');
    const localCredsPath = path.join(localAuthDir, 'creds.json');

    if (!fs.existsSync(localCredsPath)) {
      return false;
    }

    LoggerService.info('PRISMA_AUTH', '⚡ Found local WhatsApp session files. Migrating to database...');

    const files = fs.readdirSync(localAuthDir);
    let importedCount = 0;
    const CHUNK_SIZE = 100;

    const fileEntries: Array<{ key: string; value: string }> = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fullPath = path.join(localAuthDir, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        fileEntries.push({ key: file, value: content });
      } catch {}
    }

    for (let i = 0; i < fileEntries.length; i += CHUNK_SIZE) {
      const chunk = fileEntries.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map((item) =>
          prisma.whatsAppSession.upsert({
            where: { key: item.key },
            update: { value: item.value },
            create: { key: item.key, value: item.value },
          }).then(() => importedCount++).catch(() => {})
        )
      );
    }

    LoggerService.info('PRISMA_AUTH', `✅ Successfully migrated ${importedCount} WhatsApp session keys to database!`);
    return true;
  } catch (error: any) {
    LoggerService.warn('PRISMA_AUTH', `Auto-seed from local files skipped: ${error.message}`);
    return false;
  }
}
