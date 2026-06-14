# Kế hoạch nâng cấp: Token Counting & Z.AI Search Mode

> Dự án: Reverse Z AI 4.0 Demo  
> Ngày tạo: 2025  
> Cập nhật: Dựa trên phân tích API thực tế từ `Z ai DOC/DOC/Tài liệu cấu trúc/completed.txt`  
> Trạng thái: Draft — Chờ phê duyệt trước khi implement

---

## Mục lục

1. [Phát hiện quan trọng từ API thực tế](#1-phát-hiện-quan-trọng-từ-api-thực-tế)
2. [Tổng quan kiến trúc hiện tại](#2-tổng-quan-kiến-trúc-hiện-tại)
3. [Feature 10: Token Counting & Cost Estimation](#3-feature-10-token-counting--cost-estimation)
4. [Feature 8: Z.AI Search Mode](#4-feature-8-zai-search-mode)
5. [Thứ tự thực hiện](#5-thứ-tự-thực-hiện)
6. [Testing Plan](#6-testing-plan)

---

## 1. Phát hiện quan trọng từ API thực tế

Phân tích file `completed.txt` cho thấy cấu trúc API thực tế của Z.AI, thay đổi đáng kể cách tiếp cận cho cả 2 features.

### 1.1 Token Counting — Z.AI đã trả về token counts!

Z.AI trả token usage thực tế trong SSE stream, phase `"other"`:

```json
{"type":"chat:completion","data":{"phase":"other","usage":{"prompt_tokens":376,"completion_tokens":688,"total_tokens":1064,"prompt_tokens_details":{}}}}
```

**Hệ quả**: Không cần heuristic estimation ±15%. Chỉ cần capture event `phase: "other"` từ inject.js → relay về server → token counts chính xác 100%.

### 1.2 Search Mode — Không cần tìm DOM toggle!

Payload gửi lên Z.AI có field `features`:

```json
{
  "features": {
    "image_generation": false,
    "web_search": false,
    "auto_web_search": false,
    "preview_mode": true,
    "flags": []
  }
}
```

**Hệ quả**: Không cần tìm search toggle trên DOM và click. Chỉ cần intercept fetch request trong inject.js, modify payload set `web_search: true` khi isSearch được yêu cầu.

### 1.3 Cấu trúc SSE đầy đủ — 4 phases

| Phase | Mô tả | Data fields |
|---|---|---|
| `"thinking"` | Chain of thought (tư duy) | `delta_content` |
| `"answer"` | Nội dung chính (phản hồi) | `delta_content` |
| `"other"` | **Usage stats** (token counts) | `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens` |
| `"done"` | Kết thúc stream | `done: true` |

### 1.4 Request Payload đầy đủ của Z.AI

```json
{
  "stream": true,
  "model": "GLM-5.1",
  "messages": [{ "role": "user", "content": "..." }],
  "chat_id": "931045a2-eaac-49d9-8b9c-d14763ae2fd7",
  "current_user_message_id": "585b058c-...",
  "current_user_message_parent_id": "1305c88d-...",
  "features": {
    "image_generation": false,
    "web_search": false,
    "auto_web_search": false,
    "preview_mode": true,
    "flags": []
  },
  "captcha_verify_param": "eyJjZXJ0aWZ5...",
  "background_tasks": { "title_generation": true, "tags_generation": true },
  "params": {},
  "signature_prompt": "nếu là code python",
  "variables": {
    "{{USER_NAME}}": "thanh sang",
    "{{USER_LOCATION}}": "Unknown"
  }
}
```

### 1.5 So sánh cách tiếp cận cũ vs mới

| Feature | Cách cũ (KE_HOACH_NANG_CAP v1) | Cách mới (dựa trên API thực tế) |
|---|---|---|
| **Token Counting** | Heuristic estimation ±15% | Capture `phase: "other"` event → chính xác 100% |
| **Search Mode** | Tìm DOM toggle + click (rủi ro UI thay đổi) | Modify fetch payload: `features.web_search = true` |
| **Risk Search** | 🟡 Trung bình (phụ thuộc UI) | 🟢 Thấp (intercept API, không phụ thuộc DOM) |
| **Effort Token** | 2-3 ngày | 1-2 ngày (đơn giản hơn nhiều) |
| **Effort Search** | 3-4 ngày | 2-3 ngày (bỏ bước research DOM) |

---

## 2. Tổng quan kiến trúc hiện tại

### Data flow hiện tại

```
Zen VSCode
    │
    │  POST /v1/chat/accounts/messages  { messages, conversationId, stream }
    ▼
zen.ts (Router)
    │
    │  chatEngine.chat(prompt, onToken, conversationId, isNewChat)
    ▼
z.ts (ZChat)
    │
    │  WS send: { action: 'send_prompt', prompt, isNewChat }
    ▼
content.js (Chrome Extension)
    │
    │  DOM: type vào textarea + click Send
    ▼
Z.AI Web (chat.z.ai)
    │
    │  POST /api/v2/chat/completions  ← payload có features.web_search: false
    │  SSE Response: phase=thinking → phase=answer → phase=other(usage) → phase=done
    ▼
inject.js (Network Interception)
    │
    │  postMessage: { type: 'Z_AI_SSE_DELTAS', payloads }
    ▼
content.js
    │
    │  WS send: { type: 'stream_chunk', chunk: 'data: {...}\n\n' }
    ▼
z.ts (ZChat)
    │
    │  Parse SSE → onToken(content)
    ▼
zen.ts
    │
    │  sanitizeToken → addToken → flush → SSE to client
    ▼
Zen VSCode
```

### Files liên quan & vai trò

| File | Vai trò | Sẽ sửa? |
|---|---|---|
| `z.ts` | Core engine — WebSocket server, stream parsing | ✅ Cả 2 features |
| `src/routes/zen.ts` | API router — request handling, SSE formatting | ✅ Cả 2 features |
| `src/utils/sse.ts` | SSE helpers — headers, token flusher | ✅ Token counting |
| `src/utils/sanitizer.ts` | Token sanitization | ❌ Không sửa |
| `extension/inject.js` | Network interception — SSE capture, **fetch payload modification** | ✅ Cả 2 features |
| `extension/content.js` | Bridge — WS relay, DOM manipulation | ✅ Search mode |
| `rate-limiter.ts` | Rate limiting | ❌ Không sửa |

---

## 3. Feature 10: Token Counting & Cost Estimation

### 3.1 Mục tiêu

- Capture token counts thực tế từ Z.AI SSE event `phase: "other"`
- Expose token counts qua SSE metadata events + response headers + response body
- Cung cấp endpoint `/v1/usage` để xem thống kê
- Lưu usage history in-memory (sẵn sàng cho SQLite persistence sau)
- Fallback: heuristic estimation nếu Z.AI không trả usage

### 3.2 Architecture

```
Z.AI API
    │
    │  SSE: {"phase":"other","usage":{"prompt_tokens":376,"completion_tokens":688,"total_tokens":1064}}
    ▼
inject.js
    │
    │  postMessage: { type: 'Z_AI_SSE_DELTAS', payloads }  (đã có sẵn)
    │  postMessage: { type: 'Z_AI_USAGE', usage: {...} }    ← NEW
    ▼
content.js
    │
    │  WS send: { type: 'usage', usage: {...} }             ← NEW
    ▼
z.ts (ZChat)
    │
    │  Store: _lastUsage = { prompt_tokens, completion_tokens, total_tokens }
    │
    ▼
zen.ts (Router)
    │
    │  1. Add X-Tokens-Input / X-Tokens-Output headers
    │  2. Send usage SSE event before [DONE]
    │  3. Include usage in non-streaming response
    │  4. Record to UsageTracker
    ▼
Client (Zen VSCode)
```

### 3.3 New File: `src/utils/usage-tracker.ts`

```typescript
// ============================================================
// usage-tracker.ts — Token usage tracking & statistics
// Capture real token counts from Z.AI API (phase: "other").
// Fallback: heuristic estimation if Z.AI doesn't return usage.
// ============================================================

export interface UsageRecord {
    timestamp: number;
    conversationId: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
    source: 'api' | 'estimated';  // api = Z.AI trả chính xác, estimated = fallback
}

export interface UsageSummary {
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalRequests: number;
    todayPromptTokens: number;
    todayCompletionTokens: number;
    todayTokens: number;
    todayRequests: number;
    apiAccuracy: number;  // % of requests with real API data vs estimated
}

export class UsageTracker {
    private history: UsageRecord[] = [];
    private maxHistorySize: number;

    constructor(maxHistorySize: number = 10000) {
        this.maxHistorySize = maxHistorySize;
    }

    /**
     * Ghi nhận usage từ Z.AI API response (chính xác 100%).
     */
    recordFromAPI(params: {
        conversationId: string;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        model: string;
    }): void {
        this.history.push({
            timestamp: Date.now(),
            conversationId: params.conversationId,
            promptTokens: params.promptTokens,
            completionTokens: params.completionTokens,
            totalTokens: params.totalTokens,
            model: params.model,
            source: 'api',
        });
        this.trimHistory();
    }

    /**
     * Ghi nhận usage ước lượng (fallback khi Z.AI không trả usage).
     * Heuristic: 1 token ≈ 3.5 chars (English), ≈ 1.5 chars (CJK/Vietnamese).
     */
    recordEstimated(params: {
        conversationId: string;
        inputText: string;
        outputText: string;
        model: string;
    }): void {
        const promptTokens = this.estimateTokens(params.inputText);
        const completionTokens = this.estimateTokens(params.outputText);
        this.history.push({
            timestamp: Date.now(),
            conversationId: params.conversationId,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            model: params.model,
            source: 'estimated',
        });
        this.trimHistory();
    }

    /**
     * Ước lượng tokens cho text (heuristic fallback).
     */
    estimateTokens(text: string): number {
        if (!text) return 0;
        let cjkCount = 0;
        let asciiCount = 0;
        for (const char of text) {
            const code = char.charCodeAt(0);
            if (
                (code >= 0x4E00 && code <= 0x9FFF) ||
                (code >= 0xAC00 && code <= 0xD7AF) ||
                (code >= 0x3040 && code <= 0x30FF) ||
                (code >= 0x00C0 && code <= 0x024F) ||
                code > 0x2000
            ) {
                cjkCount++;
            } else {
                asciiCount++;
            }
        }
        return Math.ceil(asciiCount / 3.5) + Math.ceil(cjkCount / 1.5);
    }

    /**
     * Ước lượng tokens cho messages array (OpenAI format).
     */
    estimateMessagesTokens(messages: Array<{ role: string; content: string }>): number {
        let total = 0;
        for (const msg of messages) {
            total += 4; // role markers overhead
            total += this.estimateTokens(msg.role);
            total += this.estimateTokens(msg.content);
        }
        total += 3; // priming tokens
        return total;
    }

    /**
     * Lấy usage summary.
     */
    getSummary(): UsageSummary {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayMs = todayStart.getTime();

        let totalPrompt = 0, totalCompletion = 0, total = 0;
        let todayPrompt = 0, todayCompletion = 0, todayTotal = 0, todayCount = 0;
        let apiCount = 0;

        for (const record of this.history) {
            totalPrompt += record.promptTokens;
            totalCompletion += record.completionTokens;
            total += record.totalTokens;

            if (record.timestamp >= todayMs) {
                todayPrompt += record.promptTokens;
                todayCompletion += record.completionTokens;
                todayTotal += record.totalTokens;
                todayCount++;
            }
            if (record.source === 'api') apiCount++;
        }

        return {
            totalPromptTokens: totalPrompt,
            totalCompletionTokens: totalCompletion,
            totalTokens: total,
            totalRequests: this.history.length,
            todayPromptTokens: todayPrompt,
            todayCompletionTokens: todayCompletion,
            todayTokens: todayTotal,
            todayRequests: todayCount,
            apiAccuracy: this.history.length > 0
                ? Math.round((apiCount / this.history.length) * 100)
                : 0,
        };
    }

    reset(): void {
        this.history = [];
    }

    private trimHistory(): void {
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }
}
```

### 3.4 Modifications: `extension/inject.js`

**Thay đổi**: Capture thêm `phase: "other"` (usage data) từ SSE và gửi riêng qua postMessage

```javascript
// === THÊM VÀO inject.js — trong TransformStream transform() ===

// Hiện tại đã có: queuePostMessage(parsed) cho mọi SSE data
// Cần thêm: detect phase "other" (usage) và gửi riêng

const interceptor = new TransformStream({
    transform(chunk, controller) {
        try {
            const text = decoder.decode(chunk, { stream: true });
            sseBuffer += text;
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6).trim();
                    if (jsonStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        queuePostMessage(parsed);

                        // ← NEW: Detect usage data (phase: "other")
                        if (parsed.data && parsed.data.phase === 'other' && parsed.data.usage) {
                            console.log('[Inject] 📊 Usage data detected from Z.AI API:',
                                JSON.stringify(parsed.data.usage));
                            window.postMessage({
                                type: 'Z_AI_USAGE',
                                usage: parsed.data.usage,
                            }, '*');
                        }

                        // ← NEW: Detect search results (for Feature 8)
                        if (parsed.data && parsed.data.search_results) {
                            window.postMessage({
                                type: 'Z_AI_SEARCH_RESULTS',
                                results: parsed.data.search_results,
                            }, '*');
                        }

                        // ← NEW: Detect search phase
                        if (parsed.data && parsed.data.phase === 'searching') {
                            window.postMessage({
                                type: 'Z_AI_SEARCH_PHASE',
                                phase: 'searching',
                            }, '*');
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.error('[Inject] SSE transform error:', e);
        }
        controller.enqueue(chunk);
    },
    // ... existing flush() ...
});
```

### 3.5 Modifications: `extension/content.js`

**Thay đổi**: Relay usage data từ inject.js về server qua WebSocket

```javascript
// === THÊM VÀO content.js — trong window.addEventListener('message') ===

// ← NEW: Usage data handler
if (data.type === 'Z_AI_USAGE' && data.usage) {
    console.log('[Content] 📊 Usage data from Z.AI API:',
        `prompt=${data.usage.prompt_tokens}, completion=${data.usage.completion_tokens}, total=${data.usage.total_tokens}`);
    safeSend({
        type: 'usage',
        usage: data.usage,
        requestId: currentRequestId,
    });
}

// ← NEW: Search results handler (for Feature 8)
if (data.type === 'Z_AI_SEARCH_RESULTS' && data.results) {
    console.log('[Content] 🔍 Search results received:', data.results.length, 'results');
    safeSend({
        type: 'search_results',
        results: data.results,
        requestId: currentRequestId,
    });
}

// ← NEW: Search phase handler (for Feature 8)
if (data.type === 'Z_AI_SEARCH_PHASE') {
    console.log('[Content] 🔍 Search phase:', data.phase);
    safeSend({
        type: 'search_phase',
        phase: data.phase,
        requestId: currentRequestId,
    });
}
```

### 3.6 Modifications: `z.ts` (ZChat)

**Thay đổi**: 
1. Thêm `UsageTracker` instance
2. Handle `usage` message type từ extension
3. Thêm `isSearch` parameter cho search mode
4. Expose usage data cho zen.ts

```typescript
// === THÊM VÀO z.ts ===

import { UsageTracker } from './src/utils/usage-tracker';

export class ZChat {
    // ... existing properties ...
    public usageTracker: UsageTracker;           // ← NEW
    private _lastUsage: {                        // ← NEW
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    } | null = null;
    private _currentSearchResults: any[] | null = null;  // ← NEW (Feature 8)

    constructor(rateLimitConfig?: Partial<RateLimitConfig>) {
        this.rateLimiter = new RateLimiter(rateLimitConfig || DEFAULT_RATE_LIMIT_CONFIG);
        this.usageTracker = new UsageTracker();   // ← NEW
        console.log('[RateLimiter] ✅ Initialized');
    }

    // === THÊM: Handle usage message trong WS onmessage ===
    // Trong initBrowser(), phần this.wsConnection ws.on('message'):

    // Thêm vào existing message type handling:
    if (msg.type === 'usage' && msg.usage) {
        console.log(`[System] 📊 Usage from Z.AI API: prompt=${msg.usage.prompt_tokens}, completion=${msg.usage.completion_tokens}, total=${msg.usage.total_tokens}`);
        this._lastUsage = {
            promptTokens: msg.usage.prompt_tokens || 0,
            completionTokens: msg.usage.completion_tokens || 0,
            totalTokens: msg.usage.total_tokens || 0,
        };
    }

    if (msg.type === 'search_results' && msg.results) {
        console.log(`[System] 🔍 Search results received: ${msg.results.length} results`);
        this._currentSearchResults = msg.results;
    }

    if (msg.type === 'search_phase') {
        console.log(`[System] 🔍 Search phase: ${msg.phase}`);
    }

    // ← NEW: Public getters
    public get lastUsage() {
        return this._lastUsage;
    }

    public get currentSearchResults(): any[] | null {
        return this._currentSearchResults;
    }

    // === THAY ĐỔI: chat() — thêm isSearch param ===
    public async chat(
        prompt: string,
        onToken?: (token: string) => void,
        conversationId: string = '',
        isNewChat: boolean = false,
        isSearch: boolean = false  // ← NEW PARAMETER (Feature 8)
    ) {
        const result = this.chatLock.then(async () => {
            await this.executeChat(prompt, onToken, conversationId, isNewChat, isSearch);
        });
        this.chatLock = result.catch(() => {});
        return result;
    }

    private async executeChat(
        prompt: string,
        onToken?: (token: string) => void,
        conversationId: string = '',
        isNewChat: boolean = false,
        isSearch: boolean = false  // ← NEW
    ) {
        // ... existing validation & rate limit ...

        // ← NEW: Reset per-request state
        this._lastUsage = null;
        this._currentSearchResults = null;

        // ... existing page ready + stream handler setup ...

        // ← CHANGED: Include isSearch in WS message
        this.wsConnection.send(JSON.stringify({
            action: 'send_prompt',
            prompt,
            isNewChat,
            isSearch,  // ← NEW: Forward to extension
        }));

        // ... existing wait logic ...

        // ← NEW: After stream ends, record usage
        // If Z.AI returned usage (phase: "other"), use exact data
        // Otherwise, fallback to estimation
        if (this._lastUsage) {
            this.usageTracker.recordFromAPI({
                conversationId,
                promptTokens: this._lastUsage.promptTokens,
                completionTokens: this._lastUsage.completionTokens,
                totalTokens: this._lastUsage.totalTokens,
                model: 'GLM-5.1',
            });
        }
        // Note: Fallback estimation will be done in zen.ts where we have
        // access to both input messages and accumulated output
    }

    // ← NEW: Public method để lấy usage summary
    public getUsageSummary() {
        return this.usageTracker.getSummary();
    }
}
```

### 3.7 Modifications: `src/utils/sse.ts`

**Thay đổi**: Thêm token count headers + usage summary SSE event

```typescript
// === CẬP NHẬT: writeSSEHeaders — thêm token info ===

export function writeSSEHeaders(
    res: express.Response,
    rateLimiter: RateLimiter,
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null
): void {
    const rl = rateLimiter.getStatus();
    const headers: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-RateLimit-Limit-Per-Minute': String(rl.maxRequestsPerMinute),
        'X-RateLimit-Limit-Per-Hour': String(rl.maxRequestsPerHour),
        'X-RateLimit-Remaining-Per-Minute': String(Math.max(0, rl.maxRequestsPerMinute - rl.requestsThisMinute)),
        'X-RateLimit-Remaining-Per-Hour': String(Math.max(0, rl.maxRequestsPerHour - rl.requestsThisHour)),
    };

    // ← NEW: Add token count headers if available
    if (usage) {
        headers['X-Tokens-Input'] = String(usage.promptTokens);
        headers['X-Tokens-Output'] = String(usage.completionTokens);
        headers['X-Tokens-Total'] = String(usage.totalTokens);
    }

    res.writeHead(200, headers);
}

// === THÊM MỚI: Write usage SSE event ===

export function writeUsageEvent(
    res: express.Response,
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        source: 'api' | 'estimated';
    },
    conversationId: string
): void {
    res.write(`data: ${JSON.stringify({
        type: 'usage',
        input_tokens: usage.promptTokens,
        output_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        source: usage.source,
        conversation_id: conversationId,
    })}\n\n`);
}

// createTokenFlusher — KHÔNG THAY ĐỔI, giữ nguyên
```

### 3.8 Modifications: `src/routes/zen.ts`

**Thay đổi**: 
1. Capture usage từ ZChat sau khi stream kết thúc
2. Gửi usage event + headers
3. Thêm endpoints `/v1/tokenize`, `/v1/usage`
4. Fallback estimation nếu Z.AI không trả usage
5. Parse `is_search` parameter (Feature 8)

```typescript
// === THÊM VÀO zen.ts ===

import { UsageTracker } from '../utils/usage-tracker';

export function zenRouter(
    chatEngine: ZChat,
    mappingService: MappingService,
    getInitStatus: () => { isInitialized: boolean; initError: string | null }
): express.Router {
    const router = express.Router();

    // ... existing auth middleware ...

    // ← NEW: Tokenize endpoint — preview token count
    router.post('/v1/tokenize', (req, res) => {
        const { text, messages } = req.body;

        let tokenCount = 0;
        if (messages && Array.isArray(messages)) {
            tokenCount = chatEngine.usageTracker.estimateMessagesTokens(messages);
        } else if (text && typeof text === 'string') {
            tokenCount = chatChat.usageTracker.estimateTokens(text);
        } else {
            res.status(400).json({
                error: 'Provide either "text" (string) or "messages" (array) in request body.'
            });
            return;
        }

        res.json({
            success: true,
            token_count: tokenCount,
            estimation_method: 'heuristic',
            accuracy: '±15% (estimate only — Z.AI provides exact counts in chat responses)',
            model: 'GLM-5.1',
        });
    });

    // ← NEW: Usage endpoint — get token usage statistics
    router.get('/v1/usage', (req, res) => {
        const summary = chatEngine.getUsageSummary();
        res.json({
            success: true,
            data: summary,
        });
    });

    // === CẬP NHẬT: /v1/providers — model name + is_search ===

    router.get('/v1/providers', (req, res) => {
        res.json({
            success: true,
            message: 'Providers retrieved successfully',
            data: [
                {
                    provider_id: 'z',
                    provider_name: 'Z.AI',
                    is_enabled: true,
                    website: 'https://chat.z.ai/',
                    is_search: true,     // ← CHANGED: false → true
                    is_upload: false,
                    auth_method: ['google', 'basic'],
                    is_temperature: false,
                    models: [
                        {
                            id: 'GLM-5.1',              // ← CHANGED: glm-5-turbo → GLM-5.1
                            name: 'GLM-5.1',            // ← CHANGED
                            is_thinking: true,
                            context_length: null,
                            success_rate: 100,
                            max_req_conversation: 0,
                            max_token_conversation: 0
                        }
                    ],
                    connection_mode: 'headless_browser',
                    concurrency_mode: 'concurrent',
                    total_accounts: 1
                }
            ],
            meta: { timestamp: new Date().toISOString() }
        });
    });

    // === THAY ĐỔI: handleMessages — thêm token tracking + search ===

    const handleMessages = async (req: express.Request, res: express.Response) => {
        // ... existing validation ...

        const { messages, conversationId, stream, is_search, search } = req.body;  // ← ADD is_search
        const useSearch = is_search === true || search === true;  // ← NEW

        // ... existing conversation mapping code ...

        try {
            if (stream !== false) {
                // ---- SSE streaming mode ----
                // Write headers first (without usage — will add in SSE events)
                writeSSEHeaders(res, chatEngine.rateLimiter);

                // ... existing initialMeta code ...

                // ← NEW: Send search status if applicable
                if (useSearch) {
                    res.write(`data: ${JSON.stringify({
                        type: 'search_status',
                        enabled: true,
                        message: 'Search mode activated. Z.AI will search the web before responding.',
                    })}\n\n`);
                }

                const { addToken, flush } = createTokenFlusher(res);

                // ← NEW: Accumulate output for fallback estimation
                let outputAccumulator = '';

                try {
                    await chatEngine.chat(
                        prompt,
                        (token) => {
                            outputAccumulator += token;  // ← NEW: Accumulate
                            // ... existing sanitization + addToken code ...
                        },
                        resolvedConversationId,
                        isNewChat,
                        useSearch  // ← NEW: Pass search flag
                    );

                    // ← NEW: Get usage data
                    const apiUsage = chatEngine.lastUsage;

                    let finalUsage: {
                        promptTokens: number;
                        completionTokens: number;
                        totalTokens: number;
                        source: 'api' | 'estimated';
                    };

                    if (apiUsage) {
                        // Z.AI returned exact token counts
                        finalUsage = { ...apiUsage, source: 'api' };
                    } else {
                        // Fallback: estimate from text
                        const estimatedInput = chatEngine.usageTracker.estimateMessagesTokens(messages);
                        const estimatedOutput = chatEngine.usageTracker.estimateTokens(outputAccumulator);
                        finalUsage = {
                            promptTokens: estimatedInput,
                            completionTokens: estimatedOutput,
                            totalTokens: estimatedInput + estimatedOutput,
                            source: 'estimated',
                        };
                        // Record estimated usage
                        chatEngine.usageTracker.recordEstimated({
                            conversationId: resolvedConversationId,
                            inputText: messages.map((m: any) => m.content).join('\n'),
                            outputText: outputAccumulator,
                            model: 'GLM-5.1',
                        });
                    }

                    // ← NEW: Send search results if available (Feature 8)
                    const searchResults = chatEngine.currentSearchResults;
                    if (searchResults && searchResults.length > 0) {
                        res.write(`data: ${JSON.stringify({
                            type: 'search_results',
                            results: searchResults.map((r: any, i: number) => ({
                                index: i + 1,
                                title: r.title || '',
                                url: r.url || r.link || '',
                                snippet: r.snippet || r.content || '',
                            })),
                        })}\n\n`);
                    }

                    // ← NEW: Send usage event before [DONE]
                    writeUsageEvent(res, finalUsage, resolvedConversationId);

                    // ... existing flush code ...

                } catch (err: any) {
                    // ... existing error handling ...
                } finally {
                    res.write('data: [DONE]\n\n');
                    res.end();
                }
            } else {
                // ---- Non-streaming mode ----
                try {
                    let accumulatedContent = '';
                    await chatEngine.chat(
                        prompt,
                        (token) => { accumulatedContent += sanitizeToken(token); },
                        resolvedConversationId,
                        isNewChat,
                        useSearch  // ← NEW
                    );

                    // ← NEW: Get usage
                    const apiUsage = chatEngine.lastUsage;
                    let finalUsage;

                    if (apiUsage) {
                        finalUsage = { ...apiUsage, source: 'api' };
                    } else {
                        const estimatedInput = chatEngine.usageTracker.estimateMessagesTokens(messages);
                        const estimatedOutput = chatEngine.usageTracker.estimateTokens(accumulatedContent);
                        finalUsage = {
                            promptTokens: estimatedInput,
                            completionTokens: estimatedOutput,
                            totalTokens: estimatedInput + estimatedOutput,
                            source: 'estimated',
                        };
                        chatEngine.usageTracker.recordEstimated({
                            conversationId: resolvedConversationId,
                            inputText: messages.map((m: any) => m.content).join('\n'),
                            outputText: accumulatedContent,
                            model: 'GLM-5.1',
                        });
                    }

                    // ← NEW: Search results (Feature 8)
                    const searchResults = chatEngine.currentSearchResults;

                    res.json({
                        success: true,
                        message: { role: 'assistant', content: accumulatedContent },
                        metadata: {
                            accountId: 'z-account',
                            providerId: 'z',
                            modelId: 'GLM-5.1',
                            email: 'user@chat.z.ai',
                            conversation_id: resolvedConversationId,
                        },
                        search_results: searchResults ? searchResults.map((r: any, i: number) => ({
                            index: i + 1,
                            title: r.title || '',
                            url: r.url || r.link || '',
                            snippet: r.snippet || r.content || '',
                        })) : undefined,
                        usage: {  // ← NEW
                            input_tokens: finalUsage.promptTokens,
                            output_tokens: finalUsage.completionTokens,
                            total_tokens: finalUsage.totalTokens,
                            source: finalUsage.source,
                        },
                    });
                } catch (err: any) {
                    // ... existing error handling ...
                }
            }
        } catch (err: any) {
            // ... existing error handling ...
        }
    };

    // ... rest of router ...
}
```

### 3.9 SSE Event Sequence (sau nâng cấp — có usage thực tế)

```
→ Client gửi: POST /v1/chat/accounts/messages
← SSE: data: {"meta":{...}}
← SSE: data: {"content":"Hello"}
← SSE: data: {"content":" world"}
← SSE: data: {"type":"usage","input_tokens":376,"output_tokens":688,"total_tokens":1064,"source":"api"}  ← NEW
← SSE: data: [DONE]
```

### 3.10 API Endpoints mới

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/v1/tokenize` | Preview token count (heuristic estimate) |
| `GET` | `/v1/usage` | Xem thống kê token usage (total + today + accuracy) |

**Response `/v1/usage`:**
```json
{
    "success": true,
    "data": {
        "totalPromptTokens": 15234,
        "totalCompletionTokens": 28456,
        "totalTokens": 43690,
        "totalRequests": 87,
        "todayPromptTokens": 1523,
        "todayCompletionTokens": 2845,
        "todayTokens": 4368,
        "todayRequests": 12,
        "apiAccuracy": 95
    }
}
```

### 3.11 Dependencies mới

**Không cần thêm package.** Token counting lấy trực tiếp từ Z.AI API. Fallback dùng heuristic.

**Upgrade path sau này** (optional, chỉ cho `/v1/tokenize` endpoint):
```bash
npm install js-tiktoken
```

---

## 4. Feature 8: Z.AI Search Mode

### 4.1 Mục tiêu

- Cho phép Zen VSCode yêu cầu Z.AI tìm kiếm web trước khi trả lời
- Intercept fetch request trong inject.js, modify `features.web_search` thành `true`
- Capture search results từ SSE stream và format cho client

### 4.2 Architecture — Cách tiếp cận mới (API interception)

```
Zen VSCode
    │
    │  POST /v1/chat/accounts/messages
    │  { messages, stream, is_search: true }
    ▼
zen.ts (Router)
    │
    │  chatEngine.chat(prompt, onToken, convId, isNewChat, isSearch=true)
    ▼
z.ts (ZChat)
    │
    │  WS send: { action: 'send_prompt', prompt, isNewChat, isSearch: true }
    ▼
content.js
    │
    │  WS relay — forward isSearch flag
    │  Đặt window.__zai_search_enabled = true  ← NEW: global flag
    │  DOM: type vào textarea + click Send (KHÔNG cần tìm toggle)
    ▼
Z.AI Web (chat.z.ai)
    │
    │  JavaScript chuẩn bị fetch payload với features.web_search: false
    ▼
inject.js (Network Interception)
    │
    │  Intercept fetch → check window.__zai_search_enabled
    │  if true → modify request body: features.web_search = true  ← KEY CHANGE
    │  Forward modified request to Z.AI API
    ▼
Z.AI API
    │
    │  SSE Response với search results + citations
    ▼
inject.js (SSE Capture)
    │
    │  postMessage: { type: 'Z_AI_SEARCH_RESULTS', results }
    │  postMessage: { type: 'Z_AI_SSE_DELTAS', payloads }
    │  postMessage: { type: 'Z_AI_USAGE', usage }
    ▼
content.js
    │
    │  WS send: { type: 'search_results', results }
    │  WS send: { type: 'usage', usage }
    │  WS send: { type: 'stream_chunk', chunk }
    ▼
z.ts → zen.ts → Zen VSCode
```

### 4.3 Modifications: `extension/inject.js`

**Thay đổi CHÍNH**: Intercept fetch request body, modify `features.web_search` khi search được yêu cầu

```javascript
// === THAY ĐỔI: inject.js — intercept + modify fetch payload ===

(function() {
  console.log('[Inject] Z.AI Bridge Network Interception loaded.');

  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [request, config] = args;
    let url = '';

    if (request instanceof Request) {
      url = request.url;
    } else if (typeof request === 'string') {
      url = request;
    }

    // Chỉ can thiệp vào endpoint chat của Z.AI
    if (url.includes('/api/v2/chat/completions') || url.includes('/api/agent/v2/chat/completions')) {
      console.log('[Inject] Target API detected:', url.split('?')[0]);

      // ← NEW: Check if search mode is requested
      const searchEnabled = window.__zai_search_enabled === true;

      // ← NEW: Modify request body if search is enabled
      let modifiedArgs = args;

      if (searchEnabled) {
        try {
          let body = null;
          let requestBody = null;

          // Extract body from args
          if (request instanceof Request) {
            // Request object — need to clone and read
            const cloned = request.clone();
            body = await cloned.json();
            requestBody = request;
          } else if (config && config.body) {
            // (url, config) format
            if (typeof config.body === 'string') {
              body = JSON.parse(config.body);
            } else {
              body = config.body;
            }
          }

          if (body) {
            // ← KEY: Modify features.web_search
            if (body.features) {
              body.features.web_search = true;
              console.log('[Inject] 🔍 Search mode: features.web_search set to TRUE');
            } else {
              body.features = { web_search: true };
              console.log('[Inject] 🔍 Search mode: created features.web_search = TRUE');
            }

            // Rebuild args with modified body
            const bodyStr = JSON.stringify(body);

            if (request instanceof Request) {
              // Create new Request with modified body
              modifiedArgs = [new Request(request, {
                body: bodyStr,
                method: request.method,
                headers: request.headers,
              })];
            } else {
              // (url, config) format
              modifiedArgs = [request, {
                ...config,
                body: bodyStr,
              }];
            }

            // Reset flag after use
            window.__zai_search_enabled = false;
          }
        } catch (e) {
          console.error('[Inject] Failed to modify request body for search:', e);
          // Proceed with original request if modification fails
          window.__zai_search_enabled = false;
        }
      }

      // Gọi request (có thể đã modified)
      const response = await originalFetch.apply(this, modifiedArgs);

      // 🚨 WAF Detection (existing code — unchanged)
      if (response.status === 403 || response.status === 429 || response.status === 503) {
        console.log('[Inject] 🚨 WAF/Rate limit detected! Status:', response.status);
        window.postMessage({
          type: 'Z_AI_WAF_BLOCK',
          status: response.status
        }, '*');
        return response;
      }

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('text/event-stream')) {
        console.log('[Inject] SSE Stream detected. Intercepting via TransformStream...');

        let sseBuffer = '';
        const decoder = new TextDecoder();

        const interceptor = new TransformStream({
          transform(chunk, controller) {
            try {
              const text = decoder.decode(chunk, { stream: true });
              sseBuffer += text;
              const lines = sseBuffer.split('\n');
              sseBuffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const jsonStr = line.substring(6).trim();
                  if (jsonStr === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(jsonStr);
                    queuePostMessage(parsed);

                    // ← NEW: Detect usage data (phase: "other")
                    if (parsed.data && parsed.data.phase === 'other' && parsed.data.usage) {
                      console.log('[Inject] 📊 Usage data from Z.AI API');
                      window.postMessage({
                        type: 'Z_AI_USAGE',
                        usage: parsed.data.usage,
                      }, '*');
                    }

                    // ← NEW: Detect search results
                    if (parsed.data && parsed.data.search_results) {
                      console.log('[Inject] 🔍 Search results detected');
                      window.postMessage({
                        type: 'Z_AI_SEARCH_RESULTS',
                        results: parsed.data.search_results,
                      }, '*');
                    }

                    // ← NEW: Detect search phase
                    if (parsed.data && parsed.data.phase === 'searching') {
                      window.postMessage({
                        type: 'Z_AI_SEARCH_PHASE',
                        phase: 'searching',
                      }, '*');
                    }
                  } catch (e) {}
                }
              }
            } catch (e) {
              console.error('[Inject] SSE transform error:', e);
            }
            controller.enqueue(chunk);
          },
          flush() {
            if (sseBuffer.trim()) {
              const line = sseBuffer.trim();
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr !== '[DONE]') {
                  try {
                    const parsed = JSON.parse(jsonStr);
                    queuePostMessage(parsed);
                  } catch (e) {}
                }
              }
            }
            flushInjectBuffer();
            window.postMessage({ type: 'Z_AI_STREAM_END_RAW' }, '*');
          }
        });

        const interceptedBody = response.body.pipeThrough(interceptor);
        const newHeaders = new Headers(response.headers);
        newHeaders.delete('content-encoding');
        newHeaders.delete('content-length');

        return new Response(interceptedBody, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
      return response;
    }

    return originalFetch.apply(this, args);
  };

  // ... existing toString patch + buffer logic (unchanged) ...
})();
```

### 4.4 Modifications: `extension/content.js`

**Thay đổi**: 
1. Set `window.__zai_search_enabled` flag khi isSearch = true
2. Relay search results + usage data về server
3. **KHÔNG CẦN** tìm search toggle trên DOM

```javascript
// === THAY ĐỔI: content.js — search mode qua API interception ===

// ← NEW: Search results + usage handlers trong window.addEventListener('message')
// (Đã mô tả ở phần 3.5)

// === THAY ĐỔI: handleSendPrompt — thêm isSearch ===

async function handleSendPrompt(prompt, isSearch = false) {
  // ... existing WAF check and rate limiting ...

  // ← NEW: Set search flag for inject.js to pick up
  if (isSearch) {
    console.log('[Content] 🔍 Search mode: setting window.__zai_search_enabled = true');
    window.postMessage({ type: 'Z_AI_ENABLE_SEARCH' }, '*');
  }

  // ← NEW: Reset search results cache
  // (Will be populated by inject.js via Z_AI_SEARCH_RESULTS message)

  // ... existing textarea + send button code (COMPLETELY UNCHANGED) ...
  // Không cần tìm search toggle, không cần click toggle
  // inject.js sẽ modify fetch payload tự động
}

// === THAY ĐỔI: WS onmessage — parse isSearch ===

ws.onmessage = async (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.action === 'send_prompt') {
      currentRequestId = data.requestId;
      // ← CHANGED: Pass isSearch
      handleSendPrompt(data.prompt, data.isSearch || false);
    }
    // ... existing handlers ...
  } catch (e) {
    console.error('[Content] Error parsing WS message:', e);
  }
};

