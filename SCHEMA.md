# Schema Cơ Sở Dữ Liệu Elara Server

Tài liệu mô tả cấu trúc database SQLite của Elara Server.

## Tổng quan

Elara Server sử dụng **SQLite** làm cơ sở dữ liệu, với file database mặc định nằm tại `~/.elara/database.sqlite`. Cơ chế migration tự động chạy mỗi khi server khởi động để đảm bảo schema luôn cập nhật.

---

## Bảng: `accounts`

Lưu trữ thông tin tài khoản của các provider AI.

| Cột                 | Kiểu    | Ràng buộc   | Mô tả                                           |
| ------------------- | ------- | ----------- | ----------------------------------------------- |
| `id`                | TEXT    | PRIMARY KEY | UUID xác định tài khoản duy nhất                |
| `provider_id`       | TEXT    | NOT NULL    | Tên provider (claude, deepseek, gemini, ...)    |
| `email`             | TEXT    | NOT NULL    | Email đăng nhập                                 |
| `credential`        | TEXT    | NULL        | Token/cookie/session JSON (có thể NULL cho browser-based accounts) |
| `last_refreshed_at` | INTEGER | -           | Thời gian refresh token gần nhất (timestamp ms) hoặc last used cho browser accounts |
| `usage`             | TEXT    | -           | Thông tin usage (JSON)                          |
| `reset_period`      | TEXT    | -           | Chu kỳ reset (day/month)                        |
| `is_memory_enabled` | INTEGER | DEFAULT 0   | Trạng thái bật/tắt memory cho account (1 = enabled, 0 = disabled) |
| `user_data_dir`     | TEXT    | -           | Đường dẫn thư mục profile Chrome cho browser-based provider (VD: zai-browser) |

---

## Bảng: `providers`

Danh sách các provider đã được đăng ký trong hệ thống.

| Cột                | Kiểu    | Ràng buộc            | Mô tả                                                    |
| ------------------ | ------- | -------------------- | -------------------------------------------------------- |
| `id`               | TEXT    | PRIMARY KEY          | ID provider (viết thường)                                |
| `title`            | TEXT    | NOT NULL             | Tên hiển thị của provider                                |
| `platform`         | TEXT    | DEFAULT 'web'        | Loại provider: `web`, `cli`, `api`                       |
| `connection_type`  | TEXT    | DEFAULT 'https'      | Loại kết nối: `https` (gọi HTTPS trực tiếp), `browser` (dùng browser thật qua CDP + extension) |
| `is_enabled`       | INTEGER | DEFAULT 1            | Trạng thái bật/tắt (1 = enabled, 0 = disabled)           |
| `website_url`      | TEXT    | -                    | URL website chính thức của provider                      |
| `auth_method`      | TEXT    | -                    | Phương thức xác thực (JSON array: `["basic","google"]`)  |
| `is_pausable`      | INTEGER | DEFAULT 0            | Có thể tạm dừng conversation không                       |
| `is_memory`        | INTEGER | DEFAULT 0            | Tham khảo bộ nhớ đã lưu (Memory) - history memory tự động theo logic |
| `browser_extension_folder` | TEXT | - | Thư mục chứa extension cho browser-based provider (VD: 'zai-bridge'). NULL nếu không dùng browser |

**Giá trị platform:**

- `web` - Provider dạng website (cần capture request qua MITM hoặc CDP)
- `cli` - Provider dạng command-line (chỉ cần MITM khi login)
- `api` - Provider API thuần (gọi trực tiếp, không cần proxy)

**Giá trị connection_type:**

- `https` - Provider gọi trực tiếp API qua HTTPS (VD: Claude, DeepSeek, Gemini API)
- `browser` - Provider dùng browser thật qua CDP + extension (VD: Z.AI Browser)

---

## Bảng: `models`

Lưu trữ danh sách model của từng provider (cache từ API provider).

