# ❌ KHÔNG được tạo Fallback Models trong bất kỳ Provider nào

## Quy tắc bắt buộc

**`getModels()` PHẢI throw error khi không lấy được danh sách model từ API.**

Tuyệt đối không được:
- Tạo constant `FALLBACK_MODELS`, `DEFAULT_MODELS`, `HARDCODED_MODELS`, hay tên tương tự
- Return danh sách model hardcode khi API call thất bại
- Dùng `|| fallbackList` / `?? fallbackList` để trả về model mặc định

## Lý do

Fallback models là model giả — chúng không tồn tại ở phía server hoặc đã hết hạn.
Khi UI hiển thị fallback model, người dùng sẽ nhầm tưởng đó là model thật và gửi
message → dẫn đến lỗi runtime (ví dụ: 403 permission_error, 404 model not found).

Đây đúng hơn là "silent failure" — lỗi xảy ra muộn, khó debug, gây nhầm lẫn.

## Cách xử lý đúng

```typescript
// ✅ ĐÚNG — throw error rõ ràng khi không lấy được models
async getModels(credential: string): Promise<any[]> {
  const models = await this.fetchModelsFromApi(credential);
  if (!models || models.length === 0) {
    throw new Error('Failed to fetch models: API returned empty list. Check credentials.');
  }
  return models;
}

// ❌ SAI — return fallback khi fail
async getModels(credential: string): Promise<any[]> {
  const models = await this.fetchModelsFromApi(credential);
  if (!models || models.length === 0) {
    return FALLBACK_MODELS; // KHÔNG ĐƯỢC LÀM VẬY
  }
  return models;
}
```

## Hành vi khi getModels() throw

- API server trả về error response cho client
- UI (ModelAccountDrawer) hiển thị thông báo lỗi thay vì danh sách model giả
- Người dùng biết ngay rằng credentials có vấn đề và cần xử lý

## Áp dụng cho tất cả provider

- `claude` ✅ đã xóa fallback
- `chatgpt` — kiểm tra và xóa nếu có
- `gemini` — kiểm tra và xóa nếu có
- `qwen` — kiểm tra và xóa nếu có
- `kimi` — kiểm tra và xóa nếu có
- `deepseek` — kiểm tra và xóa nếu có
- `groq` — kiểm tra và xóa nếu có
- `huggingchat` — kiểm tra và xóa nếu có
- Tất cả provider còn lại — áp dụng quy tắc này