// ← NEW: Listen for search enable message from self
// (content.js runs in isolated world, cannot set window.__zai_search_enabled directly)
// Solution: Use window.postMessage to communicate with inject.js

// Actually, content.js and inject.js share the same DOM window.
// content.js can set window.__zai_search_enabled directly:
// But content.js runs in isolated scope, so we need postMessage bridge.

// Add listener for search enable in inject.js:
// inject.js should listen for: { type: 'Z_AI_ENABLE_SEARCH' }
```

**Lưu ý về isolated world**: content.js chạy trong isolated world, không thể set trực tiếp `window.__zai_search_enabled` trên main world. Giải pháp:

```javascript
// === THÊM VÀO inject.js — listen for search enable message ===

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'Z_AI_ENABLE_SEARCH') {
    console.log('[Inject] 🔍 Search enable message received. Setting __zai_search_enabled = true');
    window.__zai_search_enabled = true;
  }
});
```

### 4.5 SSE Event Sequence — Search Mode

```
→ Client: POST /v1/chat/accounts/messages { ..., is_search: true }
← SSE: data: {"meta":{...}}
← SSE: data: {"type":"search_status","enabled":true,"message":"Search mode activated..."}
← SSE: data: {"type":"search_results","results":[{"index":1,"title":"...","url":"...","snippet":"..."}]}
← SSE: data: {"content":"Based on search results..."}
← SSE: data: {"content":" [1] says that..."}
← SSE: data: {"type":"usage","input_tokens":376,"output_tokens":688,"total_tokens":1064,"source":"api"}
← SSE: data: [DONE]
```

### 4.6 Non-Streaming Response — Search Mode

```json
{
    "success": true,
    "message": {
        "role": "assistant",
        "content": "Based on search results, the answer is... [1] [2]"
    },
    "metadata": {
        "accountId": "z-account",
        "providerId": "z",
        "modelId": "GLM-5.1",
        "email": "user@chat.z.ai",
        "conversation_id": "z-session-1234567890"
    },
    "search_results": [
        {
            "index": 1,
            "title": "Example Page",
            "url": "https://example.com/page1",
            "snippet": "This page contains information about..."
        }
    ],
    "usage": {
        "input_tokens": 376,
        "output_tokens": 688,
        "total_tokens": 1064,
        "source": "api"
    }
}
```

---

## 5. Thứ tự thực hiện

### Phase A: Token Counting (1-2 ngày) — Đơn giản hơn nhờ API thực tế

| Step | Task | File | Effort |
|---|---|---|---|
| A1 | Tạo `src/utils/usage-tracker.ts` | New file | 30 min |
| A2 | Cập nhật `extension/inject.js` — capture `phase: "other"` usage + send `Z_AI_USAGE` postMessage | Modify | 20 min |
| A3 | Cập nhật `extension/content.js` — relay `usage` message qua WS | Modify | 15 min |
| A4 | Cập nhật `z.ts` — thêm UsageTracker, handle `usage` message, expose `lastUsage` | Modify | 30 min |
| A5 | Cập nhật `src/utils/sse.ts` — thêm usage headers + `writeUsageEvent` | Modify | 15 min |
| A6 | Cập nhật `src/routes/zen.ts` — usage events, `/v1/tokenize`, `/v1/usage`, fallback estimation | Modify | 45 min |
| A7 | Compile + test | - | 30 min |
| | **TOTAL** | | **~3.5 giờ** |

### Phase B: Search Mode (2-3 ngày) — Không cần research DOM nữa

| Step | Task | File | Effort |
|---|---|---|---|
| B1 | Cập nhật `extension/inject.js` — intercept fetch + modify `features.web_search` + listen `Z_AI_ENABLE_SEARCH` + capture search results | Modify | 1 hr |
| B2 | Cập nhật `extension/content.js` — set search flag via postMessage, relay search results/phase | Modify | 30 min |
| B3 | Cập nhật `z.ts` — thêm `isSearch` param, forward qua WS, handle `search_results`/`search_phase` | Modify | 30 min |
| B4 | Cập nhật `src/routes/zen.ts` — parse `is_search`, format search results, `is_search: true` in providers | Modify | 45 min |
| B5 | Compile extension + reload + test search mode | - | 1 hr |
| | **TOTAL** | | **~4 giờ** |

### ⚠️ Rủi ro & Mitigation

| Rủi ro | Xác suất | Mitigation |
|---|---|---|
| Z.AI thay đổi `features` field name | 🟢 Thấp | Log raw payload, auto-detect field names |
| Z.AI thêm captcha verification cho search | 🟡 Trung bình | Fallback: notify client search unavailable, proceed without search |
| `window.__zai_search_enabled` bị race condition | 🟡 Trung bình | Set flag trước khi textarea typing bắt đầu (có 4+ giây delay) |
| Z.AI search results format khác dự kiến | 🟡 Trung bình | Log raw data, add flexible parsing (try multiple field names) |
| `phase: "other"` không luôn có usage | 🟢 Thấp | Fallback heuristic estimation đã được implement |

---

## 6. Testing Plan

### 6.1 Token Counting Tests

```bash
# Test 1: Verify inject.js captures usage data
# Mở Chrome DevTools trên chat.z.ai → Console
# Gửi 1 message → xem log:
# "[Inject] 📊 Usage data from Z.AI API"
# "[Content] 📊 Usage data from Z.AI API: prompt=376, completion=688, total=1064"

