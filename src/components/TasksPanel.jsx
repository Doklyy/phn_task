import { TaskCard } from './TaskCard';
import { exportTasksToExcel } from '../utils/excelExport';

const STATUS_LABELS = { new: 'Mới', in_progress: 'Đang làm', overdue: 'Quá hạn' };

export function TasksPanel({ tasks, onAcceptTask, onExportExcel }) {
  const tasksWithLabel = tasks.map((t) => ({ ...t, statusLabel: STATUS_LABELS[t.status] || t.status }));

  return (
    <div className="tasks-panel">
      <div className="panel-toolbar">
        <button type="button" className="btn-export" onClick={() => onExportExcel(tasksWithLabel)}>
          Xuất Excel
        </button>
      </div>
      <div className="task-grid">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onAccept={onAcceptTask} />
        ))}
      </div>
      {tasks.length === 0 && (
        <p className="empty-state">Chưa có nhiệm vụ nào.</p>
      )}
    </div>
  );
}
