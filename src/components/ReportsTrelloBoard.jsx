import React from 'react';
import { FileText, User } from 'lucide-react';

function formatDateStr(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  if (s.length < 10) return s;
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

export function ReportsTrelloBoard({ reports = [], onReportClick }) {
  const byDate = {};
  (reports || []).forEach((r) => {
    const d = (r.date || r.reportDate || '').slice(0, 10);
    if (!d) return;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  });
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 14);

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Báo cáo tiến độ theo ngày (dạng Trello). Mỗi cột là một ngày, thẻ là báo cáo của từng người.</p>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[360px]">
      {sortedDates.map((date) => {
        const dayReports = byDate[date] || [];
        return (
          <div
            key={date}
            className="flex-shrink-0 w-80 rounded-xl border-2 border-slate-200 bg-slate-50/50 flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 font-semibold text-sm flex items-center gap-2 bg-slate-100 text-slate-800 border-b border-slate-200">
              <FileText size={18} />
              <span>Ngày {formatDateStr(date)}</span>
              <span className="ml-auto bg-white rounded-full px-2 py-0.5 text-xs">{dayReports.length}</span>
            </div>
            <div className="flex-1 p-2 overflow-y-auto space-y-2">
              {dayReports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onReportClick && onReportClick(r)}
                  className="w-full text-left bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                    <User size={12} />
                    {r.userName || r.user_name || '—'}
                  </p>
                  <p className="font-medium text-slate-800 text-sm line-clamp-1">{r.taskTitle || r.task_title || 'Nhiệm vụ'}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.result || '—'}</p>
                </button>
              ))}
              {dayReports.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-sm">Không có báo cáo</div>
              )}
            </div>
          </div>
        );
      })}
      {sortedDates.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-400 py-12">Chưa có báo cáo nào</div>
      )}
      </div>
    </div>
  );
}
