# Z.AI Reverse-Engineering API (Pure Python)

Tái tạo API Z.AI (GLM-5-Turbo) bằng **Python thuần túy 100%**. 
Không cần Playwright, không cần trình duyệt, tốc độ cực nhanh, tiêu tốn cực ít tài nguyên.

---

## 🚀 Tính năng vượt trội
- **Siêu nhẹ**: RAM sử dụng < 50MB (giảm 95% so với bản Playwright).
- **Siêu nhanh**: Khởi động tức thì, không mất 10-20 giây chờ load browser.
- **Ổn định**: Không bị treo, không bị timeout do lỗi engine trình duyệt.
- **Hỗ trợ Thinking**: Tự động hiển thị luồng suy nghĩ (Chain of Thought) của mô hình.

---

## 📂 Cấu trúc dự án

```
Z AI/
├── signature.py       ★ TRÁI TIM: Tạo X-Signature & URL Params (Cracked)
├── z.py               ★ CLI: Chat trực tiếp từ Terminal
├── server.py          ★ SERVER: API REST (8889) tương thích Elara App/OpenAI
│
├── z_ai_auth.json     [BẮT BUỘC] Token & User ID
├── requirements.txt   Dependencies (requests, flask)
└── research/          Thư mục chứa các script phân tích (có thể xóa)
```

---

## 🛠️ Bước 1 — Lấy Token (Làm 1 lần duy nhất)

1. Truy cập `https://chat.z.ai` và **đăng nhập**.
2. Nhấn `F12` → Tab **Application** (hoặc Storage) → **Local Storage**.
3. Tìm key `token` và copy giá trị (chuỗi dài bắt đầu bằng `eyJ...`).
4. Mở file `z_ai_auth.json` và dán vào:
```json
{
  "token": "DÁN_TOKEN_VÀO_ĐÂY"
}
```
*(Script sẽ tự động lấy `user_id` từ token này)*.

---

## 📦 Bước 2 — Cài đặt

```bash
pip install flask requests
```

---

## 📖 Cách sử dụng

### 1. Chế độ CLI (Terminal Chat)
```bash
python z.py
```
*Gõ tin nhắn và Enter. Gõ `exit` để thoát.*

### 2. Chế độ Server (Cho Elara App)
```bash
python server.py
```
Server chạy tại `http://localhost:8889`. 
- **Elara App**: Thêm provider URL là `http://localhost:8889`.
- **OpenAI Compatible**: Endpoint `/v1/chat/completions`.

---

## 🧠 Nguyên lý hoạt động
Dự án đã giải mã thành công thuật toán **Double-HMAC-SHA256** của Z.AI:
1. **Khóa xoay vòng**: Một khóa trung gian được tạo ra từ Salt bí mật và Timestamp (thay đổi mỗi 5 phút).
2. **Chữ ký**: Dữ liệu payload được ký bằng khóa trung gian này để tạo ra `X-Signature`.
3. **Header**: Sử dụng `X-Fe-Version: prod-fe-1.1.14` để vượt qua kiểm tra phiên bản.

Chi tiết kỹ thuật xem tại: `Cẩm nang/Z ai/security_algorithm.md`

---

## ⚠️ Lưu ý
- Token có thời hạn (thường là 30 ngày). Nếu gặp lỗi 401, hãy cập nhật lại token mới vào `z_ai_auth.json`.
- Không chia sẻ file `z_ai_auth.json` vì nó chứa quyền truy cập tài khoản của bạn.
