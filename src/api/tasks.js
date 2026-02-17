/**
 * API nhiệm vụ – tích hợp BE.
 * Liên kết FE với cơ sở dữ liệu tập trung: mỗi user chỉ thấy đúng phạm vi công việc (assignee/leader).
 */
import { request, isApiConfigured } from './client.js';

/**
 * Chuẩn hóa task từ BE sang shape FE
 * - Ép các ID (id, assignerId, leaderId, assigneeId) về string để so sánh với currentUser.id (cũng là string).
 */
function normalizeTask(t) {
  const rawStatus = (t.status || t.taskStatus || '').toLowerCase();
  const status = rawStatus === 'pending_approval' ? 'pending_approval' : rawStatus === 'in_progress' ? 'accepted' : rawStatus === 'new' || rawStatus === 'accepted' || rawStatus === 'completed' || rawStatus === 'paused' ? rawStatus : 'new';
  const toId = (v) => (v == null ? '' : String(v));
  return {
    id: toId(t.id),
    title: t.title || t.name || '',
    objective: t.objective ?? t.goal ?? t.purpose ?? '',
    content: t.content ?? t.description ?? '',
    assignerId: toId(t.assignerId ?? t.assigner_id ?? t.assigner),
    leaderId: toId(t.leaderId ?? t.leader_id ?? t.leader ?? t.hostId),
    assigneeId: toId(t.assigneeId ?? t.assignee_id ?? t.assignee ?? t.performerId),
    leaderName: t.leaderName ?? t.leader_name ?? '',
    assigneeName: t.assigneeName ?? t.assignee_name ?? '',
    deadline: t.deadline ?? t.dueDate ?? t.due_date ?? null,
    status,
    weight: t.weight != null ? Number(t.weight) : 0,
    quality: t.quality != null ? Number(t.quality) : null,
    wqt: t.wqt != null ? Number(t.wqt) : null,
    createdAt: t.createdAt ?? t.created_at ?? t.created ?? null,
    completedAt: t.completedAt ?? t.completed_at ?? null,
    completionNote: t.completionNote ?? t.completion_note ?? null,
    completionLink: t.completionLink ?? t.completion_link ?? null,
    completionFilePath: t.completionFilePath ?? t.completion_file_path ?? null,
  };
}

/**
 * Lấy danh sách nhiệm vụ theo user hiện tại (từ token hoặc userId).
 * GET /tasks hoặc GET /tasks?userId=...
 * BE trả về đúng phạm vi: admin = tất cả, leader = việc mình chủ trì + mình làm, staff = việc mình làm.
 */
export async function fetchTasksForCurrentUser(userId) {
  if (!isApiConfigured()) {
    return getMockTasks(userId || 'user-1');
  }
  try {
    const path = userId ? `tasks?userId=${encodeURIComponent(userId)}` : 'tasks';
    const data = await request(path);
    const list = Array.isArray(data) ? data : (data.content ?? data.items ?? data.tasks ?? []);
    return list.map(normalizeTask);
  } catch (err) {
    console.warn('API tasks chưa sẵn sàng, dùng dữ liệu mẫu:', err.message);
    return getMockTasks(userId || 'user-1');
  }
}

/**
 * Tiếp nhận công việc. Backend: PATCH /api/tasks/{taskId}/accept?userId=...
 * Bắt buộc gửi userId (assignee) để backend ghi nhận và lưu trạng thái ACCEPTED.
 */
export async function acceptTask(taskId, userId) {
  if (!isApiConfigured()) {
    return Promise.resolve({ id: taskId, status: 'accepted' });
  }
  const uid = userId != null ? Number(userId) : userId;
  const tid = taskId != null ? Number(taskId) : taskId;
  const res = await request(`tasks/${tid}/accept?userId=${encodeURIComponent(uid)}`, {
    method: 'PATCH',
  });
  return normalizeTask(res);
}

/**
 * Tạo nhiệm vụ mới.
 * - Admin: assignerId là admin, có thể chọn leaderId + assigneeId bất kỳ.
 * - Leader: assignerId là leader, leaderId = chính leader, assigneeId là thành viên trong nhóm.
 */