# Test 2: Tokenize endpoint (heuristic only)
curl -X POST http://localhost:8888/v1/tokenize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, how are you today?"}'

# Expected: { "success": true, "token_count": ~8, "estimation_method": "heuristic" }

# Test 3: Usage endpoint
curl http://localhost:8888/v1/usage

# Expected: { "success": true, "data": { "totalPromptTokens": ..., "apiAccuracy": 100 } }

# Test 4: Chat with token tracking (streaming)
curl -N -X POST http://localhost:8888/v1/chat/accounts/messages \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "stream": true}'

# Expected SSE sequence:
# data: {"meta":{...}}
# data: {"content":"..."}
# data: {"type":"usage","input_tokens":376,"output_tokens":688,"total_tokens":1064,"source":"api"}  ← KEY
# data: [DONE]

# Test 5: Chat with token tracking (non-streaming)
curl -X POST http://localhost:8888/v1/chat/accounts/messages \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "stream": false}'

# Expected: Response includes "usage": { "input_tokens": 376, "output_tokens": 688, "source": "api" }

# Test 6: Verify accuracy
# So sánh token counts từ /v1/usage với Z.AI DevTools
# apiAccuracy nên = 100% (tất cả requests có data từ API)
```

### 6.2 Search Mode Tests

```bash
# Test 1: Verify inject.js modifies fetch payload
# Mở Chrome DevTools → Network tab
# Gửi request với is_search: true
# Check request payload → features.web_search should be TRUE

