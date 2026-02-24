/**
 * Banner quy định báo cáo — hiển thị trên Bảng điều khiển.
 */
export default function RuleBanner() {
  return (
    <section style={styles.banner} aria-label="Quy định báo cáo">
      <strong>Quy định:</strong> Nếu chưa báo cáo công việc ngày hôm qua trước 24:00, sáng hôm sau bạn sẽ{' '}
      <strong>không thể sử dụng hệ thống</strong> cho đến khi báo cáo bù. Hệ thống sẽ hiện thông báo chặn màn hình và danh sách nhiệm vụ cần báo cáo — bắt buộc báo cáo bù xong mới dùng tiếp.
    </section>
  );
}

const styles = {
  banner: {
    padding: '12px 16px',
    marginBottom: 12,
    background: '#e3f2fd',
    border: '1px solid #1976d2',
    borderRadius: 8,
    fontSize: 14,
    color: '#0d47a1',
    lineHeight: 1.5,
  },
};
