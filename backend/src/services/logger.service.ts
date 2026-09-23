import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma/client';

const logsDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const winstonLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `[${timestamp}] [${level.toUpperCase()}]: ${message} ${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level}: ${message}${metaStr}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
  ],
});

export class LoggerService {
  public static async log(level: 'INFO' | 'WARN' | 'ERROR', category: string, message: string, metadata?: any) {
    // 1. Winston logging
    if (level === 'ERROR') {
      winstonLogger.error(`[${category}] ${message}`, metadata);
    } else if (level === 'WARN') {
      winstonLogger.warn(`[${category}] ${message}`, metadata);
    } else {
      winstonLogger.info(`[${category}] ${message}`, metadata);
    }

    // 2. Persist to DB for Desktop Dashboard live inspection (non-blocking)
    try {
      await prisma.systemLog.create({
        data: {
          level,
          category,
          message,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } catch (e) {
      // Avoid recursive failure if database is down
      winstonLogger.debug('Failed to write SystemLog to database:', e);
    }
  }

  public static info(category: string, message: string, metadata?: any) {
    return this.log('INFO', category, message, metadata);
  }

  public static warn(category: string, message: string, metadata?: any) {
    return this.log('WARN', category, message, metadata);
  }

  public static error(category: string, message: string, metadata?: any) {
    return this.log('ERROR', category, message, metadata);
  }
}
