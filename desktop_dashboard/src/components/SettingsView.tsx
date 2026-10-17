import React, { useState } from 'react';
import { Settings, Shield, Key, Sliders, Server, Smartphone, ExternalLink, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { api, getApiBaseUrl, setApiBaseUrl } from '../services/api';

export const SettingsView: React.FC = () => {
  const currentUrl = getApiBaseUrl().replace(/\/api\/v1$/, '');
  const [serverUrl, setServerUrl] = useState(currentUrl);
  const [pingStatus, setPingStatus] = useState<{ testing: boolean; message?: string; ok?: boolean } | null>(null);

  const handleTestAndSave = async (urlToTest?: string) => {
    const target = urlToTest || serverUrl;
    setPingStatus({ testing: true });
    const result = await api.pingServer(target);
    setPingStatus({ testing: false, ok: result.ok, message: result.message });
    if (result.ok) {
      setApiBaseUrl(target);
      setServerUrl(target.replace(/\/api\/v1$/, ''));
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  const handlePresetClick = (presetUrl: string) => {
    setServerUrl(presetUrl);
    handleTestAndSave(presetUrl);
  };

  return (
    <div className="space-y-6">
      {/* Active Server Connection Card */}
      <div className="bg-slate-900/90 border border-blue-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">اتصال السيرفر (Backend Server Gateway)</h2>
              <p className="text-xs text-slate-400">حدد رابط السيرفر الذي يتصل به برنامج الداش بورد (سيرفر الهاتف أو المحلي)</p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold">
            Live Gateway
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-tunnel.trycloudflare.com or http://localhost:3000"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-blue-500 transition"
              dir="ltr"
            />
            <button
              onClick={() => handleTestAndSave()}
              disabled={pingStatus?.testing}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {pingStatus?.testing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الفحص...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>اختبار وحفظ</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">روابط سريعة:</span>
            <button
              type="button"
              onClick={() => handlePresetClick('https://prime-auto-bot.primeauto-eg.workers.dev')}
              className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-mono transition"
            >
              ☁️ السيرفر السحابي الدائم (Cloudflare Cloud)
            </button>
            <button
              type="button"
              onClick={() => handlePresetClick('http://localhost:3000')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-mono transition"
            >
              💻 سيرفر محلي (localhost:3000)
            </button>
          </div>

          {/* Feedback Alert */}
          {pingStatus && !pingStatus.testing && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                pingStatus.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {pingStatus.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{pingStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Endpoints Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">عناوين الربط ونقاط النهاية (API Endpoints)</h2>
            <p className="text-xs text-slate-400">عناوين الويب هوك لإدخالها في إعدادات منصة ويلت (Wuilt) وتطبيق الـ SMS</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
            <div className="text-slate-400 font-sans font-bold flex items-center justify-between">
              <span>رابط استقبال طلبات وسلات ويلت (Wuilt Webhook):</span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono">POST</span>
            </div>
            <div className="text-blue-400 select-all p-2 bg-slate-900 rounded border border-slate-800 text-[11px]" dir="ltr">
              {serverUrl}/api/v1/webhooks/wuilt
            </div>
            <div className="text-[11px] text-slate-500 font-sans">الأحداث المدعومة: order.created, cart.abandoned</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
            <div className="text-slate-400 font-sans font-bold flex items-center justify-between">
              <span>رابط ويب هوك واتساب (WhatsApp Webhook):</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono">GET / POST</span>
            </div>
            <div className="text-emerald-400 select-all p-2 bg-slate-900 rounded border border-slate-800 text-[11px]" dir="ltr">
              {serverUrl}/api/v1/webhooks/whatsapp
            </div>
            <div className="text-[11px] text-slate-500 font-sans">رمز التحقق الافتراضي: prime_wa_webhook_verify_token</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1 md:col-span-2">
            <div className="text-slate-400 font-sans font-bold flex items-center justify-between">
              <span>رابط مزامنة رسائل تطبيق أندرويد (Android SMS Ingestion Gateway):</span>
              <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono">POST</span>
            </div>
            <div className="text-purple-400 select-all p-2 bg-slate-900 rounded border border-slate-800 text-[11px]" dir="ltr">
              {serverUrl}/api/v1/sms/incoming
            </div>
            <div className="text-[11px] text-slate-500 font-sans">مؤمن بواسطة الترويسة x-api-key: prime_sms_secret_token_8899aabbcc</div>
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
            <h2 className="text-base font-bold text-white">المرسلون المعتمدون للرسائل البنكية (SMS Whitelist)</h2>
            <p className="text-xs text-slate-400">مرسلو الرسائل القصيرة المقبولون حصراً لدى خوارزمية الفرز</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {['Vodafone', 'VF-Cash', 'InstaPay', 'Orange', 'OrangeCash', 'Etisalat', 'EtisalatCash', 'WE', 'WECash', 'CIB', 'NBE', 'BM'].map((sender) => (
            <span key={sender} className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              {sender}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
