# 🔍 BÁO CÁO PHÂN TÍCH PROJECT: Z.AI Bridge (Reverse Z AI 4.0 Demo)

> Ngày phân tích: tự động生成  
> Repository: https://github.com/BlackCandy001/Z.AI-Completed-

---

## 1. Tổng Quan

Project là một **reverse-engineering bridge** cho phép tương tác với **Z.AI (GLM-5-Turbo)** thông qua Chrome Extension, expose API HTTP/SSE để các client (VS Code Zen, CLI, web UI) sử dụng như một API thông thường.

| Thuộc tính | Giá trị |
|---|---|
| **Mô hình AI** | GLM-5-Turbo (Z.AI) |
| **Cách tiếp cận** | Browser-in-the-middle (Chrome Extension + WebSocket Bridge) |
| **Server** | Express.js trên port 8888 |
| **WebSocket** | ws trên port 8899 |
| **License** | ISC |

---

## 2. Kiến Trúc Hệ Thống

```
┌─────────────┐     HTTP/SSE (port 8888)    ┌──────────────┐
│  VS Code Zen │◄──────────────────────────► │              │
│  / CLI / UI  │                             │  Express API │
└─────────────┘                             │  (server.ts) │
                                            └──────┬───────┘
                                                   │ ZChat.chat()
                                                   ▼
                                            ┌──────────────┐
                                            │   z.ts       │
                                            │  (ZChat)     │
                                            │  RateLimiter │
                                            └──────┬───────┘
                                                   │ WebSocket (port 8899)
                                                   ▼
┌──────────────┐    postMessage     ┌───────────────────────┐
│  inject.js   │───────────────────►│   content.js          │
│  (MAIN world)│◄──────────────────│   (Isolated world)     │
│  Fetch Hook  │   postMessage      │   WS Client + DOM     │
│  SSE Reader  │                    │   Optimizer            │
└──────┬───────┘                    └───────────┬───────────┘
       │                                        │
       │ fetch() intercept                      │ WebSocket
       ▼                                        ▼
┌──────────────────────────────────────────────────────────────┐
│                   https://chat.z.ai/                          │
│              Z.AI Server (GLM-5-Turbo API)                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Cấu Trúc File

```
project-root/
├── z.ts                    # ZChat core — WebSocket Server + CLI + Stream Parser
├── z.js                    # Compiled version of z.ts
├── rate-limiter.ts         # Rate Limiter — chống WAF block
├── rate-limiter.js         # Compiled version of rate-limiter.ts
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript config
├── package-lock.json       # Lock file
├── extension/
│   ├── manifest.json       # Chrome Extension manifest (MV3)
│   ├── content.js          # Content script — WS client + DOM optimizer
│   ├── inject.js           # Main world script — Fetch hook + SSE reader
│   ├── rules.json          # Declarative Net Request — remove CSP header
│   └── _metadata/          # Extension metadata
└── src/
    ├── server.ts           # Express HTTP API Server
    └── server.js           # Compiled version of server.ts
```

---

## 4. Phân Tích Từng Component

### 📁 `z.ts` — ZChat Core (CLI + Bridge Engine)

- **Vai trò**: WebSocket Server + CLI interface + stream parser
- **Chức năng chính**:
  - Khởi động WSS trên port 8899, chờ Chrome Extension kết nối
  - `chat()`: Gửi prompt qua WS → nhận SSE chunks → parse → callback `onToken`
  - Sequential lock (`chatLock`) đảm bảo chỉ 1 request chạy cùng lúc
  - Parse SSE `data:` lines, detect phase `thinking`/`answer`, inject `<thinking>` tags
  - Timeout 20 phút cho mỗi request
  - Hỗ trợ CLI mode (readline) hoặc programmatic API
- **Rate Limiting**: Tích hợp `RateLimiter` — check trước mỗi request, report WAF block

### 📁 `rate-limiter.ts` — Rate Limiter

- **Vai trò**: Chống WAF block từ Z.AI server
- **Chiến lược**:
  - **Sliding window**: Đếm requests trong 1 phút (max 10) và 1 giờ (max 120)
  - **Min interval**: Tối thiểu 3s giữa 2 requests liên tiếp
  - **WAF cooldown**: 60s cooldown khi phát hiện WAF block (403/429/503)
  - **Error backoff**: 2s backoff sau mỗi error
  - `acquire()` trả về `{ allowed, reason, retryAfterMs }`

### 📁 `extension/content.js` — Chrome Extension Content Script

- **Vai trò**: Bridge giữa page context và WebSocket server
- **Chức năng**:
  - Kết nối WS đến `ws://localhost:8899`
  - Inject `inject.js` vào MAIN world
  - Nhận SSE data từ `inject.js` qua `postMessage`, forward qua WS
  - **DOM Optimizer**: Ẩn thinking blocks, collapse code dài, ẩn messages cũ → giảm lag
  - **Hybrid Input Injection**: Prompt ngắn dùng `execCommand`, dài dùng `nativeSetter`
  - **Auto-reconnect**: Exponential backoff, max 20 attempts
  - **Buffered sending**: Batch WS messages mỗi 50ms
  - Visual indicator (🟢/🔴) cho trạng thái kết nối

