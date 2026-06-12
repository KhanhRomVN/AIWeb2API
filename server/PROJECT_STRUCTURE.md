# Elara Server — Đề xuất Cấu trúc Dự án Tối ưu

> **Ngày:** 2026-06-12
> **Mục tiêu:** Tái cấu trúc codebase để dễ bảo trì, mở rộng, test và onboarding developer mới.

---

## 1. Vấn đề hiện tại

| # | Vấn đề | File liên quan | Tác động |
|---|--------|---------------|----------|
| 1 | **Controller quá lớn** | `chat.controller.ts` (~500 dòng, 3 endpoints), `messages.controller.ts` (~500 dòng) | Khó test, khó debug, trộn lẫn business logic |
| 2 | **Service làm quá nhiều việc** | `chat.service.ts` vừa gửi message, vừa persist conversation, vừa tính token, vừa lock, vừa ghi metrics | Vi phạm Single Responsibility |
| 3 | **Provider file khổng lồ** | `deepseek.ts` (1120 dòng) chứa PoW, SSE parser, proxy handler, upload, session, API calls | Không thể tái sử dụng các phần độc lập |
| 4 | **Trùng lặp implementation** | `services/db.ts` và `utils/database.ts` cùng quản lý accounts | Hai code path, khó đồng bộ |
| 5 | **Thiếu phân tầng rõ ràng** | Controller gọi thẳng DB, Service gọi Service khác không qua interface | Khó mock khi test, coupling cao |
| 6 | **Route chứa business logic** | `management.ts` có logic import accounts inline | Không nhất quán với pattern chung |
| 7 | **Types phân tán** | `types/index.ts` + `provider/types.ts` có interface trùng/chồng lấp | Khó tra cứu, dễ lỗi khi refactor |
| 8 | **Middleware thiếu nhất quán** | Có file `version.middleware.ts` nhưng `logger.ts` và `errorHandler.ts` không có suffix `.middleware` | Khó phân biệt middleware với utility |

---

## 2. Cấu trúc đề xuất

