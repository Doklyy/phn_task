/**
 * API đăng nhập và thông tin người dùng – tích hợp BE Spring Boot.
 * BE: POST /api/auth/login, GET /api/auth/user/:userId
 */
import { request, setToken, getToken } from './client.js';

/**
 * Đăng nhập: POST /api/auth/login
 * Body: { username, password }
 * BE trả về: { userId, username, name, role, token } (token = userId dạng chuỗi)
 */
export async function login(credentials) {
  const data = await request('auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  if (data.token != null) setToken(data.token);
  return data;
}

/**
 * Lấy thông tin user hiện tại: GET /api/auth/user/:userId
 * BE dùng token (userId) đã lưu khi login để gọi endpoint này.
 */
export async function getMe() {
  const userId = getToken();
  if (!userId) throw new Error('Chưa đăng nhập');
  const user = await request(`auth/user/${userId}`);
  return normalizeUser(user);
}

/**
 * Chuẩn hóa user từ BE (userId, role, canManageAttendance) sang FE.
 */
export function normalizeUser(u) {
  if (!u) return null;
  const role = (u.role || '').toLowerCase();
  const canManage = u.canManageAttendance === true || role === 'admin';
  return {
    id: String(u.id ?? u.userId ?? ''),
    name: u.name || u.fullName || u.username || 'Người dùng',
    role: role === 'admin' || role === 'leader' || role === 'staff' ? role : 'staff',
    email: u.email,
    username: u.username,
    team: u.team || null,
    canManageAttendance: canManage,
  };
}

export function logout() {
  setToken(null);
}

export function hasStoredToken() {
  return Boolean(getToken());
}
