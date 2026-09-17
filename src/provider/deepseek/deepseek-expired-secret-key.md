## 1. Tóm tắt cơ chế xác thực DeepSeek

DeepSeek **không dùng JWT** và **không dùng cookie session**. Cơ chế thực tế (đã xác minh qua traffic):

| Thành phần | Giá trị / Hành vi |
|---|---|
| Token | Chuỗi opaque, ví dụ `0Wimf75hCYepiNEqt5t6vpXE5LUvTzNMqXRCHNZ54d92fm5IL7UqHv6HrerWIzcf` |
| Nơi cấp | `POST /api/v0/users/login` → `data.biz_data.user.token` |
| Cách dùng | Header `Authorization: Bearer <token>` (+ cookie `DS-AUTH-TOKEN=<token>` trong web) |
| `expires_in` | **KHÔNG có** trong response login |
| `refresh_token` | **KHÔNG có** |
| Set-Cookie | **KHÔNG có** trong response login |
| Endpoint gia hạn | `POST /api/v0/users/auth_token/check_device` (duy nhất) |

### 1.1. Endpoint gia hạn token — `auth_token/check_device`

Request (từ traffic stt=129):

```http
POST /api/v0/users/auth_token/check_device HTTP/1.1
Host: chat.deepseek.com
Authorization: Bearer 0Wimf75hCYepiNEqt5t6vpXE5LUvTzNMqXRCHNZ54d92fm5IL7UqHv6HrerWIzcf
x-device-id: efe3d897-8f1e-46a6-9d64-4628e5d73c4c
content-type: application/json

{"device_id":"efe3d897-8f1e-46a6-9d64-4628e5d73c4c","device_model":""}
```

Response:

```json
{"code":0,"msg":"","data":{"biz_code":0,"biz_msg":"","biz_data":{"rotate":null}}}
```

**Field `rotate` là mấu chốt:**

| Giá trị `rotate` | Ý nghĩa | Hành động client |
|---|---|---|
| `null` | Token hiện tại vẫn hợp lệ | Không làm gì, tiếp tục dùng token cũ |
| `"<token_mới>"` | Server cấp token mới (rotate) | **Lưu token mới ngay**, thay thế token cũ |

> ⚠️ **Giới hạn dữ liệu:** Traffic hiện tại chỉ bắt được `rotate: null` (token còn hạn). Chưa có mẫu traffic tại thời điểm token gần hết hạn để xác nhận chính xác format giá trị `rotate` khi có rotation. Tài liệu này thiết kế phòng thủ theo cả hai khả năng (string token hoặc object).

### 1.2. `device_id` — UUID v4 do client tự sinh

Từ source `main.7c490b0c22.js` (module `46722`):

```javascript
// key localStorage: "deepseek-device-id:chat"
// Sinh UUID v4 bằng crypto.randomUUID() hoặc crypto.getRandomValues()
// Lưu vào localStorage để persist qua các lần load trang
```

Đặc điểm:
- **Format:** UUID v4 (`efe3d897-8f1e-46a6-9d64-4628e5d73c4c`)
- **Nguồn:** Client tự sinh, KHÔNG lấy từ server
- **Lưu trữ:** `localStorage["deepseek-device-id:chat"]` — cố định theo browser profile
- **Vai trò:** Server dùng cặp `(token, device_id)` để quyết định rotate

> 🔑 **Hệ quả thiết kế:** Trong AIWeb2API, `device_id` **PHẢI được lưu cố định** cùng token trong credential. Nếu sinh mới mỗi request → server từ chối rotate → token chết.

### 1.3. Phân biệt 2 loại device id trong traffic

Đừng nhầm lẫn — trong request login (stt=150) có **2 giá trị khác nhau**:

| Vị trí | Giá trị | Bản chất |
|---|---|---|
| Header `x-device-id` | `efe3d897-...` (UUID) | Client-generated UUID v4, dùng cho `check_device` |
| Body `device_id` | `Bhbrn8wy...==` (base64) | Device fingerprint (do SDK awswaf sinh, KHÔNG dùng cho check_device) |

