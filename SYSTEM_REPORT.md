# BÁO CÁO TỔNG QUAN VÀ TIẾN ĐỘ HỆ THỐNG: "THẾ GIỚI NHỎ KỲ DIỆU"

Tài liệu này cung cấp mô tả toàn diện về kiến trúc, công nghệ, chức năng, cơ sở dữ liệu và **tiến độ các công việc đã hoàn thiện** của dự án "Thế Giới Nhỏ Kỳ Diệu". Tài liệu được cấu trúc chuẩn hóa để phục vụ cho việc viết báo cáo đồ án/dự án.

---

## I. GIỚI THIỆU CHUNG (INTRODUCTION)

- **Tên dự án:** Thế Giới Nhỏ Kỳ Diệu (Magical Little World).
- **Mục tiêu:** Xây dựng một ứng dụng giáo dục tương tác, giúp trẻ em khám phá thế giới tự nhiên (cụ thể là côn trùng) thông qua công nghệ nhận diện hình ảnh AI và phương pháp trò chơi hóa (Gamification).
- **Đối tượng mục tiêu:** Trẻ em (từ 5-12 tuổi), phụ huynh và giáo viên sử dụng làm công cụ hỗ trợ giáo dục ngoại khóa.

---

## II. KIẾN TRÚC HỆ THỐNG & CÔNG NGHỆ (ARCHITECTURE & TECHNOLOGIES)

Hệ thống được thiết kế theo mô hình Client-Server kết hợp với các dịch vụ đám mây (BaaS) và API Trí tuệ nhân tạo.

1. **Frontend (Giao diện người dùng):**
   - **Framework:** ReactJS (khởi tạo bằng Vite) kết hợp TypeScript để đảm bảo an toàn kiểu dữ liệu (type-safe).
   - **Styling:** Tailwind CSS cho phép xây dựng giao diện nhanh chóng, chuẩn Responsive (ưu tiên Mobile-first).
   - **Animation:** Thư viện `motion/react` xử lý các hiệu ứng chuyển cảnh, pop-up mượt mà.
   - **Icons:** Thư viện `lucide-react`.

2. **Backend & Cơ sở dữ liệu (Database):**
   - **Firebase:** Xử lý xác thực người dùng (Google Auth) và lưu trữ dữ liệu thời gian thực (Firestore) cho trạng thái người dùng.
   - **Supabase (PostgreSQL):** Hệ thống đã thiết kế sẵn lược đồ cơ sở dữ liệu quan hệ (Schema) trên Supabase để quản lý cấu trúc dữ liệu phức tạp (người dùng, bộ sưu tập, từ điển sinh học) với tính năng bảo mật Row Level Security (RLS).

3. **Trí tuệ nhân tạo (AI):**
   - **Google Gemini API (`@google/genai`):** Sử dụng mô hình đa phương thức (Multimodal) để phân tích hình ảnh từ camera, nhận diện loài côn trùng và trả về thông tin khoa học dưới dạng cấu trúc.

---

## III. MÔ TẢ CHI TIẾT CÁC CHỨC NĂNG ĐÃ HOÀN THIỆN (COMPLETED FEATURES)

### 1. Module Xác thực & Quản lý tài khoản (Authentication Module)
- **Đăng nhập đa phương thức:** Hỗ trợ đăng nhập an toàn qua tài khoản Google (OAuth 2.0).
- **Chế độ Khách (Guest Mode):** Tính năng "Chơi ngay" cho phép trải nghiệm ứng dụng không cần tài khoản, dữ liệu được lưu tạm thời trên Local Storage của trình duyệt.
- **Quản lý Hồ sơ (Profile):** Lưu trữ thông tin cá nhân bao gồm Tên hiển thị, Ảnh đại diện (Avatar hoạt hình) và Tổng điểm tích lũy.

### 2. Module Nhận diện AI & Camera (Core AI Module)
- **Tích hợp Camera:** Truy cập và hiển thị luồng video trực tiếp từ thiết bị (điện thoại/máy tính) thông qua HTML5/WebRTC.
- **Chụp ảnh & Xử lý:** Bắt khung hình, nén và chuyển đổi sang định dạng Base64.
- **Nhận diện thông minh:** Gửi ảnh tới Gemini API kèm theo Prompt chuyên biệt. AI sẽ phân tích và trả về:
  - Tên loài (Tiếng Việt, Tiếng Anh, Tên khoa học).
  - Đặc điểm sinh học, môi trường sống.
  - Vai trò sinh thái (VD: Thiên địch, thụ phấn).

### 3. Module Học tập & Bộ sưu tập (Library Module)
- **Từ điển bách khoa:** Hệ thống lưu trữ thông tin chuẩn hóa của các loài côn trùng. Ngôn ngữ được biên tập thân thiện, dễ hiểu với trẻ em.
- **Bộ sưu tập cá nhân:** Lưu lại lịch sử những loài côn trùng người dùng đã chụp và nhận diện thành công, tạo cảm giác thành tựu (như sưu tập thẻ bài).

### 4. Module Trò chơi hóa (Gamification Module)
- **Hệ thống Điểm thưởng:** Tự động cộng điểm (VD: +10 điểm) mỗi khi khám phá ra một loài mới.
- **Bảng xếp hạng (Leaderboard):** Truy xuất và sắp xếp điểm số của toàn bộ người dùng, vinh danh các "Thám hiểm nhí" xuất sắc nhất, kích thích sự tò mò và tính thi đua.

---

## IV. THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE SCHEMA)

