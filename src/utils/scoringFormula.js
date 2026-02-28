/**
 * Công thức tính điểm theo file "Quan ly cong viec_PHN - Theo doi Nhiem vu.csv":
 * - Trọng số CV (weight 0–1) → Điểm W: Rất thấp=1, Thấp=2, Bình thường=3, Cao=5, Rất cao=8
 * - Chất lượng CV → Điểm Q: Không đạt=0, Đạt chuẩn (hoặc cao hơn)=1
 * - Trạng thái CV → Điểm T: Chưa đến hạn/Không hoàn thành=0, Hoàn thành đúng hạn=1
 * - Tổng điểm (mỗi nhiệm vụ) = Điểm W × Điểm Q × Điểm T
 * - Xếp hạng: tổng (Tổng điểm) theo từng Chủ trì (assignee), sắp xếp giảm dần.
 */

const WEIGHT_TO_POINTS = [
  { max: 0.25, points: 1 },   // Rất thấp
  { max: 0.5, points: 2 },    // Thấp
  { max: 0.7, points: 3 },    // Bình thường
  { max: 0.9, points: 5 },    // Cao
  { max: 1.5, points: 8 },    // Rất cao
];

/** Trọng số (số 0–1) → Điểm W (1, 2, 3, 5, 8) */
export function weightToPoints(weight) {
  if (weight == null || weight === '') return 0;
  const w = Number(weight);
  if (Number.isNaN(w) || w < 0) return 0;
  for (const { max, points } of WEIGHT_TO_POINTS) {
    if (w <= max) return points;
  }
  return 8;
}

/** Chất lượng (số 0–1.3): Không đạt = 0, Đạt tối thiểu trở lên (>= 0.6) = 1 */
export function qualityToQ(quality) {
  if (quality == null || quality === '') return 0;
  const q = Number(quality);
  if (Number.isNaN(q)) return 0;
  return q >= 0.6 ? 1 : 0;
}

/** Nhiệm vụ hoàn thành đúng hạn: completedAt <= deadline (hoặc trong vòng 1 ngày sau deadline) */
export function isCompletedOnTime(task) {
  if (!task || (task.status || '').toLowerCase() !== 'completed') return false;
  const deadline = task.deadline;
  const completedAt = task.completedAt;
  if (!deadline || !completedAt) return false;
  const dEnd = new Date(String(deadline).replace(' ', 'T'));
  const dDone = new Date(String(completedAt).replace(' ', 'T'));
  if (Number.isNaN(dEnd.getTime()) || Number.isNaN(dDone.getTime())) return false;
  const oneDayMs = 24 * 60 * 60 * 1000;
  return dDone.getTime() <= dEnd.getTime() + oneDayMs;
}

/** Điểm T: 1 nếu hoàn thành đúng hạn, 0 nếu không */
export function taskToT(task) {
  return isCompletedOnTime(task) ? 1 : 0;
}

/** Điểm nhiệm vụ = W × Q × T (chỉ tính khi đã hoàn thành và có chất lượng) */
export function taskScore(task) {
  const w = weightToPoints(task.weight);
  const q = qualityToQ(task.quality);
  const t = taskToT(task);
  return w * q * t;
}

/**
 * Tính bảng xếp hạng từ danh sách task: mỗi user có tổng điểm = sum(taskScore) với task assignee = user.
 * Trả về mảng { userId, name, totalScore, completedCount } sắp xếp totalScore giảm dần.
 */
export function computeRankingFromTasks(tasks = [], users = []) {
  const byUser = {};
  (tasks || []).forEach((task) => {
    const assigneeId = task.assigneeId != null ? String(task.assigneeId) : '';
    if (!assigneeId) return;
    const score = taskScore(task);
    if (!byUser[assigneeId]) {
      byUser[assigneeId] = { userId: assigneeId, totalScore: 0, completedCount: 0 };
    }
    byUser[assigneeId].totalScore += score;
    if ((task.status || '').toLowerCase() === 'completed') byUser[assigneeId].completedCount += 1;
  });

  const userMap = {};
  (users || []).forEach((u) => {
    const id = String(u.id ?? u.userId ?? '');
    if (id) userMap[id] = u.name || u.fullName || u.username || id;
  });

  return Object.values(byUser)
    .map((r) => ({ ...r, name: userMap[r.userId] || r.userId }))
    .sort((a, b) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0));
}
