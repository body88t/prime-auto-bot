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

  // Real-time Neon DB Queue Poller (processes orders & carts ingested by Cloudflare Worker Gateway)
  let isPollingDb = false;
  setInterval(async () => {
    if (isPollingDb) return;
    if (WhatsAppService.getStatus().status !== 'CONNECTED') return;
    isPollingDb = true;
    try {
      // 1. Dispatch WhatsApp instructions for any newly ingested Order from Cloudflare Worker
      const pendingOrders = await prisma.order.findMany({
        where: { notes: 'PENDING_WA_DISPATCH', status: 'PENDING_PAYMENT' },
        take: 10,
      });

      for (const ord of pendingOrders) {
        await prisma.order.update({
          where: { id: ord.id },
          data: { notes: 'WA_DISPATCHED' },
        });

        const normalizedPhone = WhatsAppService.normalizePhoneNumber(ord.customerPhone);
        const isSuppressed = config.suppressedPhones.some(
          (sp) => sp && (normalizedPhone.endsWith(sp) || sp.endsWith(normalizedPhone) || normalizedPhone === sp)
        );
        if (isSuppressed || !normalizedPhone) {
          LoggerService.warn('WHATSAPP_BOT', `🛡️ Skipping WA dispatch for suppressed/empty phone on order #${ord.wuiltOrderId}`);
          continue;
        }

        let parsedItems: any[] = [];
        try {
          parsedItems = ord.itemsJson ? JSON.parse(ord.itemsJson) : [];
        } catch {}

        const formattedItems = WhatsAppService.formatOrderItems(parsedItems);
        const formattedDate = WhatsAppService.formatOrderDateTime(ord.createdAt);
        const { MESSAGES } = await import('./utils/constants');
        const msg = MESSAGES.ORDER_CREATED_INSTRUCTION(ord.customerName, formattedItems, formattedDate);
        await WhatsAppService.sendTextMessage(normalizedPhone, msg);
        LoggerService.info('WHATSAPP_BOT', `✅ Dispatched initial WhatsApp instructions for order #${ord.wuiltOrderId} (${normalizedPhone})`);
      }

      // 2. Dispatch WhatsApp reminder for any unsent AbandonedCart
      const pendingCarts = await prisma.abandonedCart.findMany({
        where: { reminderSent: false },
        take: 5,
      });
      for (const cart of pendingCarts) {
        await QueueService.processAbandonedCartReminder({
          cartId: cart.cartId,
          customerPhone: cart.customerPhone,
          customerName: cart.customerName || 'عزيزنا العميل',
        });
      }
    } catch (err: any) {
      // Ignore transient DB poll errors
    } finally {
      isPollingDb = false;
    }
  }, 3000);
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
