# Schema Cơ Sở Dữ Liệu Elara Server

Tài liệu mô tả cấu trúc database SQLite của Elara Server.

## Tổng quan

Elara Server sử dụng **SQLite** làm cơ sở dữ liệu, với file database mặc định nằm tại `~/.elara/database.sqlite`. Cơ chế migration tự động chạy mỗi khi server khởi động để đảm bảo schema luôn cập nhật.

---

## Bảng: `accounts`

Lưu trữ thông tin tài khoản của các provider AI.

| Cột | Kiểu | Ràng buộc | Mô tả |
| `id` | TEXT | PRIMARY KEY | UUID xác định tài khoản duy nhất |
| `provider_id` | TEXT | NOT NULL | Tên provider (claude, deepseek, gemini, ...) |
| `email` | TEXT | NOT NULL | Email đăng nhập |
| `credential` | TEXT | NOT NULL | Token/cookie/session JSON |
| `last_refreshed_at` | INTEGER | - | Thời gian refresh token gần nhất (timestamp ms) |
| `usage` | TEXT | - | Thông tin usage (JSON) |
| `reset_period` | TEXT | - | Chu kỳ reset (day/month) |

---

## Bảng: `providers`

Danh sách các provider đã được đăng ký trong hệ thống.

| Cột         | Kiểu | Ràng buộc            | Mô tả                                                   |
| ----------- | ---- | -------------------- | ------------------------------------------------------- |
| `id`        | TEXT | PRIMARY KEY          | ID provider (viết thường)                               |
| `title`     | TEXT | NOT NULL             | Tên hiển thị của provider                               |
| `platform`  | TEXT | DEFAULT 'web'        | Loại provider: `web`, `cli`, `api`                      |

**Giá trị platform:**
- `web` - Provider dạng website (cần capture request qua MITM hoặc CDP)
- `cli` - Provider dạng command-line (chỉ cần MITM khi login)
- `api` - Provider API thuần (gọi trực tiếp, không cần proxy)

**Ghi chú:** Số lượng tài khoản của mỗi provider có thể tính bằng `COUNT(*) FROM accounts WHERE provider_id = ?` khi cần.

---

## Bảng: `config`

Lưu trữ cấu hình key-value cho hệ thống.

| Cột     | Kiểu | Ràng buộc   | Mô tả                                |
| ------- | ---- | ----------- | ------------------------------------ |
| `key`   | TEXT | PRIMARY KEY | Khóa cấu hình                        |
| `value` | TEXT | -           | Giá trị (có thể là string hoặc JSON) |

**Các key phổ biến:**

- `enable_stats_collection` - Bật/tắt thu thập thống kê (mặc định: `true`)

---

## Bảng: `models`

Lưu trữ danh sách model của từng provider (cache từ API provider).

| Cột              | Kiểu    | Ràng buộc                 | Mô tả                                      |
| ---------------- | ------- | ------------------------- | ------------------------------------------ |
| `id`             | INTEGER | PRIMARY KEY AUTOINCREMENT | ID tự tăng                                 |
| `provider_id`    | TEXT    | NOT NULL                  | Provider sở hữu model                      |
| `model_id`       | TEXT    | NOT NULL                  | ID model (ví dụ: `deepseek-chat`)          |
| `model_name`     | TEXT    | NOT NULL                  | Tên hiển thị                               |
| `is_thinking`    | INTEGER | DEFAULT 0                 | Hỗ trợ thinking mode (1 = có, 0 = không)   |
| `context_length` | INTEGER | -                         | Độ dài context tối đa (token)              |
| `updated_at`     | INTEGER | NOT NULL                  | Thời gian cập nhật gần nhất (timestamp ms) |

**Unique Constraint:** `UNIQUE(provider_id, model_id)`

---

## Bảng: `metrics`

Lưu trữ thống kê sử dụng (request, token, conversation).

| Cột               | Kiểu    | Ràng buộc                 | Mô tả                            |
| ----------------- | ------- | ------------------------- | -------------------------------- |
| `id`              | INTEGER | PRIMARY KEY AUTOINCREMENT | ID tự tăng                       |
| `provider_id`     | TEXT    | NOT NULL                  | Provider được sử dụng            |
| `model_id`        | TEXT    | NOT NULL                  | Model được sử dụng               |
| `account_id`      | TEXT    | NOT NULL                  | Account đã gửi request           |
| `conversation_id` | TEXT    | -                         | Conversation ID (nếu có)         |
| `total_tokens`    | INTEGER | DEFAULT 0                 | Tổng token (prompt + completion) |
| `timestamp`       | INTEGER | NOT NULL                  | Thời gian request (timestamp ms) |

**Indexes (tối ưu truy vấn thống kê):**

- `idx_metrics_timestamp` trên cột `timestamp`
- `idx_metrics_conversation_id` trên cột `conversation_id`
- `idx_metrics_account_time` trên `(account_id, timestamp)`
- `idx_metrics_provider_model_time` trên `(provider_id, model_id, timestamp)`

---

## Bảng đã xóa hoặc không còn dùng

| Bảng                   | Trạng thái | Ghi chú                             |
| ---------------------- | ---------- | ----------------------------------- |
| `model_sequences`      | Đã xóa     | Cơ chế sequence model đã bị loại bỏ |
| `provider_models`      | Đã xóa     | Thay thế bằng bảng `models`         |
| `provider_models_sync` | Đã xóa     | Không cần sync models nữa           |
| `commands`             | Đã xóa     | Tính năng commands đã bị loại bỏ    |
| `local_conversations`  | Đã xóa     | Backend không lưu conversation      |
| `local_messages`       | Đã xóa     | Backend không lưu message           |
| `models_performance`   | Đã xóa     | Không còn dùng                      |
| `conversation_stats`   | Đã xóa     | Không còn dùng                      |
| `extended_tools`       | Đã xóa     | Không còn dùng                      |
| `accounts_stats`       | Đã xóa     | Không còn dùng                      |
| `providers_stats`      | Đã xóa     | Không còn dùng                      |

---

## Quan hệ giữa các bảng

```
accounts ──┐
           │
providers ◄┘ (provider_id)

models ────┐
           │
metrics ◄──┘ (provider_id, model_id)
      │
      └── accounts (account_id)
```

---

## Ghi chú kỹ thuật

- **Timestamp:** Tất cả các cột timestamp đều lưu dưới dạng `number` (milliseconds since epoch)
- **WAL mode:** Database được cấu hình `PRAGMA journal_mode = WAL` để cải thiện concurrent access
- **Migration:** Schema tự động cập nhật qua hàm `runMigrations()` khi khởi động
- **Encoding:** UTF-8
- **Models:** Danh sách models được lấy trực tiếp từ API provider mỗi khi cần, và cache vào bảng `models` để fallback
