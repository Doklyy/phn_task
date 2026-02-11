# Sơ đồ cơ sở dữ liệu PHN (dbdiagram.io)

## Cách dùng

1. Mở **[https://dbdiagram.io/](https://dbdiagram.io/)** trên trình duyệt.
2. Mở file `phn-database.dbml` trong thư mục `docs/`.
3. **Copy toàn bộ** nội dung file.
4. Trên dbdiagram.io, dán vào khung soạn thảo bên trái (hoặc dùng **Import** → **Import from DBML** nếu có).
5. Sơ đồ quan hệ sẽ tự vẽ bên phải.

## Các bảng trong sơ đồ

| Bảng | Mô tả |
|------|--------|
| **users** | Tài khoản, phân quyền (Admin / Chủ trì / Thực hiện). Cơ sở dữ liệu tập trung để mỗi người chỉ thấy đúng phạm vi công việc. |
| **tasks** | Công việc: tiêu đề, nội dung, mục tiêu, deadline, trọng số, WQT. Liên kết assigner, leader, assignee → users. |
| **daily_reports** | Báo cáo tiến độ hàng ngày (bắt buộc). Lịch sử báo cáo để tra cứu và tính điểm chuyên cần. |
| **scores** | Điểm tổng hợp theo kỳ (WQT + chuyên cần), tùy chọn. |

## Quan hệ

- **tasks** → **users** (assigner_id, leader_id, assignee_id)
- **daily_reports** → **tasks** (task_id), **users** (user_id)
- **scores** → **users** (user_id)

Sơ đồ dùng chuẩn [DBML](https://dbml.dbdiagram.io/docs) nên tương thích với dbdiagram.io.
