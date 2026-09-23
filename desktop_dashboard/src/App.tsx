import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { OrdersTable } from './components/OrdersTable';
import { OrderDetailModal } from './components/OrderDetailModal';
import { ManualVerificationModal } from './components/ManualVerificationModal';
import { SmsFeed } from './components/SmsFeed';
import { SystemLogsView } from './components/SystemLogsView';
import { SettingsView } from './components/SettingsView';
import { SimulatorDrawer } from './components/SimulatorDrawer';
import { WhatsAppQrModal } from './components/WhatsAppQrModal';
import { AlertTriangle } from 'lucide-react';
import { api } from './services/api';
import { DashboardStats, IncomingSms, Order, SystemLog } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('orders');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [smsList, setSmsList] = useState<IncomingSms[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [loadingSms, setLoadingSms] = useState<boolean>(false);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [manualVerifyOrder, setManualVerifyOrder] = useState<Order | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);

  // WhatsApp State
  const [waStatus, setWaStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED'>('CONNECTING');
  const [waQrCode, setWaQrCode] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);

  // Fetch WhatsApp Status
  const fetchWhatsAppStatus = useCallback(async () => {
    try {
      const data = await api.getWhatsAppStatus();
      setWaStatus(data.status);
      setWaQrCode(data.qrCodeDataUrl);
      setWaPhone(data.connectedPhoneNumber);
    } catch (e) {
      console.error('Failed to fetch WhatsApp status:', e);
    }
  }, []);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
      setIsBackendConnected(true);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
      setIsBackendConnected(false);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const data = await api.getOrders({
        status: statusFilter,
        search: searchQuery,
      });
      setOrders(data.orders);
      setIsBackendConnected(true);
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoadingOrders(false);
    }
  }, [statusFilter, searchQuery]);

  // Fetch SMS
  const fetchSms = useCallback(async () => {
    setLoadingSms(true);
    try {
      const data = await api.getIncomingSms();
      setSmsList(data);
    } catch (e) {
      console.error('Failed to fetch SMS:', e);
    } finally {
      setLoadingSms(false);
    }
  }, []);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const data = await api.getLogs();
      setLogs(data);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  // Full Refresh
  const handleRefresh = useCallback(() => {
    fetchStats();
    fetchOrders();
    fetchWhatsAppStatus();
    if (activeTab === 'sms') fetchSms();
    if (activeTab === 'logs') fetchLogs();
  }, [fetchStats, fetchOrders, fetchWhatsAppStatus, fetchSms, fetchLogs, activeTab]);

  useEffect(() => {
    fetchStats();
    fetchWhatsAppStatus();
  }, [fetchStats, fetchWhatsAppStatus]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (activeTab === 'sms') fetchSms();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, fetchSms, fetchLogs]);

  // Server-Sent Events (Live streaming updates)
  useEffect(() => {
    const unsubscribe = api.subscribeToEvents((event) => {
      console.log('Live SSE Event:', event);
      setIsLive(true);
      setIsBackendConnected(true);

      if (event.type === 'WHATSAPP_QR') {
        setWaStatus('SCAN_QR');
        if (event.data?.qrCodeDataUrl) {
          setWaQrCode(event.data.qrCodeDataUrl);
        }
      } else if (event.type === 'WHATSAPP_STATUS') {
        if (event.data?.status) {
          setWaStatus(event.data.status);
        }
        if (event.data?.connectedPhoneNumber) {
          setWaPhone(event.data.connectedPhoneNumber);
        }
      }

      fetchStats();
      fetchOrders();
      if (activeTab === 'sms') fetchSms();
      if (activeTab === 'logs') fetchLogs();
    });

    return () => {
      unsubscribe();
    };
  }, [fetchStats, fetchOrders, fetchSms, fetchLogs, activeTab]);

  // Manual verification handler
  const handleManualVerifySubmit = async (orderId: string, amount: number, notes?: string) => {
    await api.manualVerifyOrder(orderId, amount, notes);
    handleRefresh();
    if (selectedOrder && selectedOrder.id === orderId) {
      const updated = await api.getOrderById(orderId);
      setSelectedOrder(updated);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Backend Offline Warning Banner */}
      {!isBackendConnected && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 text-rose-300 px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>السيرفر المحلي (Backend Server) غير متصل على المنفذ 3000. يرجى تشغيل السيرفر بواسطة <b>npm run dev</b> أو عبر ملف <b>START_SYSTEM.bat</b>.</span>
          </div>
          <button
            onClick={handleRefresh}
            className="underline hover:text-white font-bold"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenWhatsApp={() => setIsWhatsAppModalOpen(true)}
        onRefresh={handleRefresh}
        isLive={isLive}
        waStatus={waStatus}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Overview */}
        <StatsOverview stats={stats} loading={loadingStats} />

        {/* Tab Views */}
        {activeTab === 'orders' && (
          <OrdersTable
            orders={orders}
            loading={loadingOrders}
            onSelectOrder={(order) => setSelectedOrder(order)}
            onManualVerify={(order) => setManualVerifyOrder(order)}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}

        {activeTab === 'sms' && (
          <SmsFeed
            smsList={smsList}
            loading={loadingSms}
            onRefresh={fetchSms}
          />
        )}

        {activeTab === 'logs' && (
          <SystemLogsView
            logs={logs}
            loading={loadingLogs}
            onRefresh={fetchLogs}
          />
        )}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Modals & Drawers */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onManualVerify={(order) => {
          setSelectedOrder(null);
          setManualVerifyOrder(order);
        }}
      />

      <ManualVerificationModal
        order={manualVerifyOrder}
        onClose={() => setManualVerifyOrder(null)}
        onSubmit={handleManualVerifySubmit}
      />

      <SimulatorDrawer
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSuccess={handleRefresh}
      />

      <WhatsAppQrModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        status={waStatus}
        qrCodeDataUrl={waQrCode}
        connectedPhone={waPhone}
        onRefresh={fetchWhatsAppStatus}
      />
    </div>
  );
};

export default App;
