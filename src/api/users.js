/**
 * API người dùng – dùng cho màn Nhân sự (admin/leader xem danh sách, admin đổi role).
 */
import { request } from './client.js';

/**
 * Lấy danh sách user theo quyền: truyền currentUserId để admin thấy tất cả, leader thấy cùng nhóm, staff thấy mình.
 * GET /api/users?currentUserId=...
 */
export async function fetchUsers(currentUserId) {
  const url = currentUserId != null ? `users?currentUserId=${encodeURIComponent(currentUserId)}` : 'users';
  const data = await request(url);
  return Array.isArray(data) ? data : [];
}

/**
 * Admin cập nhật role cho user.
 * Gọi: PATCH /api/users/{id}/role?adminId=...&role=ADMIN|LEADER|STAFF
 */
export async function updateUserRole(userId, newRole, adminId) {
  const role = String(newRole || '').toUpperCase();
  const url = `users/${userId}/role?adminId=${encodeURIComponent(adminId)}&role=${encodeURIComponent(role)}`;
  return request(url, { method: 'PATCH' });
}

