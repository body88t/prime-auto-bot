import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma/client';
import { config } from '../config/env';
import { WhatsAppService } from '../services/whatsapp.service';
import { VisionService } from '../services/vision.service';
import { MatchingEngine } from '../services/matching.service';
import { LoggerService } from '../services/logger.service';
import { ORDER_STATUS } from '../utils/constants';

export class WhatsAppController {
  private static receiptsDir = path.resolve(__dirname, '../../storage/receipts');

  public static initializeStorage() {
    if (!fs.existsSync(this.receiptsDir)) {
      fs.mkdirSync(this.receiptsDir, { recursive: true });
    }
  }

  /**
   * Retrieves current WhatsApp Baileys connection state and QR code.
   * GET /api/v1/whatsapp/status
   */
  public static getStatus(req: Request, res: Response) {
    let status = WhatsAppService.getStatus();
    if (status.status === 'DISCONNECTED') {
      WhatsAppService.initialize();
      status = WhatsAppService.getStatus();
    }
    return res.status(200).json({
      success: true,
      ...status,
    });
  }

  /**
   * Renders modern web pairing interface for scanning WhatsApp QR code headlessly.
   * GET /scan-qr
   */
  public static renderQrPage(req: Request, res: Response) {
    if (config.adminQrKey) {
      const key = req.query.key as string | undefined;
      if (key !== config.adminQrKey) {
        return res.status(403).send(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head><meta charset="utf-8"><title>غير مصرح</title></head>
          <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="background:#1e293b;padding:32px;border-radius:12px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
              <h2 style="color:#ef4444;margin-top:0;">🔒 صفحة محمية بمفتاح أمان</h2>
              <p style="color:#94a3b8;">يرجى تزويد مفتاح المرور عبر الرابط: <code>/scan-qr?key=YOUR_KEY</code></p>
            </div>
          </body>
          </html>
        `);
      }
    }

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ربط الواتساب السحابي | Prime Auto Bot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; }
    body {
      background: radial-gradient(circle at top, #1e293b 0%, #0f172a 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: rgba(30, 41, 59, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      text-align: center;
    }
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 8px;
      color: #ffffff;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .status-box {
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      font-weight: 700;
      font-size: 15px;
      transition: all 0.3s ease;
    }
    .status-CONNECTED {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10b981;
      color: #34d399;
    }
    .status-SCAN_QR {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid #f59e0b;
      color: #fbbf24;
    }
    .status-CONNECTING, .status-DISCONNECTED {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid #3b82f6;
      color: #60a5fa;
    }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border-radius: 16px;
      display: inline-block;
      margin: 10px auto 20px auto;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      position: relative;
    }
    .qr-image {
      width: 260px;
      height: 260px;
      display: block;
    }
    .instructions {
      text-align: right;
      background: rgba(15, 23, 42, 0.6);
      padding: 16px 20px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.06);
      margin-bottom: 20px;
    }
    .instructions ol {
      padding-right: 20px;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.8;
    }
    .instructions ol li {
      margin-bottom: 4px;
    }
    .connected-panel {
      padding: 24px 10px;
    }
    .phone-number {
      font-size: 24px;
      font-weight: 800;
      color: #34d399;
      direction: ltr;
      margin: 12px 0 6px 0;
      letter-spacing: 1px;
    }
    .pulse-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .btn {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    .btn:hover { background: #1d4ed8; }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      margin-top: 10px;
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.18); }
    .footer-note {
      font-size: 12px;
      color: #64748b;
      margin-top: 16px;
    }
    .spinner {
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header-badge">
      <span class="pulse-dot"></span>
      Prime Auto Bot Cloud Gateway
    </div>
    <h1>ربط واتساب بالسيرفر السحابي</h1>
    <p class="subtitle">السيرفر يعمل 24/7 دون الحاجة لفتح اللابتوب. امسح الكود لمرة واحدة لربط حساب الواتساب.</p>

    <div id="statusBox" class="status-box status-CONNECTING">
      <span>جاري فحص حالة الاتصال...</span>
    </div>

    <!-- QR Code Section -->
    <div id="qrSection" style="display: none;">
      <div class="qr-container">
        <img id="qrImage" class="qr-image" src="" alt="WhatsApp QR Code">
      </div>
      <div class="instructions">
        <ol>
          <li>افتح <strong>واتساب</strong> على هاتفك 📱</li>
          <li>اضغط على <strong>الأجهزة المرتبطة (Linked Devices)</strong></li>
          <li>اضغط على <strong>ربط جهاز (Link a Device)</strong></li>
          <li>وجّه كاميرا الهاتف نحو الكود الظاهر أعلاه</li>
        </ol>
      </div>
    </div>

    <!-- Connected Section -->
    <div id="connectedSection" style="display: none;" class="connected-panel">
      <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
      <h2 style="color: #ffffff; font-size: 20px;">واتساب متصل ويعمل بنجاح!</h2>
      <div id="activePhone" class="phone-number">+20...</div>
      <p style="color: #94a3b8; font-size: 13px; margin: 12px 0 20px 0;">السيرفر جاهز الآن لاستقبال طلبات Wuilt والتحقق من الإيصالات والرسائل البنكية تلقائياً 24 ساعة يومياً.</p>
      <button class="btn btn-secondary" onclick="reconnectWhatsApp()">إعادة الاتصال / Reconnect</button>
    </div>

    <!-- Loading Spinner -->
    <div id="loadingSection">
      <div class="spinner"></div>
      <p style="color: #94a3b8; font-size: 13px;">جاري إعداد محرك Baileys وتجهيز الكود...</p>
    </div>

    <div class="footer-note">يتم تحديث الحالة تلقائياً كل ثانيتين دون الحاجة لتحديث الصفحة</div>
  </div>

  <script>
    let isFetching = false;
    async function updateStatus() {
      if (isFetching) return;
      isFetching = true;
      try {
        const res = await fetch('/api/v1/whatsapp/status');
        const data = await res.json();
        
        const statusBox = document.getElementById('statusBox');
        const qrSection = document.getElementById('qrSection');
        const qrImage = document.getElementById('qrImage');
        const connectedSection = document.getElementById('connectedSection');
        const loadingSection = document.getElementById('loadingSection');
        const activePhone = document.getElementById('activePhone');

        statusBox.className = 'status-box status-' + data.status;

        if (data.status === 'CONNECTED') {
          statusBox.innerHTML = '<span class="pulse-dot"></span> متصل بنجاح بالسحابة 24/7';
          qrSection.style.display = 'none';
          loadingSection.style.display = 'none';
          connectedSection.style.display = 'block';
          activePhone.innerText = '+' + (data.connectedPhoneNumber || '');
        } else if (data.status === 'SCAN_QR' && data.qrCodeDataUrl) {
          statusBox.innerHTML = '⚡ جاهز للمسح من الهاتف';
          qrImage.src = data.qrCodeDataUrl;
          qrSection.style.display = 'block';
          loadingSection.style.display = 'none';
          connectedSection.style.display = 'none';
        } else {
          statusBox.innerHTML = '⏳ جاري الاتصال وتوليد الكود...';
          qrSection.style.display = 'none';
          loadingSection.style.display = 'block';
          connectedSection.style.display = 'none';
        }
      } catch (err) {
        console.error('Error fetching WhatsApp status:', err);
      } finally {
        isFetching = false;
      }
    }

    async function reconnectWhatsApp() {
      if (!confirm('هل تريد إعادة تهيئة جلسة الواتساب؟')) return;
      try {
        await fetch('/api/v1/whatsapp/init', { method: 'POST' });
        updateStatus();
      } catch (e) {
        alert('تعذر طلب إعادة الاتصال');
      }
    }

    setInterval(updateStatus, 2000);
    updateStatus();
  </script>
</body>
</html>
    `;
    return res.status(200).send(html);
  }

  /**
   * Force reconnects or initializes Baileys WA engine.
   * POST /api/v1/whatsapp/init
   */
  public static async init(req: Request, res: Response) {
    WhatsAppService.initialize();
    return res.status(200).json({
      success: true,
      message: 'WhatsApp initialization sequence triggered.',
    });
  }

  /**
   * Meta Webhook verification backward compatibility (GET).
   */
  public static verifyWebhook(req: Request, res: Response) {
    const challenge = req.query['hub.challenge'];
    return res.status(200).send(challenge || 'OK');
  }

  /**
   * Inbound WhatsApp message processor (POST).
   */
  public static async handleIncomingMessage(req: Request, res: Response) {
    return res.status(200).json({ status: 'handled_by_baileys_engine' });
  }

  /**
   * Handles payment receipt image uploaded by customer.
   */
  public static async processIncomingReceipt(customerPhone: string, mediaId?: string, localFilePath?: string) {
    this.initializeStorage();
    LoggerService.info('WHATSAPP_BOT', `Processing receipt from ${customerPhone}`);

    // 1. Find the latest pending order for this customer phone
    const order = await prisma.order.findFirst({
      where: {
        customerPhone: { contains: customerPhone.slice(-9) },
        status: { in: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PARTIAL_DEPOSIT, ORDER_STATUS.FAILED_VERIFICATION] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      LoggerService.warn('WHATSAPP_BOT', `No active pending order found for phone ${customerPhone}.`);
      await WhatsAppService.sendTextMessage(
        customerPhone,
        'شكراً لإرسال الإيصال. لم نتمكن من العثور على طلب معلق مرتبط برقم هاتفك. يُرجى إنشاء طلب عبر المتجر أولاً أو التواصل مع خدمة العملاء: 01019930974.'
      );
      return;
    }

    let imagePath = localFilePath;
    if (!imagePath) {
      const mockReceiptFilename = `receipt_${order.wuiltOrderId}_${Date.now()}.png`;
      imagePath = path.join(this.receiptsDir, mockReceiptFilename);
      fs.writeFileSync(imagePath, Buffer.from('SIMULATED_RECEIPT_IMAGE_BUFFER'));
    }

    const publicImageUrl = `${config.publicServerUrl}/storage/receipts/${path.basename(imagePath)}`;

    // 2. Vision OCR
    const visionResult = await VisionService.parseReceiptImage(imagePath);

    // 3. Dual-verification matching against bank SMS
    const matchResult = await MatchingEngine.processReceiptScan(order.id, publicImageUrl, visionResult);

    LoggerService.info('WHATSAPP_BOT', `Matching completed for order #${order.wuiltOrderId}: status=${matchResult.status}, matched=${matchResult.matched}`);
  }
}
