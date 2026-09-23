import path from 'path';
import { prisma } from '../prisma/client';
import { config } from '../config/env';
import { isSenderWhitelisted } from '../utils/sms-parser.util';
import { MESSAGES, ORDER_STATUS, RECEIPT_STATUS } from '../utils/constants';
import { WhatsAppService } from './whatsapp.service';
import { WuiltService } from './wuilt.service';
import { WaybillService } from './waybill.service';
import { WuiltAutomationService } from './wuilt-automation.service';
import { VisionReceiptResult } from './vision.service';
import { LoggerService } from './logger.service';

export interface MatchingResult {
  matched: boolean;
  orderId: string;
  smsId?: string;
  scanId?: string;
  status: string;
  verifiedAmount?: number;
  message: string;
  waybillUrls?: { png: string; pdf: string };
}

export class MatchingEngine {
  /**
   * Processes a newly scanned receipt image for an order and reconciles it against IncomingSms.
   */
  public static async processReceiptScan(
    orderId: string,
    imageUrl: string,
    visionResult: VisionReceiptResult
  ): Promise<MatchingResult> {
    LoggerService.info('MATCHING_ENGINE', `Starting dual-verification for order ${orderId}`, {
      detectedAmount: visionResult.amount,
      detectedRef: visionResult.reference_id,
      provider: visionResult.wallet_provider,
    });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new Error(`Order ${orderId} does not exist`);
    }

    // 1. Create ReceiptScan record
    const receiptScan = await prisma.receiptScan.create({
      data: {
        orderId: order.id,
        imageUrl,
        detectedAmount: visionResult.amount,
        detectedRefId: visionResult.reference_id,
        detectedDate: visionResult.transaction_date,
        detectedWallet: visionResult.wallet_provider,
        confidenceScore: visionResult.confidenceScore,
        status: RECEIPT_STATUS.PENDING,
        rawVisionResponse: visionResult.rawResponse || null,
      },
    });

    // 2. Search unconsumed SMS in database
    // Rule: isConsumed == false AND (referenceId == detectedRefId OR (amount == detectedAmount AND within 30 min window))
    const windowMinutes = config.matchingWindowMinutes;
    const windowStartTime = new Date(order.createdAt.getTime() - windowMinutes * 60 * 1000);
    const windowEndTime = new Date(order.createdAt.getTime() + windowMinutes * 60 * 1000);

    // Fetch unconsumed SMS
    const candidateSmsList = await prisma.incomingSms.findMany({
      where: {
        isConsumed: false,
      },
      orderBy: { receivedAt: 'desc' },
    });

    let matchedSms: (typeof candidateSmsList)[0] | null = null;

    for (const sms of candidateSmsList) {
      // Validate sender whitelist
      if (!isSenderWhitelisted(sms.sender)) {
        continue;
      }

      // Check Criteria 1: Exact reference match
      const hasRefMatch =
        sms.referenceId &&
        visionResult.reference_id &&
        sms.referenceId.trim().toLowerCase() === visionResult.reference_id.trim().toLowerCase();

      // Check Criteria 2: Amount match within 30-minute window of order
      const hasAmountWindowMatch =
        Math.abs(sms.amount - visionResult.amount) < 0.01 &&
        sms.receivedAt >= windowStartTime &&
        sms.receivedAt <= windowEndTime;

      if (hasRefMatch || hasAmountWindowMatch) {
        matchedSms = sms;
        LoggerService.info('MATCHING_ENGINE', `Found matching SMS #${sms.id}: refMatch=${!!hasRefMatch}, amountWindowMatch=${!!hasAmountWindowMatch}`);
        break;
      }
    }