# Test 2: Chat without search (default, unchanged)
curl -N -X POST http://localhost:8888/v1/chat/accounts/messages \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is 2+2?"}], "stream": true}'

# Expected: Normal response, NO search_status or search_results events

# Test 3: Chat with search (streaming)
curl -N -X POST http://localhost:8888/v1/chat/accounts/messages \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Latest news about AI 2025"}], "stream": true, "is_search": true}'

# Expected SSE sequence:
# data: {"type":"search_status","enabled":true,...}
# data: {"type":"search_results","results":[...]}
# data: {"content":"..."}
# data: {"type":"usage",...,"source":"api"}
# data: [DONE]

# Test 4: Chat with search (non-streaming)
curl -X POST http://localhost:8888/v1/chat/accounts/messages \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Latest news about AI 2025"}], "stream": false, "is_search": true}'

# Expected: Response includes "search_results": [...]

# Test 5: Verify providers endpoint
curl http://localhost:8888/v1/providers

# Expected: "is_search": true, model "GLM-5.1"

# Test 6: Search flag auto-reset
# Gửi 2 requests liên tiếp: 1 với is_search=true, 1 không
# Request 2 KHÔNG được có web_search=true
curl -N -X POST http://localhost:8888/v1/chat/accounts/messages \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Search test"}], "stream": true, "is_search": true}'

