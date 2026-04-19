# BÁO CÁO TỔNG QUAN TÍNH NĂNG VÀ KIẾN TRÚC HỆ THỐNG
**Tên dự án:** Ứng dụng AI Nhận diện Côn trùng dành cho Trẻ em
**Nền tảng:** Mobile App (Android - Capacitor / ReactJS) & Cloud MLOps

---

## PHẦN 1: TỔNG QUAN CÁC CHỨC NĂNG THEO GIAO DIỆN (FRONTEND)

Ứng dụng được thiết kế tối ưu UI/UX dành riêng cho trẻ em với các hoạ tiết thiên nhiên, phông chữ lớn và thân thiện.

### 1. Màn hình Cổng Vào (Auth Screen)
- **Đăng nhập / Đăng ký truyền thống:** Yêu cầu sử dụng Email của phụ huynh để đăng ký nhằm tuân thủ quy định bảo vệ quyền riêng tư của trẻ em (COPPA). 
- **Thiết lập Avatar & Tên:** Trẻ em có thể tự tải ảnh đại diện nhân vật yêu thích.
- **Quên mật khẩu:** Gửi tín hiệu về email phụ huynh để reset mật khẩu.
- *Lưu ý bảo mật:* Hệ thống cố tình loại bỏ công cụ Đăng nhập bằng Google/Mạng xã hội (SSO) để ngăn chặn việc thu thập dữ liệu hành vi của trẻ trên không gian mạng và đảm bảo App hoạt động trơn tru trong mọi môi trường Sandbox (WebView) của điện thoại di động.

### 2. Màn hình Sảnh Chính (Dashboard)
- **Hệ thống Điểm thưởng & Cấp bậc:** Hiển thị điểm số, số lượng côn trùng đã khám phá để kích thích sự tò mò và thi đua của trẻ.
- **Bảng điều hướng:** Điều hướng mượt mà đến các chức năng Quét AI và Viện bảo tàng.

### 3. Màn hình Khám Phá AI (Camera & Máy Quét AI)
- **Chụp ảnh trực tiếp / Tải ảnh từ thư viện:** Giao diện camera tích hợp, cho phép các bé chụp côn trùng ngoài vườn.
- **Xử lý Ảnh (Inference):** Gửi ảnh đến máy chủ AI (Hugging Face / YOLO) để chẩn đoán.
- **Kết quả Sinh học:** Trả về Tên côn trùng, Đặc tính, Độ nguy hiểm, Thức ăn yêu thích. Cập nhật thẳng vào bộ sưu tập cá nhân của trẻ.

### 4. Màn hình Viện Bảo Tàng (Collection Screen)
- **Lưu trữ Thành tựu:** Hiển thị danh sách các loài côn trùng thẻ bài bé đã thu thập được.
- **Trạng thái "Chờ nghiên cứu" (Unknown):** Đối với các côn trùng hệ thống AI hiện tại chưa nhận diện được, ứng dụng sẽ dán nhãn "Côn Trùng Bí Ẩn" (Unknown). Đây là điểm kích hoạt cho toàn bộ hệ thống lõi MLOps ở Phần 2.

---

## PHẦN 2: KIẾN TRÚC LÕI (BACKEND & TỰ ĐỘNG HOÁ MLOPS)

Đây là giá trị cốt lõi và phức tạp nhất của Đồ án. Hệ thống không chỉ dừng lại ở việc gọi API có sẵn, mà xây dựng một **Chu trình Huấn luyện Mô hình Máy học Liên tục (Continuous Training - CI/CT/CD)** hoàn toàn tự động, phân tán qua nhiều nền tảng Cloud.

### 1. Cơ sở dữ liệu đám mây (Supabase / PostgreSQL)
- **Đóng vai trò Trái tim:** Quản lý toàn bộ thông tin tài khoản (Auth) và Cơ sở dữ liệu (Database).
- **Storage:** Lưu trữ hình ảnh côn trùng mà trẻ em chụp được.
- **Bảng `collections`:** Ghi nhận mọi kết quả AI. Nếu AI không nhận diện được ảnh, dữ liệu sẽ được lưu với trường `insect_id = "unknown_insect"`. Supabase đóng vai trò Data Lake để đào tạo lại mô hình.