```
server/src/
├── index.ts                          # Entry point (thay start.ts)
├── app.ts                            # Express app factory (giữ nguyên, đã tốt)
├── env.ts                            # Environment loader (giữ nguyên)

├── config/
│   ├── server.config.ts              # Server config (giữ nguyên)
│   ├── proxy.config.ts               # Proxy config (giữ nguyên)
│   └── index.ts                      # Re-export

├── types/                            # Tập trung TẤT CẢ types
│   ├── index.ts                      # Re-export tất cả
│   ├── account.types.ts              # Account, AccountSchema
│   ├── chat.types.ts                 # ChatRequest, ChatResponse, StreamChunk
│   ├── message.types.ts              # Message, SendMessageOptions
│   ├── provider.types.ts             # Provider interface, ProviderConfig
│   ├── model.types.ts                # Model, ModelSequence, CachedModel
│   ├── stats.types.ts                # UsageHistory, PeriodStats
│   ├── workspace.types.ts            # WorkspaceInfo, RootConfig
│   ├── command.types.ts              # Command
│   ├── git.types.ts                  # GitStatusSummary, FileDiffStats
│   ├── proxy.types.ts                # ProxyConfig, ProxyHandler
│   └── api.types.ts                  # ApiResponse, ApiError, Pagination

├── middleware/
│   ├── error-handler.middleware.ts    # (rename từ errorHandler.ts)
│   ├── request-logger.middleware.ts   # (rename từ logger.ts)
│   ├── version.middleware.ts          # (giữ nguyên)
│   ├── rate-limit.middleware.ts       # (mới) Rate limiting
│   └── index.ts                      # Re-export

├── routes/
│   ├── index.ts                      # Root router
│   └── v1/
│       ├── index.ts                  # Mount all v1 routes
│       ├── chat.routes.ts            # (rename từ chat.ts)
│       ├── account.routes.ts         # (giữ nguyên)
│       ├── provider.routes.ts        # (giữ nguyên)
│       ├── messages.routes.ts        # (rename từ messages.ts)
│       ├── model.routes.ts           # (giữ nguyên)
│       ├── model-sequences.routes.ts # (giữ nguyên)
│       ├── stats.routes.ts           # (giữ nguyên)
│       ├── config.routes.ts          # (giữ nguyên)
│       ├── debug.routes.ts           # (giữ nguyên)
│       ├── claudecode.routes.ts      # (giữ nguyên)
│       ├── command.routes.ts         # (giữ nguyên)
│       ├── git.routes.ts             # (giữ nguyên)
│       ├── workspace.routes.ts       # (giữ nguyên)
│       └── proxy.routes.ts           # (giữ nguyên)

├── controllers/                      # Mỏng — chỉ parse request, gọi service, format response
│   ├── index.ts
│   ├── chat/
│   │   ├── send-message.controller.ts    # Tách từ chat.controller.ts
│   │   ├── claude-messages.controller.ts # Tách từ chat.controller.ts
│   │   └── completion.controller.ts      # Tách từ chat.controller.ts
│   ├── messages/
│   │   ├── messages.controller.ts        # Tách logic session queue ra service
│   │   └── count-tokens.controller.ts
│   ├── account.controller.ts
│   ├── provider.controller.ts
│   ├── model.controller.ts
│   ├── models.controller.ts
│   ├── stats.controller.ts
│   ├── upload.controller.ts
│   ├── config.controller.ts              # (mới) Tách từ routes/v1/config.ts
│   ├── claudecode.controller.ts          # (mới) Tách từ routes/v1/claudecode.ts
│   ├── command.controller.ts             # (mới) Tách từ routes/v1/command.routes.ts
│   ├── git.controller.ts                 # (mới) Tách từ routes/v1/git.routes.ts
│   ├── workspace.controller.ts           # (mới) Tách từ routes/v1/workspace.routes.ts
│   └── proxy.controller.ts               # (mới) Tách từ routes/v1/proxy.routes.ts

├── services/                        # Business logic thuần túy
│   ├── index.ts
│   ├── chat/
│   │   ├── chat.service.ts           # Core: gửi message qua provider
│   │   ├── chat-persistence.service.ts  # (mới) Lưu conversation + message
│   │   ├── chat-session.service.ts   # (mới) Lock + session management
│   │   └── chat-metrics.service.ts   # (mới) Token counting + stats recording
│   ├── account/
│   │   ├── account.service.ts        # CRUD accounts (hợp nhất từ account.controller business logic)
│   │   ├── account-selector.service.ts
│   │   └── account-refresh.service.ts
│   ├── provider/
│   │   ├── provider.service.ts
│   │   └── models-sync.service.ts
│   ├── auth/
│   │   └── login.service.ts
│   ├── proxy/
│   │   ├── proxy.service.ts
│   │   └── proxy-events.service.ts   # (rename từ proxy-events.ts)
│   ├── kiro-account.service.ts
│   ├── command.service.ts
│   ├── config.service.ts
│   ├── git.service.ts
│   ├── stats.service.ts
│   ├── version.service.ts
│   ├── workspace.service.ts
│   └── scanner.service.ts

├── repositories/                    # (MỚI) Data access layer — chỉ chứa SQL queries
│   ├── index.ts
│   ├── account.repository.ts
│   ├── provider.repository.ts
│   ├── conversation.repository.ts
│   ├── message.repository.ts
│   ├── metrics.repository.ts
│   ├── config.repository.ts
│   ├── model-sequence.repository.ts
│   ├── command.repository.ts
│   └── provider-model.repository.ts

├── database/
│   ├── connection.ts                # (mới) Tách logic connect + native binding từ db.ts
│   ├── migrations.ts                # (mới) Tách toàn bộ CREATE TABLE + ALTER từ db.ts
│   ├── seed.ts                      # (mới) Dữ liệu mặc định
│   └── index.ts                     # Re-export getDb(), initDatabase(), closeDatabase()

├── providers/                       # (rename từ provider/)
│   ├── index.ts                     # Re-export tất cả providers
│   ├── registry.ts                  # Provider registry
│   ├── provider-config.ts           # Bundled provider definitions
│   ├── base-provider.ts             # (MỚI) Abstract class với shared logic
│   ├── deepseek/
│   │   ├── index.ts                 # Export DeepSeekProvider
│   │   ├── deepseek.provider.ts     # Provider class chính
│   │   ├── deepseek.pow.ts          # (tách) PoW WASM solver
│   │   ├── deepseek.sse-parser.ts   # (tách) SSE stream parser
│   │   ├── deepseek.proxy-handler.ts # (tách) Proxy handler
│   │   ├── deepseek.upload.ts       # (tách) File upload logic
│   │   └── deepseek.types.ts        # (tách) DeepSeek-specific types
│   ├── claude/
│   │   ├── index.ts
│   │   ├── claude.provider.ts
│   │   └── claude.types.ts
│   ├── gemini/
│   ├── groq/
│   ├── mistral/
│   ├── qwen/
│   ├── qwen-cli/
│   ├── cerebras-cloud/
│   ├── huggingchat/
│   ├── gemini-cli/
│   ├── kiro-cli/
│   ├── codex-cli/
│   └── zai/
├── utils/
│   ├── logger.ts
│   ├── http-client.ts
│   ├── tokenizer.ts
│   ├── cert-manager.ts
│   ├── cookie-jar.ts
│   ├── env-info.ts
│   ├── port.ts
│   ├── api-error.ts                 # (rename từ apiError.ts)
│   ├── api-response.ts              # (rename từ apiResponse.ts)
│   └── chat-validator.ts

├── __tests__/                       # (MỚI) Unit tests mirror src structure
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── providers/
│   └── utils/

└── resources/                       # (MỚI) Static files
    └── wasm/
        └── sha3_wasm_bg.7b9ca65ddd.wasm
```