→ Trong `check_device`, cả header `x-device-id` và body `device_id` dùng **cùng giá trị UUID**.

---

## 2. Root cause lỗi `40003`

```
[ERROR] Failed to create chat session (code: 40003): Authorization Failed (invalid token)
    at DeepSeekProvider.handleMessage (deepseek.provider.ts:413)
```

Chuỗi nhân quả:

1. Token DeepSeek có TTL server-side (thực tế vài ngày) nhưng login response **không trả `expires_in`** → client không biết khi nào hết hạn.
2. Code hiện tại của AIWeb2API **không gọi `check_device` định kỳ** → bỏ lỡ thời điểm server muốn rotate token.
3. Khi token server-side hết hạn, mọi request (`chat_session/create`, `chat/completion`, ...) đều trả `code: 40003`.
4. Code hiện tại ném lỗi thẳng ra ngoài → user phải login lại thủ công.

---

## 3. Thiết kế cơ chế Auto-Renew

### 3.1. Nguyên tắc

- **Lưu `device_id` cố định** cùng token trong credential.
- **Reactive:** Khi gặp `40003` → gọi `check_device` một lần; nếu nhận token mới → retry request gốc; nếu không → báo login lại.
- **Proactive (khuyến nghị):** Gọi `check_device` định kỳ (ví dụ mỗi 6–12 giờ) để nhận token mới trước khi hết hạn.
- **Không sinh mới `device_id`** trong bất kỳ flow nào ngoài login lần đầu.

### 3.2. Credential schema mới (backward-compatible)

Credential hiện tại: `{"secretKey":"<token>"}`

Credential mới:

```json
{
  "secretKey": "<token>",
  "deviceId": "<uuid-v4>"
}
```

**Parse với fallback:**

```typescript
private parseCredential(credential: string): { token: string; deviceId: string | null } {
  if (credential.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(credential);
      const token = parsed.secretKey || parsed.secret_key ||
                    parsed.accessToken || parsed.access_token || parsed.token;
      const deviceId = parsed.deviceId || parsed.device_id || null;
      if (token) return { token, deviceId };
    } catch (e) {
      logger.warn('[DeepSeek] Credential not valid JSON, treating as raw token:', e);
    }
  }
  return { token: credential, deviceId: null };
}
```

> Lưu ý: nếu `deviceId === null` (credential cũ), cần **generate + persist** một device_id mới vào credential ngay sau lần login/user-profile fetch đầu tiên, rồi lưu lại credential vào DB.

---

## 4. Code cần thêm vào AIWeb2API

### 4.1. `deepseek.constant.ts` — bổ sung

```typescript
// Trong API_PATHS, thêm:
export const API_PATHS = {
  USERS_CURRENT: '/api/v0/users/current',
  USERS_LOGIN: '/api/v0/users/login',
  USERS_AUTH_TOKEN_CHECK_DEVICE: '/api/v0/users/auth_token/check_device', // ← MỚI
  CHAT_CONTINUE: '/api/v0/chat/continue',
  // ... phần còn lại giữ nguyên
} as const;

// Trong HTTP_HEADER_NAMES, thêm:
export const HTTP_HEADER_NAMES = {
  // ... giữ nguyên
  X_DEVICE_ID: 'x-device-id', // ← MỚI
  X_DEVICE_MODEL: 'x-device-model', // ← MỚI (tùy chọn, dùng "" như web)
} as const;

// Thêm constants mới:
export const AUTH_RENEW_CONFIG = {
  /** Gọi check_device proactive mỗi N ms (mặc định 6h) */
  PROACTIVE_INTERVAL_MS: 6 * 60 * 60 * 1000,
  /** Timeout cho 1 lần check_device (ms) */
  REQUEST_TIMEOUT_MS: 15_000,
  /** Số lần retry tối đa khi gặp lỗi mạng (không tính 40003) */
  MAX_NETWORK_RETRIES: 2,
} as const;

export const DEEPSEEK_ERROR_CODES = {
  AUTHORIZATION_FAILED: 40003,
} as const;
```

