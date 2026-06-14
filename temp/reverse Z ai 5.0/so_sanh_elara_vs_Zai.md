# So sánh: Reverse Z AI 4.0 Demo vs Elara/Server

## 1. Tổng quan

| Tiêu chí | Reverse Z AI 4.0 Demo | Elara/Server |
|---|---|---|
| **Tên package** | `z-ai-bridge` | `@khanhromvn/elara-server` |
| **Version** | 1.0.3 | 1.2.5 |
| **Mô tả** | Bridge cho phép tương tác với Z.AI (GLM-5-Turbo) qua Chrome Extension | Full backend server hỗ trợ nhiều AI providers |
| **Mục tiêu** | Single-provider (chỉ Z.AI) | Multi-provider (13+ providers) |
| **Loại dự án** | Demo / Standalone tool | Production-grade server |

---

## 2. Kiến trúc & Cấu trúc

### Reverse Z AI 4.0 Demo — Đơn giản, tập trung
```
server.ts          → Bootstrap + mount routes
z.ts               → Core engine (ZChat class) — WebSocket + headless browser
src/routes/        → 4 route files (zen, webui, admin, proxy)
src/services/      → 3 services (MappingService, ProxyManager, Socks5Forwarder)
src/utils/         → 2 utils (sanitizer, sse)
extension/         → Chrome Extension (kết nối browser ↔ server)
```

### Elara/Server — Phân tầng, mở rộng
```
app.ts + server.ts → App factory + HTTP(S) server lifecycle
src/config/        → Cấu hình proxy, server (TLS, host, port)
src/controllers/   → 8 controllers (account, chat, messages, model, provider, stats, upload...)
src/routes/v1/     → 14+ route modules (chat, accounts, providers, messages, debug, config, models, stats, workspaces, git, commands, proxy, claudecode...)
src/services/      → 15+ services (account-refresh, account-selector, chat, command, config, db, git, login, models-sync, provider, proxy, scanner, stats, version, workspace)
src/middleware/     → errorHandler, logger, version
src/provider/      → 13 providers (mỗi cái riêng biệt)
src/utils/         → 11 utils (apiError, apiResponse, cert-manager, chat-validator, cookie-jar, database, http-client, logger, port, tokenizer...)
src/types/         → TypeScript type definitions
```

---

## 3. AI Providers

| | Reverse Z AI 4.0 Demo | Elara/Server |
|---|---|---|
| **Số lượng** | **1** (chỉ Z.AI) | **13+** |
| **Danh sách** | Z.AI (GLM-5-Turbo) | Claude, DeepSeek, Gemini, Gemini CLI, Groq, HuggingChat, Mistral, Qwen, Qwen CLI, Kiro CLI, Codex CLI, Cerebras Cloud, Z.AI |
| **Cơ chế** | Headless browser qua Chrome Extension | Mỗi provider có implementation riêng (headless browser, API, CLI...) |
| **Registry** | Không cần — hardcoded | `ProviderRegistry` dynamic loading + alias |
| **Model routing** | Cố định `glm-5-turbo` | `getProviderForModel()` — tự động chọn provider theo model |

---

## 4. Cách thức kết nối AI

### 4.0 Demo — WebSocket Bridge
```
Zen VSCode → HTTP :8888 → ZChat → WebSocket :8899 → Chrome Extension → Z.AI Web
```
- Dùng **Chrome Extension** (background.js + content.js + inject.js) làm trung gian
- ZChat khởi tạo WebSocket Server trên port 8899
- Extension inject vào `chat.z.ai`, gửi/nhận tin qua WebSocket
- Streaming qua SSE về client

### Elara/Server — Provider Pattern
```
Client → HTTP :port/v1/chat → chat.controller → chat.service → Provider → AI API/Browser/CLI
```
- Mỗi provider tự quản lý cách kết nối (API key, headless browser, CLI tool...)
- Có `ProviderRegistry` đăng ký và load tất cả providers lúc start
- Provider có thể register routes riêng + proxy handler riêng
- Z.AI provider trong Elara cũng tồn tại (`zai.ts` - 755 lines)

