import './TaskCard.css';

const STATUS_CONFIG = {
  new: { label: 'Mới', className: 'status-new' },
  in_progress: { label: 'Đang làm', className: 'status-in-progress' },
  overdue: { label: 'Quá hạn', className: 'status-overdue' },
};

export function TaskCard({ task, onAccept }) {
  const config = STATUS_CONFIG[task.status] || { label: task.status, className: '' };
  const canAccept = task.status === 'new';

  return (
    <div className={`task-card ${config.className}`}>
      <div className="task-card-header">
        <span className="task-id">#{task.id}</span>
        <span className={`task-badge ${config.className}`}>{config.label}</span>
      </div>
      <h4 className="task-title">{task.title}</h4>
      <p className="task-due">Hạn: {task.dueDate || '—'}</p>
      {canAccept && (
        <button type="button" className="btn-accept" onClick={() => onAccept(task)}>
          Tiếp nhận
        </button>
      )}
    </div>
  );
}
