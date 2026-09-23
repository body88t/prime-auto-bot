import React from 'react';
import { Bot, RefreshCw, Smartphone, PlayCircle, Settings, FileText, ShoppingBag, MessageSquare, QrCode } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSimulator: () => void;
  onOpenWhatsApp: () => void;
  onRefresh: () => void;
  isLive: boolean;
  waStatus: 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED';
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSimulator,
  onOpenWhatsApp,
  onRefresh,
  isLive,
  waStatus,
}) => {
  const tabs = [
    { id: 'orders', label: 'الطلبات والتحقق', icon: ShoppingBag },
    { id: 'sms', label: 'رسائل البنوك (SMS)', icon: MessageSquare },
    { id: 'logs', label: 'سجلات النظام', icon: FileText },
    { id: 'settings', label: 'الإعدادات والبيئة', icon: Settings },
  ];

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-white">PRIME<span className="text-blue-500">BOT</span></span>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2 py-0.5 rounded-full font-semibold">
                  v1.0 Pro
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">نظام التحقق الذاتي من مدفوعات المحافظ الإلكترونية والشحن</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Status & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* WhatsApp Pairing Status Pill */}
            <button
              onClick={onOpenWhatsApp}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                waStatus === 'CONNECTED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
              }`}
            >
              {waStatus === 'CONNECTED' ? (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>واتساب متصل ✓</span>
                </>
              ) : (
                <>
                  <QrCode className="w-3.5 h-3.5" />
                  <span>امسح رمز الواتساب (QR)</span>
                </>
              )}
            </button>

            {/* Live SSE Pulse */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-slate-300 font-medium">{isLive ? 'اتصال مباشر' : 'جاري المزامنة'}</span>
            </div>

            {/* Test Simulation Button */}
            <button
              onClick={onOpenSimulator}
              className="flex items-center gap-1.5 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">محاكي العمليات</span>
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
