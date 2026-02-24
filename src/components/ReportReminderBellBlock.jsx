/**
 * Khối hiển thị trong popup chuông thông báo khi chưa báo cáo ngày hôm qua.
 * Đặt ở đầu nội dung popup chuông.
 */
import { useState, useEffect } from 'react';
import { getReportsReminder } from '../api/reports.js';

export default function ReportReminderBellBlock({ userId, onGoReport, onClosePopup }) {
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    getReportsReminder(userId)
      .then((r) => setReminder(r || {}))
      .catch(() => setReminder({ missingYesterday: false }))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div style={styles.loading}>Đang tải...</div>;
  if (!reminder?.missingYesterday) return null;

  const missingTasks = Array.isArray(reminder.missingTasks) ? reminder.missingTasks : [];
  const yesterdayStr = reminder.yesterday
    ? new Date(reminder.yesterday).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  const handleGoReport = () => {
    onClosePopup?.();
    onGoReport?.();
  };

  return (
    <div style={styles.block}>
      <div style={styles.header}>
        <span style={styles.badge}>Báo cáo bù</span>
        <span style={styles.title}>Chưa báo cáo ngày {yesterdayStr}</span>
      </div>
      <p style={styles.message}>
        {reminder.message ||
          'Bạn chưa báo cáo công việc ngày hôm trước. Vui lòng báo cáo bù trước khi sử dụng hệ thống.'}
      </p>
      {missingTasks.length > 0 && (
        <ul style={styles.list}>
          {missingTasks.map((t) => (
            <li key={t.taskId} style={styles.listItem}>
              {t.taskTitle || 'Nhiệm vụ #' + t.taskId}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={handleGoReport} style={styles.btn}>
        Đi báo cáo ngay
      </button>
    </div>
  );
}

const styles = {
  block: {
    padding: 14,
    marginBottom: 12,
    background: '#fff8e1',
    border: '1px solid #ffc107',
    borderRadius: 10,
    borderLeft: '4px solid #e65100',
  },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge: {
    background: '#e65100',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
  },
  title: { fontSize: 14, fontWeight: 600, color: '#111' },
  message: { fontSize: 13, color: '#444', margin: '0 0 10px', lineHeight: 1.5 },
  list: { margin: '0 0 10px', paddingLeft: 18, fontSize: 12, color: '#333', lineHeight: 1.5 },
  listItem: { marginBottom: 2 },
  btn: {
    padding: '8px 16px',
    background: '#D4384E',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  loading: { padding: 12, fontSize: 13, color: '#666' },
};