### 4.2. `deepseek.types.ts` — bổ sung

```typescript
// Response của /users/auth_token/check_device
export interface CheckDeviceResponse {
  rotate: string | null;         // token mới, hoặc null nếu không rotate
}

// Credential đã parse
export interface DeepSeekCredential {
  token: string;
  deviceId: string | null;
}

// (tùy chọn) nếu server trả object khi rotate:
export interface CheckDeviceRotateObject {
  token: string;
  expire_at?: number;
}
```

### 4.3. `deepseek.provider.ts` — bổ sung / sửa

#### 4.3.1. Thêm helper lấy/sinh device_id

```typescript
import { randomUUID } from 'crypto';

/**
 * Lấy device_id từ credential; nếu chưa có thì sinh UUID v4 mới.
 * KHÔNG persist ở đây — caller chịu trách nhiệm lưu lại credential.
 */
private resolveDeviceId(credential: DeepSeekCredential): string {
  if (credential.deviceId) return credential.deviceId;
  return randomUUID(); // UUID v4 — khớp hành vi web client
}
```

#### 4.3.2. Thêm method `renewTokenIfPossible()`

```typescript
/**
 * Gọi /users/auth_token/check_device để kiểm tra & rotate token.
 * Trả về token mới nếu server rotate, hoặc token cũ nếu không.
 * Trả về null nếu token đã chết hoàn toàn (cần login lại).
 */
async renewTokenIfPossible(
  credential: DeepSeekCredential,
): Promise<{ token: string; rotated: boolean; newCredential: string } | null> {
  const deviceId = this.resolveDeviceId(credential);

  try {
    const url = `${BASE_URL}${API_PATHS.USERS_AUTH_TOKEN_CHECK_DEVICE}`;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AUTH_RENEW_CONFIG.REQUEST_TIMEOUT_MS,
    );

    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${credential.token}`,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.X_DEVICE_ID]: deviceId,
        [HTTP_HEADER_NAMES.X_DEVICE_MODEL]: '',
        [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.LINUX_CHROME,
        [HTTP_HEADER_NAMES.X_CLIENT_VERSION]: HTTP_HEADERS.X_CLIENT_VERSION,
        [HTTP_HEADER_NAMES.X_CLIENT_PLATFORM]: HTTP_HEADERS.X_CLIENT_PLATFORM,
        [HTTP_HEADER_NAMES.X_CLIENT_LOCALE]: HTTP_HEADERS.X_CLIENT_LOCALE,
        [HTTP_HEADER_NAMES.X_CLIENT_BUNDLE_ID]: HTTP_HEADERS.X_CLIENT_BUNDLE_ID,
        [HTTP_HEADER_NAMES.X_CLIENT_TIMEZONE_OFFSET]: HTTP_HEADERS.X_CLIENT_TIMEZONE_OFFSET,
      },
      body: JSON.stringify({ device_id: deviceId, device_model: '' }),
    });

    clearTimeout(timeout);

    // 40003/401 → token đã chết, không thể renew
    if (res.status === 401 || res.status === 403) {
      logger.warn('[DeepSeek] check_device rejected token (auth dead)');
      return null;
    }

    if (!res.ok) {
      logger.warn(`[DeepSeek] check_device HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as DeepSeekApiEnvelope<{
      rotate?: string | null;
    }>;

    if (json?.code !== SUCCESS_CODE) {
      logger.warn(
        `[DeepSeek] check_device biz error code=${json?.code} msg=${json?.msg}`,
      );
      return null;
    }

    const rotate = json?.data?.biz_data?.rotate ?? null;

    // Không rotate → token cũ vẫn dùng được
    if (!rotate) {
      return {
        token: credential.token,
        rotated: false,
        newCredential: JSON.stringify({
          secretKey: credential.token,
          deviceId,
        }),
      };
    }

    // Rotate → token mới
    const newToken =
      typeof rotate === 'string'
        ? rotate
        : (rotate as unknown as { token: string })?.token;

    if (!newToken) {
      logger.warn('[DeepSeek] rotate payload shape unexpected:', rotate);
      return null;
    }

    const newCredential = JSON.stringify({ secretKey: newToken, deviceId });
    logger.info('[DeepSeek] Token rotated successfully');
    return { token: newToken, rotated: true, newCredential };
  } catch (e: any) {
    logger.warn('[DeepSeek] check_device request failed:', e?.message || e);
    return null;
  }
}
```

#### 4.3.3. Cập nhật `handleMessage()` — retry khi 40003

Chèn đoạn xử lý quanh chỗ tạo session (`sessionData?.[API_FIELDS.CODE] !== SUCCESS_CODE`):

```typescript
// === BẮT ĐẦU: retry khi gặp 40003 ===
const isAuthError = (code: unknown): boolean =>
  Number(code) === DEEPSEEK_ERROR_CODES.AUTHORIZATION_FAILED;

// ... trong handleMessage, sau khi gọi sessionClient.post(CHAT_SESSION_CREATE):

let sessionData = (await sessionRes.json()) as DeepSeekApiEnvelope<{
  chat_session: { id: string };
  id: string;
}>;

// Nếu là lỗi auth → thử renew 1 lần
if (isAuthError(sessionData?.[API_FIELDS.CODE])) {
  logger.warn('[DeepSeek] 40003 detected, attempting token renew...');

  const renewed = await this.renewTokenIfPossible(credentialParsed);
  if (renewed) {
    // Caller phải persist `renewed.newCredential` (xem mục 5)
    options.onCredentialRotated?.(renewed.newCredential);

    // Tạo lại client với token mới
    const retryClient = new HttpClient({
      baseURL: BASE_URL,
      headers: {
        ...baseHeaders,
        [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${renewed.token}`,
        [HTTP_HEADER_NAMES.COOKIE]: `${COOKIE_CONFIG.AUTH_TOKEN_NAME}=${renewed.token}`,
        [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.CHAT_SESSION_PREFIX}${newSessionUUID}`,
      },
    });

    const retryRes = await retryClient.post(API_PATHS.CHAT_SESSION_CREATE, {
      [API_FIELDS.CHARACTER_ID]: null,
    });

    sessionData = (await retryRes.json()) as typeof sessionData;

    if (isAuthError(sessionData?.[API_FIELDS.CODE])) {
      throw new Error(
        `DeepSeek auth still failing after renew (code: ${sessionData?.[API_FIELDS.CODE]}). Re-login required.`,
      );
    }
  } else {
    throw new Error(
      'DeepSeek token expired and cannot be renewed. Re-login required.',
    );
  }
}
// === KẾT THÚC retry ===
```

> Cần thêm `onCredentialRotated?: (newCredential: string) => void | Promise<void>` vào `SendMessageOptions` (trong `types.ts` của project). Caller (service layer / controller) chịu trách nhiệm lưu credential mới vào DB.

#### 4.3.4. Cập nhật `login()` — lưu device_id vào credential

```typescript
// Trong login(), sau khi có token từ CDP:
const deviceId = randomUUID(); // sinh 1 lần, dùng mãi
const jsonCredential = JSON.stringify({ secretKey: token, deviceId });
return { isValid: true, cookies: jsonCredential, email };
```

---

## 5. Service layer — persist credential khi rotate

Trong `chat.service.ts` (nơi gọi `provider.handleMessage`):

```typescript
await provider.handleMessage({
  // ... các option cũ
  onCredentialRotated: async (newCredential: string) => {
    await accountRepository.updateCredential(accountId, newCredential);
    logger.info(`[Account ${accountId}] DeepSeek credential rotated & saved`);
  },
});
```

> Nếu chưa có `accountRepository.updateCredential`, cần thêm. Đây là điểm **bắt buộc** — nếu không lưu, token mới sẽ mất khi restart và lại phải renew từ đầu (nhưng vẫn tốt hơn login lại).

---

## 6. Proactive renewal (khuyến nghị mạnh)

Để tránh việc phải renew ngay giữa request của user (gây latency), thêm scheduler gọi `check_device` định kỳ:

```typescript
// Ví dụ: cron job / setInterval trong account manager
setInterval(async () => {
  const accounts = await accountRepository.listDeepSeekAccounts();
  for (const acc of accounts) {
    const cred = this.parseCredential(acc.credential);
    const renewed = await provider.renewTokenIfPossible(cred);
    if (renewed && renewed.rotated) {
      await accountRepository.updateCredential(acc.id, renewed.newCredential);
    }
  }
}, AUTH_RENEW_CONFIG.PROACTIVE_INTERVAL_MS);
```

**Lịch khuyến nghị:**
- Chạy mỗi **6 giờ** (hoặc 12 giờ) — đủ dày để bắt kịp rotation trước khi token chết.
- Chạy thêm **1 lần ngay sau khi server khởi động** để đồng bộ state.
- Có thể chạy **1 lần ngay trước mỗi request chat** với cache TTL (ví dụ 30 phút) để giảm số lần gọi.

---

## 7. Testing checklist

- [ ] **Login lần đầu** → credential JSON có `{secretKey, deviceId}`.
- [ ] **Load credential cũ** (chỉ có `secretKey`) → parse OK, `deviceId=null`, sau lần renew đầu tiên credential được ghi lại đủ 2 field.
- [ ] **Giả lập token hết hạn:** dùng token cũ đã revoke → gọi handleMessage → phải tự động renew → nếu renew fail → báo "re-login required" (không crash).
- [ ] **Renew thành công:** mock `check_device` trả `rotate: "<token_mới>"` → kiểm tra `onCredentialRotated` được gọi và DB được update.
- [ ] **Renew không cần thiết:** `check_device` trả `rotate: null` → request gốc tiếp tục với token cũ, không có side-effect.
- [ ] **device_id không đổi** giữa các lần renew (log ra so sánh).
- [ ] **Proactive scheduler:** chạy interval 6h → log renew mỗi lần.
- [ ] **Network error** khi check_device → fallback graceful, không crash request của user.

---

## 8. Giới hạn & điều chưa xác minh

1. **Format `rotate` khi có giá trị thực chưa được capture.** Code trên xử lý cả 2 khả năng (string hoặc object `{token}`) nhưng cần verify với traffic thực khi token gần hết hạn.
2. **TTL token DeepSeek không được server công bố** (không có `expires_in`). Khoảng "vài ngày" là suy đoán từ báo cáo người dùng — nên log thời điểm renew thành công để đo TTL thực tế.
3. **Cơ chế rotate có thể phụ thuộc IP/region** (traffic này từ VN). Nếu AIWeb2API chạy qua proxy khác region, có thể cần capture lại traffic tương ứng.
4. **`device_id` trong body login là fingerprint khác** (base64 từ SDK awswaf) — không liên quan đến `check_device`, không cần lưu.

---

## 9. Tóm tắt thay đổi tối thiểu để fix lỗi 40003

| File | Thay đổi |
|---|---|
| `deepseek.constant.ts` | Thêm `API_PATHS.USERS_AUTH_TOKEN_CHECK_DEVICE`, `HTTP_HEADER_NAMES.X_DEVICE_ID`, `DEEPSEEK_ERROR_CODES`, `AUTH_RENEW_CONFIG` |
| `deepseek.types.ts` | Thêm `CheckDeviceResponse`, `DeepSeekCredential` |
| `deepseek.provider.ts` | Thêm `resolveDeviceId()`, `renewTokenIfPossible()`, sửa `parseCredential()`, sửa `login()` (sinh device_id), sửa `handleMessage()` (retry khi 40003) |
| `types.ts` (project) | Thêm `onCredentialRotated` vào `SendMessageOptions` |
| `chat.service.ts` | Truyền `onCredentialRotated` để persist credential mới |
| Scheduler (mới) | Gọi `renewTokenIfPossible()` mỗi 6h |