---

## 5. Tính năng so sánh

| Tính năng | 4.0 Demo | Elara/Server |
|---|---|---|
| **Chat streaming (SSE)** | ✅ | ✅ |
| **Non-streaming** | ✅ | ✅ |
| **Rate limiting** | ✅ (custom, đơn giản) | ✅ (express-rate-limit + custom) |
| **WAF detection** | ✅ (phát hiện + cooldown) | ❓ (không thấy rõ) |
| **Conversation mapping** | ✅ (MappingService) | ✅ (database-driven) |
| **Token sanitization** | ✅ (sanitizeToken) | ✅ (unescapeHtml + tokenizer) |
| **Proxy support** | ✅ (ProxyManager + SOCKS5) | ✅ (proxy.service + per-provider proxy handler) |
| **Account management** | ❌ (hardcoded 1 account) | ✅ (DB CRUD + refresh + selector) |
| **Multi-account rotation** | ❌ | ✅ (account-selector service) |
| **Database** | ❌ (in-memory only) | ✅ (SQLite + better-sqlite3) |
| **Authentication** | ✅ (Bearer token đơn giản) | ✅ (JWT + login per provider) |
| **HTTPS/TLS** | ❌ | ✅ (cert-manager + TLS config) |
| **Logging** | console.log | ✅ (Winston structured logger) |
| **Error handling** | Basic try/catch | ✅ (Centralized errorHandler middleware) |
| **Input validation** | Basic checks | ✅ (Zod schema validation) |
| **File upload** | ❌ | ✅ (multer) |
| **Git integration** | ❌ | ✅ (simple-git) |
| **Workspace management** | ❌ | ✅ (workspace.service) |
| **Model sync** | ❌ (hardcoded) | ✅ (models-sync.service) |
| **Stats/Analytics** | ❌ (stub endpoint) | ✅ (stats.service - 387 lines) |
| **Version checking** | ❌ | ✅ (version.service) |
| **CLI support** | ❌ | ✅ (Kiro, Codex, Qwen CLI, Gemini CLI) |
| **Chrome Extension** | ✅ (đi kèm) | ❌ (không cần) |
| **Search mode** | ❌ | ✅ (is_search parameter) |
| **Temperature control** | ❌ | ✅ (temperature parameter) |
| **Thinking mode** | ❌ | ✅ (thinking parameter) |

---

## 6. Dependencies chính

| | 4.0 Demo | Elara/Server |
|---|---|---|
| **Express** | v5.2.1 | v4.19.2 |
| **WebSocket** | ws v8.21.0 | ❌ (không dùng) |
| **Database** | ❌ | better-sqlite3, sqlite3, mongoose |
| **Auth** | ❌ | jsonwebtoken, cookie-parser |
| **Validation** | ❌ | zod |
| **Logging** | ❌ (console) | winston |
| **HTTP Client** | ❌ (qua extension) | node-fetch, http-mitm-proxy |
| **Security** | ❌ | helmet, express-rate-limit |
| **Tokenizer** | ❌ | js-tiktoken |
| **File handling** | ❌ | multer, fs-extra |
| **Build tools** | pkg, javascript-obfuscator | pkg, tsup, tsc-alias, javascript-obfuscator, jest |
| **Total deps** | 4 runtime + 7 dev | 20+ runtime + 30+ dev |

---

## 7. API Routes so sánh

### 4.0 Demo
| Route | Mô tả |
|---|---|
| `GET /v1/health` | Health check |
| `GET /v1/providers` | Danh sách providers (hardcoded) |
| `GET /v1/accounts` | Danh sách accounts (hardcoded) |
| `GET /v1/stats` | Stats (stub) |
| `POST /v1/chat/accounts/messages` | Chat chính |
| `POST /v1/chat/accounts/:id/messages` | Chat với accountId |
| `POST /v1/chat/pause` | Pause (stub) |
| `/api/*` | Z.AI Web UI mock |
| `/rate-limit-*` | Rate limit admin |

