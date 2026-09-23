import { Router } from 'express';
import { WuiltController } from '../controllers/wuilt.controller';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { SmsController } from '../controllers/sms.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { requireInternalApiKey } from '../middlewares/auth.middleware';

const router = Router();

// -----------------------------------------------------------------------------
// Webhooks Ingestion Engine
// -----------------------------------------------------------------------------
// Wuilt Events (order.created, ORDER_PLACED, cart.abandoned)
const wuiltWebhookPaths = [
  '/webhooks/wuilt',
  '/webhooks/wuilt/order-created',
  '/webhooks/wuilt/orders',
];

wuiltWebhookPaths.forEach((webhookPath) => {
  router.get(webhookPath, (req, res) => res.status(200).json({ status: 'OK', service: 'Wuilt Webhook Endpoint', path: webhookPath }));
  router.post(webhookPath, WuiltController.handleWebhook);
  router.all(webhookPath, (req, res, next) => {
    if (req.method === 'HEAD' || req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });
});

// WhatsApp Cloud & Baileys Engine
router.get('/webhooks/whatsapp', WhatsAppController.verifyWebhook);
router.post('/webhooks/whatsapp', WhatsAppController.handleIncomingMessage);
router.get('/whatsapp/status', WhatsAppController.getStatus);
router.get('/whatsapp/scan-qr', WhatsAppController.renderQrPage);
router.post('/whatsapp/init', WhatsAppController.init);

// -----------------------------------------------------------------------------
// Android SMS Ingestion (Secured via INTERNAL_SMS_SYNC_KEY)
// -----------------------------------------------------------------------------
router.post('/sms/incoming', requireInternalApiKey, SmsController.handleIncomingSms);
router.get('/sms/ping', SmsController.ping);

// -----------------------------------------------------------------------------
// Desktop Dashboard APIs
// -----------------------------------------------------------------------------
router.get('/dashboard/stats', DashboardController.getStats);
router.get('/dashboard/orders', DashboardController.getOrders);
router.get('/dashboard/orders/:id', DashboardController.getOrderById);
router.post('/dashboard/orders/:id/verify', DashboardController.manualVerifyOrder);
router.get('/dashboard/sms', DashboardController.getIncomingSms);
router.get('/dashboard/logs', DashboardController.getLogs);
router.get('/dashboard/events', DashboardController.streamEvents);

// Simulation & Testing endpoints
router.post('/dashboard/simulate/order', DashboardController.simulateOrder);
router.post('/dashboard/simulate/sms', DashboardController.simulateSms);
router.post('/dashboard/simulate/receipt', DashboardController.simulateReceiptScan);

export default router;
