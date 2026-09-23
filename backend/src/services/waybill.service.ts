import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { config } from '../config/env';
import { LoggerService } from './logger.service';

export interface WaybillData {
  orderId: string;
  wuiltOrderId: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  orderTotal: number;
  depositPaid: number;
  remainingTotal: number;
  createdAt: Date;
}

export interface WaybillResult {
  pngPath: string;
  pdfPath: string;
  pngUrl: string;
  pdfUrl: string;
}

export class WaybillService {
  private static storageDir = path.resolve(__dirname, '../../storage/waybills');

  public static initializeStorage() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Generates a branded shipping waybill as PNG screenshot and PDF document.
   */
  public static async generateWaybill(data: WaybillData): Promise<WaybillResult> {
    this.initializeStorage();
    LoggerService.info('WAYBILL_SERVICE', `Generating waybill for order #${data.orderId} (Wuilt: ${data.wuiltOrderId})`);

    const filenameBase = `waybill_${data.wuiltOrderId}_${Date.now()}`;
    const pngPath = path.join(this.storageDir, `${filenameBase}.png`);
    const pdfPath = path.join(this.storageDir, `${filenameBase}.pdf`);

    // Generate QR code base64
    const qrData = `ORDER:${data.wuiltOrderId}|TEL:${data.customerPhone}|COD:${data.remainingTotal}EGP`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, { width: 140, margin: 1 });

    const htmlContent = this.generateWaybillHtml(data, qrCodeDataUrl);

    let browser;
    try {
      const launchOptions: any = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
      };
      if (config.puppeteerExecutablePath) {
        launchOptions.executablePath = config.puppeteerExecutablePath;
      }
      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 }); // A4 high-res
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // 1. Render PNG screenshot (targeting waybill container)
      const element = await page.$('#waybill-container');
      if (element) {
        await element.screenshot({ path: pngPath });
      } else {
        await page.screenshot({ path: pngPath, fullPage: true });
      }

      // 2. Render PDF document
      await page.pdf({
        path: pdfPath,
        format: 'A5',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });

      const pngUrl = `${config.publicServerUrl}/storage/waybills/${path.basename(pngPath)}`;
      const pdfUrl = `${config.publicServerUrl}/storage/waybills/${path.basename(pdfPath)}`;

      LoggerService.info('WAYBILL_SERVICE', `Waybill generated: PNG=${pngPath}, PDF=${pdfPath}`);

      return {
        pngPath,
        pdfPath,
        pngUrl,
        pdfUrl,
      };
    } catch (error: any) {
      LoggerService.error('WAYBILL_SERVICE', `Failed to generate waybill for order ${data.orderId}`, error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private static generateWaybillHtml(data: WaybillData, qrCodeDataUrl: string): string {
    const formattedDate = new Date(data.createdAt).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsRows = data.items.map((item, idx) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: 600;">${(item.price * item.quantity).toFixed(2)} ج.م</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>بوليصة شحن - طلب #${data.wuiltOrderId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', 'Noto Sans Arabic', 'KacstOne', 'Segoe UI', Tahoma, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      display: flex;
      justify-content: center;
      padding: 20px;
      direction: rtl;
    }
    #waybill-container {
      width: 750px;
      background: #ffffff;
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 28px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px dashed #cbd5e1;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .logo-badge {
      font-size: 26px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .logo-badge span { color: #3b82f6; }
    .header-order-info {
      text-align: left;
      direction: ltr;
    }
    .order-number {
      font-size: 20px;
      font-weight: 800;
      color: #1e293b;
    }
    .order-date {
      font-size: 12px;
      color: #64748b;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      background: #f8fafc;
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .card-content {
      font-size: 14px;
      line-height: 1.6;
      color: #1e293b;
    }
    .highlight {
      font-weight: 700;
      font-size: 16px;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 13px;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      padding: 10px;
      text-align: right;
      font-weight: 700;
      border-bottom: 2px solid #cbd5e1;
    }
    .financials {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      align-items: center;
      border-top: 2px dashed #cbd5e1;
      padding-top: 18px;
    }
    .financial-box {
      background: #eff6ff;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 14px;
      text-align: center;
    }
    .cod-label {
      font-size: 14px;
      font-weight: 700;
      color: #1e40af;
    }
    .cod-amount {
      font-size: 28px;
      font-weight: 900;
      color: #1d4ed8;
      margin: 4px 0;
    }
    .deposit-badge {
      font-size: 13px;
      color: #059669;
      font-weight: 700;
    }
    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .qr-container img {
      width: 120px;
      height: 120px;
    }
    .footer {
      margin-top: 16px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <div id="waybill-container">
    <div class="header">
      <div class="logo-badge">PRIME<span>EXPRESS</span></div>
      <div class="header-order-info">
        <div class="order-number">#${data.wuiltOrderId}</div>
        <div class="order-date">${formattedDate}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">بيانات العميل والتوصيل</div>
        <div class="card-content">
          <div class="highlight">${data.customerName}</div>
          <div style="direction: ltr; text-align: right; font-weight: 700; color: #2563eb;">📞 ${data.customerPhone}</div>
          <div style="margin-top: 4px;">📍 ${data.shippingAddress || 'القاهرة - مصر'}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">بيانات الشحن والمتجر</div>
        <div class="card-content">
          <div class="highlight">متجر برايم أوتو (Wuilt Store)</div>
          <div>خدمة الشحن السريع داخل محافظات مصر</div>
          <div style="color: #059669; font-weight: 700; margin-top: 4px;">✓ تم التحقق من العربون بنجاح</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th>المنتج</th>
          <th style="width: 80px; text-align: center;">الكمية</th>
          <th style="width: 110px; text-align: left;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="financials">
      <div class="financial-box">
        <div class="cod-label">المبلغ المطلوب تحصيله عند الاستلام (COD)</div>
        <div class="cod-amount">${data.remainingTotal.toFixed(2)} ج.م</div>
        <div class="deposit-badge">تم سداد عربون مسبق: ${data.depositPaid.toFixed(2)} ج.م (إجمالي الطلب: ${data.orderTotal.toFixed(2)} ج.م)</div>
      </div>
      <div class="qr-container">
        <img src="${qrCodeDataUrl}" alt="Order QR Code" />
        <span style="font-size: 10px; color: #64748b; margin-top: 4px;">امسح لتتبع الشحنة</span>
      </div>
    </div>

    <div class="footer">
      تم إنشاء هذه البوليصة آلياً عبر نظام PRIME AUTO BOT - التحقق الذاتي من المدفوعات والشحن
    </div>
  </div>
</body>
</html>
    `;
  }
}