---

## 3. Nguyên tắc thiết kế

### 3.1 Phân tầng rõ ràng (Layered Architecture)

```
┌─────────────────────────────────────────┐
│  Routes         (HTTP routing)          │  ← Mỏng nhất, chỉ mapping URL → Controller
├─────────────────────────────────────────┤
│  Controllers    (Request/Response)      │  ← Parse input, gọi Service, format output
├─────────────────────────────────────────┤
│  Services       (Business Logic)        │  ← Logic nghiệp vụ thuần túy, không biết HTTP
├─────────────────────────────────────────┤
│  Repositories   (Data Access)           │  ← SQL queries, không chứa business logic
├─────────────────────────────────────────┤
│  Database       (Connection)            │  ← Kết nối + migration
└─────────────────────────────────────────┘
```

**Quy tắc dependency:** Mỗi layer chỉ được gọi layer liền kề bên dưới nó. Controller không được gọi Repository trực tiếp.

### 3.2 Mỗi file ≤ 300 dòng

File hiện tại cần tách:
- `deepseek.ts`: 1120 → 6 file (provider, pow, sse-parser, proxy-handler, upload, types)
- `chat.controller.ts`: 500 → 3 file (send-message, claude-messages, completion)
- `messages.controller.ts`: 500 → 2 file (messages, count-tokens) + tách session queue ra service riêng
- `db.ts`: 300 → 3 file (connection, migrations, seed)
- `chat.service.ts`: 250 → 4 file (chat, persistence, session, metrics)

### 3.3 Đặt tên nhất quán

| Loại file | Suffix | Ví dụ |
|-----------|--------|-------|
| Middleware | `.middleware.ts` | `error-handler.middleware.ts` |
| Controller | `.controller.ts` | `send-message.controller.ts` |
| Service | `.service.ts` | `chat-persistence.service.ts` |
| Repository | `.repository.ts` | `account.repository.ts` |
| Provider | `.provider.ts` | `deepseek.provider.ts` |
| Types | `.types.ts` | `account.types.ts` |
| Config | `.config.ts` | `server.config.ts` |
| Routes | `.routes.ts` | `chat.routes.ts` |
| Test | `.test.ts` | `chat.service.test.ts` |