### 📁 `extension/inject.js` — Main World Script

- **Vai trò**: Network interception ở cấp độ fetch
- **Chiến lược**: Monkey-patch `window.fetch`
  - Detect URL chứa `/api/v2/chat/completions` hoặc `/api/agent/v2/chat/completions`
  - **Clone response**: 1 bản đọc SSE thật → postMessage cho content.js
  - **Transform response**: 1 bản filter thinking tokens qua `TransformStream` → browser render không hiển thị thinking
  - WAF detection: Status 403/429/503 → postMessage `Z_AI_WAF_BLOCK`
  - Fallback: Nếu stream đóng mà không có `done` tag → `Z_AI_STREAM_END_RAW`

### 📁 `extension/rules.json` — Declarative Net Request

- Xóa `Content-Security-Policy` header từ Z.AI → cho phép inject script vào page
- Áp dụng cho mọi resource type từ `chat.z.ai`

### 📁 `src/server.ts` — Express HTTP API Server

- **Vai trò**: Expose REST/SSE API tương thích với OpenAI format
- **Endpoints chính**:

| Endpoint | Method | Mô tả |
|---|---|---|
| `/v1/health` | GET | Health check + rate limit status |
| `/v1/providers` | GET | Danh sách providers (Z.AI) |
| `/v1/accounts` | GET | Danh sách accounts |
| `/v1/chat/accounts/messages` | POST | Chat completion (SSE/json) |
| `/v1/chat/accounts/:id/messages` | POST | Chat completion (SSE/json) |
| `/api/chat/completions` | POST | Z.AI native format |
| `/api/v2/chat/completions` | POST | Z.AI native format |
| `/api/agent/v2/chat/completions` | POST | Z.AI native format |
| `/rate-limit-status` | GET | Rate limit status |
| `/rate-limit-config` | POST | Update rate limit config |
| `/rate-limit-reset` | POST | Reset rate limits |
| Various `/api/v1/*` | GET | Mock Z.AI web UI APIs |

- **Tối ưu quan trọng**:
  - Tin đầu tiên gửi full system prompt, tin tiếp theo chỉ gửi `<zen-user-content>` (strip system prompt) → giảm token
  - Token sanitization: Fix lỗi typo của AI (`write_toile` → `write_to_file`, v.v.)
  - Buffered flushing: Flush khi ≥2000 chars hoặc mỗi 300ms
  - Conversation tracking: Cleanup conversations cũ khi Map > 100 entries

---

## 5. Dependencies

| Package | Version | Mục đích |
|---|---|---|
| `express` | ^5.2.1 | HTTP server |
| `ws` | ^8.21.0 | WebSocket bridge |
| `cors` | ^2.8.6 | CORS middleware |
| `uuid` | ^11.1.1 | ID generation (chưa thấy dùng) |
| `typescript` | ^6.0.3 | Build |
| `ts-node` | ^10.9.2 | Dev runtime |
| `@types/node` | ^25.9.1 | Node.js type definitions |
| `@types/express` | ^5.0.6 | Express type definitions |
| `@types/ws` | ^8.18.1 | ws type definitions |
| `@types/cors` | ^2.8.19 | cors type definitions |

---

## 6. Điểm Mạnh

1. **Kiến trúc tách biệt tốt**: inject.js (MAIN world) ↔ content.js (isolated) ↔ WS server ↔ HTTP server — mỗi layer có trách nhiệm rõ ràng
2. **Rate limiting toàn diện**: Sliding window + min interval + WAF cooldown + error backoff
3. **Thinking filter kép**: CSS ẩn + TransformStream filter → browser không render thinking, tiết kiệm GPU
4. **DOM optimization**: Collapse code, ẩn old messages, CSS containment → chống lag
5. **Token sanitization**: Auto-fix common AI typos trong XML tags
6. **Graceful degradation**: Reconnect, timeout, WAF detection, error handling
7. **Conversation optimization**: Strip system prompt ở continuation messages → giảm token gửi đi
8. **Visual indicator**: Extension hiển thị trạng thái kết nối trực tiếp trên page

---

## 7. Vấn Đề & Rủi Ro