# Wait for completion, then:
curl -N -X POST http://localhost:8888/v1/chat/accounts/messages \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "No search test"}], "stream": true}'

# Expected: Request 2 has NO search_status/search_results events
```

---

## Appendix: Files Summary

### New Files
| File | Mô tả |
|---|---|
| `src/utils/usage-tracker.ts` | Token usage tracking + statistics + heuristic fallback |

### Modified Files
| File | Feature 10 | Feature 8 |
|---|---|---|
| `extension/inject.js` | ✅ Capture `phase: "other"` usage + send `Z_AI_USAGE` | ✅ Intercept fetch + modify `features.web_search` + capture search results |
| `extension/content.js` | ✅ Relay `usage` message qua WS | ✅ Set search flag via postMessage + relay search data |
| `z.ts` | ✅ Add UsageTracker, handle `usage` message, expose `lastUsage` | ✅ Add `isSearch` param, handle `search_results`/`search_phase` |
| `src/routes/zen.ts` | ✅ Usage events, `/v1/tokenize`, `/v1/usage`, fallback estimation | ✅ Parse `is_search`, format search results, update providers |
| `src/utils/sse.ts` | ✅ Extended headers with tokens, `writeUsageEvent` | ❌ |

### Unchanged Files
| File | Lý do |
|---|---|
| `src/utils/sanitizer.ts` | Không liên quan |
| `rate-limiter.ts` | Không liên quan |
| `extension/manifest.json` | Không cần thêm permissions (inject.js đã chạy ở MAIN world) |
| `extension/background.js` | Không liên quan |
| `extension/popup.html` | Không liên quan |

### Effort Estimate (Updated)

| Feature | Thời gian cũ | Thời gian mới | Lý do giảm |
|---|---|---|---|
| Token Counting | 2-3 ngày | **1-2 ngày (~3.5 giờ)** | Z.AI đã trả usage data, không cần estimation logic phức tạp |
| Search Mode | 3-4 ngày | **2-3 ngày (~4 giờ)** | Không cần research DOM, modify fetch payload trực tiếp |
| **Total** | **5-7 ngày** | **3-5 ngày (~7.5 giờ)** | |