### Elara/Server
| Route | Mô tả |
|---|---|
| `GET /health` | Health check |
| `/v1/chat` | Chat routing |
| `/v1/accounts` | Account CRUD |
| `/v1/providers` | Provider info |
| `/v1/messages` | Message history |
| `/v1/models` | Model listing |
| `/v1/model-sequences` | Model sequences |
| `/v1/stats` | Thống kê chi tiết |
| `/v1/config` | Cấu hình |
| `/v1/workspaces` | Workspace management |
| `/v1/git` | Git operations |
| `/v1/commands` | Command execution |
| `/v1/proxy` | Proxy config |
| `/v1/claudecode` | Claude Code specific |
| `/v1/debug` | Debug endpoints |
| `/:provider/*` | Provider-specific routes |
| `POST /login/:provider` | Provider login |

---

## 8. Kết luận

| | Reverse Z AI 4.0 Demo | Elara/Server |
|---|---|---|
| **Vai trò** | Prototype / Demo kết nối Z.AI trực tiếp | Production server quản lý nhiều AI providers |
| **Độ phức tạp** | Thấp (~15 files source) | Cao (~50+ files source) |
| **Khả năng mở rộng** | Thêm provider = viết lại core | Thêm provider = tạo 1 file mới + register |
| **Phù hợp cho** | Test nhanh, 1 user, chỉ dùng Z.AI | Deploy thực tế, multi-user, multi-provider |

**Tóm lại**: 4.0 Demo là một **bridge đơn hướng** — kết nối Zen VSCode với Z.AI duy nhất qua Chrome Extension. Elara/Server là một **nền tảng đa năng** — hỗ trợ 13+ AI providers với database, account management, stats, và kiến trúc mở rộng. 4.0 Demo là "bản demo khái niệm", Elara/Server là "sản phẩm hoàn chỉnh".

---

## 9. Đề xuất nâng cấp cho Z AI 4.0 Demo

> Nguyên tắc: Giữ nguyên triết lý "lightweight bridge → Z.AI qua Chrome Extension", không biến thành multi-provider server. Tập trung làm **Z.AI experience tốt nhất có thể**.

### 🔴 P0 — Sửa lỗi nền tảng / Bắt buộc

#### 9.1 Conversation History Persistence
**Vấn đề**: Hiện tại `MappingService` chỉ lưu trong memory → restart server = mất toàn bộ mapping conversation
```
Hiện tại: mappingService = Map<string, string>  (RAM only)
```
**Nâng cấp**:
- Thêm SQLite nhẹ (dùng `better-sqlite3`, không cần server)
- Lưu `{ zenConversationId, zaiChatId, lastActive, messageCount }`
- Khởi động lại → tự động reconnect các session cũ
- File DB nhỏ (~few MB), không ảnh hưởng lightweight

#### 9.2 Structured Logging thay console.log
**Vấn đề**: Toàn bộ code dùng `console.log` / `console.error` → không filter, không rotate, khó debug
```
Hiện tại: console.log('[Zen Route] 🆕 New browser chat...');
```
**Nâng cấp**:
- Thêm `winston` hoặc nhẹ hơn: `pino` (fastest Node.js logger)
- Log levels: `debug | info | warn | error`
- Ghi ra file + console, tự động rotate
- Format: `[timestamp] [level] [module] message`

#### 9.3 Graceful Shutdown & Reconnection
**Vấn đề**: Tắt server = đóng WebSocket ngay, không cleanup. Extension mất kết nối = crash.
**Nâng cấp**:
- `process.on('SIGINT/SIGTERM')` → đóng browser session, flush logs, close WS gracefully
- Extension auto-reconnect khi server restart (thêm exponential backoff)
- Lưu trạng thái browser session để khôi phục nhanh

---

### 🟡 P1 — Nâng cao trải nghiệm Z.AI