| # | Vấn đề | Mức độ | Chi tiết |
|---|---|---|---|
| 1 | **Hardcoded ports** (8899, 8888) | Trung bình | Không thể chạy nhiều instance, xung đột port |
| 2 | **`uuid` dependency không dùng** | Thấp | Import trong package.json nhưng không sử dụng ở code |
| 3 | **Dual rate limiter** | Cao | `server.ts` tạo `zaiRateLimiter` riêng, `ZChat` cũng có rate limiter nội bộ → check rate limit 2 lần cho mỗi request |
| 4 | **Express 5.x** | Trung bình | Vẫn còn beta, một số middleware chưa compatible |
| 5 | **`strict: false`** trong tsconfig | Thấp | Bỏ qua type checking nghiêm ngặt, dễ gây bug ẩn |
| 6 | **DOM optimizer dùng setInterval** | Thấp | Chạy mỗi 2s liên tục ngay cả khi không cần, tốn CPU |
| 7 | **Compiled .js files committed** | Thấp | `z.js`, `rate-limiter.js`, `server.js` nằm cùng source → nên dùng `.gitignore` + build step |
| 8 | **`document.execCommand` deprecated** | Thấp | Dùng trong content.js cho hybrid input injection |
| 9 | **Không có authentication** | Cao | API mở hoàn toàn trên localhost:8888, bất kỳ process nào cũng gọi được |
| 10 | **`sanitizeToken` regex chain** | Trung bình | Nhiều `.replace()` tuần tự → dễ miss edge case, nên dùng AST parser |

---

## 8. Data Flow Chi Tiết (Stream Chat)

```
1. Client → POST /v1/chat/accounts/messages { messages, stream: true }
2. server.ts → zaiRateLimiter.acquire() ✓
3. server.ts → ZChat.chat(prompt, onToken, conversationId, isNewChat)
4. ZChat → rateLimiter.acquire() ✓  ← ⚠️ Double check (vấn đề #3)
5. ZChat → WS.send({ action: "send_prompt", prompt })
6. content.js → receive WS message → handleSendPrompt()
7. content.js → inject text into textarea → click Send button
8. inject.js → fetch() intercept → clone response
9. inject.js → processSSEStream() → postMessage({ type: "Z_AI_SSE_DELTA" })
10. content.js → receive postMessage → safeSend({ type: "stream_chunk", chunk })
11. ZChat → WS receive → currentStreamResolver(chunk) → onToken(token)
12. server.ts → sanitizeToken() → res.write SSE data
13. Client → receives SSE stream
14. inject.js → stream ends → postMessage({ type: "Z_AI_STREAM_END_RAW" })
15. content.js → safeSend({ type: "stream_end" })
16. ZChat → currentEndResolver() → resolve
17. server.ts → res.write('data: [DONE]\n\n') → res.end()
```

---

## 9. Khuyến Nghị Cải Thiện

### Ưu tiên cao

1. **Gộp Rate Limiter**: Xóa `zaiRateLimiter` trong `server.ts`, chỉ dùng rate limiter bên trong `ZChat` → tránh double check và logic phân kỳ
2. **Thêm Authentication**: Thêm API key hoặc token-based auth cho HTTP server → chống truy cập trái phép
3. **Config hóa ports**: Đưa ports vào env variables hoặc config file

### Ưu tiên trung bình

4. **Xóa `uuid` dependency**: Không sử dụng → giảm bundle size
5. **Downgrade Express**: Xem xét dùng Express 4.x ổn định hơn, hoặc theo dõi changelog Express 5
6. **Cải thiện sanitizeToken**: Thay regex chain bằng AST-based tag parser (VD: parse XML tags, fix, re-serialize)
7. **Thêm `.gitignore`**: Loại bỏ compiled `.js` files khỏi git tracking

### Ưu tiên thấp

8. **Bật `strict: true`** trong tsconfig: Phát hiện bug sớm hơn
9. **Thay `setInterval` bằng `MutationObserver`** cho DOM optimizer: Hiệu quả hơn, chỉ chạy khi DOM thay đổi
10. **Thay `document.execCommand`** bằng `InputEvent` API: Không bị deprecated

---

## 10. Tóm Tắt

Project là một **reverse proxy bridge** khá hoàn chỉnh cho Z.AI, giải quyết tốt bài toán bypass browser-based AI chat thông qua Chrome Extension + WebSocket + network interception. Kiến trúc 4-layer rõ ràng, rate limiting toàn diện, và nhiều tối ưu hiệu năng (DOM optimizer, thinking filter, conversation strip).

Tuy nhiên, cần xử lý các vấn đề **dual rate limiter**, **thiếu authentication**, và **hardcoded configuration** trước khi sử dụng trong môi trường production.