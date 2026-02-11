import { utils, writeFileXLSX } from 'xlsx';

/**
 * Xuất danh sách nhiệm vụ ra file Excel.
 * @param {Array} tasks - Mảng task (id, title, status, dueDate, ...)
 * @param {string} filename - Tên file (mặc định tasks.xlsx)
 */
export function exportTasksToExcel(tasks, filename = 'danh-sach-nhiem-vu.xlsx') {
  const rows = tasks.map((t) => ({
    'Mã': t.id,
    'Tiêu đề': t.title,
    'Trạng thái': t.statusLabel || statusToLabel(t.status),
    'Hạn': t.dueDate || '',
  }));
  const ws = utils.json_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Nhiệm vụ');
  writeFileXLSX(wb, filename);
}

function statusToLabel(status) {
  const map = { new: 'Mới', in_progress: 'Đang làm', overdue: 'Quá hạn' };
  return map[status] || status;
}
