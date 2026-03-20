/**
 * Ngày tạo nhiệm vụ (theo lịch local) là ngày đầu tiên được phép ghi nhận báo cáo tiến độ.
 * Không thể báo cáo cho ngày trước ngày tạo (vd: tạo 20/3 → không báo cáo 19/3).
 */
export function getTaskFirstReportableDateStr(task) {
  if (!task) return '';
  const raw = task.createdAt ?? task.created_at;
  if (!raw) return '';
  const s = String(raw).replace(' ', 'T');
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** So sánh chuỗi YYYY-MM-DD */
export function dateStrLTE(a, b) {
  if (!a || !b) return true;
  return String(a).slice(0, 10) <= String(b).slice(0, 10);
}
