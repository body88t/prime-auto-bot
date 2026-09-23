import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env';
import { LoggerService } from './logger.service';

export interface WuiltOrderPayload {
  id: string;
  orderNumber?: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
  pricing: {
    total: number;
    subtotal: number;
    shipping: number;
    currency: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    governorate: string;
    country: string;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    sku?: string;
  }>;
  status: string;
  createdAt: string;
}

export class WuiltService {
  private static baseUrl = 'https://api.wuilt.com/v1';

  /**
   * Verifies HMAC signature of inbound Wuilt webhook requests.
   */
  public static verifyWebhookSignature(payload: string, signatureHeader?: string): boolean {
    if (!config.wuiltWebhookSecret || config.wuiltWebhookSecret.startsWith('mock_')) {
      return true; // Bypass in mock/development mode
    }
    if (!signatureHeader) return false;

    try {
      const hmac = crypto.createHmac('sha256', config.wuiltWebhookSecret);
      const digest = hmac.update(payload).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
    } catch (e) {
      LoggerService.error('WUILT_SERVICE', 'Error verifying webhook signature', e);
      return false;
    }
  }

  /**
   * Updates an order status and deposit in Wuilt.
   */
  public static async updateOrderPayment(wuiltOrderId: string, depositAmount: number, remainingTotal: number, status: string): Promise<boolean> {
    try {
      LoggerService.info('WUILT_SERVICE', `Updating order ${wuiltOrderId} in Wuilt: deposit=${depositAmount}, remaining=${remainingTotal}, status=${status}`);

      if (!config.wuiltApiKey || config.wuiltApiKey.startsWith('mock_')) {
        LoggerService.info('WUILT_SERVICE', `[MOCK MODE] Wuilt order ${wuiltOrderId} marked as updated.`);
        return true;
      }

      const response = await axios.patch(
        `${this.baseUrl}/orders/${wuiltOrderId}`,
        {
          status: status === 'CONFIRMED' ? 'confirmed' : 'partially_paid',
          notes: `[PRIME BOT] Verified deposit: ${depositAmount} EGP. Remaining COD: ${remainingTotal} EGP.`,
          financialStatus: status === 'CONFIRMED' ? 'partially_paid' : 'pending',
          customFields: {
            depositPaid: depositAmount,
            remainingToCollect: remainingTotal,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${config.wuiltApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      LoggerService.error('WUILT_SERVICE', `Failed to update order ${wuiltOrderId} in Wuilt`, {
        error: error.response?.data || error.message,
      });
      return false;
    }
  }

  /**
   * Retrieves order details directly from Wuilt API.
   */
  public static async getOrder(wuiltOrderId: string): Promise<WuiltOrderPayload | null> {
    try {
      if (!config.wuiltApiKey || config.wuiltApiKey.startsWith('mock_')) {
        LoggerService.info('WUILT_SERVICE', `[MOCK MODE] Simulated fetching order ${wuiltOrderId}`);
        return null;
      }

      const response = await axios.get(`${this.baseUrl}/orders/${wuiltOrderId}`, {
        headers: {
          Authorization: `Bearer ${config.wuiltApiKey}`,
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error: any) {
      LoggerService.error('WUILT_SERVICE', `Failed to fetch order ${wuiltOrderId} from Wuilt`, error.message);
      return null;
    }
  }
}
