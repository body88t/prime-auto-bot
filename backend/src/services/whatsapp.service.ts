let _baileys: any = null;
async function getBaileys(): Promise<any> {
  if (!_baileys) {
    const dynamicImport = new Function('m', 'return import(m)');
    _baileys = await dynamicImport('@whiskeysockets/baileys');
  }
  return _baileys;
}
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import { LoggerService } from './logger.service';
import { MESSAGES, ORDER_STATUS, STORE_CONFIG } from '../utils/constants';
import { prisma } from '../prisma/client';
import { WuiltService } from './wuilt.service';
import { VisionService } from './vision.service';
import { MatchingEngine } from './matching.service';
import { broadcastDashboardEvent } from '../controllers/dashboard.controller';
import { usePrismaAuthState } from './baileys-prisma-auth.service';

export type WhatsAppConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED';

export class WhatsAppService {
  private static sock: any = null;
  private static status: WhatsAppConnectionStatus = 'DISCONNECTED';
  private static qrCodeText: string | null = null;
  private static qrCodeDataUrl: string | null = null;
  private static connectedPhoneNumber: string | null = null;
  private static authDir = path.resolve(__dirname, '../../storage/baileys_auth');
  private static receiptsDir = path.resolve(__dirname, '../../storage/receipts');
  private static isInitializing = false;

  public static getStatus() {
    return {
      status: this.status,
      connectedPhoneNumber: this.connectedPhoneNumber,
      qrCodeDataUrl: this.qrCodeDataUrl,
      qrCodeText: this.qrCodeText,
    };
  }

  /**
   * Initializes Baileys WhatsApp client with permanent local auth credentials.
   */
  public static async initialize() {
    if (this.isInitializing || (this.sock && this.status === 'CONNECTED')) {
      return;
    }
    this.isInitializing = true;

    // Ensure storage folders exist
    if (!fs.existsSync(this.authDir)) fs.mkdirSync(this.authDir, { recursive: true });
    if (!fs.existsSync(this.receiptsDir)) fs.mkdirSync(this.receiptsDir, { recursive: true });

    try {
      this.status = 'CONNECTING';
      broadcastDashboardEvent('WHATSAPP_STATUS', { status: this.status });

      const baileys = await getBaileys();
      const makeWASocket = baileys.default || baileys.makeWASocket;
      const { state, saveCreds, clearAuthState } = await usePrismaAuthState();
      const { version } = await baileys.fetchLatestBaileysVersion();
      const DisconnectReason = baileys.DisconnectReason;

      LoggerService.info('WHATSAPP_BAILEYS', `Starting Baileys WA Engine (v${version.join('.')})...`);

      const socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['Prime Auto Bot', 'Chrome', '1.0.0'],
        syncFullHistory: false,
      });

      this.sock = socket;

      // Listen for credentials updates (saves session persistently)
      socket.ev.on('creds.update', saveCreds);

      // Connection updates (QR code generation, connection open/close)
      socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCodeText = qr;
          this.status = 'SCAN_QR';
          LoggerService.info('WHATSAPP_BAILEYS', '⚡ New WhatsApp QR Code generated. Scan with Linked Devices:');

          // 1. Print QR in Terminal
          qrcodeTerminal.generate(qr, { small: true });

