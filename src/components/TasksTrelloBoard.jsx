import React from 'react';
import { ClipboardList, User, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

const STATUS_COLUMNS = [
  { id: 'new', status: 'new', title: 'Tồn đọng', color: 'bg-amber-50 border-amber-200', headerBg: 'bg-amber-100 text-amber-900' },
  { id: 'accepted', status: 'accepted', title: 'Đang thực hiện', color: 'bg-emerald-50 border-emerald-200', headerBg: 'bg-emerald-100 text-emerald-900' },
  { id: 'pending_approval', status: 'pending_approval', title: 'Đợi duyệt', color: 'bg-violet-50 border-violet-200', headerBg: 'bg-violet-100 text-violet-900' },
  { id: 'completed', status: 'completed', title: 'Hoàn thành', color: 'bg-slate-50 border-slate-200', headerBg: 'bg-slate-200 text-slate-800' },
  { id: 'paused', status: 'paused', title: 'Tạm dừng', color: 'bg-gray-50 border-gray-200', headerBg: 'bg-gray-200 text-gray-700' },
];

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(String(str).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(String(str).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timePart = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

function weightLabel(weight) {
  if (weight == null || weight === '') return '—';
  const w = Number(weight);
  if (Number.isNaN(w)) return '—';
  if (w <= 0.4) return 'Thấp';
  if (w <= 0.6) return 'Bình thường';
  if (w <= 0.8) return 'Cao';
  return 'Rất cao';
}

function qualityLabel(quality) {
  if (quality == null || quality === '') return '—';
  const q = Number(quality);
  if (Number.isNaN(q)) return '—';
  return String(q);
}

export function TasksTrelloBoard({ tasks = [], onTaskClick, taskIdsWithProgressReport }) {
  const reportedSet = taskIdsWithProgressReport instanceof Set
    ? taskIdsWithProgressReport
    : new Set(Array.isArray(taskIdsWithProgressReport) ? taskIdsWithProgressReport : []);

  const getTasksByStatus = (status) => {
    const s = (status || '').toLowerCase();
    return (tasks || []).filter((t) => (t.status || '').toLowerCase() === s);
  };

  const hasReportedProgress = (task) => {
    if (!task?.id) return false;
    return reportedSet.has(String(task.id));
  };

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Xem nhiệm vụ theo trạng thái (dạng Trello). Bấm vào thẻ để xem chi tiết.</p>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {STATUS_COLUMNS.map((col) => {
        const columnTasks = getTasksByStatus(col.status);
        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-72 rounded-xl border-2 ${col.color} flex flex-col overflow-hidden`}
          >
            <div className={`px-4 py-3 font-semibold text-sm flex items-center gap-2 ${col.headerBg}`}>
              <ClipboardList size={18} />
              <span>{col.title}</span>
              <span className="ml-auto bg-white/80 rounded-full px-2 py-0.5 text-xs">{columnTasks.length}</span>
            </div>
            <div className="flex-1 p-2 overflow-y-auto space-y-2">
              {columnTasks.map((task) => {
                const reported = hasReportedProgress(task);
                const isNew = (task.status || '').toLowerCase() === 'new';
                const description = task.objective || task.content || '';
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskClick && onTaskClick(task.id)}
                    className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all relative overflow-hidden group"
                  >
                    {isNew && <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500" />}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <p className="font-bold text-slate-900 text-sm line-clamp-2 flex-1 min-w-0 group-hover:text-[#D4384E] transition-colors">
                        {task.title || 'Nhiệm vụ'}
                      </p>
                      {isNew && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-orange-500 text-white uppercase shrink-0">
                          MỚI
                        </span>
                      )}
                      {reported && (
                        <span className="flex items-center gap-0.5 text-emerald-600 shrink-0" title="Đã báo tiến độ">
                          <CheckCircle2 size={14} />
                          <span className="text-[10px] font-semibold">Đã báo</span>
                        </span>
                      )}
                    </div>
                    {description && (
                      <p className="text-slate-500 text-xs line-clamp-2 mb-3">{description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        <span className="text-slate-400">CHỦ TRÌ:</span> {task.assigneeName || '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        <span className="text-slate-400">HẠN CHÓT:</span> {formatDateTime(task.deadline)}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        <span className="text-slate-400">TRỌNG SỐ:</span> {weightLabel(task.weight)}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        <span className="text-slate-400">CHẤT LƯỢNG:</span> {qualityLabel(task.quality)}
                      </span>
                      <span className="text-sky-600 text-xs font-semibold ml-auto">Xem chi tiết →</span>
                    </div>
                  </button>
                );
              })}
              {columnTasks.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-sm">Không có</div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
