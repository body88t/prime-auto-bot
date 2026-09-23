import React, { useState } from 'react';
import { Order } from '../types';
import { Search, Eye, CheckCircle, Clock, AlertCircle, FileText, ExternalLink, ShieldAlert } from 'lucide-react';

interface OrdersTableProps {
  orders: Order[];
  loading: boolean;
  onSelectOrder: (order: Order) => void;
  onManualVerify: (order: Order) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  loading,
  onSelectOrder,
  onManualVerify,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
}) => {
  const filterTabs = [
    { id: 'ALL', label: 'الكل' },
    { id: 'CONFIRMED', label: 'مؤكدة آلياً' },
    { id: 'PARTIAL_DEPOSIT', label: 'عربون جزئي' },
    { id: 'FAILED_VERIFICATION', label: 'تحتاج مراجعة يدوية' },
    { id: 'PENDING_PAYMENT', label: 'في انتظار الإيصال' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> مؤكد وجاهز للشحن
          </span>
        );
      case 'PARTIAL_DEPOSIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3 h-3" /> عربون جزئي
          </span>
        );
      case 'FAILED_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
            <ShieldAlert className="w-3 h-3" /> مراجعة مطلوبة
          </span>
        );
      case 'PENDING_PAYMENT':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Clock className="w-3 h-3" /> بانتظار التحويل
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Search & Filter Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/40">
        {/* Status Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث برقم الطلب، اسم العميل، أو الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs rounded-xl pr-10 pl-4 py-2.5 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-950/70 text-slate-400 uppercase font-bold border-b border-slate-800">
            <tr>
              <th className="px-5 py-3.5">رقم الطلب (Wuilt)</th>
              <th className="px-5 py-3.5">العميل والهاتف</th>
              <th className="px-5 py-3.5">إجمالي الطلب</th>
              <th className="px-5 py-3.5">العربون المسدد</th>
              <th className="px-5 py-3.5">المتبقي عند الاستلام</th>
              <th className="px-5 py-3.5">حالة التحقق</th>
              <th className="px-5 py-3.5">بوليصة الشحن</th>
              <th className="px-5 py-3.5 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  جاري تحميل الطلبات...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-14 text-slate-500 font-medium">
                  لا توجد طلبات مطابقة للمعايير المحددة.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-slate-800/30 transition group"
                >
                  {/* Order Number */}
                  <td className="px-5 py-4 font-mono font-bold text-slate-200">
                    #{order.wuiltOrderId}
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>

                  {/* Customer Info */}
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-100">{order.customerName}</div>
                    <div className="text-slate-400 font-mono text-[11px] tracking-wide mt-0.5" dir="ltr">
                      {order.customerPhone}
                    </div>
                  </td>

                  {/* Pricing Breakdown */}
                  <td className="px-5 py-4 font-bold text-slate-200">
                    {order.orderTotal.toFixed(2)} ج.م
                  </td>
                  <td className="px-5 py-4 font-bold text-emerald-400">
                    {order.depositPaid > 0 ? `${order.depositPaid.toFixed(2)} ج.م` : '—'}
                  </td>
                  <td className="px-5 py-4 font-bold text-cyan-400">
                    {order.remainingTotal.toFixed(2)} ج.م
                  </td>

                  {/* Status Badge */}
                  <td className="px-5 py-4">
                    {getStatusBadge(order.status)}
                  </td>

                  {/* Waybill Link */}
                  <td className="px-5 py-4">
                    {order.waybillUrl ? (
                      <a
                        href={order.waybillUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>معاينة</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onSelectOrder(order)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                        title="تفاصيل الطلب والإيصال"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {order.status !== 'CONFIRMED' && (
                        <button
                          onClick={() => onManualVerify(order)}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition"
                          title="تحقق يدوي فوري وتأكيد الشحن"
                        >
                          تحقق يدوي
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