          // 2. Generate Base64 Data URL for Desktop Dashboard
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
          } catch (e) {
            this.qrCodeDataUrl = null;
          }

          broadcastDashboardEvent('WHATSAPP_QR', {
            status: this.status,
            qrCodeDataUrl: this.qrCodeDataUrl,
            qrCodeText: this.qrCodeText,
          });
        }

        if (connection === 'close') {
          const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = reason !== DisconnectReason.loggedOut;
          this.status = 'DISCONNECTED';
          this.connectedPhoneNumber = null;
          this.qrCodeDataUrl = null;
          this.qrCodeText = null;

          LoggerService.warn('WHATSAPP_BAILEYS', `Connection closed. Reason code: ${reason}. Will reconnect: ${shouldReconnect}`);
          broadcastDashboardEvent('WHATSAPP_STATUS', { status: this.status });

          if (shouldReconnect) {
            this.isInitializing = false;
            setTimeout(() => this.initialize(), 4000);
          } else {
            LoggerService.warn('WHATSAPP_BAILEYS', 'Logged out from WhatsApp. Resetting session credentials.');
            try {
              await clearAuthState();
              fs.rmSync(this.authDir, { recursive: true, force: true });
            } catch {}
            this.isInitializing = false;
            setTimeout(() => this.initialize(), 2000);
          }
        } else if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrCodeDataUrl = null;
          this.qrCodeText = null;

          const userJid = socket.user?.id || '';
          this.connectedPhoneNumber = userJid.split(':')[0] || userJid.split('@')[0];

          LoggerService.info('WHATSAPP_BAILEYS', `✅ WhatsApp connected successfully! Active number: ${this.connectedPhoneNumber}`);
          broadcastDashboardEvent('WHATSAPP_STATUS', {
            status: this.status,
            connectedPhoneNumber: this.connectedPhoneNumber,
          });
        }
      });

      // Listen for incoming customer messages & replies
      socket.ev.on('messages.upsert', async (m: any) => {
        if (m.type !== 'notify') return;
        for (const msg of m.messages) {
          if (!msg.key.fromMe) {
            await this.handleIncomingMessage(msg);
          }
        }
      });
    } catch (error: any) {
      this.status = 'DISCONNECTED';
      LoggerService.error('WHATSAPP_BAILEYS', `Failed to initialize Baileys WA Engine: ${error.message}`);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Processes inbound messages from customers:
   * - Reply "2" or "٢" -> Cancel active order
   * - Reply "1" or "١" -> Send instructions acknowledgement
   * - Image message -> Receipt OCR & payment verification
   */
  private static async handleIncomingMessage(msg: any) {
    const senderJid = msg.key?.remoteJid;
    if (!senderJid || senderJid.endsWith('@g.us') || senderJid.includes('@broadcast') || !msg.message) {
      return; // Ignore group chats, broadcast status, or messages without content
    }

    // Extract text body
    const textBody = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      ''
    ).trim();

    if (!textBody && !msg.message?.imageMessage) {
      return; // Ignore read receipts or reaction/protocol notifications
    }

    const rawPhone = senderJid.split('@')[0];
    const normalizedPhone = this.normalizePhoneNumber(rawPhone);

    LoggerService.info('WHATSAPP_BOT', `Inbound WhatsApp message from ${normalizedPhone}: "${textBody}"`);

    // 1. Check for cancellation request ("2" or "٢")
    if (textBody === '2' || textBody === '٢' || textBody.toLowerCase() === 'الغاء' || textBody.toLowerCase() === 'إلغاء') {
      await this.handleCustomerCancellation(normalizedPhone);
      return;
    }

    // 2. Check for confirmation request ("1" or "١")
    if (textBody === '1' || textBody === '١' || textBody.toLowerCase() === 'تأكيد' || textBody.toLowerCase() === 'تاكيد') {
      await this.sendTextMessage(normalizedPhone, MESSAGES.ORDER_CONFIRM_INTENT_REPLY());
      return;
    }

    // 3. Check for receipt image upload
    if (msg.message?.imageMessage) {
      await this.handleReceiptUpload(normalizedPhone, msg);
      return;
    }
  }

  /**
   * Handles customer cancellation when replying with "2".
   */
  public static async handleCustomerCancellation(customerPhone: string) {
    LoggerService.info('WHATSAPP_BOT', `Customer ${customerPhone} requested order cancellation (replied with 2)`);

    const order = await prisma.order.findFirst({
      where: {
        customerPhone: { contains: customerPhone.slice(-9) },
        status: { in: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PARTIAL_DEPOSIT, ORDER_STATUS.FAILED_VERIFICATION] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      await this.sendTextMessage(
        customerPhone,
        'لم يتم العثور على طلب معلق نشط مرتبط برقم هاتفك لإلغائه. إذا كنت بحاجة لمساعدة، يُرجى التواصل مع خدمة العملاء: 01019930974.'
      );
      return;
    }

    // Mark as CANCELLED in DB
    await prisma.order.update({
      where: { id: order.id },
      data: { status: ORDER_STATUS.CANCELLED, notes: 'Cancelled automatically by customer via WhatsApp (replied 2).' },
    });

    // Update status in Wuilt
    await WuiltService.updateOrderPayment(order.wuiltOrderId, 0, 0, ORDER_STATUS.CANCELLED);

    // Send confirmation to customer
    await this.sendTextMessage(customerPhone, MESSAGES.ORDER_CANCELLED_CONFIRMATION(order.wuiltOrderId));

    // Broadcast update to Desktop Dashboard
    broadcastDashboardEvent('ORDER_UPDATED', {
      orderId: order.id,
      wuiltOrderId: order.wuiltOrderId,
      status: ORDER_STATUS.CANCELLED,
    });

    LoggerService.info('WHATSAPP_BOT', `Order #${order.wuiltOrderId} cancelled successfully by customer.`);
  }

  /**
   * Handles incoming receipt screenshot from WhatsApp.
   */
  public static async handleReceiptUpload(customerPhone: string, msg: any) {
    console.log(`\n================== [RECEIPT UPLOAD DETECTED] ==================`);
    console.log(`[RECEIPT] Received receipt image from: ${customerPhone}`);
    LoggerService.info('WHATSAPP_BOT', `Downloading receipt image from ${customerPhone}...`);

    try {
      // Find active pending order
      const order = await prisma.order.findFirst({
        where: {
          customerPhone: { contains: customerPhone.slice(-9) },
          status: { in: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PARTIAL_DEPOSIT, ORDER_STATUS.FAILED_VERIFICATION, ORDER_STATUS.MANUAL_REVIEW_REQUIRED] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!order) {
        console.warn(`[RECEIPT] No pending order found for customer phone: ${customerPhone}`);
        await this.sendTextMessage(
          customerPhone,
          'شكراً لإرسال الإيصال. لم نتمكن من العثور على طلب معلق مرتبط برقم هاتفك. يُرجى إنشاء طلب عبر المتجر أولاً أو التواصل مع خدمة العملاء: 01019930974.'
        );
        return;
      }

      console.log(`[RECEIPT] Linked to Order #${order.wuiltOrderId} (ID: ${order.id}) | Current Status: ${order.status}`);

      // Download image buffer directly from Baileys
      const baileys = await getBaileys();
      const buffer = await baileys.downloadMediaMessage(msg as any, 'buffer', {}) as Buffer;
      const filename = `receipt_${order.wuiltOrderId}_${Date.now()}.jpg`;
      const localPath = path.join(this.receiptsDir, filename);
      fs.writeFileSync(localPath, buffer);

      const publicImageUrl = `http://localhost:3000/storage/receipts/${filename}`;
      console.log(`[RECEIPT] Saved image locally at: ${localPath}`);

      // Vision OCR
      console.log(`[RECEIPT] Running Vision OCR on receipt...`);
      const visionResult = await VisionService.parseReceiptImage(localPath);
      console.log(`[RECEIPT OCR RESULT]: Amount=${visionResult.amount} EGP, Ref=${visionResult.reference_id}, Wallet=${visionResult.wallet_provider}`);

      // Reconcile and match against bank SMS
      console.log(`[RECEIPT] Handing over to MatchingEngine for Order #${order.wuiltOrderId}...`);
      const matchOutcome = await MatchingEngine.processReceiptScan(order.id, publicImageUrl, visionResult);
      console.log(`[RECEIPT MATCH OUTCOME]: Status=${matchOutcome.status}, Matched=${matchOutcome.matched}, Msg="${matchOutcome.message}"`);
      console.log(`=================================================================\n`);
    } catch (e: any) {
      console.error(`[RECEIPT ERROR] Failed to process receipt: ${e.message}`, e);
      LoggerService.error('WHATSAPP_BOT', `Failed to process incoming receipt from ${customerPhone}: ${e.message}`);
    }
  }

  /**
   * Sends a plain WhatsApp text message to customer.
   */
  public static async sendTextMessage(toPhone: string, message: string): Promise<boolean> {
    const recipientJid = this.formatWhatsAppJid(toPhone);
    if (!recipientJid) {
      LoggerService.warn('WHATSAPP_BOT', `Cannot send message: invalid phone number "${toPhone}"`);
      return false;
    }
    LoggerService.info('WHATSAPP_BOT', `Sending text message to ${recipientJid}`);

    if (!this.sock || this.status !== 'CONNECTED') {
      LoggerService.warn('WHATSAPP_BOT', `WhatsApp not connected. Message queued/simulated: "${message.substring(0, 50)}..."`);
      return false;
    }

    try {
      await this.sock.sendMessage(recipientJid, { text: message });
      return true;
    } catch (error: any) {
      LoggerService.error('WHATSAPP_BOT', `Error sending message to ${recipientJid}: ${error.message}`);
      return false;
    }
  }

  /**
   * Sends an image message (e.g. shipping waybill screenshot) to customer.
   */
  public static async sendImageMessage(toPhone: string, imagePath: string, caption?: string): Promise<boolean> {
    const recipientJid = this.formatWhatsAppJid(toPhone);
    if (!recipientJid) {
      LoggerService.warn('WHATSAPP_BOT', `Cannot send image: invalid phone number "${toPhone}"`);
      return false;
    }
    LoggerService.info('WHATSAPP_BOT', `Sending image to ${recipientJid}: ${imagePath}`);

    if (!this.sock || this.status !== 'CONNECTED') {
      LoggerService.warn('WHATSAPP_BOT', `WhatsApp not connected. Image sending simulated.`);
      return false;
    }

    try {
      const buffer = fs.readFileSync(imagePath);
      await this.sock.sendMessage(recipientJid, {
        image: buffer,
        caption: caption || '',
        mimetype: 'image/png',
      });
      return true;
    } catch (error: any) {
      LoggerService.error('WHATSAPP_BOT', `Error sending image to ${recipientJid}: ${error.message}`);
      return false;
    }
  }

  /**
   * Sends a document (e.g. PDF waybill) to a recipient or group.
   */
  public static async sendDocumentMessage(
    targetJidOrPhone: string,
    documentPath: string,
    filename: string,
    caption?: string
  ): Promise<boolean> {
    const targetJid = targetJidOrPhone.endsWith('@g.us')
      ? targetJidOrPhone
      : this.formatWhatsAppJid(targetJidOrPhone);

    if (!targetJid) {
      LoggerService.warn('WHATSAPP_BOT', `Cannot send document: invalid target "${targetJidOrPhone}"`);
      return false;
    }

    LoggerService.info('WHATSAPP_BOT', `Sending document ${filename} to ${targetJid}`);

    if (!this.sock || this.status !== 'CONNECTED') {
      LoggerService.warn('WHATSAPP_BOT', `WhatsApp not connected. Document sending simulated.`);
      return false;
    }

    try {
      const buffer = fs.readFileSync(documentPath);
      await this.sock.sendMessage(targetJid, {
        document: buffer,
        fileName: filename,
        mimetype: 'application/pdf',
        caption: caption || '',
      });
      return true;
    } catch (error: any) {
      LoggerService.error('WHATSAPP_BOT', `Error sending document to ${targetJid}: ${error.message}`);
      return false;
    }
  }

  /**
   * Sends order waybill PDF and item summary to the Store Branch Group ("المحل 🏃‍♂️").
   */
  public static async sendToBranchGroup(pdfPath: string, filename: string, caption: string): Promise<boolean> {
    const groupName = STORE_CONFIG.BRANCH_GROUP_NAME;
    LoggerService.info('WHATSAPP_BOT', `Looking up Store Branch group: "${groupName}"...`);

    if (!this.sock || this.status !== 'CONNECTED') {
      LoggerService.warn('WHATSAPP_BOT', `WhatsApp not connected. Branch notification simulated.`);
      return false;
    }

    try {
      // Find group JID by name
      const groupJid = await this.findGroupJidByName(groupName);
      if (!groupJid) {
        LoggerService.warn('WHATSAPP_BOT', `Group "${groupName}" not found in your linked WhatsApp chats. Ensure group exists.`);
        return false;
      }

      return await this.sendDocumentMessage(groupJid, pdfPath, filename, caption);
    } catch (e: any) {
      LoggerService.error('WHATSAPP_BOT', `Failed to send to branch group: ${e.message}`);
      return false;
    }
  }

  /**
   * Searches participating WhatsApp groups by subject name.
   */
  public static async findGroupJidByName(name: string): Promise<string | null> {
    if (!this.sock) return null;
    try {
      const groups = await this.sock.groupFetchAllParticipating();
      for (const [jid, metadata] of Object.entries(groups as Record<string, any>)) {
        if (metadata.subject && metadata.subject.trim() === name.trim()) {
          return jid;
        }
      }
      // Fuzzy fallback
      for (const [jid, metadata] of Object.entries(groups as Record<string, any>)) {
        if (metadata.subject && (metadata.subject.includes(name) || name.includes(metadata.subject))) {
          return jid;
        }
      }
      return null;
    } catch (e: any) {
      LoggerService.warn('WHATSAPP_BOT', `Could not fetch participating groups: ${e.message}`);
      return null;
    }
  }

  /**
   * Cleans and sanitizes raw phone number and returns a valid Baileys JID without '+'.
   * 1. تحويل الأرقام العربية المشرقية إن وجدت إلى أرقام إنجليزية
   * 2. إزالة علامة + والمسافات والشرطات وأي رموز غير رقمية
   * 3. إذا كان يبدأ بـ 01 (رقم محلي)، أضف كود مصر 20
   * 4. إرجاع الـ JID الصالح لـ Baileys
   */
  public static formatWhatsAppJid(rawPhone: string): string {
    if (!rawPhone) return "";
    if (rawPhone.endsWith('@g.us')) return rawPhone;
    if (rawPhone.endsWith('@s.whatsapp.net')) {
      rawPhone = rawPhone.replace('@s.whatsapp.net', '');
    }
    // 1. تحويل الأرقام العربية المشرقية إن وجدت إلى أرقام إنجليزية
    let phone = rawPhone.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    // 2. إزالة علامة + والمسافات والشرطات وأي رموز غير رقمية
    phone = phone.replace(/\D/g, "");
    // 3. إذا كان يبدأ بـ 01 (رقم محلي)، أضف كود مصر 20
    if (phone.startsWith("01")) {
      phone = "20" + phone.slice(1);
    }
    // 4. إرجاع الـ JID الصالح لـ Baileys
    return `${phone}@s.whatsapp.net`;
  }

  /**
   * Normalizes Egyptian and international phone numbers into clean E.164 digits without plus or symbols.
   */
  public static normalizePhoneNumber(rawPhone: string): string {
    if (!rawPhone) return "";
    let phone = rawPhone.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    phone = phone.replace(/\D/g, "");
    if (phone.startsWith("01")) {
      phone = "20" + phone.slice(1);
    }
    return phone;
  }

  /**
   * Helper: formats items list for template {order_items_formatted}.
   */
  public static formatOrderItems(items: any[]): string {
    if (!items || !Array.isArray(items) || items.length === 0) return '• منتجات الطلب';
    return items
      .map((item) => {
        if (typeof item === 'string') {
          try {
            item = JSON.parse(item);
          } catch {
            return `• ${item}`;
          }
        }
        const name = item.name || item.title || item.product_name || item.productTitle || 'منتج';
        const quantity = Number(item.quantity || item.count || item.qty || 1);
        const price = Number(item.price ?? item.unit_price ?? item.total_price ?? item.amount ?? 0);
        return price > 0
          ? `• ${quantity} × ${name} (${price} ج.م)`
          : `• ${quantity} × ${name}`;
      })
      .join('\n');
  }

  /**
   * Helper: formats current order date in Arabic locale.
   */
  public static formatOrderDateTime(date: Date = new Date()): string {
    try {
      return date.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date.toISOString();
    }
  }
}

export function formatWhatsAppJid(rawPhone: string): string {
  return WhatsAppService.formatWhatsAppJid(rawPhone);
}
