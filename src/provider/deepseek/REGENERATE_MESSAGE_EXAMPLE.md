# DeepSeek - Regenerate/Edit Message Examples

## 📌 Tổng quan

DeepSeek hỗ trợ **gửi lại message** (regenerate/edit) thông qua `parent_message_id`.
Khi gửi lại, message cũ và toàn bộ lịch sử sau nó sẽ bị xóa.

---

## 1️⃣ REGENERATE MESSAGE (Gửi lại - nội dung giống hệt)

Khi bạn muốn AI tạo response **mới** từ message cũ với **nội dung giống hệt**.

### API Call:

```typescript
await deepseekProvider.handleMessage({
  credential: "eyJhbGc...", // Access token (JWT)
  provider_id: "deepseek",
  model: "deepseek-chat",
  
  // ⭐ Quan trọng: Chỉ định chat session và parent message
  conversationId: "550e8400-e29b-41d4-a716-446655440000", // Chat session UUID
  parent_message_id: "123456", // ⭐ Message ID của message muốn gửi lại
  
  messages: [
    {
      role: "user",
      content: "Giải thích AI là gì?", // ⭐ Nội dung GIỐNG HỆT message cũ
    },
  ],
  
  onContent: (chunk) => console.log(chunk),
  onDone: () => console.log("Done"),
  onError: (err) => console.error(err),
});
```

### Request payload sẽ gửi:

```json
{
  "chat_session_id": "550e8400-e29b-41d4-a716-446655440000",
  "parent_message_id": "123456", // ⭐ ID của message cần regenerate
  "model_type": "ds-3.5",
  "prompt": "Giải thích AI là gì?", // ⭐ Nội dung GIỐNG HỆT
  "ref_file_ids": [],
  "thinking_enabled": false,
  "search_enabled": false,
  "action": null,
  "preempt": false
}
```

### Kết quả:
- Message có ID `123456` và **tất cả message sau nó** bị XÓA
- Tạo message mới với nội dung giống hệt
- Tạo response mới từ AI

---

## 2️⃣ EDIT MESSAGE (Sửa nội dung)

Khi bạn muốn **sửa nội dung** message cũ và tạo response mới.

### API Call:

```typescript
await deepseekProvider.handleMessage({
  credential: "eyJhbGc...",
  provider_id: "deepseek",
  model: "deepseek-chat",
  conversationId: "550e8400-e29b-41d4-a716-446655440000",
  parent_message_id: "123456", // ⭐ Message cần edit
  
  messages: [
    {
      role: "user",
      content: "Giải thích ML là gì?", // ⭐ Nội dung MỚI (đã sửa)
    },
  ],
  
  onContent: (chunk) => console.log(chunk),
  onDone: () => console.log("Done"),
  onError: (err) => console.error(err),
});
```

### Request payload sẽ gửi:

```json
{
  "chat_session_id": "550e8400-e29b-41d4-a716-446655440000",
  "parent_message_id": "123456", // ⭐ Message cần edit
  "model_type": "ds-3.5",
  "prompt": "Giải thích ML là gì?", // ⭐ Nội dung MỚI
  "ref_file_ids": [],
  "thinking_enabled": false,
  "search_enabled": false,
  "action": null,
  "preempt": false
}
```

### Kết quả:
- Message `123456` và **tất cả message sau nó** bị XÓA
- Tạo message mới với nội dung đã sửa
- Tạo response mới từ AI

---

## 3️⃣ So sánh Regenerate vs Edit

| Tính năng | Regenerate | Edit |
|-----------|-----------|------|
| **Nội dung message** | Giống hệt message cũ | Khác với message cũ |
| **parent_message_id** | ID message cũ | ID message cũ |
| **Message cũ** | Bị xóa | Bị xóa |
| **Lịch sử sau** | Bị xóa | Bị xóa |
| **API endpoint** | Giống nhau | Giống nhau |
| **Payload** | Giống nhau | Giống nhau |

