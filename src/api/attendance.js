/**
 * API chấm công.
 */
import { request, isApiConfigured } from './client.js';

export async function checkIn(userId) {
  if (!isApiConfigured()) throw new Error('API chưa cấu hình');
  return request(`attendance/check-in?userId=${encodeURIComponent(userId)}`, { method: 'POST' });
}

export async function checkOut(userId) {
  if (!isApiConfigured()) throw new Error('API chưa cấu hình');
  return request(`attendance/check-out?userId=${encodeURIComponent(userId)}`, { method: 'POST' });
}

/**
 * GET /api/attendance/records — cần currentUserId và userId (và from/to nếu có).
 */
export async function getAttendanceRecords(currentUserId, userId, from, to) {
  if (!isApiConfigured()) return [];
  const params = new URLSearchParams({ currentUserId: String(currentUserId), userId: String(userId) });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const data = await request(`attendance/records?${params}`);
  return Array.isArray(data) ? data : [];
}

export async function getAttendanceRecordsForMonth(currentUserId, year, month, targetUserId) {
  if (!isApiConfigured()) return [];
  const params = new URLSearchParams({ currentUserId, year, month: String(month) });
  if (targetUserId) params.set('targetUserId', targetUserId);
  const data = await request(`attendance/records/month?${params}`);
  return Array.isArray(data) ? data : [];
}

export async function getTimeWorkScore(userId, year, month) {
  if (!isApiConfigured()) return { timeWorkScore: 0 };
  const params = new URLSearchParams({ userId, year, month: String(month) });
  return request(`attendance/time-score?${params}`);
}

/** GET /api/attendance/codes — danh sách mã trạng thái (code, description) cho dropdown. */
export async function getAttendanceCodes() {
  if (!isApiConfigured()) return [];
  const data = await request('attendance/codes');
  return Array.isArray(data) ? data : [];
}

/**
 * PATCH /api/attendance/records/{id} — cập nhật giờ vào/ra và trạng thái. Chỉ người có quyền chấm công.
 * checkInAt, checkOutAt: "HH:mm" hoặc null; attendanceCode: "L" | "N_FULL" | ...
 */
export async function updateAttendanceRecord(recordId, currentUserId, { checkInAt, checkOutAt, attendanceCode }) {
  if (!isApiConfigured()) throw new Error('API chưa cấu hình');
  const params = new URLSearchParams({ currentUserId: String(currentUserId) });
  if (checkInAt != null && checkInAt !== '') params.set('checkInAt', String(checkInAt).slice(0, 5));
  if (checkOutAt != null && checkOutAt !== '') params.set('checkOutAt', String(checkOutAt).slice(0, 5));
  if (attendanceCode != null && attendanceCode !== '') params.set('attendanceCode', attendanceCode);
  return request(`attendance/records/${recordId}?${params}`, { method: 'PATCH' });
}

/**
 * POST /api/attendance/records — tạo bản ghi chấm công. Chỉ người có quyền.
 * recordDate: "yyyy-MM-dd"
 */
export async function createAttendanceRecord(currentUserId, userId, recordDate, { checkInAt, checkOutAt, attendanceCode }) {
  if (!isApiConfigured()) throw new Error('API chưa cấu hình');
  const params = new URLSearchParams({
    currentUserId: String(currentUserId),
    userId: String(userId),
    recordDate: String(recordDate).slice(0, 10),
  });
  if (checkInAt != null && checkInAt !== '') params.set('checkInAt', String(checkInAt).slice(0, 5));
  if (checkOutAt != null && checkOutAt !== '') params.set('checkOutAt', String(checkOutAt).slice(0, 5));
  if (attendanceCode != null && attendanceCode !== '') params.set('attendanceCode', attendanceCode);
  return request(`attendance/records?${params}`, { method: 'POST' });
}
