/**
 * API điểm hiệu suất & xếp hạng – tích hợp BE.
 * GET /api/scoring/user/:userId, GET /api/scoring/ranking
 * Hỗ trợ tham số month (YYYY-MM) để điểm và xếp hạng theo từng tháng (mỗi tháng reset).
 *
 * Công thức điểm (tính ở backend): thường là
 *   totalScore = 0.4 * attendanceScore + 0.6 * qualityScore
 * (chuyên cần 40%, chất lượng công việc 60%).
 */
import { request, isApiConfigured } from './client.js';

/**
 * Điểm cá nhân. options.month = "YYYY-MM" (optional) — nếu BE hỗ trợ sẽ trả điểm theo tháng.
 */
export async function getScoringUser(userId, options = {}) {
  if (!isApiConfigured() || !userId) return null;
  try {
    const params = new URLSearchParams();
    if (options.month && String(options.month).match(/^\d{4}-\d{2}$/)) params.set('month', options.month);
    const q = params.toString() ? `?${params}` : '';
    return await request(`scoring/user/${encodeURIComponent(userId)}${q}`);
  } catch {
    return null;
  }
}

/**
 * Bảng xếp hạng (totalScore giảm dần). options.month = "YYYY-MM" (optional) — nếu BE hỗ trợ sẽ trả xếp hạng theo tháng.
 */
export async function getRanking(options = {}) {
  if (!isApiConfigured()) return [];
  try {
    const params = new URLSearchParams();
    if (options.month && String(options.month).match(/^\d{4}-\d{2}$/)) params.set('month', options.month);
    const q = params.toString() ? `?${params}` : '';
    const data = await request(`scoring/ranking${q}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
