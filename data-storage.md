# Data Storage Architecture

Cấu trúc lưu trữ dữ liệu của AIWeb2API.

---

## 📂 Tổng quan

**Thư mục gốc:** `~/.aiweb2api/`

AIWeb2API sử dụng:
- **SQLite Database (chính)** — Metadata, accounts, providers, models, metrics
- **SQLite Database (managers)** — Cấu hình database manager do user tạo
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
- `config`

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