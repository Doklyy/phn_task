import React from 'react';
import { ClipboardList, Calendar, User } from 'lucide-react';

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

export function TasksTrelloBoard({ tasks = [], onTaskClick }) {
  const getTasksByStatus = (status) => {
    const s = (status || '').toLowerCase();
    return (tasks || []).filter((t) => (t.status || '').toLowerCase() === s);
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
              {columnTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onTaskClick && onTaskClick(task.id)}
                  className="w-full text-left bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <p className="font-medium text-slate-800 text-sm line-clamp-2">{task.title || 'Nhiệm vụ'}</p>
                  <div className="mt-2 flex flex-col gap-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {task.assigneeName || '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      Ngày giao: {formatDate(task.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      Hạn chót: {formatDate(task.deadline)}
                    </span>
                  </div>
                </button>
              ))}
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
