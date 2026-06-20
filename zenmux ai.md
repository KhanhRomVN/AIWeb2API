# TÀI LIỆU REVERSE ZENMUX AI BROWSER

## TỔNG QUAN

**Base URL:** `https://zenmux.ai`

**API Version:** `2026-04-20` (header `x-api-version`)

**Authentication:** Cookie-based với `ctoken` và `sessionId`

---

## 1. AUTHENTICATION

### 1.1. Login Google - Lấy URL
```
GET /api/login/auth/google?ctoken={ctoken}&provider=google
```

**Headers:**
```
x-api-version: 2026-04-20
Cookie: ctoken=bigfish_ctoken_...
```

**Response:**
```json
{
  "success": true,
  "data": "https://accounts.google.com/o/oauth2/v2/auth?client_id=501879852035-jdiollac6udreei820kh1pkk4n6uevdv.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fzenmux.ai%3Fprovider%3Dgoogle&response_type=code&scope=email profile&state=5j3lujq6lut"
}
```

### 1.2. Login Google - Callback
```
GET /api/login/auth/google/callback?ctoken={ctoken}&code={code}&state={state}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "loginType": "google",
    "avatarUrl": "avatars/{accountId}/{filename}.jpg",
    "displayName": "User Name",
    "freeGift": false,
    "isNew": false,
    "inviteJoined": false
  }
}
```

### 1.3. Get User Info
```
GET /api/user/info?ctoken={ctoken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "placeholder_user_id",
    "accountId": "placeholder_account_id",
    "loginType": "google",
    "avatarUrl": "avatars/placeholder_account_id/avatar.jpg",
    "displayName": "User Name",
    "email": "user@example.com",
    "balance": 0,
    "gmtCreate": "2026-06-19T12:40:01.000Z",
    "inWhiteList": true,
    "needVerify": false,
    "connectedAccounts": [
      {
        "id": "placeholder_connected_account_id",
        "provider": "google",
        "nickname": "user@example.com"
      }
    ],
    "agreementOutdated": false,
    "insuranceUserLog": 1,
    "flags": {
      "monitored": false,
      "abusive": false,
      "suspended": false,
      "banned": false,
      "subscriptionInsider": false,
      "subscription": false,
      "viewNewChat": false,
      "certifiedBuilder": false,
      "kolMember": false,
      "campusAmbassador": false,
      "friends": false,
      "allowTransferCredits": false
    }
  }
}
```

### 1.4. Logout
```
POST /api/user/logout?ctoken={ctoken}
```
Body: empty

**Response:**
```json
{
  "success": true,
  "data": {}
}
```

**Server set-cookie mới** (sessionId mới)

### 1.5. Privacy Settings
```
GET /api/user/get_privacy_settings?ctoken={ctoken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logging": 1,
    "insurance": 1,
    "modelSlug": null,
    "providerSlug": null,
    "providerSort": null,
    "chatModelSlug": null,
    "chatProviderSlug": null,
    "autoSummaryTitlePrompt": null,
    "autoSummaryTitleModelSlug": null,
    "autoSummaryTitleProviderSlug": null,
    "lowBalanceAlertEnabled": 1,
    "lowBalanceCreditThreshold": 0,
    "autoSubscriptionFiveHourResetEnabled": false
  }
}
```

---

## 2. CHAT

### 2.1. Create New Chat
```
POST /api/frontend/chat/add?ctoken={ctoken}
```

**Headers:**
```
x-api-version: 2026-04-20
Content-Type: application/json
Cookie: ctoken=...
```

**Body:**
```json
{
  "name": "chào bạn",
  "extra": "{\"subChats\":[{\"subChatId\":\"326107ccb3e441e0be7b2b58f7a87659\",\"chatModel\":{\"modelInfo\":{\"slug\":\"z-ai/glm-5.2-free\"}},\"selectedProtocolId\":\"anthropic\",\"billing\":{\"mode\":\"payg\"},\"imageConfig\":{\"aspectRatio\":\"1:1\",\"imageSize\":\"1K\",\"quality\":\"\"}}]}",
  "chatRequestId": ["023675113b704ac1854c9338bb89a792"],
  "question": "chào bạn",
  "answer": "",
  "roundExtra": ["{\"subChatId\":\"326107ccb3e441e0be7b2b58f7a87659\",\"modelInfo\":{\"slug\":\"z-ai/glm-5.2-free\"},\"endpointProviderName\":\"BigModel\",\"chatRequestId\":\"023675113b704ac1854c9338bb89a792\",\"status\":\"sending\"}"]
}
```

