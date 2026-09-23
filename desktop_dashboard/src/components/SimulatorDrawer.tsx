import React, { useState } from 'react';
import { api } from '../services/api';
import { X, Play, ShoppingBag, MessageSquare, Image, CheckCircle, AlertCircle } from 'lucide-react';

interface SimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SimulatorDrawer: React.FC<SimulatorDrawerProps> = ({ isOpen, onClose, onSuccess }) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSimulateOrder = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const order = await api.simulateOrder({
        customerName: 'محمد سامي',
        customerPhone: '01012345678',
        orderTotal: 1200,
      });
      setFeedback(`تم إنشاء طلب جديد بنجاح: #${order.wuiltOrderId} وإرسال تعليمات الدفع عبر واتساب.`);
      onSuccess();
    } catch (e: any) {
      setFeedback(`فشلت المحاكاة: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSms = async (amount: number, sender = 'VF-Cash') => {
    setLoading(true);
    setFeedback(null);
    try {
      const sms = await api.simulateSms({
        sender,
        amount,
      });
      setFeedback(`تم استقبال رسالة بنكية تجريبية (${sender} - ${amount} ج.م) بنجاح.`);
      onSuccess();
    } catch (e: any) {
      setFeedback(`فشلت المحاكاة: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateReceipt = async (amount: number) => {
    setLoading(true);
    setFeedback(null);
    try {
      // Find latest pending order
      const ordersRes = await api.getOrders({ status: 'ALL', limit: 1 });
      const order = ordersRes.orders[0];
      if (!order) {
        setFeedback('لا يوجد أي طلب حالي لمحاكاة رفع الإيصال عليه. أنشئ طلباً أولاً.');
        setLoading(false);
        return;
      }

      const res = await api.simulateReceipt({
        orderId: order.id,
        amount,
        wallet: 'Vodafone Cash',
      });
      setFeedback(`تم مسح الإيصال ومطابقته: النتيجة [${res.matchResult.status}] - ${res.matchResult.message}`);
      onSuccess();
    } catch (e: any) {
      setFeedback(`فشلت المحاكاة: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end">
      <div className="bg-slate-900 border-r border-slate-800 w-full max-w-md h-full flex flex-col p-6 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Play className="w-5 h-5 text-indigo-400" />
            <span>محاكي العمليات المباشر (Sandbox)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="my-4 p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{feedback}</span>
          </div>
        )}

        <div className="space-y-6 my-4 flex-1 text-xs">
          {/* Step 1: Simulate Order */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <ShoppingBag className="w-4 h-4 text-blue-400" />
              <span>1. محاكاة طلب جديد من ويلت (Wuilt)</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              يقوم بإرسال حدث <code>order.created</code> وحفظ الطلب وإرسال رسالة واتساب للعميل برقم الحساب والعربون المطلوب.
            </p>
            <button
              onClick={handleSimulateOrder}
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition"
            >
              إنشاء طلب تجريبي جديد
            </button>
          </div>

          {/* Step 2: Simulate SMS */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>2. محاكاة رسالة بنك من هاتف الأندرويد</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              محاكاة إرسال رسالة نصية واردة من فودافون كاش أو إنستاباي إلى نقطة المزامنة.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSimulateSms(200, 'VF-Cash')}
                disabled={loading}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition"
              >
                فودافون كاش (200 ج)
              </button>
              <button
                onClick={() => handleSimulateSms(200, 'InstaPay')}
                disabled={loading}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-purple-300 font-bold rounded-xl transition"
              >
                إنستاباي (200 ج)
              </button>
            </div>
          </div>

          {/* Step 3: Simulate WhatsApp Receipt */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <Image className="w-4 h-4 text-purple-400" />
              <span>3. محاكاة إرسال إيصال تحويل عبر واتساب</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              يقوم بتشغيل محرك Vision OCR والمطابقة مع رسائل البنك وتطبيق القواعد المالية.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSimulateReceipt(200)}
                disabled={loading}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
              >
                إيصال كامل (200 ج)
              </button>
              <button
                onClick={() => handleSimulateReceipt(100)}
                disabled={loading}
                className="py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition"
              >
                إيصال جزئي (100 ج)
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition text-xs"
          >
            إغلاق المحاكي
          </button>
        </div>
      </div>
    </div>
  );
};
