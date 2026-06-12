# Hướng dẫn: Gửi `parent_message_id` cho Qwen (Client)

## Vấn đề

Qwen lưu lịch sử hội thoại phía server theo cấu trúc **cây message** (tree-based).  
Mỗi request phải kèm `parent_id` = ID của assistant message trước đó để Qwen biết tin nhắn mới nối vào đâu trong cây.

Nếu không gửi `parent_id` → Qwen không nhận ra context → **mất bộ nhớ hội thoại**.

---

## Server đã làm gì

Server (`qwen.ts`) đã có **fallback**: nếu client không gửi `parent_message_id`, server tự gọi `GET /api/v2/chats/{chat_id}` để lấy `currentId`.

Tuy nhiên, fallback này tốn thêm **1 HTTP round-trip** trước mỗi request follow-up → tăng latency ~200–500ms.

---

## Client cần làm gì

### 1. Lắng nghe `parent_id` từ stream metadata

Sau mỗi response từ server, stream SSE sẽ trả về một event metadata dạng:

```json
{ "meta": { "parent_id": "08807cad-923d-46f2-bc2e-2bcbd2d6816a" } }
```

Event này đến từ `response.created` của Qwen, được forward qua server.

Client cần **lưu lại** `parent_id` này cho conversation hiện tại.

### 2. Gửi `parent_message_id` trong request tiếp theo

Khi gửi tin nhắn follow-up (turn 2, 3, ...) trong cùng một conversation, thêm field `parent_message_id` vào request body:

```json
{
  "conversationId": "df94554d-45a3-4be9-bd75-e38878c4a0e4",
  "parent_message_id": "08807cad-923d-46f2-bc2e-2bcbd2d6816a",
  "messages": [...],
  ...
}
```

### 3. Logic quản lý state

```
Gửi req1 (turn 1):
  - parent_message_id: undefined (không cần)

Nhận response req1:
  - Lắng nghe stream: { meta: { parent_id: "xxx" } }
  - Lưu: conversation.qwenParentId = "xxx"

Gửi req2 (turn 2):
  - parent_message_id: conversation.qwenParentId  ← gửi kèm

Nhận response req2:
  - Cập nhật: conversation.qwenParentId = "<parent_id mới từ stream>"

... lặp lại cho mỗi turn
```

---

## Lưu ý quan trọng

- `parent_message_id` **chỉ cần thiết cho Qwen** — các provider khác (Claude, Gemini, DeepSeek, v.v.) không cần.
- Client nên lưu `parent_message_id` **theo từng conversation**, không phải global.
- Nếu client không gửi (ví dụ sau page refresh), server sẽ tự fetch — không bị lỗi, chỉ chậm hơn một chút.
- `parent_id` trong stream metadata có thể là ID của assistant message, không phải user message.

---

## Ví dụ stream parsing (pseudo-code)

```typescript
// Khi nhận stream từ server
onStreamChunk(chunk) {
  if (chunk.meta?.parent_id) {
    // Lưu để dùng cho request tiếp theo
    currentConversation.qwenParentId = chunk.meta.parent_id;
  }
  if (chunk.content) {
    // Xử lý nội dung như bình thường
    appendContent(chunk.content);
  }
}

// Khi gửi request mới
sendMessage(conversationId, messages) {
  return api.post('/accounts/messages', {
    conversationId,
    messages,
    // Chỉ gửi nếu có (Qwen sẽ dùng, provider khác bỏ qua)
    parent_message_id: currentConversation.qwenParentId ?? undefined,
    ...
  });
}
```

---

## Server endpoint tham khảo

```
POST /accounts/:accountId/messages
Body: {
  conversationId: string,
  parent_message_id?: string,   // ← thêm field này
  messages: Message[],
  providerId: string,
  modelId: string,
  ...
}
```

Field `parent_message_id` đã được định nghĩa sẵn trong server types (`src/types/index.ts`), không cần thay đổi server.
