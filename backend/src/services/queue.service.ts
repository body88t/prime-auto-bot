import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/env';
import { prisma } from '../prisma/client';
import { WhatsAppService } from './whatsapp.service';
import { MESSAGES } from '../utils/constants';
import { LoggerService } from './logger.service';

export interface AbandonedCartJobData {
  cartId: string;
  customerPhone: string;
  customerName?: string;
}

export class QueueService {
  private static cartQueue: Queue | null = null;
  private static cartWorker: Worker | null = null;
  private static memoryTimeouts = new Map<string, NodeJS.Timeout>();

  public static async initialize() {
    if (config.redisUrl && !config.redisUrl.startsWith('mock_')) {
      try {
        const connection = new IORedis(config.redisUrl, {
          maxRetriesPerRequest: null,
          retryStrategy: (times) => (times > 3 ? null : Math.min(times * 1000, 3000)),
        });

        connection.on('error', (err) => {
          LoggerService.warn('QUEUE_SERVICE', `Redis connection issue: ${err.message}. Falling back to in-memory scheduler.`);
        });

        this.cartQueue = new Queue('abandoned-cart-recovery', { connection });
        this.cartWorker = new Worker(
          'abandoned-cart-recovery',
          async (job: Job<AbandonedCartJobData>) => {
            await this.processAbandonedCartReminder(job.data);
          },
          { connection }
        );

        LoggerService.info('QUEUE_SERVICE', 'BullMQ queue and worker initialized with Redis.');
        return;
      } catch (e: any) {
        LoggerService.warn('QUEUE_SERVICE', `Failed to initialize BullMQ: ${e.message}. Using in-memory fallback.`);
      }
    }

    LoggerService.info('QUEUE_SERVICE', 'In-memory reliable delay scheduler active for background tasks.');
  }

  /**
   * Schedules an abandoned cart recovery reminder (default 2 hours).
   */
  public static async scheduleAbandonedCartReminder(
    cartId: string,
    customerPhone: string,
    customerName?: string,
    delayMs: number = 2 * 60 * 60 * 1000 // 2 hours
  ) {
    LoggerService.info('QUEUE_SERVICE', `Scheduling abandoned cart recovery for cart ${cartId} (${customerPhone}) in ${delayMs / 1000}s`);

    if (this.cartQueue) {
      try {
        await this.cartQueue.add(
          `cart-reminder-${cartId}`,
          { cartId, customerPhone, customerName },
          { delay: delayMs, removeOnComplete: true, removeOnFail: false }
        );
        return;
      } catch (e: any) {
        LoggerService.warn('QUEUE_SERVICE', `BullMQ add failed: ${e.message}. Using memory fallback.`);
      }
    }

    // In-memory fallback
    const timer = setTimeout(async () => {
      this.memoryTimeouts.delete(cartId);
      await this.processAbandonedCartReminder({ cartId, customerPhone, customerName });
    }, delayMs);

    this.memoryTimeouts.set(cartId, timer);
  }

  /**
   * Evaluates cart and sends recovery WhatsApp message if not converted.
   */
  public static async processAbandonedCartReminder(data: AbandonedCartJobData) {
    const { cartId, customerPhone, customerName } = data;
    LoggerService.info('QUEUE_SERVICE', `Executing abandoned cart check for cartId=${cartId}`);

    try {
      const normalizedPhone = WhatsAppService.normalizePhoneNumber(customerPhone);
      const isSuppressedPhone = config.suppressedPhones.some(
        (sp) => sp && (normalizedPhone.endsWith(sp) || sp.endsWith(normalizedPhone) || normalizedPhone === sp)
      );
      if (isSuppressedPhone) {
        LoggerService.warn('QUEUE_SERVICE', `🛡️ Abandoned cart ${cartId} (${normalizedPhone}) is in SUPPRESSION LIST. Skipping reminder.`);
        return;
      }

      const cart = await prisma.abandonedCart.findUnique({ where: { cartId } }).catch(() => null);
      if (cart && cart.reminderSent) {
        LoggerService.info('QUEUE_SERVICE', `Reminder already sent for cart ${cartId}.`);
        return;
      }

      // Check if the customer has placed an order recently
      const recentOrder = await prisma.order.findFirst({
        where: {
          customerPhone: { contains: normalizedPhone.slice(-9) },
          ...(cart ? { createdAt: { gte: cart.abandonedAt } } : {}),
          status: { in: ['CONFIRMED', 'PARTIAL_DEPOSIT', 'PENDING_PAYMENT'] },
        },
      }).catch(() => null);

      if (recentOrder) {
        LoggerService.info('QUEUE_SERVICE', `Customer converted with order #${recentOrder.wuiltOrderId}. Skipping recovery.`);
        return;
      }

      const message = MESSAGES.ABANDONED_CART_RECOVERY(customerName || 'عزيزنا العميل', '', 'https://primeautoeg.com');
      const sent = await WhatsAppService.sendTextMessage(normalizedPhone, message);

      if (sent && cart) {
        await prisma.abandonedCart.update({
          where: { cartId },
          data: {
            reminderSent: true,
            reminderSentAt: new Date(),
          },
        }).catch(() => null);
        LoggerService.info('QUEUE_SERVICE', `Abandoned cart recovery message dispatched to ${normalizedPhone} for cart ${cartId}`);
      }
    } catch (error: any) {
      LoggerService.error('QUEUE_SERVICE', `Error processing abandoned cart recovery for ${cartId}`, error.message);
    }
  }

  public static async shutdown() {
    for (const [, timer] of this.memoryTimeouts) {
      clearTimeout(timer);
    }
    this.memoryTimeouts.clear();

    if (this.cartWorker) {
      await this.cartWorker.close();
    }
    if (this.cartQueue) {
      await this.cartQueue.close();
    }
  }
}
