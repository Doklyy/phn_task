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
 * Lấy báo cáo của user trong khoảng ngày (để tab Chuyên cần, khóa tiếp nhận...).
 * GET /reports?userId=... (bắt buộc); lọc from/to ở client nếu có.
 */
export async function getMyReports(filters = {}) {
  const userId = filters.userId ?? filters.user_id;
  if (!isApiConfigured() || !userId) return [];
  const params = new URLSearchParams({ userId: String(userId) });
  try {
    const list = await request(`reports?${params}`);
    const arr = Array.isArray(list) ? list.map(normalizeReport) : [];
    const from = filters.from ? String(filters.from).slice(0, 10) : null;
    const to = filters.to ? String(filters.to).slice(0, 10) : null;
    if (from && to) {
      return arr.filter((r) => {
        const d = (r.date ?? r.reportDate ?? '').slice(0, 10);
        return d >= from && d <= to;
      });
    }
    return arr;
  } catch (e) {
    throw e;
  }
}

/**
 * Nhắc báo cáo bù: chưa báo cáo ngày hôm qua thì chặn dùng hệ thống.
 * GET /reports/reminder?userId=...
 * Response: { missingYesterday, yesterday, message, missingTasks: [{ taskId, taskTitle }] }
 */
export async function getReportsReminder(userId) {
  if (!isApiConfigured() || !userId) return { missingYesterday: false };
  try {
    const data = await request(`reports/reminder?userId=${encodeURIComponent(userId)}`);
    return data || { missingYesterday: false };
  } catch {
    return { missingYesterday: false };
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
