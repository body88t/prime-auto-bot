import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config/env';
import apiRouter from './routes/api.routes';
import { errorHandler } from './middlewares/error.middleware';
import { LoggerService } from './services/logger.service';
import { QueueService } from './services/queue.service';
import { WaybillService } from './services/waybill.service';
import { WhatsAppService } from './services/whatsapp.service';
import { WhatsAppController } from './controllers/whatsapp.controller';
import { prisma } from './prisma/client';

const app = express();

// Ensure storage directories exist
const waybillsDir = path.resolve(__dirname, '../storage/waybills');
const receiptsDir = path.resolve(__dirname, '../storage/receipts');
if (!fs.existsSync(waybillsDir)) fs.mkdirSync(waybillsDir, { recursive: true });
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Storage for Waybills and Receipts
app.use('/storage/waybills', express.static(waybillsDir));
app.use('/storage/receipts', express.static(receiptsDir));

// Ultra-fast Health Check for 24/7 Keep-Alive (UptimeRobot / Koyeb / Render)
app.all('/health', async (req, res) => {
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  let dbStatus = 'CONNECTED';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = 'DISCONNECTED';
  }

  res.status(200).json({
    status: 'OK',
    service: 'PRIME AUTO BOT BACKEND',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
    database: dbStatus,
    whatsappStatus: WhatsAppService.getStatus().status,
  });
});

// Headless WhatsApp Web Pairing Interface
app.get('/scan-qr', WhatsAppController.renderQrPage);
app.get('/qr', WhatsAppController.renderQrPage);

// API Routes
app.use('/api/v1', apiRouter);

// Global Error Handler
app.use(errorHandler);

// Start server
const server = app.listen(config.port, async () => {
  LoggerService.info('BOOTSTRAP', `🚀 Prime Auto Bot Backend running on port ${config.port}`);
  LoggerService.info('BOOTSTRAP', `📡 Public Server URL: ${config.publicServerUrl}`);
  LoggerService.info('BOOTSTRAP', `🛡️ Internal SMS Sync Key configured`);
  
  // Initialize Queue & WhatsApp
  await QueueService.initialize();
  WaybillService.initializeStorage();
  WhatsAppService.initialize();

  // Autonomous Cloud Keep-Alive & 45-Minute Zero-Downtime Container Renewal
  if (config.nodeEnv === 'production') {
    const cloudHealthUrl = process.env.CLOUD_HEALTH_URL || 'https://primeautobot-1480cm0m.b4a.run/health';
    const b4aCookie =
      process.env.B4A_SESSION_COOKIE ||
      'connect.sid=s%3A4wI4qDfGabcN_MQxzQQWaeTfPQvDJBqs.H48lW%2B9OSl07XkOOiknoT%2BzbN1t1AW5SwltXHpn%2FXhw';
    const serviceEnvId = process.env.B4A_SERVICE_ENV_ID || '5db65208-53fd-4bae-8e40-c7e872ef26b8';

    // Self-ping every 3 minutes
    setInterval(async () => {
      try {
        await fetch(cloudHealthUrl);
      } catch {}
    }, 3 * 60 * 1000);

    // Proactively trigger zero-downtime replacement deployment at 45 minutes of uptime
    setTimeout(async () => {
      try {
        LoggerService.info('BOOTSTRAP', '🔄 Triggering proactive 45-minute zero-downtime cloud container renewal...');
        await fetch('https://api.containers.back4app.com/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: b4aCookie,
            Origin: 'https://containers.back4app.com',
            Referer: 'https://containers.back4app.com/',
          },
          body: JSON.stringify({
            query: `mutation { triggerManualDeployment(serviceEnvironmentId: "${serviceEnvId}") { id status } }`,
          }),
        });
      } catch (err: any) {
        LoggerService.warn('BOOTSTRAP', `Self-renewal warning: ${err.message}`);
      }
    }, 45 * 60 * 1000);
  }
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  LoggerService.info('SHUTDOWN', `Received ${signal}. Shutting down gracefully...`);
  await QueueService.shutdown();
  server.close(() => {
    LoggerService.info('SHUTDOWN', 'HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
