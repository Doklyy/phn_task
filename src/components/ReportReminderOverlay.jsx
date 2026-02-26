/**
 * Overlay chặn toàn màn hình khi chưa báo cáo ngày hôm qua.
 * Đặt ở đầu layout (trước sidebar và chuông). Sau khi gửi báo cáo bù, tăng refetchTrigger để gọi lại API và ẩn overlay.
 */
import { useState, useEffect } from 'react';
import { getReportsReminder } from '../api/reports.js';

export default function ReportReminderOverlay({ userId, onGoReport, refetchTrigger }) {
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goneToReport, setGoneToReport] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getReportsReminder(userId)
      .then((r) => {
        setReminder(r || {});
        setGoneToReport(false);
      })
      .catch(() => setReminder({ missingYesterday: false }))
      .finally(() => setLoading(false));
  }, [userId, refetchTrigger]);

  if (loading || !reminder?.missingYesterday) return null;
  if (goneToReport) return null;

  const missingTasks = Array.isArray(reminder.missingTasks) ? reminder.missingTasks : [];
  const yesterdayStr = reminder.yesterday
    ? new Date(reminder.yesterday).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  return (
    <div style={styles.overlay} role="alert" aria-modal="true">
      <div style={styles.box}>
        <div style={styles.icon}>⚠</div>
        <h3 style={styles.heading}>Chưa báo cáo — không thể sử dụng hệ thống</h3>
        <p style={styles.message}>
          {reminder.message ||
            'Bạn chưa báo cáo công việc ngày hôm trước. Vui lòng báo cáo bù trước khi sử dụng hệ thống.'}
        </p>
        {missingTasks.length > 0 && (
          <div style={styles.listWrap}>
            <div style={styles.listTitle}>Danh sách nhiệm vụ chưa báo cáo ngày {yesterdayStr}:</div>
            <ul style={styles.list}>
              {missingTasks.map((t) => (
                <li key={t.taskId} style={styles.listItem}>
                  {t.taskTitle || 'Nhiệm vụ #' + t.taskId}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={styles.actions}>
          <button
            type="button"
            onClick={() => {
              setGoneToReport(true);
              const missingDate = reminder.yesterday ? String(reminder.yesterday).slice(0, 10) : null;
              onGoReport?.(missingDate);
            }}
            style={styles.primaryBtn}
          >
            Đi báo cáo ngay
          </button>
        </div>
        <p style={styles.hint}>
          Sau khi gửi báo cáo bù cho ngày {yesterdayStr}, bạn mới có thể sử dụng hệ thống bình thường.
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    fontFamily: 'system-ui, sans-serif',
  },
  box: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    maxWidth: 480,
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
    textAlign: 'center',
  },
  icon: { fontSize: 40, color: '#c62828', marginBottom: 8 },
  heading: { fontSize: 18, margin: '0 0 8px', color: '#111', fontWeight: 700 },
  message: { fontSize: 14, color: '#444', margin: '0 0 16px', lineHeight: 1.5 },
  listWrap: {
    textAlign: 'left',
    marginBottom: 16,
    padding: '12px 14px',
    background: '#fff8e1',
    borderRadius: 8,
    border: '1px solid #ffc107',
  },
  listTitle: { fontSize: 13, fontWeight: 600, color: '#e65100', marginBottom: 8 },
  list: { margin: 0, paddingLeft: 20, fontSize: 13, color: '#333', lineHeight: 1.6 },
  listItem: { marginBottom: 4 },
  actions: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 },
  primaryBtn: {
    padding: '12px 24px',
    background: '#D4384E',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
  },
  hint: { fontSize: 12, color: '#666', margin: 0, fontStyle: 'italic' },
};
