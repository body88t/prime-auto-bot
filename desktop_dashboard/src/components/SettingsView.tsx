import React from 'react';
import { Settings, Shield, Key, Sliders, Server, Smartphone, ExternalLink, CheckCircle } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Endpoints Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">عناوين الربط ونقاط النهاية (API Endpoints)</h2>
            <p className="text-xs text-slate-400">عناوين الويب هوك لإدخالها في إعدادات منصة ويلت (Wuilt) وواتساب للأعمال</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
            <div className="text-slate-400 font-sans font-bold flex items-center justify-between">
              <span>رابط استقبال طلبات وسلات ويلت (Wuilt Webhook):</span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono">POST</span>
            </div>
            <div className="text-blue-400 select-all p-2 bg-slate-900 rounded border border-slate-800 text-[11px]">
              http://your-domain.com/api/v1/webhooks/wuilt
            </div>
            <div className="text-[11px] text-slate-500 font-sans">الأحداث المدعومة: order.created, cart.abandoned</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
            <div className="text-slate-400 font-sans font-bold flex items-center justify-between">
              <span>رابط ويب هوك واتساب (WhatsApp Webhook):</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono">GET / POST</span>
            </div>
            <div className="text-emerald-400 select-all p-2 bg-slate-900 rounded border border-slate-800 text-[11px]">
              http://your-domain.com/api/v1/webhooks/whatsapp
            </div>
            <div className="text-[11px] text-slate-500 font-sans">رمز التحقق الافتراضي: prime_wa_webhook_verify_token</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1 md:col-span-2">
            <div className="text-slate-400 font-sans font-bold flex items-center justify-between">
              <span>رابط مزامنة رسائل تطبيق أندرويد (Android SMS Ingestion Gateway):</span>
              <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono">POST</span>
            </div>
            <div className="text-purple-400 select-all p-2 bg-slate-900 rounded border border-slate-800 text-[11px]">
              http://your-domain.com/api/v1/sms/incoming
            </div>
            <div className="text-[11px] text-slate-500 font-sans">مؤمن بواسطة الترويسة x-api-key: INTERNAL_SMS_SYNC_KEY</div>
          </div>
        </div>
      </div>

      {/* Financial & Matching Rules Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">قواعد التحقق المالي والحد الأدنى (Financial Rules)</h2>
            <p className="text-xs text-slate-400">القواعد المنطقية الصارمة المطبقة في محرك المطابقة</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-slate-400 font-bold mb-1">حد التأكيد المباشر (Threshold)</div>
            <div className="text-2xl font-black text-emerald-400">190 ج.م</div>
            <p className="text-slate-500 text-[11px] mt-1">
              إذا كان المبلغ &gt;= 190 ج، يتم تأكيد الطلب فوراً وتوليد البوليصة.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-slate-400 font-bold mb-1">عربون الطلب المستهدف</div>
            <div className="text-2xl font-black text-blue-400">200 ج.م</div>
            <p className="text-slate-500 text-[11px] mt-1">
              المبلغ المطلوب في رسائل تعليمات الدفع الموجهة للعملاء.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-slate-400 font-bold mb-1">النافذة الزمنية للمطابقة</div>
            <div className="text-2xl font-black text-purple-400">30 دقيقة</div>
            <p className="text-slate-500 text-[11px] mt-1">
              أقصى فارق زمني مقبول بين وقت الطلب ورسالة البنك عند تطابق المبلغ.
            </p>
          </div>
        </div>
      </div>

      {/* Security Whitelist Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">قائمة الجهات المعتمدة (Authorized Whitelist)</h2>
            <p className="text-xs text-slate-400">المرسلون المقبولون حصراً لمنع الاحتيال أو تزوير الرسائل الشخصية</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {[
            'VF-Cash (فودافون كاش)',
            'InstaPay (إنستاباي - شبكة المدفوعات اللحظية)',
            'OrangeCash (أورانج كاش)',
            'EtisalatCash / e& money (اتصالات كاش)',
            'WEPay (وي باي)',
            'CIB (البنك التجاري الدولي)',
            'Banque Misr (بنك مصر)',
            'NBE (البنك الأهلي المصري)',
            'QNB ALAHLI (بنك قطر الوطني)',
          ].map((item, idx) => (
            <span
              key={idx}
              className="px-3 py-1.5 bg-slate-950 text-slate-300 rounded-xl border border-slate-800 font-medium flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
