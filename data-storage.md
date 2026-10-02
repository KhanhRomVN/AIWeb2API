# Data Storage Architecture

Cấu trúc lưu trữ dữ liệu của AIWeb2API.

---

## 📂 Tổng quan

**Thư mục gốc:** `~/.aiweb2api/`

```
~/.aiweb2api/
├── aiweb2api-accounts.sqlite   ← Accounts (DB chính)
├── metrics.sqlite              ← Metrics & model stats
├── database-managers.sqlite    ← Database manager configs
├── aiweb2api-config.sqlite     ← Global config
└── {providerId}/{email}/       ← Browser profiles
```

AIWeb2API sử dụng 4 file SQLite riêng biệt, mỗi file có vai trò độc lập:

| File | Nội dung | Ghi chú |
|---|---|---|
| `aiweb2api-accounts.sqlite` | Bảng `accounts` | DB chính |
| `metrics.sqlite` | Bảng `model_stats`, `metrics` | Thống kê runtime |
| `database-managers.sqlite` | Bảng `database_managers` | Manager configs |
| `aiweb2api-config.sqlite` | Bảng `config` | Global config |

---

## 🗄️ Accounts Database (DB chính)

**Path:** `~/.aiweb2api/aiweb2api-accounts.sqlite`

Chỉ chứa duy nhất bảng `accounts`. Tách biệt hoàn toàn khỏi metrics để migration accounts không ảnh hưởng dữ liệu thống kê.

### Bảng: `accounts`

Lưu trữ thông tin tài khoản của các provider AI.

**Columns:**

- **`id`** (TEXT, PRIMARY KEY) — UUID xác định tài khoản duy nhất
- **`provider_id`** (TEXT, NOT NULL) — Tên provider (claude, deepseek, gemini, ...)
- **`email`** (TEXT, NOT NULL) — Email đăng nhập
- **`credential`** (TEXT, NULL) — Token/cookie/session JSON (NULL cho browser-based accounts)
- **`usage`** (REAL) — Tỷ lệ usage từ 0.0 đến 100.0 (phần trăm)
- **`reset_usage_at`** (TEXT) — Thời điểm reset usage (`YYYY-MM-DD` hoặc `YYYY-MM-DD HH:MM`)
- **`is_memory_enabled`** (INTEGER, DEFAULT 0) — Trạng thái bật/tắt memory (1 = enabled)
- **`user_data_dir`** (TEXT) — Đường dẫn thư mục profile Chrome cho browser-based provider
- **`last_used_at`** (INTEGER, NULL) — Timestamp (ms) lần gần nhất account được dùng. NULL nếu chưa từng dùng.
- **`auth_method`** (TEXT, NULL) — Auth method dùng để tạo account (e.g. `google`, `github`, `apple`, `discord`). NULL nếu không cần phân loại.

---

## 📊 Metrics Database

**Path:** `~/.aiweb2api/metrics.sqlite`

Chứa toàn bộ dữ liệu thống kê runtime. Tách riêng để không làm nặng accounts DB và dễ xóa/reset thống kê mà không ảnh hưởng accounts.

### Bảng: `model_stats`

Lưu trữ thống kê runtime per-model (hiện tại: success_rate).

**⚠️ LƯU Ý:** Bảng này **CHỈ** lưu thống kê runtime cần persist. **KHÔNG BAO GIỜ** lưu metadata model (name, capabilities, context_length...) vào đây — những thứ đó lấy từ provider constants hoặc API live.

**Columns:**

- **`provider_id`** (TEXT, NOT NULL) — Provider sở hữu model
- **`model_id`** (TEXT, NOT NULL) — ID model (ví dụ: `deepseek-chat`)
- **`success_rate`** (REAL, DEFAULT NULL) — Tỷ lệ thành công (0–100%), NULL nếu chưa có dữ liệu
- **`updated_at`** (INTEGER, NOT NULL) — Thời gian cập nhật gần nhất (timestamp ms)

**Primary Key:** `(provider_id, model_id)`

### Bảng: `metrics`

Lưu trữ thống kê sử dụng (request, token) per-request.

**Columns:**

- **`id`** (INTEGER, PRIMARY KEY AUTOINCREMENT)
- **`provider_id`** (TEXT, NOT NULL) — Provider được sử dụng
- **`model_id`** (TEXT, NOT NULL) — Model được sử dụng
- **`account_id`** (TEXT, NOT NULL) — Account đã gửi request
- **`status`** (TEXT, DEFAULT `'success'`) — Trạng thái: `success` hoặc `error`
- **`total_tokens`** (INTEGER, DEFAULT 0) — Tổng token (prompt + completion). 0 nếu lỗi
- **`timestamp`** (INTEGER, NOT NULL) — Thời gian request (timestamp ms)

**Indexes:**

