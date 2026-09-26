# Data Storage Architecture

Cấu trúc lưu trữ dữ liệu của AIWeb2API.

---

## 📂 Tổng quan

**Thư mục gốc:** `~/.aiweb2api/`

AIWeb2API sử dụng:
- **SQLite Database (chính)** — Metadata, accounts, providers, models, metrics
- **SQLite Database (managers)** — Cấu hình database manager do user tạo
- **SQLite Database (config)** — Cấu hình toàn cục (bảng `config` duy nhất)
- **File System** — Browser profiles (user data dir) cho browser-based providers

---

## 🗄️ SQLite Database (chính)

**Path:** `~/.aiweb2api/aiweb2api.sqlite`

### Nội dung

- Metadata của accounts, providers, models, metrics
- Quan hệ giữa entities (foreign keys)
- Timestamps và trạng thái

### Bảng chính

Xem chi tiết tại [`database-schema.md`](./database-schema.md)

- `accounts`
- `providers`
- `model_stats` 
- `metrics`

---

## 🗂️ Managers Database (riêng)

**Path:** `~/.aiweb2api/database-managers.sqlite`

File SQLite **riêng biệt** lưu cấu hình các database manager do user tạo
trong Zen Settings > General. Tách khỏi `database.sqlite` chính để migration
của DB chính không phá vỡ dữ liệu quản lý.

### Bảng

- `database_managers` — mỗi row là 1 manager với `type` = `local-file` (dùng
  `file_path`) hoặc `connection` (dùng host/port/database_name/username/
  password/ssl_mode/channel_binding/extra_json).

---

## ⚙️ Config Database (riêng)

**Path:** `~/.aiweb2api/aiweb2api-config.sqlite`

File SQLite **riêng biệt** chỉ chứa duy nhất bảng `config`, tách khỏi
`aiweb2api.sqlite` chính để cấu hình toàn cục không bị ảnh hưởng bởi migration
của DB chính. File và bảng được tạo tự động khi khởi động (`initConfigDatabase()`).

### Bảng `config`

Single-row (`id = 1`, `CHECK (id = 1)`, được seed tự động).

- **`id`** (INTEGER, PRIMARY KEY) — Luôn bằng 1
- **`chromium_profile_dir`** (TEXT, NULL) — System path tới thư mục chứa các
  profile Chromium. Khi login, client gửi `profile_folder` (tên folder cấp 1
  bên trong thư mục này) để backend mở browser với profile tương ứng.

### API

- `GET /v1/config` — Lấy cấu hình hiện tại
- `PUT /v1/config` — Cập nhật (partial) — body: `{ chromium_profile_dir? }`

---

## 📁 File System

### Browser Profiles

**Path:** `~/.aiweb2api/{providerId}/{email}/`

Mỗi browser-based provider (VD: `zai-browser`) có một thư mục profile riêng cho từng email đăng nhập.

```
~/.aiweb2api/
├── zai-browser/
│   ├── user1@example.com/
│   ├── user2@example.com/
│   └── ...
└── temp/
    ├── {tempSessionId}/
    └── ...
```

---

## 📖 Related

- [`database-schema.md`](./database-schema.md) — Database schema
- [`README.md`](./README.md) — Project overview