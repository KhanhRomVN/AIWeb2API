# DeepSeek INCOMPLETE Response — Handling Guide

## Tổng quan

DeepSeek tự ngắt SSE stream khi response quá dài (thường > ~40k tokens). Khi đó stream kết thúc với signal `INCOMPLETE` thay vì `[DONE]`. Cần gọi `POST /api/v0/chat/continue` để lấy phần còn lại.

---

## 1. Server-side (Elara — `server/src/provider/deepseek.ts`)

### Đã implement

Logic được tách thành 2 private methods mới trong `DeepSeekProvider`:

#### `parseSSEStream(responseBody, opts)`
- Parse một SSE stream body, emit content/thinking/metadata qua callbacks
- **Return:** `{ incomplete: boolean, responseMessageId: number | null }`
- Detect `INCOMPLETE` qua 2 patterns:
  - `{"p":"response/status","o":"SET","v":"INCOMPLETE"}`
  - `{"p":"response","o":"BATCH","v":[..., {"p":"quasi_status","v":"INCOMPLETE"}]}`

#### `continueIncompleteResponse(client, sessionId, responseMessageId)`
- Gọi `POST /api/v0/chat/continue` với body:
  ```json
  {
    "request": "{\"chat_session_id\":\"...\",\"message_id\":8,\"fallback_to_resume\":true}",
    "response": ""
  }
  ```
- Return: `Response` object (SSE stream tiếp theo)

#### `handleMessage` — Auto-continue loop
```
Initial stream → parseSSEStream
  ↓ incomplete=true?
  ↓ YES → continueIncompleteResponse → parseSSEStream (lặp tối đa 10 lần)
  ↓ NO  → onDone()
```

### Metadata emitted khi đang continue
```json
{ "continuing": true, "continuation_count": 1 }
```
Client có thể dùng để hiển thị "Continuing response..." indicator.

---

## 2. Client-side (Zen VSCode Extension)

### Vấn đề
Elara server đã xử lý auto-continue **hoàn toàn transparent** — client nhận SSE stream liên tục không bị ngắt. Tuy nhiên, Zen cần xử lý thêm:

1. **Hiển thị indicator** khi nhận `meta.continuing = true`
2. **Timeout dài hơn** cho DeepSeek (response có thể mất nhiều phút nếu cần nhiều lần continue)
3. **Fallback thủ công** nếu Elara server không có auto-continue (kết nối trực tiếp)

### SSE Events từ Elara server

```
data: {"meta": {"accountId":"...", "providerId":"deepseek", ...}}

data: {"content": "...chunk..."}

data: {"meta": {"continuing": true, "continuation_count": 1}}   ← DeepSeek đang continue

data: {"content": "...more content..."}

data: [DONE]
```

### Implementation trong Zen

#### A. Detect và hiển thị "Continuing..." indicator

```typescript
// Trong SSE message handler
if (event.meta?.continuing) {
  // Hiển thị subtle indicator trong UI
  this.showContinuingIndicator(event.meta.continuation_count);
}

private showContinuingIndicator(count: number) {
  // Ví dụ: thêm dòng separator vào chat
  // hoặc update status bar
  vscode.window.setStatusBarMessage(
    `$(sync~spin) DeepSeek: Continuing long response (part ${count})...`,
    5000
  );
}
```

#### B. Timeout configuration cho DeepSeek

```typescript
// Tăng timeout cho DeepSeek vì có thể cần nhiều lần continue
const STREAM_TIMEOUT_MS = providerId === 'deepseek' ? 300_000 : 60_000; // 5 phút vs 1 phút
```

#### C. Fallback: Direct continue (nếu Zen gọi DeepSeek trực tiếp, không qua Elara)

Nếu Zen có mode gọi thẳng DeepSeek API (bypass Elara), cần implement:

```typescript
interface DeepSeekStreamState {
  sessionId: string;
  responseMessageId: number | null;
  isIncomplete: boolean;
  continuationCount: number;
}

async function handleDeepSeekStream(
  response: Response,
  state: DeepSeekStreamState,
  onChunk: (text: string) => void,
  onDone: () => void,
  credential: string,
): Promise<void> {
  const result = await parseDeepSeekSSE(response.body!, state, onChunk);
  
  if (result.incomplete && result.responseMessageId !== null && state.continuationCount < 10) {
    state.continuationCount++;
    state.responseMessageId = result.responseMessageId;
    
    // Gọi /chat/continue
    const continueRes = await fetch('https://chat.deepseek.com/api/v0/chat/continue', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credential}`,
        'Content-Type': 'application/json',
        'Origin': 'https://chat.deepseek.com',
      },
      body: JSON.stringify({
        request: JSON.stringify({
          chat_session_id: state.sessionId,
          message_id: result.responseMessageId,
          fallback_to_resume: true,
        }),
        response: '',
      }),
    });
    
    // Recurse để parse tiếp
    await handleDeepSeekStream(continueRes, state, onChunk, onDone, credential);
  } else {
    onDone();
  }
}
```

#### D. Detect INCOMPLETE trong SSE parser của Zen

```typescript
function parseDeepSeekSSELine(line: string, state: DeepSeekStreamState): string | null {
  if (!line.startsWith('data: ')) return null;
  
  const jsonStr = line.slice(6).trim();
  if (jsonStr === '[DONE]') return 'DONE';
  
  try {
    const json = JSON.parse(jsonStr);
    
    // Capture response_message_id từ event: ready
    if (json.response_message_id != null) {
      state.responseMessageId = json.response_message_id;
    }
    
    // Detect INCOMPLETE — pattern 1
    if (json.p === 'response/status' && json.v === 'INCOMPLETE') {
      state.isIncomplete = true;
      return 'INCOMPLETE';
    }
    
    // Detect INCOMPLETE — pattern 2 (BATCH)
    if (json.p === 'response' && json.o === 'BATCH' && Array.isArray(json.v)) {
      for (const item of json.v) {
        if (item.p === 'quasi_status' && item.v === 'INCOMPLETE') {
          state.isIncomplete = true;
          return 'INCOMPLETE';
        }
      }
    }
    
    // Extract content delta
    if (typeof json.v === 'string' && json.p?.endsWith('/content')) {
      return json.v; // text chunk
    }
    
  } catch (_) {}
  
  return null;
}
```

---

## 3. Tóm tắt flow

```
User sends long prompt
        │
        ▼
DeepSeek /chat/completion
        │
        ▼ SSE stream
   [content chunks...]
        │
        ▼
  quasi_status=INCOMPLETE
  + event: close
        │
        ▼ (auto-detected by server)
DeepSeek /chat/continue
  { request: {chat_session_id, message_id, fallback_to_resume:true}, response:"" }
        │
        ▼ SSE stream (tiếp tục từ chỗ ngắt)
   [more content chunks...]
        │
        ▼
  [DONE] hoặc INCOMPLETE lại → lặp
        │
        ▼
  onDone() → client nhận [DONE]
```

---

## 4. Các điểm cần lưu ý

| Điểm | Chi tiết |
|------|----------|
| `message_id` | Là số nguyên (integer), không phải UUID. Lấy từ `event: ready` → `response_message_id` |
| `fallback_to_resume` | Luôn set `true` — cho phép DeepSeek tự resume từ server state |
| `response` field | Có thể để `""` — DeepSeek dùng server-side state, không cần replay stream |
| Max continuations | Giới hạn 10 lần để tránh infinite loop |
| Token count | `accumulated_token_usage` trong BATCH event cho biết tổng tokens đã dùng |
| Timeout | Mỗi lần continue có thể mất 30-60s, tổng có thể > 5 phút |
