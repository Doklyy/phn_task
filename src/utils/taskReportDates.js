/**
 * Chuỗi YYYY-MM-DD (lịch local) từ trường ngày giờ của task (API).
 */
function toLocalYMD(raw) {
  if (!raw) return '';
  const s = String(raw).replace(' ', 'T');
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Ngày đầu tiên được phép / phải ghi nhận báo cáo tiến độ:
 * từ lúc **tiếp nhận** (acceptedAt), không tính khi còn NEW.
 * Dữ liệu cũ không có acceptedAt → fallback ngày tạo.
 */
export function getTaskFirstReportableDateStr(task) {
  if (!task) return '';
  const accepted = toLocalYMD(task.acceptedAt ?? task.accepted_at);
  if (accepted) return accepted;
  return toLocalYMD(task.createdAt ?? task.created_at);
}

/** So sánh chuỗi YYYY-MM-DD */
export function dateStrLTE(a, b) {
  if (!a || !b) return true;
  return String(a).slice(0, 10) <= String(b).slice(0, 10);
}

/**
 * Có bắt báo cáo tiến độ trong ngày lịch `dateStr` (YYYY-MM-DD) không.
 * Không bắt: chưa đến ngày tiếp nhận, tạm dừng, đợi duyệt, hoàn thành (sau ngày kết thúc hoặc hoàn thành không ngày).
 * NEW: chưa tiếp nhận — không bắt; sau khi tiếp nhận (acceptedAt) mới áp.
 */
export function taskRequiresProgressReportOnDateStr(task, dateStr) {
  if (!task || !dateStr) return false;
  const dStr = String(dateStr).slice(0, 10);
  const status = (task.status || '').toLowerCase();
  const first = getTaskFirstReportableDateStr(task);
  if (first && dStr < first) return false;
  if (status === 'pending_approval') return false;
  if (status === 'new') return false;
  if (status === 'completed') {
    const completedStr = (task.completedAt || task.completed_at || task.submittedAt || task.submitted_at)
      ? String(task.completedAt || task.completed_at || task.submittedAt || task.submitted_at).slice(0, 10)
      : null;
    if (!completedStr) return false;
    if (dStr > completedStr) return false;
  }
  if (status === 'paused') return false;
  return true;
}
