/**
 * API điểm hiệu suất & xếp hạng – tích hợp BE.
 * GET /api/scoring/user/:userId, GET /api/scoring/ranking
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
