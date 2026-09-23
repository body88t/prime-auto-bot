import axios from 'axios';
import { DashboardStats, IncomingSms, Order, SystemLog } from '../types';

const API_BASE_URL = 'http://localhost:3000/api/v1';

export const api = {
  async getStats(): Promise<DashboardStats> {
    const res = await axios.get(`${API_BASE_URL}/dashboard/stats`);
    return res.data.stats;
  },

  async getOrders(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<{ orders: Order[]; total: number }> {
    const res = await axios.get(`${API_BASE_URL}/dashboard/orders`, { params });
    return {
      orders: res.data.orders,
      total: res.data.pagination.total,
    };
  },

  async getOrderById(id: string): Promise<Order> {
    const res = await axios.get(`${API_BASE_URL}/dashboard/orders/${id}`);
    return res.data.order;
  },

  async manualVerifyOrder(id: string, verifiedAmount: number, notes?: string) {
    const res = await axios.post(`${API_BASE_URL}/dashboard/orders/${id}/verify`, {
      verifiedAmount,
      notes,
    });
    return res.data;
  },

  async getIncomingSms(params?: { isConsumed?: string; search?: string }): Promise<IncomingSms[]> {
    const res = await axios.get(`${API_BASE_URL}/dashboard/sms`, { params });
    return res.data.smsList;
  },

  async getLogs(params?: { level?: string; category?: string }): Promise<SystemLog[]> {
    const res = await axios.get(`${API_BASE_URL}/dashboard/logs`, { params });
    return res.data.logs;
  },

  // Simulators for testing
  async simulateOrder(data: { customerName?: string; customerPhone?: string; orderTotal?: number }) {
    const res = await axios.post(`${API_BASE_URL}/dashboard/simulate/order`, data);
    return res.data.order;
  },

  async simulateSms(data: { sender: string; amount: number; referenceId?: string; rawMessage?: string }) {
    const res = await axios.post(`${API_BASE_URL}/dashboard/simulate/sms`, data);
    return res.data.sms;
  },

  async simulateReceipt(data: { orderId: string; amount: number; referenceId?: string; wallet?: string }) {
    const res = await axios.post(`${API_BASE_URL}/dashboard/simulate/receipt`, data);
    return res.data;
  },

  async getWhatsAppStatus(): Promise<{ status: 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED'; connectedPhoneNumber: string | null; qrCodeDataUrl: string | null }> {
    const res = await axios.get(`${API_BASE_URL}/whatsapp/status`);
    return res.data;
  },

  async initWhatsApp() {
    const res = await axios.post(`${API_BASE_URL}/whatsapp/init`);
    return res.data;
  },

  // Server-Sent Events subscription
  subscribeToEvents(onEvent: (event: { type: string; data: any }) => void): () => void {
    const eventSource = new EventSource(`${API_BASE_URL}/dashboard/events`);

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
