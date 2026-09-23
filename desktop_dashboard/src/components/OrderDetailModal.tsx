import React from 'react';
import { Order } from '../types';
import { X, User, Phone, MapPin, DollarSign, Image, MessageSquare, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onManualVerify: (order: Order) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose, onManualVerify }) => {
  if (!order) return null;

  let items: Array<{ name: string; quantity: number; price: number }> = [];
  try {
    items = order.itemsJson ? JSON.parse(order.itemsJson) : [];
  } catch {
    items = [];
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black text-white">تفاصيل الطلب #{order.wuiltOrderId}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {order.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Customer & Address Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-3">
                <User className="w-4 h-4 text-blue-400" />
                <span>بيانات العميل</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="font-bold text-white text-base">{order.customerName}</div>
                <div className="flex items-center gap-2 text-slate-300 font-mono text-xs" dir="ltr">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{order.customerPhone}</span>
                </div>
                <div className="flex items-start gap-2 text-slate-400 text-xs mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span>{order.shippingAddress || 'القاهرة - مصر'}</span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-3">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>الموقف المالي للعربون والشحن</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">إجمالي قيمة الطلب:</span>
                  <span className="font-bold text-white">{order.orderTotal.toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">العربون المستلم:</span>
                  <span className="font-bold text-emerald-400">{order.depositPaid.toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">المتبقي للتحصيل عند التسليم (COD):</span>
                  <span className="font-bold text-cyan-400 text-sm">{order.remainingTotal.toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ordered Products Table */}
          {items.length > 0 && (
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 text-xs font-bold text-slate-300">
                المنتجات المطلوبة ({items.length})
              </div>
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900/60 text-slate-400">
                  <tr>
                    <th className="px-4 py-2">المنتج</th>
                    <th className="px-4 py-2 text-center">الكمية</th>
                    <th className="px-4 py-2 text-left">السعر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 font-medium text-slate-200">{item.name}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-300">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-left font-bold text-slate-300">
                        {(item.price * item.quantity).toFixed(2)} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Receipt Scans & Vision AI Analysis */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Image className="w-4 h-4 text-purple-400" />
              <span>إيصالات التحويل وتحليل الرؤية الذكية (Vision AI)</span>
            </h3>

            {(!order.receiptScans || order.receiptScans.length === 0) ? (
              <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
                لم يتم إرسال أي إيصال تحويل من العميل عبر واتساب حتى الآن.
              </div>
            ) : (
              <div className="space-y-3">
                {order.receiptScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start"
                  >
                    <div className="w-28 h-28 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shrink-0">
                      <img
                        src={scan.imageUrl}
                        alt="Receipt"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">
                          {scan.detectedWallet || 'محفظة إلكترونية'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          ثقة النموذج: {(scan.confidenceScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-slate-300">
                        <span className="text-slate-500">المبلغ المستخرج:</span>{' '}
                        <strong className="text-emerald-400">{scan.detectedAmount} ج.م</strong>
                      </div>
                      <div className="text-slate-300">
                        <span className="text-slate-500">رقم العملية / المرجع:</span>{' '}
                        <strong className="font-mono text-purple-300">{scan.detectedRefId || 'غير متوفر'}</strong>
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        تاريخ التحويل: {scan.detectedDate || new Date(scan.createdAt).toLocaleString('ar-EG')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consumed Banking SMS */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>الرسائل البنكية المرتبطة (Incoming SMS)</span>
            </h3>

            {(!order.consumedSms || order.consumedSms.length === 0) ? (
              <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500">
                لا توجد رسائل بنكية مقترنة بهذا الطلب حتى الآن.
              </div>
            ) : (
              <div className="space-y-2">
                {order.consumedSms.map((sms) => (
                  <div
                    key={sms.id}
                    className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-300">{sms.sender}</span>
                      <span className="font-mono font-bold text-emerald-400">{sms.amount} ج.م</span>
                    </div>
                    <p className="text-slate-300 font-mono text-[11px]">{sms.rawMessage}</p>
                    <div className="text-[10px] text-slate-500">
                      تم الاستلام: {new Date(sms.receivedAt).toLocaleString('ar-EG')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waybill Output Preview */}
          {order.waybillUrl && (
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-400" />
                <div>
                  <div className="font-bold text-white text-sm">بوليصة الشحن الرسمية جاهزة</div>
                  <div className="text-xs text-slate-400">تم إنشاء البوليصة بصيغتي PNG و PDF وإرسالها آلياً للعميل وفرع المتجر</div>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={order.waybillUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition"
                >
                  صورة (PNG)
                </a>
                {order.waybillPdfUrl && (
                  <a
                    href={order.waybillPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg transition"
                  >
                    مستند (PDF)
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            معرف الطلب الداخلي: <span className="font-mono">{order.id}</span>
          </div>
          <div className="flex gap-2">
            {order.status !== 'CONFIRMED' && (
              <button
                onClick={() => onManualVerify(order)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition"
              >
                تأكيد التحقق يدوياً الآن
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