export async function createTask(task, assignerId) {
  if (!isApiConfigured()) {
    throw new Error('API chưa được cấu hình, không thể tạo nhiệm vụ.');
  }
  const payload = {
    title: task.title?.trim(),
    content: task.content?.trim() || '',
    objective: task.objective?.trim() || '',
    deadline: task.deadline, // dạng 'YYYY-MM-DDTHH:mm' từ input datetime-local
    weight: task.weight != null ? Number(task.weight) : 0,
    leaderId: task.leaderId,
    assigneeId: task.assigneeId,
  };
  const data = await request(`tasks?assignerId=${encodeURIComponent(assignerId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeTask(data);
}

/**
 * Cập nhật trạng thái task (completed, paused): PATCH /tasks/:id?userId=...
 */
export async function updateTaskStatus(taskId, userId, status) {
  const uid = userId != null ? Number(userId) : userId;
  let url = `tasks/${taskId}?userId=${encodeURIComponent(uid)}`;
  const res = await request(url, {
    method: 'PATCH',
    body: JSON.stringify({ status: status != null ? String(status).toUpperCase() : undefined }),
  });
  return normalizeTask(res);
}

/**
 * Admin/Leader chỉnh sửa thông tin công việc: nội dung, thời hạn, trọng số, trạng thái, chất lượng.
 * PATCH /tasks/:id?userId=... body: { title?, content?, objective?, deadline?, weight?, status?, quality? }
 */
export async function updateTaskDetails(taskId, userId, payload) {
  const uid = userId != null ? Number(userId) : userId;
  const url = `tasks/${taskId}?userId=${encodeURIComponent(uid)}`;
  const body = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.content !== undefined) body.content = payload.content;
  if (payload.objective !== undefined) body.objective = payload.objective;
  if (payload.deadline !== undefined) body.deadline = payload.deadline;
  if (payload.weight !== undefined) body.weight = Number(payload.weight);
  if (payload.status !== undefined) body.status = String(payload.status).toUpperCase();
  if (payload.quality !== undefined) body.quality = Number(payload.quality);
  const res = await request(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return normalizeTask(res);
}

/**
 * Assignee gửi báo cáo hoàn thành → chuyển sang Đợi duyệt.
 * POST /api/tasks/:id/complete?userId=...
 */
export async function submitCompletion(taskId, userId, payload) {
  const tid = taskId != null ? Number(taskId) : NaN;
  const uid = userId != null ? Number(userId) : NaN;
  if (Number.isNaN(tid) || tid < 1) {
    throw new Error('Mã nhiệm vụ không hợp lệ. Thử đóng và mở lại chi tiết task.');
  }
  if (Number.isNaN(uid) || uid < 1) {
    throw new Error('Bạn chưa đăng nhập hoặc phiên hết hạn. Vui lòng đăng nhập lại.');
  }
  const body = {
    completionNote: payload?.completionNote ?? payload?.completion_note ?? '',
    completionLink: payload?.completionLink ?? payload?.completion_link ?? null,
    completionFilePath: payload?.completionFilePath ?? payload?.completion_file_path ?? null,
  };
  const path = `tasks/${tid}/complete?userId=${encodeURIComponent(uid)}`;
  try {
    const res = await request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return normalizeTask(res);
  } catch (e) {
    if (e?.message?.includes('404')) {
      const base = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
      console.warn('[submitCompletion] 404 – URL có dạng: ' + base + '/' + path + ' . Kiểm tra backend chạy và VITE_API_URL.');
    }
    throw e;
  }
}

/**
 * Leader (người phân công) duyệt báo cáo hoàn thành → COMPLETED, đánh giá chất lượng (0..1).
 */
export async function approveCompletion(taskId, userId, quality) {
  let url = `tasks/${taskId}/approve?userId=${encodeURIComponent(userId)}`;
  if (quality != null && quality !== '') url += `&quality=${encodeURIComponent(Number(quality))}`;
  const res = await request(url, { method: 'PATCH' });
  return normalizeTask(res);
}

/**
 * Leader (người phân công) từ chối → trả về tồn đọng (ACCEPTED).
 * Lý do (optional) gửi qua query param reason.
 */
export async function rejectCompletion(taskId, userId, reason) {
  let url = `tasks/${taskId}/reject?userId=${encodeURIComponent(userId)}`;
  if (reason) url += `&reason=${encodeURIComponent(reason)}`;
  const res = await request(url, { method: 'PATCH' });
  return normalizeTask(res);
}

/** Dữ liệu mẫu khi chưa có BE */
function getMockTasks(userId) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);

  return [
    { id: 1, title: 'Xây dựng Database hệ thống PHN', objective: 'Lưu trữ phân quyền 3 cấp.', content: 'Thiết kế bảng Users, Tasks, Logs.', assignerId: 'admin_01', leaderId: 'leader_01', leaderName: 'Người chủ trì', assigneeId: userId, deadline: fmt(tomorrow), status: 'new', weight: 0.8, quality: 0, wqt: 0, createdAt: fmt(now), completedAt: null },
    { id: 2, title: 'Tối ưu giao diện Mobile', objective: 'Tăng trải nghiệm người dùng.', content: 'Chỉnh menu và nút trên mobile.', assignerId: 'leader_01', leaderId: 'leader_01', leaderName: 'Người chủ trì', assigneeId: userId, deadline: fmt(tomorrow), status: 'accepted', weight: 0.5, quality: 0.9, wqt: 0.45, createdAt: fmt(now), completedAt: null },
    { id: 3, title: 'Tài liệu hướng dẫn', objective: 'Giúp nhân viên mới.', content: 'Viết tài liệu PDF và video.', assignerId: 'leader_01', leaderId: 'leader_01', leaderName: 'Người chủ trì', assigneeId: userId, deadline: fmt(yesterday), status: 'accepted', weight: 0.3, quality: null, wqt: 0, createdAt: fmt(now), completedAt: null },
    { id: 4, title: 'Kiểm thử đăng nhập', objective: 'Đảm bảo phân quyền đúng.', content: 'Test cases từng role.', assignerId: 'admin_01', leaderId: 'leader_01', leaderName: 'Người chủ trì', assigneeId: userId, deadline: fmt(yesterday), status: 'completed', weight: 0.6, quality: 0.95, wqt: 0.57, createdAt: fmt(now), completedAt: fmt(now) },
    { id: 5, title: 'Nghiên cứu API bên thứ ba', objective: 'Đánh giá tích hợp.', content: 'Rà soát tài liệu API. Tạm dừng chờ phê duyệt.', assignerId: 'leader_01', leaderId: 'leader_01', leaderName: 'Người chủ trì', assigneeId: userId, deadline: fmt(tomorrow), status: 'paused', weight: 0.4, quality: null, wqt: 0, createdAt: fmt(now), completedAt: null },
  ];
}

export { getMockTasks };