#### 9.4 Multi-Account Z.AI Rotation
**Vấn đề**: Hiện tại hardcoded 1 account `z-account`, 1 credential
```
Hiện tại: { id: 'z-account', email: 'user@chat.z.ai', credential: 'dummy-credential' }
```
**Nâng cấp**:
- Hỗ trợ nhiều tài khoản Z.AI (Google login, basic login)
- Round-robin hoặc least-recently-used rotation
- Auto-switch khi 1 account bị rate limit / WAF block
- Lưu accounts trong SQLite (encrypted credentials)
- Admin UI để thêm/xóa accounts

#### 9.5 Thông minh hơn về Conversation Context
**Vấn đề**: Logic hiện tại khá thô — lần 2 gửi chỉ extract `<zen-user-content>`, không gửi history
```
Hiện tại:
  isNewChat → gửi full payload
  !isNewChat → chỉ gửi user content (bỏ system prompt)
```
**Nâng cấp**:
- **Context window management**: Đếm tokens, tự động truncate history cũ khi gần limit
- **Smart summarization**: Khi conversation quá dài → tự tóm tắt phần cũ, giữ context quan trọng
- **Per-conversation settings**: Cho phép mỗi conversation có temperature, model variant khác nhau
- **Branch conversations**: Từ 1 điểm, tạo nhánh mới (như ChatGPT)

#### 9.6 Enhanced WAF/Rate-Limit Handling
**Vấn đề**: Hiện tại chỉ detect WAF error và cooldown đơn giản
```
Hiện tại: isWAFError() → reportWAFBlock() → cooldown
```
**Nâng cấp**:
- **Adaptive throttling**: Tự động giảm tốc độ request khi phát hiện sắp bị block
- **Request fingerprinting**: Randomize timing, headers để tránh pattern detection
- **Auto-retry với backoff**: Không fail ngay → thử lại 2-3 lần với delay tăng dần
- **WAF bypass strategies**: Rotation user-agent, proxy switching tự động
- **Dashboard hiển thị**: Trạng thái rate-limit realtime trong admin UI

#### 9.7 Streaming Quality Improvements
**Vấn đề**: Buffer logic hiện tại phức tạp và có thể drop tokens
```
Hiện tại: Custom bufferParts + inTag parsing + sanitizeToken
```
**Nâng cấp**:
- **Reliable token stream**: Rewrite buffer logic dùng state machine thay vì manual string parsing
- **Thinking mode support**: Tách `<think()>...</think()>` thành separate SSE event type
- **Progress indicators**: Gửi metadata events (tokens/sec, estimated time, queue position)
- **Partial save**: Stream đang chạy mà mất kết nối → tự động resume từ checkpoint

---

### 🟢 P2 — Tính năng mới giá trị cao

#### 9.8 Z.AI Search Mode
**Vấn đề**: Z.AI web có tính năng search nhưng bridge chưa expose
```
Hiện tại: is_search: false (hardcoded trong providers endpoint)
```
**Nâng cấp**:
- Thêm parameter `is_search: true` trong request body
- Extension inject trigger search mode trên Z.AI web
- Trả về kết quả search + citations trong SSE stream
- Format: `{ type: "search_result", query: "...", sources: [...] }`

#### 9.9 File Upload / Image Support
**Vấn đề**: Z.AI web hỗ trợ upload file/image nhưng bridge chưa hỗ trợ
```
Hiện tại: is_upload: false
```
**Nâng cấp**:
- Thêm `/v1/upload` endpoint nhận file từ Zen
- Extension forward file sang Z.AI web upload
- Hỗ trợ: images (PNG, JPG), PDF, code files
- Preview trong Zen chat

#### 9.10 Token Counting & Cost Estimation
**Vấn đề**: Không biết số tokens đã dùng, không estimate chi phí
**Nâng cấp**:
- Thêm `js-tiktoken` hoặc nhẹ hơn: ước lượng tokens (1 token ≈ 4 chars)
- Header response: `X-Tokens-Used`, `X-Tokens-Remaining`
- `/v1/tokenize` endpoint để preview token count trước khi gửi
- Daily/weekly usage stats lưu vào SQLite

