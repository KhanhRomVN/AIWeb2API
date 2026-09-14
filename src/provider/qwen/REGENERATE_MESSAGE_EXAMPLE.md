# Qwen - Edit Message (Regenerate) Examples

## 📌 Tổng quan

Qwen chỉ có **1 cơ chế duy nhất**: **Edit message** với `user_action: "edit"`.

- **Edit với content mới** = Sửa nội dung message
- **Edit với content giống hệt** = Regenerate (gửi lại)

**Về mặt kỹ thuật**: Không có sự khác biệt giữa "edit" và "regenerate". Cả 2 đều:
- Ghi đè message cũ
- Xóa toàn bộ lịch sử sau message đó
- Tạo response mới

---

## 🔄 EDIT MESSAGE (Bao gồm cả Regenerate)

Dùng khi muốn **thay đổi message cũ** (hoặc gửi lại với nội dung giống hệt).

### API Call:

```typescript
await qwenProvider.handleMessage({
  credential: "eyJhbGc...", // Access token
  provider_id: "qwen",
  model: "qwen3.7-plus",
  conversationId: "c77315b7-f395-4a22-aa63-4101765fbf13", // Chat ID
  parent_message_id: "29769347-be5b-496b-a125-26b2f5a8c728", // Parent của message cần edit
  
  // ⭐ Quan trọng: Các field để EDIT
  user_action: "edit", // Báo cho Qwen biết đây là edit
  edit_message_id: "32154413-eeae-482a-b43b-e20724d7b55c", // FID của message cũ cần edit
  
  messages: [
    {
      role: "user",
      content: "xin chào 2 LẦN NỮA", // Nội dung MỚI (đã sửa)
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
  "stream": true,
  "version": "2.1",
  "incremental_output": true,
  "chatId": "c77315b7-f395-4a22-aa63-4101765fbf13",
  "parentId": "29769347-be5b-496b-a125-26b2f5a8c728",
  "chat_id": "c77315b7-f395-4a22-aa63-4101765fbf13",
  "chat_mode": "normal",
  "model": "qwen3.7-plus",
  "parent_id": "29769347-be5b-496b-a125-26b2f5a8c728",
  "messages": [
    {
      "id": null,
      "fid": "32154413-eeae-482a-b43b-e20724d7b55c", // ⭐ FID của message cũ
      "parentId": "29769347-be5b-496b-a125-26b2f5a8c728",
      "childrenIds": ["ba9d06a4-bde5-49ee-9414-6cbcf13313fe"], // ⭐ Children sẽ bị XÓA
      "role": "user",
      "content": "xin chào 2 LẦN NỮA", // ⭐ Nội dung MỚI
      "user_action": "edit", // ⭐ Action = edit
      "files": [],
      "timestamp": 1789361809,
      "models": ["qwen3.7-plus"],
      "model": "",
      "chat_type": "t2t",
      "feature_config": {
        "thinking_enabled": false,
        "output_schema": "phase",
        "research_mode": "normal",
        "auto_thinking": false,
        "thinking_mode": "Fast",
        "auto_search": true
      },
      "extra": {
        "meta": {
          "subChatType": "t2t"
        }
      },
      "sub_chat_type": "t2t",
      "parent_id": "29769347-be5b-496b-a125-26b2f5a8c728"
    }
  ],
  "timestamp": 1789361809
}
```

### Kết quả:
- Message `32154413-eeae-482a-b43b-e20724d7b55c` bị ghi đè
- Tất cả children (`ba9d06a4-bde5-49ee-9414-6cbcf13313fe`) bị XÓA
- Tạo response mới

---

## 💡 Ví dụ Use Cases

### Use Case 1: Sửa nội dung (Edit thật sự)

```typescript
// Message cũ: "xin chào 2"
// Sửa thành: "xin chào 2 LẦN NỮA"

await qwenProvider.handleMessage({
  credential: "eyJhbGc...",
  model: "qwen3.7-plus",
  conversationId: "c77315b7-...",
  parent_message_id: "29769347-...",
  user_action: "edit",
  edit_message_id: "32154413-...", // FID message cũ
  messages: [
    {
      role: "user",
      content: "xin chào 2 LẦN NỮA", // ⭐ Nội dung MỚI
    },
  ],
  onContent: (chunk) => console.log(chunk),
  onDone: () => console.log("Done"),
  onError: (err) => console.error(err),
});
```

### Use Case 2: Regenerate (Edit với content giống hệt)

