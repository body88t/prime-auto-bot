import { Request, Response } from 'express';
import { prisma } from '../prisma/client';
import { MatchingEngine } from '../services/matching.service';
import { ORDER_STATUS, RECEIPT_STATUS } from '../utils/constants';
import { LoggerService } from '../services/logger.service';
import { config } from '../config/env';

// Server-Sent Events clients manager
export const sseClients: Response[] = [];

export function broadcastDashboardEvent(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

export class DashboardController {
  /**
   * Real-time dashboard KPI metrics.
   */
  public static async getStats(req: Request, res: Response) {
    try {
      const [
        totalOrders,
        confirmedOrders,
        partialOrders,
        pendingOrders,
        failedOrders,
        totalSms,
        unconsumedSms,
        allOrders,
      ] = await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: ORDER_STATUS.CONFIRMED } }),
        prisma.order.count({ where: { status: ORDER_STATUS.PARTIAL_DEPOSIT } }),
        prisma.order.count({ where: { status: ORDER_STATUS.PENDING_PAYMENT } }),
        prisma.order.count({ where: { status: ORDER_STATUS.FAILED_VERIFICATION } }),
        prisma.incomingSms.count(),
        prisma.incomingSms.count({ where: { isConsumed: false } }),
        prisma.order.findMany({ select: { depositPaid: true, orderTotal: true } }),
      ]);

      const totalDepositsCollected = allOrders.reduce((sum, o) => sum + (o.depositPaid || 0), 0);
      const totalOrderRevenue = allOrders.reduce((sum, o) => sum + (o.orderTotal || 0), 0);

      return res.status(200).json({
        success: true,
        stats: {
          totalOrders,
          confirmedOrders,
          partialOrders,
          pendingOrders,
          failedOrders,
          totalSms,
          unconsumedSms,
          totalDepositsCollected,
          totalOrderRevenue,
          thresholdEgp: config.depositThresholdEgp,
          targetDepositEgp: config.targetDepositEgp,
        },
      });
    } catch (error: any) {
      LoggerService.error('DASHBOARD_API', 'Failed to retrieve stats', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Orders list with pagination, search, and status filter.
   */
  public static async getOrders(req: Request, res: Response) {
    try {
      const { status, search, page = '1', limit = '20' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (status && status !== 'ALL') {
        where.status = status as string;
      }
      if (search) {
        const query = String(search).trim();
        where.OR = [
          { wuiltOrderId: { contains: query } },
          { customerName: { contains: query } },
          { customerPhone: { contains: query } },
        ];
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            receiptScans: { orderBy: { createdAt: 'desc' } },
            consumedSms: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.order.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      LoggerService.error('DASHBOARD_API', 'Failed to get orders', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Single order detail with receipts and consumed SMS.
   */
  public static async getOrderById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          receiptScans: { orderBy: { createdAt: 'desc' } },
          consumedSms: true,
        },
      });

      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      return res.status(200).json({ success: true, order });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Manual verification fallback: merchant manually confirms payment.
   */
  public static async manualVerifyOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { verifiedAmount, notes } = req.body;

      if (!verifiedAmount || typeof verifiedAmount !== 'number' || verifiedAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'A valid positive verifiedAmount is required for manual verification.',
        });
      }

      const result = await MatchingEngine.manualVerifyOrder(id, verifiedAmount, notes);
      broadcastDashboardEvent('ORDER_UPDATED', result);

      return res.status(200).json({
        success: true,
        message: 'Order verified manually by operator.',
        result,
      });
    } catch (error: any) {
      LoggerService.error('DASHBOARD_API', `Manual verification failed: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * List incoming SMS messages.
   */
  public static async getIncomingSms(req: Request, res: Response) {
    try {
      const { isConsumed, search, limit = '50' } = req.query;
      const limitNum = parseInt(limit as string, 10);

      const where: any = {};
      if (isConsumed !== undefined && isConsumed !== 'ALL') {
        where.isConsumed = isConsumed === 'true';
      }
      if (search) {
        const query = String(search).trim();
        where.OR = [
          { sender: { contains: query } },
          { referenceId: { contains: query } },
          { rawMessage: { contains: query } },
        ];
      }

      const smsList = await prisma.incomingSms.findMany({
        where,
        include: { consumedByOrder: { select: { id: true, wuiltOrderId: true, customerName: true } } },
        orderBy: { receivedAt: 'desc' },
        take: limitNum,
      });

      return res.status(200).json({ success: true, smsList });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * List system audit logs.
   */
  public static async getLogs(req: Request, res: Response) {
    try {
      const { level, category, limit = '100' } = req.query;
      const limitNum = parseInt(limit as string, 10);

      const where: any = {};
      if (level && level !== 'ALL') where.level = String(level).toUpperCase();
      if (category && category !== 'ALL') where.category = String(category);

      const logs = await prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
      });

      return res.status(200).json({ success: true, logs });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * SSE Stream endpoint for live desktop dashboard events.
   */
  public static streamEvents(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);

    // Send initial ping
    res.write(`event: CONNECTED\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      const index = sseClients.indexOf(res);
      if (index !== -1) {
        sseClients.splice(index, 1);
      }
    });
  }

  /**
   * Simulation Helper: Create a demo order.
   */
  public static async simulateOrder(req: Request, res: Response) {
    try {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const wuiltOrderId = `EG-${randomNum}`;
      const customerName = req.body.customerName || 'أحمد علي';
      const customerPhone = req.body.customerPhone || '01012345678';
      const orderTotal = req.body.orderTotal || 1250;

      const order = await prisma.order.create({
        data: {
          wuiltOrderId,
          customerName,
          customerPhone,
          orderTotal,
          depositPaid: 0,
          remainingTotal: orderTotal,
          status: ORDER_STATUS.PENDING_PAYMENT,
          shippingAddress: 'شارع التحرير - الدقي - الجيزة',
          itemsJson: JSON.stringify([
            { name: 'قميص أكسفورد قطن مصري', quantity: 2, price: 500 },
            { name: 'بنطال جينز كلاسيك', quantity: 1, price: 250 },
          ]),
        },
      });

      broadcastDashboardEvent('ORDER_CREATED', order);
      return res.status(201).json({ success: true, order });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Simulation Helper: Ingest a simulated bank SMS.
   */
  public static async simulateSms(req: Request, res: Response) {
    try {
      const sender = req.body.sender || 'VF-Cash';
      const amount = req.body.amount || 200.0;
      const refId = req.body.referenceId || `TXN${Math.floor(10000000 + Math.random() * 90000000)}`;
      const rawMessage = req.body.rawMessage || `تم استلام مبلغ ${amount.toFixed(2)} جنيه من 01099887766. رصيدك الحالي هو 2500.00 جنيه. رقم العملية: ${refId}`;

      const sms = await prisma.incomingSms.create({
        data: {
          sender,
          amount,
          referenceId: refId,
          rawMessage,
          receivedAt: new Date(),
          isConsumed: false,
        },
      });

      broadcastDashboardEvent('SMS_RECEIVED', sms);
      return res.status(201).json({ success: true, sms });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Simulation Helper: Ingest a receipt scan for an order.
   */
  public static async simulateReceiptScan(req: Request, res: Response) {
    try {
      const { orderId, amount = 200, referenceId, wallet = 'Vodafone Cash' } = req.body;
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const ref = referenceId || `TXN${Math.floor(10000000 + Math.random() * 90000000)}`;
      const dummyUrl = `${config.publicServerUrl}/storage/receipts/simulated_receipt_${order.wuiltOrderId}.png`;

      const matchResult = await MatchingEngine.processReceiptScan(order.id, dummyUrl, {
        amount: parseFloat(amount),
        reference_id: ref,
        transaction_date: new Date().toISOString(),
        wallet_provider: wallet,
        confidenceScore: 0.99,
        rawResponse: JSON.stringify({ simulated: true, amount, reference_id: ref }),
      });

      broadcastDashboardEvent('RECEIPT_PROCESSED', matchResult);
      return res.status(200).json({ success: true, matchResult });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