**Response:**
```json
{
  "chatId": "2625CHhv8Trs15155842",
  "chatRoundId": "2625CRzyTKB116518616",
  "rounds": [...],
  "chatRounds": [...]
}
```

### 2.2. Send Message (Streaming - Anthropic compatible)
```
POST /api/anthropic/v1/messages
```

**Headers:**
```
x-zenmux-apikey-source: payg
chat-request-id: {uuid}
anthropic-version: 2023-06-01
x-zenmux-accept-processing: true, true
Content-Type: application/json
```

**Body - GLM 5.2 Free:**
```json
{
  "model": "z-ai/glm-5.2-free:bigmodel",
  "max_tokens": 128000,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "chào bạn",
          "cache_control": { "type": "ephemeral" }
        }
      ]
    }
  ],
  "stream": true
}
```

**Body - Kimi K2.7 Code (có thinking):**
```json
{
  "model": "moonshotai/kimi-k2.7-code-free:moonshotai",
  "max_tokens": 262144,
  "thinking": {
    "type": "enabled",
    "budget_tokens": 10240
  },
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "chào bạn",
          "cache_control": { "type": "ephemeral" }
        }
      ]
    }
  ],
  "stream": true
}
```

**Response:** Server-Sent Events (text/event-stream)

```
event: message_start
data: {"type":"message_start","message":{"id":"...","type":"message","role":"assistant","model":"z-ai/glm-5.2-free","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Ch"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"input_tokens":9,"output_tokens":15,"cache_read_input_tokens":0,"server_tool_use":{"web_search_requests":0},"service_tier":"standard"}}

event: message_stop
data: {"type":"message_stop"}
```

**Với Kimi K2.7 Code - có thêm block `thinking`:**
```
event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"We need respond..."}}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}
```

### 2.3. Update Round (Lưu câu trả lời)
```
POST /api/frontend/chat/updateRound?ctoken={ctoken}
```

**Body:**
```json
{
  "chatId": "2625CHhv8Trs15155842",
  "chatRoundId": "2625CRzyTKB116518616",
  "question": "chào bạn",
  "answer": "Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?",
  "extra": "{\"subChatId\":\"326107ccb3e441e0be7b2b58f7a87659\",\"chatRequestId\":\"023675113b704ac1854c9338bb89a792\",\"status\":\"success\",\"modelInfo\":{\"slug\":\"z-ai/glm-5.2-free\"},\"usage\":{\"prompt_tokens\":9,\"completion_tokens\":15},\"firstTokenLatency\":9285,\"totalTokenTime\":9909,\"requestId\":\"023675113b704ac1854c9338bb89a792\",\"chatRequestTime\":\"2026-06-19T12:46:55.000Z\",\"zenmuxRequestId\":\"ae2a3b139ed3415abbc6d00d5793ab05\",\"endpointProviderName\":\"BigModel\"}",
  "chatRequestId": "023675113b704ac1854c9338bb89a792",
  "status": "success",
  "finishReason": "success"
}
```

**Với Kimi K2.7 Code - có thêm `reasoning` và `reasoningTime` nằm trong chuỗi JSON `extra`:**
```json
{
  "chatId": "2625CHhv8Trs15155842",
  "chatRoundId": "2625CRzyTKB116518616",
  "question": "chào bạn",
  "answer": "...",
  "extra": "{\"subChatId\":\"326107ccb3e441e0be7b2b58f7a87659\",\"chatRequestId\":\"023675113b704ac1854c9338bb89a792\",\"status\":\"success\",\"modelInfo\":{\"slug\":\"moonshotai/kimi-k2.7-code-free\"},\"usage\":{\"prompt_tokens\":9,\"completion_tokens\":15},\"firstTokenLatency\":9285,\"totalTokenTime\":9909,\"requestId\":\"023675113b704ac1854c9338bb89a792\",\"chatRequestTime\":\"2026-06-19T12:46:55.000Z\",\"zenmuxRequestId\":\"ae2a3b139ed3415abbc6d00d5793ab05\",\"endpointProviderName\":\"MoonshotAI\",\"reasoning\":\"We need respond to Vietnamese greeting...\",\"reasoningTime\":0.558}",
  "chatRequestId": "023675113b704ac1854c9338bb89a792",
  "status": "success",
  "finishReason": "success"
}
```


