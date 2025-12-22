  # 🧭 Tour Booking System – Admin Dashboard (Frontend)

Frontend **Admin Dashboard** cho hệ thống **Tour Booking System**.  
Dự án cung cấp giao diện quản trị để Admin quản lý **tour, đơn hàng, nhân viên, danh mục, khuyến mãi** và theo dõi **Activity Log (hoạt động gần đây)**.

---

## 🚀 Công nghệ sử dụng

- **HTML5 / CSS3 / JavaScript**
- **Bootstrap 5** (UI Admin Template)
- **Axios / Fetch API** (gọi backend)
- **Chart.js** (biểu đồ thống kê)
- **Font Awesome / Bootstrap Icons**
- **JWT Authentication** (kết nối backend)

---

## 🎯 Chức năng chính

### 📊 Dashboard
- Thống kê tổng quan:
  - Số tour
  - Số đơn hàng
  - Doanh thu
  - Người dùng
- Biểu đồ theo ngày / tháng

### 🧳 Quản lý Tour
- Danh sách tour (phân trang, tìm kiếm)
- Tạo / chỉnh sửa / xoá tour
- Nhân bản tour
- Upload hình ảnh (Cloudinary)

### 📦 Quản lý Đơn hàng
- Xem danh sách đơn
- Cập nhật trạng thái:
  - PENDING
  - PROCESS
  - COMPLETE
  - CANCEL
- Xem chi tiết hoá đơn

### 🧑‍💼 Quản lý Nhân viên
- Thêm / sửa / xoá nhân viên
- Reset mật khẩu
- Phân quyền theo Role & Permission

### 🗂️ Quản lý Danh mục
- CRUD danh mục
- Xoá nhiều danh mục

### 🎁 Quản lý Khuyến mãi
- Tạo chương trình khuyến mãi
- Áp dụng % giảm giá
- Quản lý thời gian hiệu lực

### 🕒 Activity Log (Hoạt động gần đây)
- Timeline hiển thị các hành động của Admin:
  - Tạo / sửa / xoá tour
  - Cập nhật đơn hàng
  - Quản lý danh mục, nhân viên
- Dữ liệu realtime từ backend

---

## 🧱 Kiến trúc Frontend

HTML Pages
↓
JavaScript (Fetch / Axios)
↓
REST API (Spring Boot Backend)

- **HTML**: giao diện
- **CSS/Bootstrap**: layout & responsive
- **JavaScript**: xử lý logic, gọi API
- **JWT**: xác thực và phân quyền

---

## 📁 Cấu trúc thư mục (tham khảo)

FE-ADMINDOASHBOARD
├── assets
│ ├── css
│ ├── js
│ ├── img
│ └── vendor
├── pages
│ ├── tours.html
│ ├── orders.html
│ ├── employees.html
│ ├── categories.html
│ └── promotions.html
├── index.html
└── login.html

---

## 🔐 Xác thực & phân quyền

- Đăng nhập bằng **JWT**
- Token được lưu trong:
  - `localStorage`
- Mỗi request gửi kèm header:
```http
Authorization: Bearer <JWT_TOKEN>
▶️ Cách chạy project
Cách 1: Mở trực tiếp

Mở login.html bằng trình duyệt

Phù hợp khi backend đã bật CORS

Cách 2: Dùng Live Server (khuyên dùng)
# VS Code
Right click → Open with Live Server

🔗 Kết nối Backend

Backend tương ứng:
👉 BE-ADMINDDOASHBOARD

Yêu cầu backend:

Spring Boot đang chạy

Đã bật CORS

API sẵn sàng tại http://localhost:8080

👨‍💻 Nhóm phát triển

Tour Booking System – Team 05

Frontend: Admin Dashboard

Backend: Spring Boot

Database: MySQL

📄 License

Dự án phục vụ mục đích học tập và phát triển nội bộ.