Hệ thống sử dụng cơ sở dữ liệu quan hệ (PostgreSQL qua Supabase) với 3 thực thể chính:

1. **Bảng `users` (Người dùng):** `uid` (PK), `username`, `total_points`, `avatar_id`, `role`.
2. **Bảng `insects` (Từ điển Côn trùng):** `id` (PK), `name_vi`, `name_en`, `scientific_name`, `description`, `habitat`, `habitat_icon`, `role`, `role_icon`, `category_color`, `image_cartoon`.
3. **Bảng `collections` (Bộ sưu tập):** `id` (PK), `user_id` (FK), `insect_id` (FK), `captured_at`, `photo_path`.

*Bảo mật:* Áp dụng Row Level Security (RLS) đảm bảo người dùng chỉ có thể thêm/sửa bộ sưu tập và hồ sơ của chính mình, nhưng có thể xem bảng xếp hạng chung.

---

## V. TRẢI NGHIỆM NGƯỜI DÙNG & GIAO DIỆN (UI/UX DESIGN)

- **Nguyên tắc thiết kế:** Lấy trẻ em làm trung tâm (Child-centered design).
- **Bố cục (Layout):** Thiết kế Mobile-first, giới hạn khung hình tỷ lệ điện thoại (max-width: 430px) đặt giữa màn hình đối với bản Web, tạo cảm giác như một ứng dụng di động thực thụ (Native App).
- **Màu sắc & Đồ họa:** Sử dụng tone màu xanh lá chủ đạo (Nature theme), kết hợp các họa tiết trang trí nổi (lá cây, hoa) và các icon bo tròn, màu sắc tươi sáng.
- **Tương tác (Interaction):** Màn hình Splash Screen sinh động, hệ thống Toast Notification thân thiện, các nút bấm có hiệu ứng nhấn vật lý.

---

## VI. TỔNG HỢP CÁC CÔNG VIỆC KỸ THUẬT ĐÃ THỰC HIỆN (WORK COMPLETED)

Tính đến thời điểm hiện tại, đội ngũ phát triển đã hoàn thành các hạng mục công việc sau:

### 1. Khởi tạo & Cấu hình dự án
- Thiết lập dự án Frontend với **ReactJS (Vite)** và **TypeScript**.
- Cài đặt và cấu hình **Tailwind CSS** để style giao diện.
- Thiết lập file `.env.example` để quản lý các biến môi trường (Gemini API, Supabase URL/Key).
- Cấu hình `metadata.json` để yêu cầu quyền truy cập Camera của thiết bị.

### 2. Phát triển Giao diện (UI/UX)
- Xây dựng hệ thống Component hoàn chỉnh cho các màn hình: `SplashScreen`, `AuthScreen`, `MainScreen`, `ScanScreen`, `ResultScreen`, `LibraryScreen`, `RankScreen`, `ProfileScreen`.
- Tích hợp thư viện **`motion/react`** để làm hiệu ứng chuyển trang (transition), hiệu ứng xuất hiện (fade-in, slide-up) mượt mà.
- Tích hợp thư viện **`lucide-react`** cho hệ thống icon đồng bộ.
- Xây dựng hệ thống **Toast Notification** (thông báo nổi) tùy chỉnh để báo lỗi, báo thành công hoặc thông tin.

### 3. Tích hợp AI (Trí tuệ nhân tạo)
- Viết service `geminiService.ts` sử dụng SDK `@google/genai`.
- Xây dựng prompt (câu lệnh) chuyên biệt để AI nhận diện hình ảnh côn trùng và trả về dữ liệu chuẩn (Tên, đặc điểm, độ hiếm...).

### 4. Thiết lập Cơ sở dữ liệu & Backend
- **Tích hợp Firebase**: Cấu hình `firebase.ts`, tích hợp Firebase Authentication (Google Login), Firestore Database để lưu trữ dữ liệu người dùng (Profile) theo thời gian thực (`onSnapshot`), xử lý các hàm bắt lỗi chuẩn.
- **Chuẩn bị hạ tầng Supabase (PostgreSQL)**: Viết file `supabase.ts` để khởi tạo client kết nối, viết file `supabase-schema.sql` hoàn chỉnh bao gồm tạo bảng, đổ dữ liệu mẫu (Seed data) và thiết lập bảo mật **Row Level Security (RLS)**.

### 5. Xử lý Logic luồng ứng dụng
- Quản lý State toàn cục trong `App.tsx` (quản lý phiên đăng nhập, thông tin user, màn hình hiện tại).
- Xử lý logic cấp quyền và bật/tắt luồng video từ Camera thiết bị.
- Xử lý logic lưu trữ tạm thời (Local Storage) cho người dùng chọn chế độ "Chơi ngay" không cần đăng nhập.
- Xử lý luồng nghiệp vụ cốt lõi: Chụp ảnh -> Gửi ảnh dạng Base64 lên AI -> Nhận kết quả -> Cập nhật điểm số -> Lưu vào bộ sưu tập.

---

## VII. KẾT LUẬN

Hệ thống "Thế Giới Nhỏ Kỳ Diệu" đã hoàn thiện bộ khung kiến trúc toàn diện từ Frontend, Backend đến tích hợp AI. Ứng dụng không chỉ giải quyết bài toán nhận diện hình ảnh với độ chính xác cao nhờ Gemini API mà còn mang lại giá trị thực tiễn trong giáo dục thông qua trải nghiệm người dùng xuất sắc và hệ thống Gamification bài bản. Hệ thống cơ sở dữ liệu được thiết kế chuẩn mực, sẵn sàng cho việc mở rộng quy mô (scale) trong tương lai.