**Response:**
```json
{
  "id": "2625CRzyTKB116518616",
  "status": "success",
  "finish_reason": "success",
  "question": "chào bạn",
  "answer": "Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?",
  "extra": "{...}"
}
```

### 2.4. Update Chat
```
POST /api/frontend/chat/update?ctoken={ctoken}
```

**Body:**
```json
{
  "id": "2625CHhv8Trs15155842",
  "name": "chào bạn",
  "extra": "{\"subChats\":[...]}"
}
```

### 2.5. Chat Detail
```
GET /api/frontend/chat/detail?ctoken={ctoken}&chatId={chatId}
```

### 2.6. Chat List
```
GET /api/frontend/chat/list?ctoken={ctoken}
```

**Response:** `{"success":true,"data":[...]}` (2B khi trống)

---

## 3. MODELS

### 3.1. Model List by Filter
```
GET /api/frontend/model/listByFilter?ctoken={ctoken}
```

### 3.2. Available Models
```
GET /api/frontend/model/available/list?ctoken={ctoken}&sort=newest
```

### 3.3. Provider List and Models
```
GET /api/frontend/provider/listAndModel?ctoken={ctoken}
```

### 3.4. Model Prices
```
GET /api/frontend/model/provider/price/list?ctoken={ctoken}
```

---

## 4. SUBSCRIPTION

### 4.1. Get Current Subscription
```
GET /api/subscription/get_current?ctoken={ctoken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "price": 0,
    "status": "ACTIVE",
    "planKey": "free",
    "leverage": 1,
    "alpha": 1,
    "gamma": 1,
    "period_quota": 5,
    "flowPrice": 0.03283425269240872,
    "weekMaxFlows": 38.64,
    "monthMaxFlows": 165.6,
    "nextBillingPlanKey": null,
    "enable_extra_usage": false,
    "extra_api_key": false,
    "name": "Free Plan",
    "desc": "5 Flows/5h"
  }
}
```

### 4.2. All Plans
```
GET /api/subscription/public/get_all_plans?ctoken={ctoken}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "planKey": "free",
      "name": "Free Plan",
      "desc": "5 Flows/5h",
      "price": 0,
      "period_quota": 5,
      "models": [
        {
          "endpoint_slug": "*",
          "model_slug": "z-ai/glm-5.2-free",
          "provider_slug": "*"
        }
      ]
    },
    {
      "planKey": "pro",
      "name": "Pro Plan",
      "price": 20,
      "period_quota": 50,
      "models": [...]
    },
    {
      "planKey": "max",
      "name": "Max Plan",
      "price": 100,
      "period_quota": 300
    },
    {
      "planKey": "ultra",
      "name": "Ultra Plan",
      "price": 200,
      "period_quota": 800
    }
  ]
}
```

### 4.3. Get Subscription Usage
```
GET /api/subscription/get_current_usage?ctoken={ctoken}
```

### 4.4. Onboarding Config
```
GET /api/subscription/public/get_onboarding_config?ctoken={ctoken}
```

### 4.5. Subscription Count
```
GET /api/subscription/public/get_subscriptions_count?ctoken={ctoken}
```

### 4.6. Whitelist Check
```
GET /api/subscription/is_in_whitelist?ctoken={ctoken}
```

---

## 5. REFERRAL

```
GET /api/referral/info?ctoken={ctoken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "inviteCode": "INVITE_CODE",
    "count": 0,
    "chargeCount": 0
  }
}
```

---

## 6. PAYMENT / CREDITS

### 6.1. Get Credits
```
GET /api/payment/transtion/get_credits?ctoken={ctoken}
```

### 6.2. Discount
```
GET /api/payment/transtion/discount_get?ctoken={ctoken}
```

---

## 7. INSURANCE

```
POST /api/frontend/insurance/total?ctoken={ctoken}
```

**Body:** empty

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAmount": "0",
    "count": 0
  }
}
```

---

## 8. MONITORING (Yuyan)

```
POST /collect.zenmux.ai/yuyan?biztype=yuyanmonitorl
```

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
Cookie: ctoken=...
```

