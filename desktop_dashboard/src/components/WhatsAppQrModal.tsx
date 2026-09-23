import React from 'react';
import { X, Smartphone, CheckCircle, RefreshCw, AlertCircle, LogOut } from 'lucide-react';

interface WhatsAppQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED';
  qrCodeDataUrl: string | null;
  connectedPhone: string | null;
  onRefresh: () => void;
}

export const WhatsAppQrModal: React.FC<WhatsAppQrModalProps> = ({
  isOpen,
  onClose,
  status,
  qrCodeDataUrl,
  connectedPhone,
  onRefresh,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">ربط واتساب بالهاتف (Baileys WA)</h2>
              <p className="text-xs text-slate-400">بدون Meta Cloud API - يعمل برقمك الشخصي مجاناً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          {status === 'CONNECTED' ? (
            <div className="py-6 space-y-3">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">واتساب متصل بنجاح! 🎉</h3>
              <p className="text-xs text-slate-300">
                الرقم النشط لإرسال واستقبال الرسائل:
              </p>
              <div className="font-mono font-bold text-sm bg-slate-950 py-2 px-4 rounded-xl border border-slate-800 text-emerald-400 inline-block" dir="ltr">
                +{connectedPhone || '01019930974'}
              </div>
              <p className="text-[11px] text-slate-500">
                بيانات الجلسة محفوظة في مجلد المشروع، ولن تحتاج لإعادة المسح عند إعادة التشغيل.
              </p>
            </div>
          ) : status === 'SCAN_QR' && qrCodeDataUrl ? (
            <div className="space-y-4">
              <div className="bg-white p-3 rounded-2xl inline-block shadow-xl border-4 border-emerald-500/40">
                <img
                  src={qrCodeDataUrl}
                  alt="WhatsApp Pairing QR Code"
                  className="w-64 h-64 mx-auto rounded-lg"
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-right text-xs space-y-2">
                <div className="font-bold text-slate-200">خطوات الربط من هاتفك:</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>افتح تطبيق واتساب على هاتفك الشخصي.</li>
                  <li>اضغط على القائمة (الثلاث نقاط) &gt; <strong className="text-white">الأجهزة المرتبطة (Linked Devices)</strong>.</li>
                  <li>اضغط على <strong className="text-emerald-400">ربط جهاز (Link a Device)</strong>.</li>
                  <li>وجّه كاميرا الهاتف لمسح هذا الرمز المعروض أمامك.</li>
                </ol>
              </div>

              <button
                onClick={onRefresh}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث الرمز إذا انتهت صلاحيته</span>
              </button>
            </div>
          ) : (
            <div className="py-12 space-y-3">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-sm font-bold text-white">جاري الاتصال بمحرك واتساب...</div>
              <p className="text-xs text-slate-400">
                سيظهر رمز الـ QR Code هنا وفي شاشة الأوامر (Terminal) فور توليده.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
