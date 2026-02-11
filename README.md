# Quản lý công việc (Front-end)

Giao diện quản lý nhiệm vụ với Dashboard, Tabs, Task Cards, Báo cáo và Xuất Excel.

## Chạy dự án

```bash
npm install
npm run dev
```

Mở trình duyệt tại địa chỉ hiển thị (thường `http://localhost:5173`).

## Tính năng

- **Dashboard**: Biểu đồ cột và tròn (Recharts) thống kê theo trạng thái nhiệm vụ.
- **Tabs**: Nhiệm vụ | Nhân sự | Chấm điểm.
- **Task Card**: Màu theo trạng thái (Mới = xanh, Đang làm = vàng, Quá hạn = đỏ).
- **Tiếp nhận**: Nút "Tiếp nhận" trên task trạng thái "Mới" để chuyển sang "Đang làm".
- **Báo cáo kết quả ngày**: Form trong sidebar bên phải, có validation (ngày, nội dung ≥10 ký tự, kết quả bắt buộc).
- **Phân quyền**: Nút "Giao việc" chỉ hiển thị khi user có role `admin` hoặc `leader`. Đổi role trong `src/context/AuthContext.jsx` (ví dụ `role: ROLES.ADMIN`) để kiểm tra.
- **API**: Lấy danh sách nhiệm vụ theo User ID qua `src/api/tasks.js`. Khi chưa có backend, dùng dữ liệu mẫu.
- **Xuất Excel**: Nút "Xuất Excel" xuất bảng nhiệm vụ ra file (thư viện xlsx).

## Cấu hình API (tích hợp Backend)

Tạo file `.env` (copy từ `.env.example`):

```
VITE_API_URL=http://localhost:8080/api
```

Nếu không cấu hình hoặc BE không chạy, FE dùng tài khoản mẫu và dữ liệu mẫu.

### Hợp đồng API Backend (REST)

- **Đăng nhập:** `POST /auth/login` body `{ username, password }` → `{ token, user: { id, name, role } }`
- **User hiện tại:** `GET /auth/me` hoặc `GET /users/me` (header `Authorization: Bearer <token>`) → `{ id, name, role }`
- **Nhiệm vụ:** `GET /tasks` hoặc `GET /tasks?userId=...` → mảng task (id, title, objective, content, assignerId, leaderId, assigneeId, deadline, status, weight, quality, wqt, createdAt, completedAt). Role BE trả đúng phạm vi (admin: tất cả, leader: mình chủ trì + mình làm, staff: mình làm).
- **Tiếp nhận:** `PATCH /tasks/:id` body `{ status: "accepted" }` hoặc `POST /tasks/:id/accept`
- **Báo cáo:** `GET /reports?taskId=...` → mảng `{ reportDate, result, weight }`; `POST /reports` body `{ taskId, reportDate, result, weight }`

Role từ BE: `ADMIN` / `LEADER` (hoặc `HOST`) / `STAFF` (hoặc `PERFORMER`) → FE chuẩn hóa thành `admin` / `leader` / `staff`.
