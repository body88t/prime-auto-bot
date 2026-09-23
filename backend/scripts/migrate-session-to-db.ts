import fs from 'fs';
import path from 'path';
import { prisma } from '../src/prisma/client';

async function main() {
  console.log('=====================================================');
  console.log('   PRIME AUTO BOT - WhatsApp Session DB Migrator    ');
  console.log('=====================================================');

  const authDir = path.resolve(__dirname, '../storage/baileys_auth');
  const credsPath = path.join(authDir, 'creds.json');

  if (!fs.existsSync(credsPath)) {
    console.error(`❌ No creds.json found in ${authDir}. Nothing to migrate.`);
    process.exit(1);
  }

  const rawCreds = fs.readFileSync(credsPath, 'utf8');
  let credsObj: any;
  try {
    credsObj = JSON.parse(rawCreds);
    console.log(`📱 Found WhatsApp Session for: ${credsObj.me?.id || credsObj.me?.name || 'Unknown'}`);
  } catch (err: any) {
    console.error(`❌ Failed to parse creds.json: ${err.message}`);
    process.exit(1);
  }

  const files = fs.readdirSync(authDir).filter((f) => f.endsWith('.json'));
  console.log(`📂 Found ${files.length} session key files in local storage. Beginning migration to database...`);

  let count = 0;
  let skipped = 0;
  const CHUNK_SIZE = 100;

  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (file) => {
        try {
          const filePath = path.join(authDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          await prisma.whatsAppSession.upsert({
            where: { key: file },
            update: { value: content },
            create: { key: file, value: content },
          });
          count++;
        } catch (e: any) {
          skipped++;
        }
      })
    );

    if ((i + CHUNK_SIZE) % 1000 === 0 || i + CHUNK_SIZE >= files.length) {
      console.log(`⏳ Progress: ${Math.min(i + CHUNK_SIZE, files.length)} / ${files.length} keys processed...`);
    }
  }

  console.log('-----------------------------------------------------');
  console.log(`✅ Migration Complete!`);
  console.log(`✨ Successfully uploaded ${count} session keys to database.`);
  if (skipped > 0) {
    console.log(`⚠️ Skipped ${skipped} files due to errors.`);
  }

  // Verification
  const verifyCreds = await prisma.whatsAppSession.findUnique({
    where: { key: 'creds.json' },
  });

  if (verifyCreds) {
    console.log(`🎉 VERIFIED: creds.json is present in database table "WhatsAppSession".`);
    console.log(`🚀 Your WhatsApp session will now persist permanently across all cloud restarts!`);
  } else {
    console.error(`❌ WARNING: creds.json was not found in database after migration.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal migration error:', e);
  process.exit(1);
});