#### 9.11 Admin Dashboard Cải tiến
**Vấn đề**: WebUI hiện tại chỉ mock Z.AI interface, không có admin thực sự
**Nâng cấp**:
- **Live monitoring**: Xem tất cả conversations đang active
- **Rate limit dashboard**: Biểu đồ requests/phút, WAF blocks, cooldown status
- **Account health**: Trạng thái mỗi account Z.AI (alive/blocked/cooldown)
- **Quick actions**: Reset session, switch account, clear cache
- **Logs viewer**: Xem real-time logs trong browser

#### 9.12 Proxy Intelligence
**Vấn đề**: Proxy hiện tại chỉ manual config
**Nâng cấp**:
- **Auto-proxy rotation**: Khi WAF block → tự động switch proxy
- **Proxy health check**: Test latency, availability định kỳ
- **Geo-targeting**: Chọn proxy theo region gần Z.AI server nhất
- **Built-in proxy pool**: Tích hợp danh sách free proxies hoặc API lấy proxy

---

### 🔵 P3 — Nice-to-have / Long-term

#### 9.13 Model Selection (Khi Z.AI thêm models)
```
Hiện tại: Hardcoded 'glm-5-turbo'
Tương lai: ['glm-5-turbo', 'glm-5-plus', 'glm-4-long', ...]
```
- Auto-detect available models từ Z.AI web
- `/v1/models` trả về danh sách dynamic
- Cho phép user chọn model trong Zen

#### 9.14 Conversation Export/Import
- Export sang Markdown, JSON
- Import từ ChatGPT/Claude history
- Sync giữa nhiều máy

#### 9.15 Voice Mode (Future)
- Z.AI có thể thêm voice → bridge cũng expose
- WebSocket audio streaming

#### 9.16 Plugin System
- Cho phép community viết plugins cho bridge
- Ví dụ: auto-summarize, auto-translate, code formatter

---

### Priority Matrix

| Tính năng | Impact | Effort | Priority |
|---|---|---|---|
| Conversation Persistence | 🔴 Cao | 🟢 Thấp | **P0** |
| Structured Logging | 🔴 Cao | 🟢 Thấp | **P0** |
| Graceful Shutdown | 🔴 Cao | 🟢 Thấp | **P0** |
| Multi-Account Rotation | 🟡 Cao | 🟡 Trung bình | **P1** |
| Smart Context | 🟡 Cao | 🔴 Cao | **P1** |
| WAF Bypass | 🟡 Cao | 🟡 Trung bình | **P1** |
| Streaming Rewrite | 🟡 Trung bình | 🟡 Trung bình | **P1** |
| Search Mode | 🟢 Trung bình | 🟡 Trung bình | **P2** |
| File Upload | 🟢 Trung bình | 🔴 Cao | **P2** |
| Token Counting | 🟢 Trung bình | 🟢 Thấp | **P2** |
| Admin Dashboard | 🟢 Trung bình | 🟡 Trung bình | **P2** |
| Proxy Intelligence | 🟢 Thấp | 🟡 Trung bình | **P2** |
| Model Selection | 🟢 Thấp | 🟢 Thấp | **P3** |
| Export/Import | 🟢 Thấp | 🟡 Trung bình | **P3** |

---

### Lộ trình đề xuất

**Phase 1 (1-2 tuần)** — P0: Fix nền tảng
- SQLite persistence cho MappingService
- Winston/Pino logging
- Graceful shutdown + auto-reconnect

**Phase 2 (2-3 tuần)** — P1: Nâng cao trải nghiệm
- Multi-account rotation
- WAF adaptive handling
- Rewrite streaming buffer

**Phase 3 (2-4 tuần)** — P2: Tính năng mới
- Search mode
- Token counting
- Admin dashboard cải tiến

**Phase 4 (Ongoing)** — P3: Long-term
- Model selection khi Z.AI cập nhật
- File upload
- Plugin system