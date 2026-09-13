# Data Storage Architecture

Cấu trúc lưu trữ dữ liệu của AIWeb2API.

---

## 📂 Tổng quan

**Thư mục gốc:** `~/.aiweb2api/`

AIWeb2API sử dụng:
- **SQLite Database** — Metadata, accounts, providers, models, metrics
- **File System** — Browser profiles (user data dir) cho browser-based providers

---

## 🗄️ SQLite Database

**Path:** `~/.aiweb2api/database.sqlite`

### Nội dung

- Metadata của accounts, providers, models, metrics
- Quan hệ giữa entities (foreign keys)
- Timestamps và trạng thái

### Bảng chính

Xem chi tiết tại [`database-schema.md`](./database-schema.md)

- `accounts`
- `providers`
- `models`
- `metrics`

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

> **Lưu ý:** Nếu email chưa capture được trong quá trình login, fallback tên folder là `profile_<timestamp>`.

---

## 🔒 Security

### File Permissions

```bash
chmod 700 ~/.aiweb2api
chmod 600 ~/.aiweb2api/database.sqlite
```

### Backup

```bash
# Backup
tar -czf aiweb2api-backup-$(date +%Y%m%d).tar.gz ~/.aiweb2api/

# Restore
tar -xzf aiweb2api-backup-20240101.tar.gz -C ~/
```

---

## 📖 Related

- [`database-schema.md`](./database-schema.md) — Database schema
- [`README.md`](./README.md) — Project overview