### 3.4 Dependency Injection qua constructor

Thay vì import trực tiếp singleton:

```typescript
// ❌ Hiện tại
import { getDb } from '../services/db';
const db = getDb();

// ✅ Đề xuất
class ChatPersistenceService {
  constructor(
    private conversationRepo: ConversationRepository,
    private messageRepo: MessageRepository,
  ) {}
}
```

---

## 4. Kế hoạch triển khai (6 phase)

### Phase 1: Tách Types & Database (nền tảng)
- [ ] Gộp tất cả types vào `types/`, xóa trùng lặp
- [ ] Tách `db.ts` thành `database/connection.ts` + `database/migrations.ts`
- [ ] Tạo `repositories/` layer
- [ ] Di chuyển tất cả SQL queries từ services vào repositories

### Phase 2: Tách Provider DeepSeek (file lớn nhất)
- [ ] Tạo `providers/deepseek/` folder
- [ ] Tách `deepseek.pow.ts` (PoW WASM)
- [ ] Tách `deepseek.sse-parser.ts` (SSE stream parser)
- [ ] Tách `deepseek.proxy-handler.ts` (proxy handler)
- [ ] Tách `deepseek.upload.ts` (file upload)
- [ ] Tách `deepseek.types.ts` (DeepSeek-specific types)
- [ ] `deepseek.provider.ts` chỉ còn ~200 dòng orchestration

### Phase 3: Tách Controller & Service Chat
- [ ] Tách `chat.controller.ts` → 3 controller files
- [ ] Tách `chat.service.ts` → 4 service files
- [ ] Tách `messages.controller.ts` → 2 controller + tách session queue ra service riêng

### Phase 4: Chuẩn hóa Routes & Controllers
- [ ] Tạo controller riêng cho các route đang thiếu (config, claudecode, command, git, workspace, proxy)
- [ ] Di chuyển business logic từ `routes/v1/management.ts` vào `account.controller.ts`
- [ ] Xóa file `routes/v1/management.ts`

### Phase 5: Hợp nhất trùng lặp
- [ ] Hợp nhất `utils/database.ts` vào `repositories/account.repository.ts`
- [ ] Hợp nhất `utils/apiError.ts` + `utils/apiResponse.ts` vào `types/api.types.ts`
- [ ] Chuẩn hóa tên file middleware (thêm suffix `.middleware.ts`)

### Phase 6: Test coverage
- [ ] Viết unit test cho services
- [ ] Viết integration test cho repositories
- [ ] Viết E2E test cho critical paths (chat flow)

---

## 5. Trước/Sau — So sánh nhanh

| Khía cạnh | Hiện tại | Đề xuất |
|-----------|----------|---------|
| File lớn nhất | 1120 dòng (`deepseek.ts`) | ~250 dòng |
| Tầng dữ liệu | SQL rải rác trong services | Tập trung trong repositories |
| Types | 2 file, trùng lặp | 12 file chuyên biệt, không trùng |
| Controller/Services | Ranh giới mờ | Phân tách rõ: Controller chỉ HTTP, Service chỉ logic |
| Testability | Khó mock (import trực tiếp singleton) | Dễ mock (dependency injection) |
| Onboarding | Cần đọc ~5 file để hiểu 1 flow | Mỗi file có trách nhiệm rõ ràng |
| Số file | 64 | ~110 (nhiều hơn nhưng mỗi file nhỏ, dễ đọc) |

---

## 6. Lưu ý khi refactor

1. **Không thay đổi API contract** — tất cả endpoint paths, request/response format giữ nguyên.
2. **Refactor từng phase** — mỗi phase có thể merge riêng, không cần đợi tất cả.
3. **Giữ backward compatibility** — các import path cũ có thể giữ alias tạm thời.
4. **Chạy test sau mỗi phase** — đảm bảo không break chức năng hiện có.
5. **Database migrations tích lũy** — không xóa migrations cũ, chỉ thêm migration mới nếu cần.