import React, { useState } from 'react';
import { IncomingSms } from '../types';
import { MessageSquare, CheckCircle2, Clock, Search, ShieldCheck } from 'lucide-react';

interface SmsFeedProps {
  smsList: IncomingSms[];
  loading: boolean;
  onRefresh: () => void;
}

export const SmsFeed: React.FC<SmsFeedProps> = ({ smsList, loading, onRefresh }) => {
  const [filter, setFilter] = useState<'ALL' | 'UNCONSUMED' | 'CONSUMED'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = smsList.filter((sms) => {
    if (filter === 'UNCONSUMED' && sms.isConsumed) return false;
    if (filter === 'CONSUMED' && !sms.isConsumed) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        sms.sender.toLowerCase().includes(q) ||
        (sms.referenceId && sms.referenceId.toLowerCase().includes(q)) ||
        sms.rawMessage.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">سجل الرسائل البنكية الواردة (Bank SMS Feed)</h2>
            <p className="text-xs text-slate-400">الرسائل المعتمدة والمستلمة آلياً من تطبيق أندرويد (SMS Ingestion Worker)</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل ({smsList.length})
            </button>
            <button
              onClick={() => setFilter('UNCONSUMED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filter === 'UNCONSUMED' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              متاح للربط ({smsList.filter((s) => !s.isConsumed).length})
            </button>
            <button
              onClick={() => setFilter('CONSUMED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filter === 'CONSUMED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              تم استهلاكه ({smsList.filter((s) => s.isConsumed).length})
            </button>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث في الرسائل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 rounded-xl pr-9 pl-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* SMS List */}
      <div className="divide-y divide-slate-800/60 max-h-[700px] overflow-y-auto">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">جاري تحميل الرسائل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-slate-500 text-xs">لا توجد رسائل مطابقة.</div>
        ) : (
          filtered.map((sms) => (
            <div key={sms.id} className="p-4 hover:bg-slate-800/30 transition flex flex-col md:flex-row gap-4 justify-between items-start">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    {sms.sender}
                  </span>

                  <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {sms.amount.toFixed(2)} ج.م
                  </span>

                  {sms.referenceId && (
                    <span className="text-[11px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      Ref: {sms.referenceId}
                    </span>
                  )}
                </div>

                <p className="text-slate-300 text-xs font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed">
                  {sms.rawMessage}
                </p>

                <div className="text-[11px] text-slate-500">
                  تاريخ ووقت الاستلام: {new Date(sms.receivedAt).toLocaleString('ar-EG')}
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {sms.isConsumed ? (
                  <div className="text-left md:text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> تم الربط بالطلب
                    </span>
                    {sms.consumedByOrder && (
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        طلب #{sms.consumedByOrder.wuiltOrderId} ({sms.consumedByOrder.customerName})
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Clock className="w-3.5 h-3.5" /> متاح للمطابقة
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