**Kết luận**: Về mặt kỹ thuật, **không có sự khác biệt** giữa regenerate và edit trong DeepSeek. 
Cả 2 đều dùng cùng API và cùng cách xử lý.

---

## 📝 Lấy thông tin message để regenerate/edit

Trước khi regenerate/edit, cần lấy `message_id` của message cần thao tác:

```typescript
// GET message history
const response = await fetch(
  `https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=${sessionId}&count=20`,
  {
    headers: {
      Authorization: token,
      Cookie: `DS-User-Auth-Token=${token}`,
      "User-Agent": "Mozilla/5.0...",
    },
  }
);

const json = await response.json();
const messages = json?.data?.biz_data?.chat_messages || [];

// Tìm message cuối cùng của assistant (để lấy message ID)
const lastAssistantMessage = [...messages]
  .reverse()
  .find((m) => m.role?.toUpperCase() === "ASSISTANT");

console.log({
  message_id: lastAssistantMessage.message_id,
  content: lastAssistantMessage.text,
  created_at: lastAssistantMessage.created_at,
});
```

### Hoặc sử dụng helper method của provider:

```typescript
// Provider tự động lấy last message ID
const lastMessageId = await deepseekProvider['getLastMessageId'](
  client, 
  sessionId
);

// Sau đó dùng lastMessageId làm parent_message_id
await deepseekProvider.handleMessage({
  credential: token,
  conversationId: sessionId,
  parent_message_id: lastMessageId, // ⭐ Tự động lấy
  messages: [{ role: "user", content: "new prompt" }],
  // ...
});
```

---

## 🔄 Flow hoàn chỉnh: Regenerate message

### Bước 1: Lấy session và message history

```typescript
const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const token = "eyJhbGc...";

// Lấy last message ID
const response = await fetch(
  `https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=${sessionId}&count=20`,
  {
    headers: {
      Authorization: token,
      Cookie: `DS-User-Auth-Token=${token}`,
    },
  }
);

const json = await response.json();
const messages = json?.data?.biz_data?.chat_messages || [];
const lastAssistant = messages
  .reverse()
  .find((m) => m.role === "ASSISTANT");

const parentMessageId = lastAssistant.message_id; // "123456"
```

### Bước 2: Regenerate với parent_message_id

```typescript
await deepseekProvider.handleMessage({
  credential: token,
  provider_id: "deepseek",
  model: "deepseek-chat",
  conversationId: sessionId,
  parent_message_id: parentMessageId, // ⭐ "123456"
  
  messages: [
    {
      role: "user",
      content: "Giải thích AI là gì?", // Nội dung giống hoặc khác
    },
  ],
  
  onContent: (chunk) => process.stdout.write(chunk),
  onThinking: (chunk) => console.log("[Thinking]", chunk),
  onDone: () => console.log("\n✅ Done"),
  onError: (err) => console.error("❌ Error:", err),
});
```

### Bước 3: API tự động xử lý

DeepSeek API sẽ:
1. Xóa message `123456` và tất cả message sau nó
2. Tạo message mới với prompt mới
3. Tạo response mới
4. Trả về stream SSE

---

## 🎯 Use Cases thực tế

### Use Case 1: Regenerate response (AI trả lời lại)

```typescript
// Scenario: User không hài lòng với câu trả lời, muốn AI trả lời lại

// Message history:
// 1. User: "Giải thích AI?"
// 2. Assistant: "AI là..." (message_id: 123456)

// Regenerate:
await deepseekProvider.handleMessage({
  conversationId: sessionId,
  parent_message_id: "123456", // ⭐ Message của assistant
  messages: [{ role: "user", content: "Giải thích AI?" }], // Giống hệt
  // ...
});

// Kết quả:
// 1. User: "Giải thích AI?"
// 2. Assistant: "AI là..." (response MỚI, khác câu trả lời cũ)
```

