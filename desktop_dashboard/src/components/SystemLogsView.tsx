import React, { useState } from 'react';
import { SystemLog } from '../types';
import { Terminal, Info, AlertTriangle, AlertOctagon, Filter } from 'lucide-react';

interface SystemLogsViewProps {
  logs: SystemLog[];
  loading: boolean;
  onRefresh: () => void;
}

export const SystemLogsView: React.FC<SystemLogsViewProps> = ({ logs, loading, onRefresh }) => {
  const [levelFilter, setLevelFilter] = useState<string>('ALL');

  const filtered = logs.filter((log) => {
    if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
    return true;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
      case 'WARN':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      case 'INFO':
      default:
        return <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">سجلات التدقيق وأحداث النظام (Audit Logs)</h2>
            <p className="text-xs text-slate-400">تتبع زمني لكافة أحداث Webhooks، مسح Vision OCR، والمطابقة</p>
          </div>
        </div>

        {/* Level Filter */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                levelFilter === lvl
                  ? lvl === 'ERROR'
                    ? 'bg-rose-600 text-white'
                    : lvl === 'WARN'
                    ? 'bg-amber-600 text-white'
                    : 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lvl === 'ALL' ? 'جميع المستويات' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Stream */}
      <div className="divide-y divide-slate-800/60 max-h-[700px] overflow-y-auto font-mono">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs font-sans">جاري تحميل السجلات...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-slate-500 text-xs font-sans">لا توجد سجلات مسجلة.</div>
        ) : (
          filtered.map((log) => (
            <div key={log.id} className="p-3.5 hover:bg-slate-800/30 transition text-xs flex gap-3 items-start">
              {getLevelIcon(log.level)}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">
                    {new Date(log.createdAt).toLocaleTimeString('ar-EG')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {log.category}
                  </span>
                </div>
                <div className="text-slate-200">{log.message}</div>
                {log.metadata && (
                  <pre className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800/60 overflow-x-auto">
                    {log.metadata}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