| Cột                  | Kiểu    | Ràng buộc                 | Mô tả                                               |
| -------------------- | ------- | ------------------------- | --------------------------------------------------- |
| `id`                 | INTEGER | PRIMARY KEY AUTOINCREMENT | ID tự tăng                                          |
| `provider_id`        | TEXT    | NOT NULL                  | Provider sở hữu model                               |
| `model_id`           | TEXT    | NOT NULL                  | ID model (ví dụ: `deepseek-chat`)                   |
| `model_name`         | TEXT    | NOT NULL                  | Tên hiển thị                                        |
| `is_thinking`        | INTEGER | DEFAULT 0                 | Hỗ trợ thinking mode (1 = có, 0 = không)            |
| `max_context_length` | INTEGER | -                         | Độ dài context tối đa (token)                       |
| `is_image_upload`    | INTEGER | DEFAULT 0                 | Hỗ trợ upload hình ảnh (1 = có, 0 = không)          |
| `is_video_upload`    | INTEGER | DEFAULT 0                 | Hỗ trợ upload video (1 = có, 0 = không)             |
| `updated_at`         | INTEGER | NOT NULL                  | Thời gian cập nhật gần nhất (timestamp ms)          |
| `success_rate`       | REAL    | DEFAULT NULL              | Tỷ lệ thành công (0-100%), NULL nếu chưa có dữ liệu |
| `description`        | TEXT    | -                         | Mô tả chi tiết về model, khả năng và use cases      |

**Unique Constraint:** `UNIQUE(provider_id, model_id)`

**Ghi chú:** Các field `is_search`, `is_image_upload`, `is_video_upload` nằm ở model level, không còn ở provider level.

---

## Bảng: `metrics`

Lưu trữ thống kê sử dụng (request, token, conversation).

| Cột            | Kiểu    | Ràng buộc                 | Mô tả                                            |
| -------------- | ------- | ------------------------- | ------------------------------------------------ |
| `id`           | INTEGER | PRIMARY KEY AUTOINCREMENT | ID tự tăng                                       |
| `provider_id`  | TEXT    | NOT NULL                  | Provider được sử dụng                            |
| `model_id`     | TEXT    | NOT NULL                  | Model được sử dụng                               |
| `account_id`   | TEXT    | NOT NULL                  | Account đã gửi request                           |
| `status`       | TEXT    | DEFAULT 'success'         | Trạng thái response: `success` hoặc `error`      |
| `total_tokens` | INTEGER | DEFAULT 0                 | Tổng token (prompt + completion). Bằng 0 nếu lỗi |
| `timestamp`    | INTEGER | NOT NULL                  | Thời gian request (timestamp ms)                 |

**Indexes (tối ưu truy vấn thống kê):**

- `idx_metrics_timestamp` trên cột `timestamp`
- `idx_metrics_account_time` trên `(account_id, timestamp)`
- `idx_metrics_provider_model_time` trên `(provider_id, model_id, timestamp)`
- `idx_metrics_status` trên cột `status`

---



## Ghi chú kỹ thuật

- **Timestamp:** Tất cả các cột timestamp đều lưu dưới dạng `number` (milliseconds since epoch)
- **WAL mode:** Database được cấu hình `PRAGMA journal_mode = WAL` để cải thiện concurrent access
- **Migration:** Schema tự động cập nhật qua hàm `runMigrations()` khi khởi động
- **Encoding:** UTF-8
- **Models:** Danh sách models được lấy trực tiếp từ API provider mỗi khi cần, và cache vào bảng `models` để fallback
- **Provider capabilities:** Các khả năng như search, image upload, video upload được định nghĩa ở cấp model, không phải provider



╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    █████╗ ██╗    ██╗███████╗██████╗  █████╗ ██████╗ ██╗      ║
║   ██╔══██╗██║    ██║██╔════╝██╔══██╗██╔══██╗██╔══██╗██║      ║
║   ███████║██║ █╗ ██║█████╗  ██████╔╝███████║██████╔╝██║      ║
║   ██╔══██║██║███╗██║██╔══╝  ██╔══██╗██╔══██║██╔═══╝ ██║      ║
║   ██║  ██║╚███╔███╔╝███████╗██████╔╝██║  ██║██║     ██║      ║
║   ╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝      ║ 
║                                                              ║
║              🚀 AI Web to API Gateway v1.2.5                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