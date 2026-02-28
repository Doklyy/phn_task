/**
 * API điểm hiệu suất & xếp hạng – tích hợp BE.
 * GET /api/scoring/user/:userId, GET /api/scoring/ranking
 *
 * Công thức điểm (tính ở backend): thường là
 *   totalScore = 0.4 * attendanceScore + 0.6 * qualityScore
 * (chuyên cần 40%, chất lượng công việc 60%). Nếu thứ hạng sai (vd. người ít hoàn thành lại đứng đầu),
 * cần kiểm tra lại backend: cách tính attendanceScore (số ngày báo cáo?), qualityScore (nhiệm vụ đã duyệt?),
 * và chỉ đếm user có đủ dữ liệu.
 */
import { request, isApiConfigured } from './client.js';

export async function getScoringUser(userId) {
  if (!isApiConfigured() || !userId) return null;
  try {
    return await request(`scoring/user/${encodeURIComponent(userId)}`);
  } catch {
    return null;
  }
}

/** Bảng xếp hạng (totalScore giảm dần) */
export async function getRanking() {
  if (!isApiConfigured()) return [];
  try {
    const data = await request('scoring/ranking');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
