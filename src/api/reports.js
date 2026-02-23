/**
 * API báo cáo tiến độ hàng ngày – tích hợp BE.
 * Quy trình: chiều báo cáo bắt buộc; BE ghi nhận để tính điểm chuyên cần.
 */
import { request, isApiConfigured } from './client.js';

/**
 * Lấy danh sách báo cáo theo task (lọc trên client sau khi lấy theo user).
 * GET /reports?userId=... rồi filter theo taskId.
 */
export async function getReportsByTask(taskId, userId) {
  if (!isApiConfigured()) return [];
  if (!userId) return [];
  try {
    const list = await request(`reports?userId=${encodeURIComponent(userId)}`);
    const arr = Array.isArray(list) ? list : [];
    return arr
      .filter((r) => String(r.taskId ?? r.task_id) === String(taskId))
      .map(normalizeReport);
  } catch {
    return [];
  }
}

/**
 * Admin/Leader xem toàn bộ báo cáo của một user: GET /reports?userId=...
 */
export async function getReportsByUser(userId) {
  if (!isApiConfigured() || !userId) return [];
  try {
    const list = await request(`reports?userId=${encodeURIComponent(userId)}`);
    const arr = Array.isArray(list) ? list : [];
    return arr.map(normalizeReport);
  } catch {
    return [];
  }
}

/**
 * Lấy báo cáo của user trong khoảng ngày (để kiểm tra khóa: đã báo cáo ngày hôm trước chưa)
 * GET /reports?userId=...&from=...&to=...
 */
export async function getMyReports(filters = {}) {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const q = params.toString();
  try {
    const list = await request(`reports${q ? `?${q}` : ''}`);
    return Array.isArray(list) ? list.map(normalizeReport) : [];
  } catch (e) {
    throw e;
  }
}

/**
 * Gửi báo cáo: POST /reports?userId=...
 * Body: { taskId, reportDate (YYYY-MM-DD), result, weight (0-1, optional) }
 */
export async function submitReport(payload, userId) {
  const body = {
    taskId: payload.taskId,
    reportDate: payload.reportDate,
    result: payload.result,
    weight: payload.weight != null ? Number(payload.weight) : null,
    attachmentPath: payload.attachmentPath || null,
  };
  if (!isApiConfigured()) {
    return normalizeReport({ ...body, date: body.reportDate });
  }
  try {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const data = await request(`reports${q}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return normalizeReport(data);
  } catch (e) {
    throw e;
  }
}

function normalizeReport(r) {
  const date = r.reportDate ?? r.report_date ?? r.date;
  return {
    id: r.id,
    userId: r.userId ?? r.user_id,
    userName: r.userName ?? r.user_name,
    taskId: r.taskId ?? r.task_id,
    taskTitle: r.taskTitle ?? r.task_title,
    date: date ? String(date).slice(0, 10) : '',
    result: r.result ?? r.content ?? '',
    weight: r.weight != null ? Number(r.weight) : null,
    attachmentPath: r.attachmentPath ?? r.attachment_path ?? null,
  };
}

/**
 * Admin lấy toàn bộ báo cáo: GET /reports/admin?adminId=...
 */
export async function getAllReportsForAdmin(adminId) {
  if (!isApiConfigured() || !adminId) return [];
  const list = await request(`reports/admin?adminId=${encodeURIComponent(adminId)}`);
  return Array.isArray(list) ? list.map(normalizeReport) : [];
}

/**
 * Tổng hợp báo cáo theo tháng (điểm cộng/trừ): GET /reports/monthly-compliance?month=2026-02&currentUserId=...
 */
export async function getMonthlyCompliance(month, currentUserId) {
  if (!isApiConfigured() || !month || !currentUserId) return [];
  const list = await request(
    `reports/monthly-compliance?month=${encodeURIComponent(month)}&currentUserId=${encodeURIComponent(currentUserId)}`
  );
  return Array.isArray(list) ? list : [];
}
