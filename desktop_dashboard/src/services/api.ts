import axios from 'axios';
import { DashboardStats, IncomingSms, Order, SystemLog } from '../types';

const STORAGE_KEY = 'PRIME_API_BASE_URL';
const DEFAULT_URL = 'https://primeautobot-1480cm0m.b4a.run/api/v1';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !saved.includes('trycloudflare.com')) return saved;
    if (saved && saved.includes('trycloudflare.com')) {
      localStorage.setItem(STORAGE_KEY, DEFAULT_URL);
    }
  }
  return DEFAULT_URL;
}

export function setApiBaseUrl(url: string): string {
  const clean = url.trim().replace(/\/+$/, '');
  const finalUrl = clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, finalUrl);
  }
  return finalUrl;
}

export const api = {
  getApiBaseUrl,
  setApiBaseUrl,

  async pingServer(url?: string): Promise<{ ok: boolean; message: string; ms?: number }> {
    const target = url ? setApiBaseUrl(url) : getApiBaseUrl();
    const healthUrl = target.replace(/\/api\/v1$/, '') + '/health';
    const start = Date.now();
    try {
      const res = await axios.get(healthUrl, { timeout: 6000 });
      const ms = Date.now() - start;
      if (res.status === 200) {
        return { ok: true, message: `متصل بنجاح (${ms}ms)`, ms };
      }
      return { ok: false, message: `استجابة غير متوقعة: كود ${res.status}` };
    } catch (e: any) {
      return { ok: false, message: e.message || 'فشل الاتصال بالسيرفر' };
    }
  },

  async getStats(): Promise<DashboardStats> {
    const res = await axios.get(`${getApiBaseUrl()}/dashboard/stats`);
    return res.data.stats;
  },

  async getOrders(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<{ orders: Order[]; total: number }> {
    const res = await axios.get(`${getApiBaseUrl()}/dashboard/orders`, { params });
    return {
      orders: res.data.orders,
      total: res.data.pagination.total,
    };
  },

  async getOrderById(id: string): Promise<Order> {
    const res = await axios.get(`${getApiBaseUrl()}/dashboard/orders/${id}`);
    return res.data.order;
  },

  async manualVerifyOrder(id: string, verifiedAmount: number, notes?: string) {
    const res = await axios.post(`${getApiBaseUrl()}/dashboard/orders/${id}/verify`, {
      verifiedAmount,
      notes,
    });
    return res.data;
  },

  async getIncomingSms(params?: { isConsumed?: string; search?: string }): Promise<IncomingSms[]> {
    const res = await axios.get(`${getApiBaseUrl()}/dashboard/sms`, { params });
    return res.data.smsList;
  },

  async getLogs(params?: { level?: string; category?: string }): Promise<SystemLog[]> {
    const res = await axios.get(`${getApiBaseUrl()}/dashboard/logs`, { params });
    return res.data.logs;
  },

  // Simulators for testing
  async simulateOrder(data: { customerName?: string; customerPhone?: string; orderTotal?: number }) {
    const res = await axios.post(`${getApiBaseUrl()}/dashboard/simulate/order`, data);
    return res.data.order;
  },

  async simulateSms(data: { sender: string; amount: number; referenceId?: string; rawMessage?: string }) {
    const res = await axios.post(`${getApiBaseUrl()}/dashboard/simulate/sms`, data);
    return res.data.sms;
  },

  async simulateReceipt(data: { orderId: string; amount: number; referenceId?: string; wallet?: string }) {
    const res = await axios.post(`${getApiBaseUrl()}/dashboard/simulate/receipt`, data);
    return res.data;
  },

  async getWhatsAppStatus(): Promise<{ status: 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED'; connectedPhoneNumber: string | null; qrCodeDataUrl: string | null }> {
    const res = await axios.get(`${getApiBaseUrl()}/whatsapp/status`);
    return res.data;
  },

  async initWhatsApp() {
    const res = await axios.post(`${getApiBaseUrl()}/whatsapp/init`);
    return res.data;
  },

  // Server-Sent Events subscription
  subscribeToEvents(onEvent: (event: { type: string; data: any }) => void): () => void {
    const eventSource = new EventSource(`${getApiBaseUrl()}/dashboard/events`);

    const handleMessage = (type: string) => (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onEvent({ type, data });
      } catch (err) {
        console.error('SSE JSON parse error:', err);
      }
    };

    eventSource.addEventListener('ORDER_CREATED', handleMessage('ORDER_CREATED'));
    eventSource.addEventListener('ORDER_UPDATED', handleMessage('ORDER_UPDATED'));
    eventSource.addEventListener('SMS_RECEIVED', handleMessage('SMS_RECEIVED'));
    eventSource.addEventListener('RECEIPT_PROCESSED', handleMessage('RECEIPT_PROCESSED'));
    eventSource.addEventListener('WHATSAPP_QR', handleMessage('WHATSAPP_QR'));
    eventSource.addEventListener('WHATSAPP_STATUS', handleMessage('WHATSAPP_STATUS'));

    return () => {
      eventSource.close();
    };
  },
};
