# Schema Cơ Sở Dữ Liệu AIWeb2API

Tài liệu mô tả cấu trúc database SQLite của AIWeb2API.

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

## ~~Bảng: `providers`~~ (KHÔNG DÙNG DATABASE)

**⚠️ Bảng này KHÔNG được lưu vào database.** Provider metadata được lấy trực tiếp từ provider registry (`src/provider/*/` constants) mỗi lần cần — không persist. Lý do:
- Provider metadata (name, platform, auth_method, models...) luôn cần là **live data** từ source code
- Lưu vào DB tạo nguy cơ stale data khi code provider được cập nhật
- `is_memory` per-provider: vì không có DB table, field này lấy từ config constant của từng provider

**Nếu cần đọc thông tin provider:** dùng `providerRegistry.getAllProviders()` hoặc `fetchProviderConfig()` trong `provider.service.ts`.

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

## ~~Bảng: `models`~~ (THAM KHẢO — KHÔNG DÙNG DATABASE)

**⚠️ Bảng này KHÔNG được lưu vào database.** Ghi chú tham khảo về schema nếu cần implement trong tương lai.

Lý do không dùng:
- Provider hardcode constants → cache là thừa, data có thể stale
- Provider dynamic API (`getModels()`) → luôn fetch từ live source để đảm bảo mới nhất
- Chỉ `success_rate` cần persist → đã chuyển sang bảng `model_stats`

**Nếu cần danh sách models:** fetch trực tiếp từ `fetchModelsFromProvider(providerId)` trong `provider.service.ts`.

Schema tham khảo (KHÔNG implement):
```
models (
  id TEXT,
  provider_id TEXT,
  name TEXT,
  is_thinking INTEGER,
  context_length INTEGER,
  ...
)
```

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