- `idx_metrics_timestamp` trên `timestamp`
- `idx_metrics_account_time` trên `(account_id, timestamp)`
- `idx_metrics_provider_model_time` trên `(provider_id, model_id, timestamp)`
- `idx_metrics_status` trên `status`

---

## 🗂️ Managers Database

**Path:** `~/.aiweb2api/database-managers.sqlite`

File SQLite **riêng biệt** lưu cấu hình các database manager do user tạo trong Zen Settings > General. Tách khỏi DB chính để migration không phá vỡ dữ liệu quản lý.

### Bảng: `database_managers`

Mỗi row là 1 manager với `type`:
- `local-file` — dùng `file_path`
- `connection` — dùng host/port/database_name/username/password/ssl_mode/channel_binding/extra_json

Record đặc biệt `__aiweb2api_default__` trỏ tới `aiweb2api-accounts.sqlite` và được seed tự động khi khởi động.

---

## ⚙️ Config Database

**Path:** `~/.aiweb2api/aiweb2api-config.sqlite`

File SQLite **riêng biệt** chỉ chứa duy nhất bảng `config` (single-row). Tách khỏi DB chính để cấu hình toàn cục không bị ảnh hưởng bởi migration. File và bảng được tạo tự động khi khởi động (`initConfigDatabase()`).

### Bảng: `config`

Single-row (`id = 1`, `CHECK (id = 1)`, được seed tự động).

- **`id`** (INTEGER, PRIMARY KEY) — Luôn bằng 1
- **`chromium_profile_dir`** (TEXT, NULL) — System path tới thư mục chứa các profile Chromium.
- **`chromium_profile_subpath`** (TEXT, NULL) — Relative path từ `[profile_email]/` tới folder chứa `Default/`. NULL hoặc rỗng = cấu trúc mặc định (`[profile_email]/Default/`). Ví dụ: `"chrome"` hoặc `"chromium"` cho cấu trúc `[profile_email]/chrome/Default/`.

**API:**
- `GET /v1/config` — Lấy cấu hình hiện tại
- `PUT /v1/config` — Cập nhật (partial) — body: `{ chromium_profile_dir?, chromium_profile_subpath? }`
- `POST /v1/config/scan-profile-dir` — Quét cấu trúc thư mục profile — body: `{ profile_dir: string }` → trả về `{ subpaths: string[] }` (mảng rỗng = cấu trúc mặc định)

---

## ~~Bảng: `providers`~~ (KHÔNG DÙNG DATABASE)

**⚠️** Provider metadata **KHÔNG** được lưu vào database. Lấy trực tiếp từ provider registry (`src/provider/*/` constants) mỗi lần cần — không persist.

**Nếu cần đọc thông tin provider:** dùng `providerRegistry.getAllProviders()` hoặc `fetchProviderConfig()` trong `provider.service.ts`.

---

## ~~Bảng: `models`~~ (KHÔNG DÙNG DATABASE)

Model metadata **KHÔNG** được lưu vào database. Lý do:
- Provider hardcode constants → cache là thừa, data có thể stale
- Provider dynamic API (`getModels()`) → luôn fetch từ live source
- Chỉ `success_rate` cần persist → đã có bảng `model_stats` trong `metrics.sqlite`

**Nếu cần danh sách models:** fetch từ `fetchModelsFromProvider(providerId)` trong `provider.service.ts`.

---

## 📁 File System — Browser Profiles

**Path:** `~/.aiweb2api/{providerId}/{email}/`

Mỗi browser-based provider có một thư mục profile riêng cho từng email đăng nhập.

```
~/.aiweb2api/
├── zai-browser/
│   ├── user1@example.com/
│   └── user2@example.com/
└── temp/
    └── {tempSessionId}/
```

---

## 🔧 Cross-DB Queries

Khi cần join dữ liệu giữa 2 databases (ví dụ: stats per account), **không thể dùng SQL JOIN trực tiếp**. Thực hiện ở service/repository layer:

1. Query `metrics.sqlite` → lấy stats tổng hợp theo `account_id`
2. Query `aiweb2api-accounts.sqlite` → lấy thông tin accounts
3. Merge kết quả in-memory

Ví dụ: `queryAccountStatsByPeriod()` trong `metrics.repository.ts`.

---

## 📖 Source Files

- `src/database/connection.ts` — Accounts DB init & `getDb()` / `getDataStore()`
- `src/database/metrics-db.ts` — Metrics DB init & `getMetricsDb()` / `getMetricsDataStore()`
- `src/database/managers.ts` — Managers DB
- `src/database/config-db.ts` — Config DB
- `src/database/migrations.ts` — Accounts DB migrations
- `src/database/schema.ts` — Kysely type schemas (`AccountsDatabase`, `MetricsDatabase`)
- `src/database/integrity-check.ts` — Startup integrity checks
