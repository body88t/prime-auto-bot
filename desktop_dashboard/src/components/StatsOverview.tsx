import React from 'react';
import { DashboardStats } from '../types';
import { CheckCircle2, AlertTriangle, Clock, Wallet, Inbox, Sparkles } from 'lucide-react';

interface StatsOverviewProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 h-28" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'إجمالي الطلبات',
      value: stats.totalOrders,
      icon: Clock,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'تم التأكيد آلياً',
      value: stats.confirmedOrders,
      sublabel: `عربون >= ${stats.thresholdEgp} ج.م`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'عربون جزئي',
      value: stats.partialOrders,
      sublabel: 'أقل من 190 ج.م',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'بانتظار المراجعة اليدوية',
      value: stats.failedOrders,
      sublabel: 'عدم تطابق إيصال',
      icon: Sparkles,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
    },
    {
      label: 'إجمالي العربون المحصّل',
      value: `${stats.totalDepositsCollected.toLocaleString('ar-EG')} ج.م`,
      icon: Wallet,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
    },
    {
      label: 'رسائل بنكية جاهزة للربط',
      value: stats.unconsumedSms,
      sublabel: `من إجمالي ${stats.totalSms} رسالة`,
      icon: Inbox,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`bg-slate-900/70 border ${card.border} rounded-2xl p-4 flex flex-col justify-between hover:bg-slate-900 transition shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">{card.label}</span>
              <div className={`p-2 rounded-xl ${card.bg}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white tracking-tight">{card.value}</div>
              {card.sublabel && (
                <div className="text-[11px] text-slate-400 mt-0.5">{card.sublabel}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
