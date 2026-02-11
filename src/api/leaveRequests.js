/**
 * API đơn xin nghỉ / xin đến muộn / xin về sớm.
 */
import { request, isApiConfigured } from './client.js';

export async function createLeaveRequest(userId, payload) {
  if (!isApiConfigured()) throw new Error('API chưa cấu hình');
  return request(`leave-requests?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMyLeaveRequests(userId) {
  if (!isApiConfigured()) return [];
  const data = await request(`leave-requests/my?userId=${encodeURIComponent(userId)}`);
  return Array.isArray(data) ? data : [];
}

export async function getPendingLeaveRequests(adminId) {
  if (!isApiConfigured()) return [];
  const data = await request(`leave-requests/pending?adminId=${encodeURIComponent(adminId)}`);
  return Array.isArray(data) ? data : [];
}

export async function approveLeaveRequest(requestId, adminId) {
  if (!isApiConfigured()) throw new Error('API chưa cấu hình');
  return request(`leave-requests/${requestId}/approve?adminId=${encodeURIComponent(adminId)}`, {
    method: 'PATCH',
  });
}

export async function rejectLeaveRequest(requestId, adminId, reason) {
  if (!isApiConfigured()) throw new Error('API chưa cấu hình');
  return request(`leave-requests/${requestId}/reject?adminId=${encodeURIComponent(adminId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ reason: reason || '' }),
  });
}
