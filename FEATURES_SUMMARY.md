# TỔNG HỢP CHỨC NĂNG VÀ CÔNG VIỆC ĐÃ THỰC HIỆN
Dự án: **Thế Giới Nhỏ Kỳ Diệu** (Ứng dụng giáo dục khám phá thế giới côn trùng)

---

## PHẦN 1: CÁC CHỨC NĂNG HỆ THỐNG ĐÃ HOÀN THIỆN (FEATURES)

### 1. Xác thực & Quản lý người dùng
- **Đăng nhập/Đăng ký**: Hỗ trợ đăng nhập an toàn bằng tài khoản Google hoặc chế độ "Chơi ngay" (Guest/Local user) lưu dữ liệu tạm thời trên máy.
- **Hồ sơ cá nhân (Profile)**: Hiển thị tên người dùng, ảnh đại diện (avatar hoạt hình), và tổng số điểm tích lũy.
- **Đăng xuất**: Xóa phiên đăng nhập hiện tại và trở về màn hình chào mừng.

### 2. Quét & Nhận diện côn trùng bằng AI (Tính năng cốt lõi)
- **Giao diện Camera**: Cho phép người dùng mở camera trực tiếp trên thiết bị web/mobile để chụp ảnh.
- **Nhận diện thông minh (Gemini AI)**: Tích hợp AI để phân tích hình ảnh vừa chụp, tự động nhận diện loài côn trùng và trích xuất thông tin khoa học.
- **Màn hình Kết quả (Result Screen)**: Hiển thị thông tin chi tiết về loài côn trùng vừa tìm thấy.
- **Hệ thống phần thưởng (Gamification)**: Tự động cộng điểm thưởng (ví dụ: +10 điểm) vào tài khoản khi khám phá thành công một loài mới.

### 3. Bộ sưu tập / Từ điển sinh học (Library)
- **Lưu trữ thành tích**: Hiển thị danh sách các loài côn trùng mà người dùng đã khám phá và thu thập được.
- **Kiến thức bách khoa**: Cung cấp thông tin chi tiết, dễ hiểu cho trẻ em về từng loài (Tên gọi, môi trường sống, vai trò sinh thái...).

### 4. Bảng xếp hạng thi đua (Leaderboard/Rank)
- **Xếp hạng điểm số**: Hiển thị danh sách các "Thám hiểm nhí" có điểm số cao nhất trong hệ thống để tạo động lực thi đua.

---

## PHẦN 2: CHI TIẾT CÁC CÔNG VIỆC KỸ THUẬT ĐÃ LÀM (WORK COMPLETED)

### 1. Khởi tạo & Cấu hình dự án
- Thiết lập dự án Frontend với **ReactJS (Vite)** và **TypeScript**.
- Cài đặt và cấu hình **Tailwind CSS** để style giao diện nhanh chóng.
- Thiết lập file `.env.example` để quản lý các biến môi trường (Gemini API, Supabase URL/Key).
- Cấu hình `metadata.json` để yêu cầu quyền truy cập Camera của thiết bị.

### 2. Phát triển Giao diện & Trải nghiệm người dùng (UI/UX)
- Thiết kế layout theo hướng **Mobile-first**, mô phỏng màn hình điện thoại với viền bo tròn và hình nền chủ đề thiên nhiên (màu xanh lá, icon hoa lá).
- Xây dựng hệ thống Component hoàn chỉnh cho các màn hình:
  - `SplashScreen.tsx`: Màn hình chờ sinh động lúc khởi động.
  - `AuthScreen.tsx`: Màn hình đăng nhập.
  - `MainScreen.tsx`: Màn hình chính (Dashboard) với các nút điều hướng lớn, dễ bấm.
  - `ScanScreen.tsx`: Màn hình tích hợp luồng mở camera và chụp ảnh.
  - `ResultScreen.tsx`: Màn hình hiển thị kết quả nhận diện từ AI.
  - `LibraryScreen.tsx`: Màn hình danh sách bộ sưu tập.
  - `RankScreen.tsx`: Màn hình bảng xếp hạng.
  - `ProfileScreen.tsx`: Màn hình hồ sơ cá nhân.
- Tích hợp thư viện **`motion/react`** để làm hiệu ứng chuyển trang (transition), hiệu ứng xuất hiện (fade-in, slide-up) mượt mà.
- Tích hợp thư viện **`lucide-react`** cho hệ thống icon đồng bộ.
- Xây dựng hệ thống **Toast Notification** (thông báo nổi) tùy chỉnh để báo lỗi, báo thành công hoặc thông tin.

### 3. Tích hợp AI (Trí tuệ nhân tạo)
- Viết service `geminiService.ts` sử dụng SDK `@google/genai`.
- Xây dựng prompt (câu lệnh) chuyên biệt để AI nhận diện hình ảnh côn trùng và trả về dữ liệu chuẩn (Tên, đặc điểm, độ hiếm...).

### 4. Thiết lập Cơ sở dữ liệu & Backend
- **Tích hợp Firebase**:
  - Cấu hình `firebase.ts` kết nối với Firebase.
  - Tích hợp Firebase Authentication (Google Login).
  - Tích hợp Firestore Database để lưu trữ dữ liệu người dùng (Profile) theo thời gian thực (`onSnapshot`).
  - Xử lý các hàm bắt lỗi (Error Boundary) chuẩn của Firestore.
- **Chuẩn bị hạ tầng Supabase (PostgreSQL)**:
  - Viết file `supabase.ts` để khởi tạo client kết nối.
  - Viết file `supabase-schema.sql` hoàn chỉnh bao gồm:
    - Tạo các bảng: `users`, `insects`, `collections`.
    - Đổ dữ liệu mẫu (Seed data) cho các loài côn trùng cơ bản (Bọ rùa, Bướm, Ong, Chuồn chuồn, Kiến).
    - Thiết lập bảo mật **Row Level Security (RLS)** và các **Policies** phân quyền đọc/ghi dữ liệu chặt chẽ.

### 5. Xử lý Logic luồng ứng dụng
- Quản lý State toàn cục trong `App.tsx` (quản lý phiên đăng nhập, thông tin user, màn hình hiện tại).
- Xử lý logic cấp quyền và bật/tắt luồng video từ Camera thiết bị.
- Xử lý logic lưu trữ tạm thời (Local Storage) cho người dùng chọn chế độ "Chơi ngay" không cần đăng nhập.
- Xử lý luồng: Chụp ảnh -> Gửi ảnh dạng Base64 lên AI -> Nhận kết quả -> Cập nhật điểm số -> Lưu vào bộ sưu tập.
