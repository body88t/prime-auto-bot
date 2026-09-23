import React, { useState } from 'react';
import { Order } from '../types';
import { X, CheckCircle, ShieldAlert, AlertTriangle } from 'lucide-react';

interface ManualVerificationModalProps {
  order: Order | null;
  onClose: () => void;
  onSubmit: (orderId: string, amount: number, notes?: string) => Promise<void>;
}

export const ManualVerificationModal: React.FC<ManualVerificationModalProps> = ({
  order,
  onClose,
  onSubmit,
}) => {
  if (!order) return null;

  const [amount, setAmount] = useState<number>(200);
  const [notes, setNotes] = useState<string>('تم التحقق يدوياً بواسطة مسؤول النظام.');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('يجب إدخال مبلغ صحيح أكبر من 0.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(order.id, amount, notes);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'حدث خطأ أثناء التحقق اليدوي.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFullConfirm = amount >= 190;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">التحقق اليدوي البديل (Manual Verification)</h2>
              <p className="text-xs text-slate-400">طلب #{order.wuiltOrderId} - {order.customerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              المبلغ المتحقق منه (بالجنيه المصري EGP)
            </label>
            <input
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 text-white font-mono font-bold text-lg rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition"
              required
            />
            <div className="mt-2 text-xs">
              {isFullConfirm ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  المبلغ يحقق شرط العربون (&gt;= 190 ج.م). سيتم تأكيد الطلب، وإنشاء البوليصة وإرسالها فوراً.
                </span>
              ) : (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  المبلغ أقل من 190 ج.م. سيتم تسجيله كـ "عربون جزئي" وإرسال رسالة مطالبة بالمتبقي مع إيقاف الشحن.
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              ملاحظات التحقق والتدقيق
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 transition"
              placeholder="اكتب سبب التأكيد اليدوي أو رقم المعاملة البنكية..."
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2.5 text-xs font-bold text-white rounded-xl shadow-lg transition ${
                isFullConfirm
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
              }`}
            >
              {submitting ? 'جاري المعالجة...' : isFullConfirm ? 'تأكيد الطلب وإصدار البوليصة' : 'تسجيل كعربون جزئي'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