### 2. Trạm điều phối Tự động (Databricks)
- **Đóng vai trò Bộ não (Orchestrator):** Databricks được thiết lập một Daemon Job (Chạy định kỳ - Cron Scheduler).
- **Quy trình hoạt động:** Định kỳ (VD: Mỗi 1 tiếng), Databricks Notebook lẳng lặng thức dậy, bắn API vào Supabase để quét toàn bộ Data.
- **Bộ lọc thông minh:** Nếu phát hiện có dữ liệu `insect_id == "unknown_insect"` (Có côn trùng lạ mới mà AI hiện tại chưa biết), Databricks sẽ ra quyết định: *"Cần phải tiến hành huấn luyện AI nhồi thêm kiến thức mới"*.
- *Script Python tại Databricks sử dụng Kaggle API để "kích điện" máy chủ GPU của Kaggle hoạt động.*

### 3. Trạm Huấn luyện Máy Học GPU (Kaggle)
- **Đóng vai trò Cỗ máy Huấn luyện nặng (Training Node):** Khi nhận được lệnh giật điện từ Databricks, Kaggle API sẽ tự động `kernels_pull` và `kernels_push` một Notebook tự động (Auto-Train YOLO).
- **Quy trình Tự học:** 
  1. Notebook trên Kaggle sử dụng Máy ảo tăng tốc GPU (P100/T4) để download toàn bộ ảnh côn trùng lạ từ Supabase.
  2. Gắn nhãn tự động (Pseudo-labeling hoặc Transfer Learning).
  3. Bắt đầu Train đè lên file Trọng số (Weights) cũ của YOLOv8.
  4. Sau khoảng 20-30 phút Train xong, sinh ra file Não mới thông minh hơn: `best.pt`.
  5. Cửa hậu (Backdoor): Kaggle tự động ném file `best.pt` này chạy thẳng lên Hugging Face Repo.

### 4. Trạm Máy chủ API Suy luận (Hugging Face Spaces)
- **Đóng vai trò Giao tiếp thiết bị đầu cuối (Inference API):** Nơi host mã nguồn Python FastAPI và mô hình `best.pt`. 
- Khi file `best.pt` mới được Kaggle đập vào Repo, Hugging Face Space sẽ tự động **Bắt tính hiệu Restart** (Xây dựng và khởi động lại Server).
- Quá trình cập nhật Não AI mới khép lại, Server hoạt động bình thường chờ những bức ảnh tiếp theo từ App Mobile gửi tới.

---

## TÓM TẮT VÒNG LẶP DỮ LIỆU ĐÓNG (DATA FLYWHEEL)
1. **Trẻ em (Mobile App):** Chụp một con bọ lạ ngoài vườn chưa từng có trong hệ thống.
2. **Supabase:** Nhận ảnh, không nhận diện được $\rightarrow$ Lưu trạng thái "Bọ Lạ".
3. **Databricks:** Nửa đêm thức dậy, phát hiện có "Bọ Lạ" $\rightarrow$ Báo động cho Kaggle.
4. **Kaggle (GPU):** Tự động bật máy lạnh, lấy ảnh bọ lạ về dạy cho AI YOLO. Học xong, đóng gói "Não bộ YOLO mới" ném lên mạng.
5. **Hugging Face:** Nhận Não mới, tự khởi động lại trạm thu phát.
6. **Sáng hôm sau:** Trẻ em mở App, hình ảnh Bọ Lạ hôm qua tự động được đổi tên thành loài côn trùng chính xác. Mô hình cứ thế thông minh lên từng ngày dựa trên 100% Cấu trúc Serverless (Không cần con người can thiệp hay thuê máy chủ duy trì đắt đỏ).