```typescript
// Message cũ: "xin chào 2"
// Gửi lại: "xin chào 2" (giống hệt)

await qwenProvider.handleMessage({
  credential: "eyJhbGc...",
  model: "qwen3.7-plus",
  conversationId: "c77315b7-...",
  parent_message_id: "29769347-...",
  user_action: "edit",
  edit_message_id: "32154413-...",
  messages: [
    {
      role: "user",
      content: "xin chào 2", // ⭐ Nội dung GIỐNG HỆT
    },
  ],
  onContent: (chunk) => console.log(chunk),
  onDone: () => console.log("Done"),
  onError: (err) => console.error(err),
});
```

**Kết quả cả 2 use case**: Message cũ bị ghi đè, children bị xóa, tạo response mới.

---

## 2️⃣ REGENERATE MESSAGE (Gửi lại - không sửa)

Khi bạn muốn **gửi lại** message với **nội dung giống hệt** (hoặc khác) để AI tạo response mới.

### Cách 1: Gửi lại với nội dung GIỐNG HỆT

```typescript
await qwenProvider.handleMessage({
  credential: "eyJhbGc...",
  provider_id: "qwen",
  model: "qwen3.7-plus",
  conversationId: "c77315b7-f395-4a22-aa63-4101765fbf13",
  parent_message_id: "29769347-be5b-496b-a125-26b2f5a8c728",
  
  // ⭐ Quan trọng: Các field để REGENERATE
  user_action: "edit", // Vẫn dùng "edit"
  edit_message_id: "32154413-eeae-482a-b43b-e20724d7b55c", // FID message cũ
  
  messages: [
    {
      role: "user",
      content: "xin chào 2\n", // ⭐ Nội dung GIỐNG HỆT message cũ
    },
  ],
  
  onContent: (chunk) => console.log(chunk),
  onDone: () => console.log("Done"),
  onError: (err) => console.error(err),
});
```

### Cách 2: Gửi lại với nội dung KHÁC

```typescript
await qwenProvider.handleMessage({
  credential: "eyJhbGc...",
  provider_id: "qwen",
  model: "qwen3.7-plus",
  conversationId: "c77315b7-f395-4a22-aa63-4101765fbf13",
  parent_message_id: "29769347-be5b-496b-a125-26b2f5a8c728",
  
  // ⭐ Regenerate với nội dung khác
  user_action: "edit",
  edit_message_id: "32154413-eeae-482a-b43b-e20724d7b55c",
  
  messages: [
    {
      role: "user",
      content: "xin chào 3 LẦN", // ⭐ Nội dung KHÁC message cũ
    },
  ],
  
  onContent: (chunk) => console.log(chunk),
  onDone: () => console.log("Done"),
  onError: (err) => console.error(err),
});
```

### Kết quả:
- Cả 2 cách đều: message cũ bị ghi đè + children bị xóa + tạo response mới
- **Không có sự khác biệt** giữa "edit content" và "regenerate với content giống hệt"

---

## 📝 Lấy thông tin message để edit/regenerate

Trước khi edit, cần lấy:
- `fid` của message cần edit
- `parent_id` của message đó
- `childrenIds` (tự động fetch bởi provider)

```typescript
// GET message history
const response = await fetch(
  `https://chat.qwen.ai/api/v2/chats/${conversationId}/messages/`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      source: "web",
      version: "0.2.91",
    },
  }
);

const json = await response.json();
const messages = json.messages || json.data || [];

// Tìm message cần edit
const messageToEdit = messages.find(m => m.fid === "32154413-eeae-482a-b43b-e20724d7b55c");

console.log({
  fid: messageToEdit.fid,
  parent_id: messageToEdit.parent_id,
  childrenIds: messageToEdit.childrenIds,
  content: messageToEdit.content,
});
```

---

## ⚠️ Lưu ý quan trọng

1. **Edit = Regenerate**: Cả 2 đều dùng `user_action: "edit"`. Chỉ khác nhau ở nội dung message mới (giống hệt hay khác).

2. **childrenIds**: Provider tự động fetch childrenIds khi `user_action: 'edit'`. Bạn chỉ cần truyền `edit_message_id`.

3. **Message history bị xóa**: Tất cả message từ điểm edit trở đi đều bị xóa, không thể khôi phục.

4. **FID vs ID**: 
   - `fid`: Frontend ID (do client tạo, UUID) - Dùng để identify message
   - `id`: Backend ID (do server tạo, có thể null)
   - **Luôn dùng `fid`** để identify message khi edit