    // 3. If no match found:
    if (!matchedSms) {
      LoggerService.warn('MATCHING_ENGINE', `No matching SMS found for order #${order.wuiltOrderId} (ID: ${order.id}). Applying security fallback.`);

      const threshold = config.depositThresholdEgp; // 190 EGP
      const targetDeposit = config.targetDepositEgp; // 200 EGP

      if (visionResult.amount < threshold) {
        // Fallback Case A: Amount is LESS than 190 EGP (< 190 EGP)
        // Customer transferred partial amount or OCR read low amount -> Send PARTIAL_DEPOSIT_ALERT immediately without waiting for SMS
        console.log(`[MATCHING_ENGINE] OCR amount (${visionResult.amount} EGP) is below threshold (${threshold} EGP) without SMS match. Sending partial deposit alert.`);
        
        const remainingDeposit = Math.max(0, targetDeposit - visionResult.amount);
        const newDepositPaid = (order.depositPaid || 0) + visionResult.amount;
        const newRemainingTotal = Math.max(0, order.orderTotal - newDepositPaid);

        await prisma.$transaction(async (tx) => {
          await tx.receiptScan.update({
            where: { id: receiptScan.id },
            data: { status: RECEIPT_STATUS.LOW_DEPOSIT },
          });
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: ORDER_STATUS.PARTIAL_DEPOSIT,
              depositPaid: newDepositPaid,
              remainingTotal: newRemainingTotal,
              notes: `Partial deposit detected via OCR: ${visionResult.amount} EGP. No bank SMS matched yet.`,
            },
          });
        });

        // Send WhatsApp alert to customer
        const alertMsg = MESSAGES.PARTIAL_DEPOSIT_ALERT(order.customerName, visionResult.amount, remainingDeposit);
        await WhatsAppService.sendTextMessage(order.customerPhone, alertMsg);

        return {
          matched: false,
          orderId: order.id,
          scanId: receiptScan.id,
          status: ORDER_STATUS.PARTIAL_DEPOSIT,
          verifiedAmount: visionResult.amount,
          message: `Partial deposit (${visionResult.amount} EGP) detected without SMS. Notified customer to complete remaining ${remainingDeposit} EGP.`,
        };
      } else {
        // Fallback Case B: Amount is GREATER OR EQUAL to 190 EGP (>= 190 EGP) but no SMS matched yet
        // Security rule: Do NOT automatically confirm (prevent fraudulent receipts).
        // Send reassurance message, set status to MANUAL_REVIEW_REQUIRED, and alert Desktop Dashboard.
        console.log(`[MATCHING_ENGINE] OCR amount (${visionResult.amount} EGP) >= threshold (${threshold} EGP) but no matching SMS yet. Setting MANUAL_REVIEW_REQUIRED and sending reassurance.`);

        await prisma.$transaction(async (tx) => {
          await tx.receiptScan.update({
            where: { id: receiptScan.id },
            data: { status: RECEIPT_STATUS.PENDING },
          });
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: ORDER_STATUS.MANUAL_REVIEW_REQUIRED,
              notes: `Receipt uploaded with ${visionResult.amount} EGP (Ref: ${visionResult.reference_id || 'N/A'}). Awaiting SMS arrival or manual dashboard verification.`,
            },
          });
        });

        // Send reassurance message to customer
        await WhatsAppService.sendTextMessage(order.customerPhone, MESSAGES.RECEIPT_UNDER_REVIEW());

        return {
          matched: false,
          orderId: order.id,
          scanId: receiptScan.id,
          status: ORDER_STATUS.MANUAL_REVIEW_REQUIRED,
          verifiedAmount: visionResult.amount,
          message: 'Receipt received with valid amount, but bank SMS not yet arrived. Set to MANUAL_REVIEW_REQUIRED and customer notified.',
        };
      }
    }

    // 4. Match found: Execute Financial Validation & Deposit Threshold Rule
    return await this.executeFinancialVerification(order.id, matchedSms.id, receiptScan.id, visionResult.amount);
  }

  /**
   * Applies financial rules (< 190 EGP vs >= 190 EGP) and dispatches waybills/WhatsApp.
   */
  public static async executeFinancialVerification(
    orderId: string,
    smsId: string | null,
    scanId: string | null,
    verifiedAmount: number
  ): Promise<MatchingResult> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error(`Order ${orderId} not found`);

    const threshold = config.depositThresholdEgp; // 190 EGP
    const targetDeposit = config.targetDepositEgp; // 200 EGP

    // Case 1: Verified amount is LESS than 190 EGP (Partial Deposit)
    if (verifiedAmount < threshold) {
      LoggerService.info('MATCHING_ENGINE', `Amount ${verifiedAmount} EGP is less than threshold (${threshold} EGP). Marking PARTIAL_DEPOSIT.`);

      const remainingDeposit = Math.max(0, targetDeposit - verifiedAmount);
      const newDepositPaid = (order.depositPaid || 0) + verifiedAmount;
      const newRemainingTotal = Math.max(0, order.orderTotal - newDepositPaid);

      // Update Order & Scan status
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: ORDER_STATUS.PARTIAL_DEPOSIT,
            depositPaid: newDepositPaid,
            remainingTotal: newRemainingTotal,
          },
        });

        if (scanId) {
          await tx.receiptScan.update({
            where: { id: scanId },
            data: {
              status: RECEIPT_STATUS.LOW_DEPOSIT,
              matchedSmsId: smsId,
            },
          });
        }

        // If an SMS was matched, mark it consumed to avoid double crediting
        if (smsId) {
          await tx.incomingSms.update({
            where: { id: smsId },
            data: {
              isConsumed: true,
              consumedByOrderId: order.id,
            },
          });
        }
      });

      // Send WhatsApp notification to customer with exact SPEC wording
      const alertMsg = MESSAGES.PARTIAL_DEPOSIT_ALERT(order.customerName, verifiedAmount, remainingDeposit);
      await WhatsAppService.sendTextMessage(order.customerPhone, alertMsg);

      // HALT PIPELINE: Do NOT generate waybill, do NOT confirm on Wuilt, do NOT notify branch group.
      LoggerService.info('MATCHING_ENGINE', `Pipeline halted for order ${order.id} due to partial deposit (${verifiedAmount} EGP).`);

      return {
        matched: true,
        orderId: order.id,
        smsId: smsId || undefined,
        scanId: scanId || undefined,
        status: ORDER_STATUS.PARTIAL_DEPOSIT,
        verifiedAmount,
        message: `Partial deposit of ${verifiedAmount} EGP recorded. Customer notified of remaining ${remainingDeposit} EGP.`,
      };
    }

    // Case 2: Verified amount is GREATER OR EQUAL to 190 EGP (Full Confirmation)
    LoggerService.info('MATCHING_ENGINE', `Amount ${verifiedAmount} EGP satisfies threshold (${threshold} EGP). Confirming order.`);

    const newDepositPaid = (order.depositPaid || 0) + verifiedAmount;
    const newRemainingTotal = Math.max(0, order.orderTotal - newDepositPaid);

    // Atomic transaction: mark SMS as consumed and update order status
    await prisma.$transaction(async (tx) => {
      if (smsId) {
        await tx.incomingSms.update({
          where: { id: smsId },
          data: {
            isConsumed: true,
            consumedByOrderId: order.id,
          },
        });
      }

      if (scanId) {
        await tx.receiptScan.update({
          where: { id: scanId },
          data: {
            status: RECEIPT_STATUS.MATCHED,
            matchedSmsId: smsId,
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: ORDER_STATUS.CONFIRMED,
          depositPaid: newDepositPaid,
          remainingTotal: newRemainingTotal,
        },
      });
    });

    // Deduct paid deposit via Wuilt API
    await WuiltService.updateOrderPayment(order.wuiltOrderId, newDepositPaid, newRemainingTotal, ORDER_STATUS.CONFIRMED);

    // Generate Shipping Waybill (PNG screenshot + PDF) via Puppeteer
    let parsedItems = [];
    try {
      parsedItems = order.itemsJson ? JSON.parse(order.itemsJson) : [{ name: 'طلب متجر برايم', quantity: 1, price: order.orderTotal }];
    } catch {
      parsedItems = [{ name: 'طلب متجر برايم', quantity: 1, price: order.orderTotal }];
    }

    let waybillResult: { pngPath: string; pdfPath: string; pngUrl: string; pdfUrl: string } | null = null;
    try {
      // 1. Automate Wuilt Aramex Airway Bill creation at 2:00 PM (excluding Friday & Sunday)
      LoggerService.info('MATCHING_ENGINE', `Requesting official Aramex Waybill via Wuilt automation for #${order.wuiltOrderId}...`);
      const wuiltResult = await WuiltAutomationService.processOrderAirwayBill({
        wuiltOrderId: order.wuiltOrderId,
        depositPaid: newDepositPaid,
        remainingTotal: newRemainingTotal,
      });

      if (wuiltResult.success && wuiltResult.pngPath && wuiltResult.pdfPath) {
        const pngUrl = `${config.publicServerUrl}/storage/waybills/${path.basename(wuiltResult.pngPath)}`;
        const pdfUrl = `${config.publicServerUrl}/storage/waybills/${path.basename(wuiltResult.pdfPath)}`;
        waybillResult = {
          pngPath: wuiltResult.pngPath,
          pdfPath: wuiltResult.pdfPath,
          pngUrl,
          pdfUrl,
        };

        await prisma.order.update({
          where: { id: order.id },
          data: {
            waybillUrl: pngUrl,
            waybillPdfUrl: pdfUrl,
          },
        });
        LoggerService.info('MATCHING_ENGINE', `Official Aramex Waybill successfully processed for #${order.wuiltOrderId}`);
      } else {
        LoggerService.warn('MATCHING_ENGINE', `Wuilt automation warning: ${wuiltResult.error}. Falling back to internal waybill.`);
        // Fallback to internal WaybillService if browser automation was unavailable
        waybillResult = await WaybillService.generateWaybill({
          orderId: order.id,
          wuiltOrderId: order.wuiltOrderId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          shippingAddress: order.shippingAddress || 'القاهرة - مصر',
          items: parsedItems,
          orderTotal: order.orderTotal,
          depositPaid: newDepositPaid,
          remainingTotal: newRemainingTotal,
          createdAt: order.createdAt,
        });
      }
    } catch (e: any) {
      LoggerService.error('MATCHING_ENGINE', `Waybill generation failed for order ${order.id}: ${e.message}`);
    }

    // Send WhatsApp confirmation to the customer with exact wording and waybill screenshot
    const confirmMsg = MESSAGES.ORDER_CONFIRMED();
    if (waybillResult) {
      await WhatsAppService.sendImageMessage(order.customerPhone, waybillResult.pngPath, confirmMsg);
    } else {
      await WhatsAppService.sendTextMessage(order.customerPhone, confirmMsg);
    }

    // Format dynamic product list from Wuilt order data
    const productNames = parsedItems.map((it: any) => `${it.name}${it.quantity > 1 ? ` (عدد ${it.quantity})` : ''}`).join(' + ');

    // Send waybill PDF to the WhatsApp Branch/Store Group ("المحل 🏃‍♂️") with exact user-defined template
    const branchCaption =
      `PRIME AUTO BOT \n` +
      `اوردر جديد\n` +
      `المنتج : ${productNames || 'طلب متجر برايم'}\n` +
      `صورة قبل و بعد التغليف`;

    if (waybillResult) {
      await WhatsAppService.sendToBranchGroup(
        waybillResult.pdfPath,
        `Aramex_Waybill_${order.wuiltOrderId}.pdf`,
        branchCaption
      );
    }

    LoggerService.info('MATCHING_ENGINE', `Pipeline complete for confirmed order ${order.id}`);

    return {
      matched: true,
      orderId: order.id,
      smsId: smsId || undefined,
      scanId: scanId || undefined,
      status: ORDER_STATUS.CONFIRMED,
      verifiedAmount,
      message: `Payment verified (${verifiedAmount} EGP). Order confirmed and waybill dispatched.`,
      waybillUrls: waybillResult ? { png: waybillResult.pngUrl, pdf: waybillResult.pdfUrl } : undefined,
    };
  }

  /**
   * Manual verification fallback: allows merchant to manually approve an order from Desktop Dashboard.
   */
  public static async manualVerifyOrder(
    orderId: string,
    verifiedAmount: number,
    notes?: string
  ): Promise<MatchingResult> {
    LoggerService.info('MATCHING_ENGINE', `Manual verification triggered for order ${orderId} with amount ${verifiedAmount} EGP`);

    if (notes) {
      await prisma.order.update({
        where: { id: orderId },
        data: { notes: `[MANUAL VERIFICATION]: ${notes}` },
      });
    }

    return await this.executeFinancialVerification(orderId, null, null, verifiedAmount);
  }
}
