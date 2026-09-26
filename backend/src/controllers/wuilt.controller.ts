import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma/client';
import { WuiltService } from '../services/wuilt.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { QueueService } from '../services/queue.service';
import { LoggerService } from '../services/logger.service';
import { MESSAGES, ORDER_STATUS } from '../utils/constants';
import { config } from '../config/env';
import { broadcastDashboardEvent } from './dashboard.controller';

export class WuiltController {
  /**
   * Main Wuilt webhook ingestion endpoint.
   */
  public static async handleWebhook(req: Request, res: Response) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-wuilt-signature'] as string | undefined;

    // Log the entire raw payload and headers to file for inspection
    try {
      const logDump = `\n--- [${new Date().toISOString()}] INBOUND WEBHOOK ---\nHEADERS: ${JSON.stringify(req.headers, null, 2)}\nBODY: ${JSON.stringify(req.body, null, 2)}\n`;
      fs.appendFileSync(path.resolve(__dirname, '../../logs/webhook_raw_dump.log'), logDump);
      console.log(`[WUILT_RAW_DUMP] Inbound Webhook body:`, rawBody);
    } catch {}

    // 1. Verify signature
    if (!WuiltService.verifyWebhookSignature(rawBody, signature)) {
      LoggerService.warn('WUILT_WEBHOOK', 'Rejected webhook due to invalid signature');
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const payload = req.body || {};
    const event = String(
      payload.data?.event ||
      payload.event ||
      payload.data?.action ||
      payload.action ||
      req.headers['x-wuilt-event'] ||
      req.headers['x-event-name'] ||
      ''
    ).trim();

    const source =
      payload.data?.payload?.order ||
      payload.data?.payload?.cart ||
      payload.data?.order ||
      payload.data?.cart ||
      payload.data?.payload ||
      payload.order ||
      payload.cart ||
      (payload.data && typeof payload.data === 'object' && !payload.data.event ? payload.data : null) ||
      payload;

    // 2. Enforce Webhook Idempotency
    const eventId = payload.id || payload.metaData?.webhookId || req.headers['x-wuilt-delivery'];
    const resolvedEventId = String(eventId || crypto.createHash('sha256').update(rawBody).digest('hex'));

    try {
      const existingEvent = await prisma.webhookEvent.findUnique({
        where: { eventId: resolvedEventId },
      });

      if (existingEvent) {
        LoggerService.info('WUILT_WEBHOOK', `Duplicate webhook event ignored: ${resolvedEventId}`);
        return res.status(200).json({ success: true, message: 'Event already processed' });
      }
    } catch (e: any) {
      LoggerService.warn('WUILT_WEBHOOK', `Idempotency check warning: ${e.message}`);
    }

    LoggerService.info('WUILT_WEBHOOK', `Received Wuilt event: "${event || 'direct_payload'}"`, { eventId: resolvedEventId });

    // 3. Route by event type or payload structure
    try {
      const normalizedEvent = event.toLowerCase().replace(/[\s\.\-\/]/g, '_');

      const isOrderEvent =
        normalizedEvent.includes('order') ||
        normalizedEvent.includes('placed') ||
        normalizedEvent.includes('create') ||
        normalizedEvent.includes('paid') ||
        Boolean(
          source.orderSerial ||
          source.order_number ||
          source.orderId ||
          source.order_id ||
          source.line_items ||
          source.items ||
          source.totalPrice ||
          source.pricing ||
          (source._id && (source.customer || source.items || source.total || source.totalPrice || source.receipt)) ||
          (source.id && (source.customer || source.items || source.total || source.total_price))
        );

      const isCartEvent =
        !isOrderEvent && (
          normalizedEvent.includes('abandoned') ||
          (normalizedEvent.includes('cart') && !normalizedEvent.includes('order') && !normalizedEvent.includes('placed')) ||
          Boolean(source.abandonedAt)
        );

      if (isOrderEvent) {
        await WuiltController.handleOrderCreated(source);
      } else if (isCartEvent) {
        await WuiltController.handleCartAbandoned(source);
      } else {
        // Fallback: if payload has order items or total or customer, treat as order created
        if (source && (source.items || source.line_items || source.totalPrice || source.total || source.total_price || source.orderSerial || source.order_number || source.id || source._id)) {
          await WuiltController.handleOrderCreated(source);
        } else {
          LoggerService.info('WUILT_WEBHOOK', `Webhook ping or unrecognized event received: "${event}"`);
          return res.status(200).json({ success: true, message: 'Webhook received' });
        }
      }

      try {
        await prisma.webhookEvent.create({
          data: {
            eventId: resolvedEventId,
            source: 'WUILT',
            eventType: event || 'order.created',
          },
        });
      } catch {}

      return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (error: any) {
      LoggerService.error('WUILT_WEBHOOK', `Error processing Wuilt webhook ${event}: ${error.message}`);
      return res.status(200).json({ success: true, warning: error.message });
    }
  }

  /**
   * Handles order.created event.
   */
  private static async handleOrderCreated(data: any) {
    const wuiltOrderId = String(
      data.orderSerial ||
      data._id ||
      data.id ||
      data.order_id ||
      data.orderId ||
      data.order_number ||
      data.number ||
      data.code ||
      `ORD-${Date.now()}`
    );

    // Customer Name extraction with rich fallbacks
    const customerName = (
      data.customer?.name ||
      data.shippingAddress?.name ||
      data.shipping_address?.name ||
      data.billingAddress?.name ||
      data.billing_address?.name ||
      `${data.customer?.first_name || data.customer?.firstName || ''} ${data.customer?.last_name || data.customer?.lastName || ''}`.trim() ||
      data.customerName ||
      "عميلنا العزيز"
    );

    // Phone extraction & sanitization
    const rawPhone = String(
      data.customer?.phone ||
      data.shippingAddress?.phone ||
      data.shipping_address?.phone ||
      data.billingAddress?.phone ||
      data.billing_address?.phone ||
      data.phone ||
      ""
    );
    const normalizedPhone = WhatsAppService.normalizePhoneNumber(rawPhone);

    // Total extraction
    const orderTotal = Number(
      data.totalPrice?.amount ??
      data.receipt?.total?.amount ??
      (typeof data.totalPrice === 'number' ? data.totalPrice : null) ??
      data.total ??
      data.total_price ??
      data.pricing?.total ??
      data.grand_total ??
      data.amount ??
      0
    );

    // Items extraction
    const items = Array.isArray(data.items)
      ? data.items
      : (Array.isArray(data.line_items) ? data.line_items : (Array.isArray(data.products) ? data.products : []));
    const itemsJson = JSON.stringify(items);

    // Shipping address extraction
    let shippingAddress = 'القاهرة - مصر';
    if (data.shippingAddress) {
      const a = data.shippingAddress;
      shippingAddress = [a.addressLine1, a.addressLine2, a.cityName, a.stateName, a.countryName, a.street, a.city, a.governorate, a.country].filter(Boolean).join(', ') || shippingAddress;
    } else if (data.shipping_address) {
      const a = data.shipping_address;
      shippingAddress = [a.address1, a.address2, a.city, a.province || a.governorate, a.country].filter(Boolean).join(', ') || shippingAddress;
    } else if (typeof data.shipping_address === 'string') {
      shippingAddress = data.shipping_address;
    }

    // 1. Check if order already exists prior to upsert
    const existingOrder = await prisma.order.findUnique({ where: { wuiltOrderId } });

    // Save order in database (Database Persistence First)
    const savedOrder = await prisma.order.upsert({
      where: { wuiltOrderId },
      update: {
        customerName,
        customerPhone: normalizedPhone,
        orderTotal,
        remainingTotal: Math.max(0, orderTotal - (config.targetDepositEgp || 200)),
        shippingAddress,
        itemsJson,
      },
      create: {
        wuiltOrderId,
        customerName,
        customerPhone: normalizedPhone,
        orderTotal,
        depositPaid: 0,
        remainingTotal: orderTotal,
        status: ORDER_STATUS.PENDING_PAYMENT,
        shippingAddress,
        itemsJson,
      },
    });

    console.log(`SUCCESS: Order saved to database with ID: ${savedOrder.id} (#${savedOrder.wuiltOrderId})`);
    LoggerService.info('WUILT_WEBHOOK', `SUCCESS: Order saved to database with ID: ${savedOrder.id} (#${savedOrder.wuiltOrderId})`);

    // 2. Live SSE Broadcast to Desktop Dashboard
    broadcastDashboardEvent('ORDER_CREATED', savedOrder);
    broadcastDashboardEvent('STATS_UPDATE', {});

    // 3. Suppression check (Safety against duplicate messages for manually handled orders)
    const isSuppressedPhone = config.suppressedPhones.some(
      (sp) => sp && (normalizedPhone.endsWith(sp) || sp.endsWith(normalizedPhone) || normalizedPhone === sp)
    );
    const isSuppressedOrder = config.suppressedOrders.includes(wuiltOrderId);

    if (isSuppressedPhone || isSuppressedOrder) {
      LoggerService.warn(
        'WUILT_WEBHOOK',
        `🛡️ Order #${savedOrder.wuiltOrderId} (Phone: ${normalizedPhone}) is in the SUPPRESSION LIST. Automated WhatsApp message skipped permanently.`
      );
      return savedOrder;
    }

    // 4. If order already existed in DB, avoid resending initial deposit instructions
    if (existingOrder) {
      LoggerService.info(
        'WUILT_WEBHOOK',
        `Order #${savedOrder.wuiltOrderId} was already registered in the system. Initial deposit instructions skipped to prevent customer annoyance.`
      );
      return savedOrder;
    }

    // 5. Send formatted WhatsApp message to customer
    if (normalizedPhone) {
      try {
        const formattedItems = WhatsAppService.formatOrderItems(items);
        const formattedDate = WhatsAppService.formatOrderDateTime(savedOrder.createdAt);
        const instructionMsg = MESSAGES.ORDER_CREATED_INSTRUCTION(customerName, formattedItems, formattedDate);
        
        await WhatsAppService.sendTextMessage(normalizedPhone, instructionMsg);
        LoggerService.info('WUILT_WEBHOOK', `WhatsApp order instructions sent to ${normalizedPhone} for order #${savedOrder.wuiltOrderId}`);
      } catch (waError: any) {
        LoggerService.error('WUILT_WEBHOOK', `Failed to send WhatsApp message for order #${savedOrder.wuiltOrderId}: ${waError.message}`);
      }
    } else {
      LoggerService.warn('WUILT_WEBHOOK', `Order #${savedOrder.wuiltOrderId} has no valid customer phone. WhatsApp message skipped.`);
    }

    return savedOrder;
  }

  /**
   * Handles cart.abandoned event.
   */
  private static async handleCartAbandoned(data: any) {
    const cartId = String(data.id || data.cartId || data.cart_id || data.token || `cart_${Date.now()}`);
    const rawPhone = String(
      data.customer?.phone ||
      data.shipping_address?.phone ||
      data.shippingAddress?.phone ||
      data.phone ||
      ""
    );
    const customerName = (
      data.customer?.name ||
      `${data.customer?.firstName || data.customer?.first_name || ''} ${data.customer?.lastName || data.customer?.last_name || ''}`.trim() ||
      data.customerName ||
      'عزيزنا العميل'
    );
    const cartItemsList = Array.isArray(data.items) ? data.items : (Array.isArray(data.line_items) ? data.line_items : []);
    const cartItems = JSON.stringify(cartItemsList);
    const totalAmount = Number(data.total_price || data.total || data.pricing?.total || 0);

    if (!rawPhone) {
      LoggerService.info('WUILT_WEBHOOK', `Abandoned cart ${cartId} has no customer phone. Skipping reminder.`);
      return;
    }

    const normalizedPhone = WhatsAppService.normalizePhoneNumber(rawPhone);

    // Save AbandonedCart record
    await prisma.abandonedCart.upsert({
      where: { cartId },
      update: {
        customerPhone: normalizedPhone,
        customerName,
        cartItems,
        totalAmount,
      },
      create: {
        cartId,
        customerPhone: normalizedPhone,
        customerName,
        cartItems,
        totalAmount,
        abandonedAt: new Date(),
        reminderSent: false,
      },
    });

    LoggerService.info('WUILT_WEBHOOK', `Abandoned cart ${cartId} saved. Scheduling 2-hour recovery reminder.`);

    // Enqueue 2-hour delayed recovery job via QueueService
    await QueueService.scheduleAbandonedCartReminder(cartId, normalizedPhone, customerName);
  }
}
