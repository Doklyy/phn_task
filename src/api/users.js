/**
 * API người dùng – dùng cho màn Nhân sự (admin/leader xem danh sách, admin đổi role).
 */
import { request } from './client.js';

/**
 * Lấy danh sách user theo quyền.
 * GET /api/users?currentUserId=...
 */
export async function fetchUsers(currentUserId) {
  const url = currentUserId != null ? `users?currentUserId=${encodeURIComponent(currentUserId)}` : 'users';
  const data = await request(url);
  return Array.isArray(data) ? data : [];
}

/**
 * Danh sách nhân sự (không bao gồm admin). Dùng cho màn Nhân sự.
 * GET /api/users?currentUserId=...&personnelOnly=true
 */
export async function fetchPersonnel(currentUserId) {
  if (currentUserId == null) return [];
  const url = `users?currentUserId=${encodeURIComponent(currentUserId)}&personnelOnly=true`;
  const data = await request(url);
  return Array.isArray(data) ? data : [];
}

/**
 * Admin cập nhật role cho user.
 * PATCH /api/users/{id}/role?adminId=...&role=ADMIN|LEADER|STAFF
 */
export async function updateUserRole(userId, newRole, adminId) {
  const role = String(newRole || '').toUpperCase();
  const url = `users/${userId}/role?adminId=${encodeURIComponent(adminId)}&role=${encodeURIComponent(role)}`;
  return request(url, { method: 'PATCH' });
}

/**
 * Admin bật/tắt quyền chấm công. PATCH /api/users/{id}/attendance-permission?adminId=...&allowed=true|false
 */
export async function updateAttendancePermission(userId, allowed, adminId) {
  const url = `users/${userId}/attendance-permission?adminId=${encodeURIComponent(adminId)}&allowed=${allowed}`;
  return request(url, { method: 'PATCH' });
}

/**
 * Admin xóa nhân viên. DELETE /api/users/{id}?adminId=...
 */
export async function deleteUser(userId, adminId) {
  const url = `users/${userId}?adminId=${encodeURIComponent(adminId)}`;
  return request(url, { method: 'DELETE' });
}

/**
 * Admin tạo nhân viên mới. POST /api/users?creatorId=...
 * Body: { username, password, name, role, team?, canManageAttendance? }
 */
export async function createUser(payload, creatorId) {
  const url = `users?creatorId=${encodeURIComponent(creatorId)}`;
  return request(url, { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * Admin cập nhật nhóm cho user. PATCH /api/users/{id}/team?adminId=...&team=...
 */
export async function updateUserTeam(userId, team, adminId) {
  const url = `users/${userId}/team?adminId=${encodeURIComponent(adminId)}${team != null && team !== '' ? `&team=${encodeURIComponent(team)}` : ''}`;
  return request(url, { method: 'PATCH' });
}