### Use Case 2: Edit user message

```typescript
// Scenario: User muốn sửa câu hỏi cũ

// Message history:
// 1. User: "Giải thích AI?" (message_id: 123455)
// 2. Assistant: "AI là..." (message_id: 123456)
// 3. User: "Còn ML?" (message_id: 123457)
// 4. Assistant: "ML là..." (message_id: 123458)

// Edit message 123455:
await deepseekProvider.handleMessage({
  conversationId: sessionId,
  parent_message_id: "123454", // ⭐ Message TRƯỚC message cần edit
  messages: [{ role: "user", content: "Giải thích Deep Learning?" }], // ⭐ Nội dung MỚI
  // ...
});

// Kết quả (message 123455, 123456, 123457, 123458 BỊ XÓA):
// 1. User: "Giải thích Deep Learning?" (message MỚI)
// 2. Assistant: "..." (response MỚI)
```

### Use Case 3: Regenerate với file attachment

```typescript
// Scenario: Regenerate nhưng thêm file đính kèm

// Upload file trước
const fileResponse = await deepseekProvider.uploadFile(token, {
  name: "data.csv",
  size: 1024,
  content: Buffer.from("..."),
});

const fileId = fileResponse.id;

// Regenerate với file
await deepseekProvider.handleMessage({
  conversationId: sessionId,
  parent_message_id: "123456",
  ref_file_ids: [fileId], // ⭐ Thêm file
  messages: [{ role: "user", content: "Phân tích file này" }],
  // ...
});
```

---

## ⚠️ Lưu ý quan trọng

1. **parent_message_id là bắt buộc** khi regenerate/edit. Nếu không có, DeepSeek sẽ tạo message mới (không xóa lịch sử).

2. **Message history bị xóa vĩnh viễn**. Không thể khôi phục các message đã xóa.

3. **Session ID phải hợp lệ**. DeepSeek chỉ chấp nhận UUID format cho session ID.

4. **Auto-fetch parent_message_id**: Provider tự động lấy last message ID nếu không truyền:
   ```typescript
   // Không cần truyền parent_message_id
   await deepseekProvider.handleMessage({
     conversationId: sessionId, // Provider tự động fetch last message
     messages: [{ role: "user", content: "..." }],
   });
   ```

5. **Thinking mode**: Có thể bật thinking khi regenerate:
   ```typescript
   await deepseekProvider.handleMessage({
     parent_message_id: "123456",
     thinking: true, // ⭐ Bật thinking
     messages: [{ role: "user", content: "..." }],
     onThinking: (chunk) => console.log("[Think]", chunk),
   });
   ```

6. **Search mode**: Có thể bật search khi regenerate:
   ```typescript
   await deepseekProvider.handleMessage({
     parent_message_id: "123456",
     search: true, // ⭐ Bật search
     messages: [{ role: "user", content: "..." }],
   });
   ```

---

## 🔍 Debug: Kiểm tra request payload

Để debug, log request payload trước khi gửi:

```typescript
const requestPayload = {
  chat_session_id: sessionId,
  parent_message_id: parentMessageId,
  model_type: "ds-3.5",
  prompt: messages[messages.length - 1].content,
  ref_file_ids: options.ref_file_ids || [],
  thinking_enabled: options.thinking || false,
  search_enabled: options.search || false,
  action: null,
  preempt: false,
};

console.log("📤 DeepSeek Request:", JSON.stringify(requestPayload, null, 2));

// Gửi request
const response = await client.post("/chat/completion", requestPayload);
```

Response sẽ là SSE stream:

```
data: {"event": "chat.message.delta", "delta": {"role": "assistant", "content": "AI "}}
data: {"event": "chat.message.delta", "delta": {"content": "là "}}
data: {"event": "chat.message.delta", "delta": {"content": "trí tuệ nhân tạo"}}
data: {"event": "chat.message.completed"}
data: [DONE]
```