**Body:** `data={encoded_csv}&time={timestamp}`

Data là CSV với format:
```
D-AE,2026-06-19 19:42:42:610,,,,2,,,placeholder_account_id,1000,102023,H5behavior,2,,,,,,,,,,,,1920x1080,,,,Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36,,,,,,,,code=2^msg=...^yuyan_id=...&time=1781872962610
```

**Response:**
```json
{
  "code": 200,
  "code_v2": 200
}
```

---

## 9. POSTHOG ANALYTICS

```
POST https://us.i.posthog.com/i/v0/e/?ip=0&_={timestamp}&ver=1.390.2&compression=gzip-js
```

**Body:** Gzipped JSON

**Response:**
```json
{
  "status": "Ok"
}
```

---

## 10. NOTIFICATION

```
GET /api/frontend/notification/unread_count?ctoken={ctoken}
```

---

## 11. APP DATA

```
GET /api/frontend/public/appData?ctoken={ctoken}
```

**Response:** 23.6KB

---

## 12. STATICS

```
GET /api/frontend/public/statics?ctoken={ctoken}
```

---

## 13. RECHARGE GIFT

```
GET /api/recharge-gift/status?ctoken={ctoken}
```

Status 401 khi chưa có gift

---

## MODEL SLUGS ĐÃ BIẾT

### GLM 5.2 Free
- **Slug:** `z-ai/glm-5.2-free`
- **Provider:** BigModel, Baidu
- **Endpoint:** `z-ai/glm-5.2-free:bigmodel`
- **Max tokens:** 128000
- **Thinking:** ❌
- **Plan:** Free, Pro, Max, Ultra

### Kimi K2.7 Code Free
- **Slug:** `moonshotai/kimi-k2.7-code-free`
- **Provider:** Moonshot AI
- **Endpoint:** `moonshotai/kimi-k2.7-code-free:moonshotai`
- **Max tokens:** 262144
- **Thinking:** ✅ (`budget_tokens: 10240`)
- **Plan:** Pro, Max, Ultra

---

## COOKIES QUAN TRỌNG

| Cookie | Description |
|--------|-------------|
| `ctoken` | Authentication token (bigfish_ctoken_xxx) |
| `sessionId` | Session ID |
| `sessionId.sig` | Session signature |
| `locale` | Language (en-US) |

---

## HEADERS CHUNG

```
x-api-version: 2026-04-20
user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...
accept: application/json, text/plain, */*
cookie: ctoken=...; sessionId=...
```

---

## FLOW TỔNG QUAN

```
┌─────────────────────────────────────────────────────────┐
│ 1. AUTHENTICATION                                      │
│    GET  /api/login/auth/google                         │
│    GET  /api/login/auth/google/callback               │
│    GET  /api/user/info                                 │
│    POST /api/user/logout                               │
├─────────────────────────────────────────────────────────┤
│ 2. CHAT                                                │
│    POST /api/frontend/chat/add                         │
│    POST /api/anthropic/v1/messages (streaming)        │
│    POST /api/frontend/chat/updateRound                │
│    POST /api/frontend/chat/update                     │
│    GET  /api/frontend/chat/detail                     │
│    GET  /api/frontend/chat/list                       │
├─────────────────────────────────────────────────────────┤
│ 3. MODELS & SUBSCRIPTION                               │
│    GET  /api/frontend/model/available/list            │
│    GET  /api/frontend/provider/listAndModel           │
│    GET  /api/subscription/get_current                 │
│    GET  /api/subscription/public/get_all_plans        │
├─────────────────────────────────────────────────────────┤
│ 4. OTHER                                               │
│    GET  /api/referral/info                             │
│    GET  /api/payment/transtion/get_credits            │
│    POST /api/frontend/insurance/total                 │
│    POST /collect.zenmux.ai/yuyan (monitoring)         │
│    POST /us.i.posthog.com/i/v0/e/ (analytics)         │
└─────────────────────────────────────────────────────────┘
```

---

## CÒN THIẾU

1. **Upload file/image** - API đính kèm
2. **Web search** - Tính năng search
3. **DeepSeek R1 / o1-mini** - Model thinking khác
4. **Notification** - Khi có thông báo
5. **Update profile** - Đổi avatar, name
6. **WebSocket** - Nếu có realtime
7. **Export chat** - Share/export