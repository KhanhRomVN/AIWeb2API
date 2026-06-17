<p align="center">
  <img src="./resources/icon.png" width="128" height="128" alt="Elara Logo">
</p>

<h1 align="center">🚀 Elara Server</h1>

<p align="center">
  <strong>AI Backend Proxy & Manager — Unified API for 20+ AI Providers</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-68a063?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/SQLite-3-003b57?style=for-the-badge&logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Version-1.2.5-brightgreen?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Bundle-~8MB-ff69b4?style=for-the-badge" alt="Bundle Size">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Stable-success?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square" alt="PRs Welcome">
</p>

---

## 📋 Mục Lục

- [✨ Giới Thiệu](#-giới-thiệu)
- [🔥 Tính Năng Nổi Bật](#-tính-năng-nổi-bật)
- [🚀 Cài Đặt Nhanh](#-cài-đặt-nhanh)
- [📖 Hướng Dẫn Sử Dụng](#-hướng-dẫn-sử-dụng)
- [🧩 Providers Hỗ Trợ](#-providers-hỗ-trợ)
- [📡 API Endpoints](#-api-endpoints)
- [🗄️ Database Schema](#️-database-schema)
- [📁 Cấu Trúc Dự Án](#-cấu-trúc-dự-án)
- [🛠️ Phát Triển & Đóng Góp](#️-phát-triển--đóng-góp)
- [📄 License](#-license)
- [📧 Liên Hệ](#-liên-hệ)

---

## ✨ Giới Thiệu

**Elara Server** là một backend proxy nhẹ nhưng mạnh mẽ, cung cấp unified API cho **20+ AI providers** (Claude, DeepSeek, Mistral, Groq, Qwen, Gemini, ...) với khả năng lưu trữ dữ liệu hội thoại local an toàn.

> ⚡ **Chỉ ~8MB bundle**, khởi động dưới 1 giây — tối ưu cho cả development và production.

---

## 🔥 Tính Năng Nổi Bật

| Tính năng | Mô tả |
| --------- | ----- |
| 🚀 **Multi-Provider** | Hỗ trợ 20+ AI providers qua unified API |
| 🔌 **Single Endpoint** | Một endpoint duy nhất cho tất cả nhu cầu AI |
| 💾 **Local Storage** | SQLite tự động quản lý trong `~/.elara/` |
| ⚡ **Siêu Nhẹ** | Bundle ~8MB, khởi động ngay lập tức |
| 🔒 **HTTPS + TLS** | Hỗ trợ HTTPS với tự động tạo certificate |
| 🧠 **Thinking Mode** | Hỗ trợ deepseek-reasoner, thinking models |
| 📤 **Upload File** | Upload file lên provider (image, video, ...) |
| 🔄 **Auto-Continue** | Tự động tiếp tục response bị cắt (DeepSeek) |
| 🛡️ **Port Conflict Handler** | Tự động hỏi kill process đang chiếm port |
| 📊 **Usage Metrics** | Thống kê token, request theo thời gian |
| 🖥️ **CLI & Programmatic** | Chạy như CLI hoặc import vào project |
| 🌐 **Proxy Support** | MITM proxy để login qua browser |

---

## 🚀 Cài Đặt Nhanh

### Cài đặt toàn cầu

```bash
npm install -g @khanhromvn/elara-server
```

### Chạy server

```bash
elara-server
```

### Hoặc chạy từ source

```bash
git clone https://github.com/khanhromvn/AIWeb2API
cd AIWeb2API
npm install
npm run dev
```

---

## 📖 Hướng Dẫn Sử Dụng

### Command Options

```bash
elara-server [options]
```

| Option | Mô tả | Mặc định |
| ------ | ----- | -------- |
| `--port, -p <number>` | Cổng server | `8888` |
| `--db-path <path>` | Đường dẫn database SQLite | `~/.elara/database.sqlite` |

**Ví dụ:**

```bash
elara-server --port 9000 --db-path ./my-data.sqlite
```

### Cơ chế xử lý Port Conflict

Khi port đã bị chiếm, server sẽ tự động hỏi:

```
[ERROR] Port 8888 already in use
Port 8888 is already in use. Do you want to kill the process using this port? (y/n)
```

- Nhập `y` → tự động kill process → server start lại
- Nhập `n` → server dừng với lỗi

> **Lưu ý:** Chỉ hoạt động trong môi trường interactive (có TTY). Production mode sẽ bỏ qua và báo lỗi.

---

## 🧩 Providers Hỗ Trợ

| Provider | Key | Platform | Auth |
| -------- | --- | -------- | ---- |
| Claude | `claude` | Web | Basic / Google |
| DeepSeek | `deepseek` | Web | Basic / Google |
| Mistral | `mistral` | Web | Basic / Google |
| Groq | `groq` | API | API Key |
| Qwen | `qwen` | Web | Basic / Google |
| Gemini | `gemini` | API / Web | API Key / Basic |
| HuggingChat | `huggingchat` | Web | Basic |
| Z.AI | `z.ai` | Web | Basic |
| Z.AI Browser | `z.ai browser` | Browser | CDP + Extension |
| Cerebras Cloud | `cerebras-cloud` | API | API Key |
| Qwen CLI | `qwen-cli` | CLI | Token |
| Gemini CLI | `gemini-cli` | CLI | Token |
| Codex CLI | `codex-cli` | CLI | Token |

**Aliases:** `z` → Z.AI, `zai` → Z.AI Browser, `z-ai` → Z.AI, v.v.

---

## 📡 API Endpoints

### Chat APIs

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| `POST` | `/v1/chat/completions` | OpenAI-compatible completion |
| `POST` | `/v1/chat/messages` | Anthropic-compatible messages |
| `POST` | `/v1/accounts/:accountId/messages` | Gửi tin nhắn chat |
| `POST` | `/v1/messages` | Claude Code / Qwen Code CLI proxy |
| `POST` | `/v1/messages/count_tokens` | Đếm token |

### Account APIs

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| `POST` | `/v1/accounts/import` | Import hàng loạt accounts |
| `POST` | `/v1/accounts` | Thêm hoặc cập nhật account |
| `GET` | `/v1/accounts` | List accounts |
| `DELETE` | `/v1/accounts/:id` | Xóa account |
| `POST` | `/v1/accounts/:provider/login` | Login qua browser |
| `POST` | `/v1/accounts/:id/switch` | Chuyển đổi account |

### Provider APIs

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| `GET` | `/v1/providers` | List providers + stats |
| `GET` | `/v1/providers/:providerId/models` | Models của provider |
| `GET` | `/v1/models/all` | Tất cả models từ enabled providers |

### Stats APIs

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| `GET` | `/v1/stats` | Thống kê usage |
| `POST` | `/v1/stats/metrics` | Ghi nhận metrics |

### Config APIs

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| `GET` | `/v1/config/values` | Đọc config keys |
| `PUT` | `/v1/config/values` | Upsert config keys |

### Workspace APIs (AI Coding)

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| `GET` | `/v1/workspaces/list` | List workspaces |
| `POST` | `/v1/workspaces/link` | Tạo hoặc tìm workspace |
| `GET` | `/v1/workspaces/context/:id` | Lấy context files |
| `PUT` | `/v1/workspaces/context/:id` | Cập nhật context file |

### Proxy APIs

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| `GET` | `/v1/proxy/config` | Lấy proxy config |
| `POST` | `/v1/proxy/config` | Cập nhật proxy config |
| `GET` | `/v1/proxy/certificate-info` | Thông tin certificate |

### Git APIs

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| `POST` | `/v1/git/status` | Git status |
| `POST` | `/v1/git/add` | Git add |
| `POST` | `/v1/git/commit` | Git commit |
| `POST` | `/v1/git/push` | Git push |
| `POST` | `/v1/git/diff` | Git diff |

### Health Check

| Method | Endpoint | Mô tả |
| ------ | -------- | ----- |
| `GET` | `/health` | Health check |

---

## 🗄️ Database Schema

Elara Server sử dụng **SQLite** với file database mặc định tại `~/.elara/database.sqlite`.

### Các bảng chính

| Bảng | Mô tả |
| ---- | ----- |
| `accounts` | Tài khoản providers (email, credential, usage) |
| `providers` | Danh sách providers (enabled, auth_method, connection_type) |
| `models` | Models cache từ providers (thinking, image upload, context length) |
| `metrics` | Usage metrics (tokens, status, timestamp) |
| `conversations` | Local conversations lưu trữ |
| `messages` | Messages trong conversations |
| `config` | Key-value config store |
| `model_sequences` | Thứ tự ưu tiên model |
| `commands` | Custom commands (trigger → action) |

**Chi tiết schema:** Xem [SCHEMA.md](./SCHEMA.md)

---

## 📁 Cấu Trúc Dự Án

```
src/
├── config/          # Cấu hình server & proxy
├── controllers/     # API controllers
├── database/        # SQLite connection & migrations
├── middleware/      # Express middleware
├── provider/        # Các provider integrations
│   ├── deepseek/   # DeepSeek provider
│   ├── gemini/     # Gemini provider
│   ├── zai/        # Z.AI provider
│   ├── ...
│   └── registry.ts # Provider registry
├── repositories/    # Data access layer
├── routes/          # API routes
├── services/        # Business logic
├── types/           # Type definitions (Zod schemas)
├── utils/           # Utilities (logger, cert-manager, prompt, kill-port)
├── app.ts           # Express app creation
├── server.ts        # HTTP/HTTPS server
└── index.ts         # Entry point
```

**Chi tiết kiến trúc:** Xem [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 🛠️ Phát Triển & Đóng Góp

### Yêu cầu

- Node.js 20+
- npm hoặc yarn

### Clone & Install

```bash
git clone https://github.com/khanhromvn/AIWeb2API
cd AIWeb2API
npm install
```

### Chạy Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Đóng góp

1. Fork repository
2. Tạo branch mới: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add some feature'`
4. Push: `git push origin feature/your-feature`
5. Tạo Pull Request

---

## 📄 License

Released under the [ISC](LICENSE) license.

---

## 📧 Liên Hệ

**Tác giả:** Khanh Rom VN

**Email:** [khanhromvn@gmail.com](mailto:khanhromvn@gmail.com)

**GitHub:** [@khanhromvn](https://github.com/khanhromvn)

---

<p align="center">
  <strong>⭐ Star us on GitHub — it motivates us a lot! ⭐</strong>
</p>

<p align="center">
  <sub>Built with ❤️ by <strong>@khanhromvn</strong></sub>
</p>