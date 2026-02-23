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
