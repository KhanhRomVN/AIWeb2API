# Schema Cơ Sở Dữ Liệu Elara Server

Tài liệu mô tả cấu trúc database SQLite của Elara Server.

## Tổng quan

Elara Server sử dụng **SQLite** làm cơ sở dữ liệu, với file database mặc định nằm tại `~/.elara/database.sqlite`. Cơ chế migration tự động chạy mỗi khi server khởi động để đảm bảo schema luôn cập nhật.

---

## Bảng: `accounts`

Lưu trữ thông tin tài khoản của các provider AI.

### Columns

- **`id`** (TEXT, PRIMARY KEY) — UUID xác định tài khoản duy nhất
- **`provider_id`** (TEXT, NOT NULL) — Tên provider (claude, deepseek, gemini, ...)
- **`email`** (TEXT, NOT NULL) — Email đăng nhập
- **`credential`** (TEXT, NULL) — Token/cookie/session JSON (có thể NULL cho browser-based accounts)
- **`usage`** (REAL) — Tỷ lệ usage từ 0.0 đến 100.0 (phần trăm)
- **`reset_usage_at`** (TEXT) — Thời điểm reset usage, có thể là ngày tháng năm (`YYYY-MM-DD`) hoặc ngày tháng năm và giờ phút (`YYYY-MM-DD HH:MM`)
- **`is_memory_enabled`** (INTEGER, DEFAULT 0) — Trạng thái bật/tắt memory cho account (1 = enabled, 0 = disabled)
- **`user_data_dir`** (TEXT) — Đường dẫn thư mục profile Chrome cho browser-based provider (VD: zai-browser)
- **`last_used_at`** (INTEGER, NULL) — Timestamp (ms) của lần gần nhất account được dùng để gửi tin nhắn. NULL nếu chưa từng dùng. Được cập nhật mỗi khi `sendMessage()` thực sự dispatch request tới provider.

---

## Bảng: `providers`

Danh sách các provider đã được đăng ký trong hệ thống.

### Columns

- **`id`** (TEXT, PRIMARY KEY) — ID provider (viết thường)
- **`title`** (TEXT, NOT NULL) — Tên hiển thị của provider
- **`description`** (TEXT) — Mô tả ngắn về provider
- **`color`** (TEXT) — Màu sắc đại diện cho provider (hex code, VD: #1E90FF)
- **`platform`** (TEXT, DEFAULT 'web') — Loại provider: `web`, `cli`, `api`
- **`connection_type`** (TEXT, DEFAULT 'https') — Loại kết nối: `https` (gọi HTTPS trực tiếp), `browser` (dùng browser thật qua CDP + extension)
- **`is_enabled`** (INTEGER, DEFAULT 1) — Trạng thái bật/tắt (1 = enabled, 0 = disabled)
- **`website_url`** (TEXT) — URL website chính thức của provider
- **`auth_method`** (TEXT) — Phương thức xác thực (JSON array: `["basic","google"]`)
- **`is_pausable`** (INTEGER, DEFAULT 0) — Có thể tạm dừng conversation không
- **`is_memory`** (INTEGER, DEFAULT 0) — Tham khảo bộ nhớ đã lưu (Memory) - history memory tự động theo logic
- **`browser_extension_folder`** (TEXT) — Thư mục chứa extension cho browser-based provider (VD: 'zai-bridge'). NULL nếu không dùng browser

**Giá trị platform:**

- `web` - Provider dạng website (cần capture request qua MITM hoặc CDP)
- `cli` - Provider dạng command-line (chỉ cần MITM khi login)
- `api` - Provider API thuần (gọi trực tiếp, không cần proxy)

**Giá trị connection_type:**

- `https` - Provider gọi trực tiếp API qua HTTPS (VD: Claude, DeepSeek, Gemini API)
- `browser` - Provider dùng browser thật qua CDP + extension (VD: Z.AI Browser)

---

## Bảng: `model_stats`

Lưu trữ thống kê runtime per-model (hiện tại chỉ có success_rate).

**⚠️ LƯU Ý QUAN TRỌNG:** Bảng này **CHỈ** lưu các thống kê runtime cần persist. **KHÔNG BAO GIỜ** lưu metadata của model (name, capabilities, context_length, description...) vào database. Những thông tin đó phải lấy từ:
- Provider constants (`.constants.ts`) cho provider hardcode model list
- Provider API live (`getModels()`) cho provider dynamic model list

### Columns

- **`provider_id`** (TEXT, NOT NULL) — Provider sở hữu model
- **`model_id`** (TEXT, NOT NULL) — ID model (ví dụ: `deepseek-chat`)
- **`success_rate`** (REAL, DEFAULT NULL) — Tỷ lệ thành công (0-100%), NULL nếu chưa có dữ liệu
- **`updated_at`** (INTEGER, NOT NULL) — Thời gian cập nhật gần nhất (timestamp ms)

**Primary Key:** `(provider_id, model_id)`

---

## ~~Bảng: `models`~~ (DEPRECATED - ĐÃ XÓA)

**⚠️ Bảng này đã bị loại bỏ hoàn toàn.** Model list không còn được lưu vào database nữa. Lý do:
- Provider hardcode constants → cache là thừa
- Provider dynamic API → luôn fetch từ live source để đảm bảo cập nhật
- Chỉ `success_rate` cần persist → đã chuyển sang `model_stats`

---

## Bảng: `metrics`

Lưu trữ thống kê sử dụng (request, token, conversation).

### Columns

- **`id`** (INTEGER, PRIMARY KEY AUTOINCREMENT) — ID tự tăng
- **`provider_id`** (TEXT, NOT NULL) — Provider được sử dụng
- **`model_id`** (TEXT, NOT NULL) — Model được sử dụng
- **`account_id`** (TEXT, NOT NULL) — Account đã gửi request
- **`status`** (TEXT, DEFAULT 'success') — Trạng thái response: `success` hoặc `error`
- **`total_tokens`** (INTEGER, DEFAULT 0) — Tổng token (prompt + completion). Bằng 0 nếu lỗi
- **`timestamp`** (INTEGER, NOT NULL) — Thời gian request (timestamp ms)

**Indexes (tối ưu truy vấn thống kê):**

- `idx_metrics_timestamp` trên cột `timestamp`
- `idx_metrics_account_time` trên `(account_id, timestamp)`
- `idx_metrics_provider_model_time` trên `(provider_id, model_id, timestamp)`
- `idx_metrics_status` trên cột `status`