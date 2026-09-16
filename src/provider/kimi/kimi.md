Đây là toàn bộ nội dung report, hiển thị trực tiếp. Tất cả header/body đều lấy từ `get_https_detail` thực tế. Token giữ nguyên văn theo yêu cầu.

---

# Kimi AI — HTTPS API Reverse Engineering Report

**Mục đích:** Liệt kê HTTPS request cho các chức năng: xem danh sách model, gửi tin nhắn, upload file, xem usage, lấy credential dùng để gửi tin nhắn.

**Nguồn:** Traffic capture thực tế `www.kimi.ai` / `auth.kimi.ai` (Google login, region oversea).

**Cảnh báo:** Report chứa token nguyên văn — không chia sẻ ngoài phạm vi nội bộ.

---

## 0. Header chung sau login

Mọi API sau login đều gắn các header sau (giá trị cụ thể của session này):

```
authorization: Bearer <accessToken>
x-msh-device-id: 7685698299491314440
x-msh-session-id: 1731473528058514141
x-msh-platform: web
x-msh-version: 2.2.0
x-msh-shield-data: sg:<token khác nhau mỗi request>
x-traffic-id: d5ig6pin7541vtcbh9t0
x-language: en-US
r-timezone: Asia/Saigon
connect-protocol-version: 1
content-type: application/json (Chat dùng application/connect+json)
Referer: https://www.kimi.ai/
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
```

---

## 1. Credential — Login

### 1.1 `LoginWithThirdParty` (stt=194) — status 200

**`POST https://auth.kimi.ai/api/account.gateway.v1.AuthService/LoginWithThirdParty`**

**Request headers:**
```
x-msh-session-id: 1731473528058514141
sec-ch-ua-platform: "Linux"
Referer: https://www.kimi.ai/
x-msh-platform: web
x-msh-device-id: 7685698299491314440
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
connect-protocol-version: 1
x-msh-version: 2.2.0
x-language: en-US
r-timezone: Asia/Saigon
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
content-type: application/json
x-msh-shield-data: sg:mCLoYWBeBH0HrcsT3nZKD3TC9b
x-traffic-id: 7685698299491314440
```

**Request body:**
```json
{"credential":{"third_party":"THIRD_PARTY_GOOGLE","code":"eyJhbGciOiJSUzI1NiIsImtpZCI6ImYxMGY4NzQwNWE5NzljMWRmMzZkZjI2NjA2NzM0ZjMzY2Q4NWMyNzEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI2MjY1ODE3NTQxOTctdjgycGF2YmxqN3RnazZhcDlvdXFiaTlsdjgyMWw2cW8uYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI2MjY1ODE3NTQxOTctdjgycGF2YmxqN3RnazZhcDlvdXFiaTlsdjgyMWw2cW8uYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTE0NTA4NDA0NDk1MzcxMjg5NzgiLCJlbWFpbCI6InRoaWVuYmFvdm4yNDY4QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJub25jZSI6Im9rdTg1djdreDZkIiwibmJmIjoxNzg5NDY5NzY5LCJuYW1lIjoiQuG6o28gVGhpw6puIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0pxTmJiMWlSV2xlelFXQm9na0ZMb3VyVkxaakV4dEctZTNrSHdicTVXR1piRVB6Zz1zOTYtYyIsImdpdmVuX25hbWUiOiJC4bqjbyIsImZhbWlseV9uYW1lIjoiVGhpw6puIiwiaWF0IjoxNzg5NDcwMDY5LCJleHAiOjE3ODk0NzM2NjksImp0aSI6ImE0OGMwMmJiMWEwNGZmMjRkN2YwZjEyMTYwMWY0ZGI3MGQxNTA4YzAifQ.gMlnluGmvavPMeKYzpfF3nSpypsPhpKQTw6XkoWUX9ix38H7DfIQDUJgokbko_30V7ESSucWIgTGqfevDmMQpu2Y8Xfym9xkREA12N5TimxKlsa2P1FI_V-oBx23Cl9ZVZcNyRKNCELzYkX5VB6YeRJCO1yhoBLzF8ZaAKUfw-F9pxmXscThmLFSVPpcWs21dj0TNZO4ApvjF-xkRhoa-UvrN5Y-wi3q74645rD9vm1byhGxc8ckjDF6u-lsKX42so8ZDzFzP_oBsiBlB4HuEBmSt4V0Qf-1qzuJn2C3qPJgQcKSAY-g7jFjpBTJcIyDdZU3B7UrM-OOBCMd3iY9XA"}}
```

**Response 200 — body:**
```json
{"accessToken":"eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhY2NvdW50IiwiYXVkIjpbImtpbWkuYWkiXSwiZXhwIjoxNzg5NDcwOTcwLCJpYXQiOjE3ODk0NzAwNzAsImp0aSI6ImRha2lhdGgwZTNuYzllYjViNDJnIiwidHlwIjoiYWNjZXNzIiwiYXBwX2lkIjoia2ltaSIsInN1YiI6ImQ1aWc2cGluNzU0MXZ0Y2JoOXQwIiwiYWJzdHJhY3RfdXNlcl9pZCI6ImQ1aWc2cGluNzU0MXZ0Y2JoNDJnIiwic3NpZCI6IjE3MzE0NzM1MjgwNTg1MTQxNDEiLCJkZXZpY2VfaWQiOiI3Njg1Njk4Mjk5NDkxMzE0NDQwIiwicmVnaW9uIjoib3ZlcnNlYXMiLCJtZW1iZXJzaGlwIjp7ImxldmVsIjoxMH0sImNvZGVfbWVtYmVyc2hpcCI6eyJsZXZlbCI6MTB9fQ.oXFJTV_oQYb80zJi86J3kt9YBxJU78i7i0da6APEpBqom15y7j-ysQ49OcW8qXziJDt9k3fWHTg7ibYSyuzsZg","refreshToken":"eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhY2NvdW50IiwiYXVkIjpbImtpbWkuYWkiXSwiZXhwIjoxNzk3MjQ2MDcwLCJpYXQiOjE3ODk0NzAwNzAsImp0aSI6ImRha2lhdGgwZTNuYzllYjViNDMwIiwidHlwIjoicmVmcmVzaCIsImFwcF9pZCI6ImtpbWkiLCJzdWIiOiJkNWlnNnBpbjc1NDF2dGNiaDl0MCIsImFic3RyYWN0X3VzZXJfaWQiOiJkNWlnNnBpbjc1NDF2dGNiaDQyZyIsInNzaWQiOiIxNzMxNDczNTI4MDU4NTE0MTQxIiwiZGV2aWNlX2lkIjoiNzY4NTY5ODI5OTQ5MTMxNDQ0MCIsInJlZ2lvbiI6Im92ZXJzZWFzIiwibWVtYmVyc2hpcCI6eyJsZXZlbCI6MTB9LCJjb2RlX21lbWJlcnNoaXAiOnsibGV2ZWwiOjEwfX0.bw7ajawJjAvz3Mqb3sQGTrGXRoWKhULlg69_oT_2fdu9KWxMKI3lDH2PfeO8R2Pu0V0BDopDcevFtllnXCurCQ","userId":"d5ig6pin7541vtcbh9t0"}
```

**Payload accessToken (decode):**
```json
{"iss":"account","aud":["kimi.ai"],"exp":1789470970,"iat":1789470070,"jti":"dakiath0e3nc9eb5b42g","typ":"access","app_id":"kimi","sub":"d5ig6pin7541vtcbh9t0","abstract_user_id":"d5ig6pin7541vtcbh42g","ssid":"1731473528058514141","device_id":"7685698299491314440","region":"overseas","membership":{"level":10},"code_membership":{"level":10}}
```

### 1.2 `GetCurrentUser` (stt=184) — verify token — status 200

**`POST https://www.kimi.ai/apiv2/kimi.gateway.account.v1.UserService/GetCurrentUser`**

**Request headers:** header chung + `authorization: Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...oXFJTV_oQYb80zJi86J3kt9...` (đúng accessToken trên)

**Request body:**
```json
{}
```

**Response 200 — body:**
```json
{"user":{"id":"d5ig6pin7541vtcbh9t0", "nickname":"Bảo Thiên", "avatar":"https://avatar.kimi.ai/avatar/d5ig6pin7541vtcbh42g/1768227686.png", "phone":{}, "region":"REGION_OVERSEA", "globalId":"d5ig6pin7541vtcbh9t0"}, "workspace":{"user":{}}}
```

---

## 2. Danh sách model

### 2.1 `GetAvailableModels` (stt=35 & stt=91) — status 200

**`POST https://www.kimi.ai/apiv2/kimi.gateway.config.v1.ConfigService/GetAvailableModels`**

**Request headers:** header chung + `authorization: Bearer <accessToken>`.

**Request body:**
```json
{}
```

**Response 200 — body:**
```json
{"availableModels":[{"scenario":"SCENARIO_CHAT", "displayName":"Instant", "description":"Fast chat, quick replies", "inputPlaceholder":"Ask anything. Images work too.", "key":"k2d6", "reasoningEffortOptions":[{"effort":"REASONING_EFFORT_NONE", "displayName":"Standard"}, {"effort":"REASONING_EFFORT_LOW", "displayName":"High"}], "defaultReasoningEffort":"REASONING_EFFORT_LOW", "id":"k2d6-chat"}, {"scenario":"SCENARIO_OK_COMPUTER", "displayName":"K2.8", "description":"Well-rounded and efficient for everyday tasks", "label":["Preview"], "kimiPlusId":"ok-computer", "agentMode":"TYPE_NORMAL", "inputPlaceholder":"Ask anything, or task an agent...", "key":"k28-preview", "reasoningEffortOptions":[{"effort":"REASONING_EFFORT_LOW", "displayName":"Standard"}, {"effort":"REASONING_EFFORT_HIGH", "displayName":"High"}, {"effort":"REASONING_EFFORT_MAX", "displayName":"Max", "description":"Consumes more credits"}], "defaultReasoningEffort":"REASONING_EFFORT_HIGH", "contextLengthOptions":[{"contextLength":"CONTEXT_LENGTH_L", "displayName":"Standard", "available":true}, {"contextLength":"CONTEXT_LENGTH_XL", "displayName":"Extra Long", "description":"Up to 1M tokens; consumes more credits", "label":"Allegro plan only", "minMembershipLevel":"LEVEL_ADVANCED"}], "defaultContextLength":"CONTEXT_LENGTH_L", "id":"k28-agent-preview"}, {"scenario":"SCENARIO_OK_COMPUTER", "displayName":"K3", "description":"Chat & Agent, flagship all-rounder", "kimiPlusId":"ok-computer", "agentMode":"TYPE_NORMAL", "inputPlaceholder":"Ask anything, or task an agent...", "key":"k3", "switchableTo":["k3-agent-swarm"], "reasoningEffortOptions":[{"effort":"REASONING_EFFORT_LOW", "displayName":"Standard"}, {"effort":"REASONING_EFFORT_HIGH", "displayName":"High"}, {"effort":"REASONING_EFFORT_MAX", "displayName":"Max", "description":"Consumes more credits"}], "defaultReasoningEffort":"REASONING_EFFORT_HIGH", "contextLengthOptions":[{"contextLength":"CONTEXT_LENGTH_L", "displayName":"Standard", "available":true}, {"contextLength":"CONTEXT_LENGTH_XL", "displayName":"Extra Long", "description":"Up to 1M tokens; consumes more credits", "label":"Allegro plan only", "minMembershipLevel":"LEVEL_ADVANCED"}], "defaultContextLength":"CONTEXT_LENGTH_L", "id":"k3-agent"}, {"scenario":"SCENARIO_OK_COMPUTER_SWARM", "displayName":"K3 Swarm", "description":"Massive search, batch processing, and more in one go", "kimiPlusId":"ok-computer", "agentMode":"TYPE_ULTRA", "inputPlaceholder":"Assign a task to your AI team...", "key":"k3-agent-ultra", "switchableTo":["k3-agent"], "reasoningEffortOptions":[{"effort":"REASONING_EFFORT_LOW", "displayName":"Standard"}, {"effort":"REASONING_EFFORT_HIGH", "displayName":"High"}, {"effort":"REASONING_EFFORT_MAX", "displayName":"Max", "description":"Consumes more credits"}], "defaultReasoningEffort":"REASONING_EFFORT_HIGH", "contextLengthOptions":[{"contextLength":"CONTEXT_LENGTH_L", "displayName":"Standard", "available":true}, {"contextLength":"CONTEXT_LENGTH_XL", "displayName":"Extra Long", "description":"Up to 1M tokens; consumes more credits", "label":"Allegro plan only", "minMembershipLevel":"LEVEL_ADVANCED"}], "defaultContextLength":"CONTEXT_LENGTH_L", "id":"k3-agent-swarm", "minMembershipLevel":"LEVEL_BASIC", "greeting":"Swarm stands ready.Tap into any skills you need. One run, multiple outputs across formats"}], "defaultScenario":{"scenario":"SCENARIO_CHAT", "model":"k2d6-chat"}}
```

**Bảng model:**

| id | displayName | scenario | defaultReasoningEffort |
|---|---|---|---|
| `k2d6-chat` | Instant | SCENARIO_CHAT | REASONING_EFFORT_LOW |
| `k28-agent-preview` | K2.8 | SCENARIO_OK_COMPUTER | REASONING_EFFORT_HIGH |
| `k3-agent` | K3 | SCENARIO_OK_COMPUTER | REASONING_EFFORT_HIGH |
| `k3-agent-swarm` | K3 Swarm | SCENARIO_OK_COMPUTER_SWARM | REASONING_EFFORT_HIGH |

---

## 3. Gửi tin nhắn

### 3.1 Chat "xin chào" (stt=100) — status 200

**`POST https://www.kimi.ai/apiv2/kimi.gateway.chat.v1.ChatService/Chat`**

**Request headers:**
```
authorization: Bearer <accessToken>
x-msh-device-id: 7685698299491314440
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
connect-protocol-version: 1
x-language: en-US
content-type: application/connect+json
x-traffic-id: d5ig6pin7541vtcbh9t0
x-msh-session-id: 1731473528058514141
Referer: https://www.kimi.ai/
x-msh-platform: web
x-msh-version: 2.2.0
r-timezone: Asia/Saigon
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-msh-shield-data: sg:0TREfWm4lCivLdcYbMSUewMmZe
```

**Request body (JSON phần Connect frame):**
```json
{"scenario":"SCENARIO_CHAT","tools":[{"type":"TOOL_TYPE_SEARCH","search":{}},{"type":"TOOL_TYPE_CRON_JOB"}],"message":{"role":"user","blocks":[{"message_id":"","text":{"content":"xin chào"}}],"scenario":"SCENARIO_CHAT","is_goal":false},"options":{"thinking":true,"enable_plugin":true,"reasoning_effort":"REASONING_EFFORT_LOW","model":"k2d6-chat"},"project_id":""}
```

**Response 200 — stream connect+json (chunked).** Các event:
- Tạo chat `1a0a4ba7-0db2-835e-8000-09e4fa50aa86`, tên "Untitled Chat".
- Message user "xin chào" (`id 1a0a4ba7-...d30745fc`).
- Message assistant generating → text: **"Xin chào! Mình có thể giúp gì cho bạn?"**
- Đổi chat name → "xin chào". Kết thúc `done:{}`.

### 3.2 Regenerate "xin chào lần nữa" (stt=228) — status 200

**`POST https://www.kimi.ai/apiv2/kimi.gateway.chat.v1.ChatService/Chat`**

**Request body:**
```json
{"chat_id":"1a0a4ba7-0db2-835e-8000-09e4fa50aa86","scenario":"SCENARIO_CHAT","tools":[{"type":"TOOL_TYPE_SEARCH","search":{}},{"type":"TOOL_TYPE_CRON_JOB"}],"message":{"id":"1a0a4ba7-0db2-835f-8000-0ae4d30745fc","parent_id":"1a0a4ba7-0db2-835e-8000-09e4fa50aa86","children_message_ids":["1a0a4ba7-0db2-8360-8000-0ae42ea84c31"],"role":"user","status":"MESSAGE_STATUS_COMPLETED","blocks":[{"message_id":"1a0a4ba7-0db2-835f-8000-0ae4d30745fc","text":{"content":"xin chào lần nữa"}}],"scenario":"SCENARIO_CHAT","create_time":"2026-09-15T11:01:17.147465Z","is_goal":false},"options":{"thinking":true,"enable_plugin":true,"reasoning_effort":"REASONING_EFFORT_LOW","model":"k2d6-chat"}}
```

**Response 200 — stream:** tạo message user mới `1a0a4bd4-...ae499ae5740` (giữ messageId cũ), assistant mới `...b51b7a35`, đổi chat name → "xin chào lần nữa", trả "Xin chào! Rất vui được gặp lại bạn 😊...".

> **Cơ chế:** không có op `REGENERATE_MESSAGE` riêng — client resend message cùng `message.id` với content đã sửa.

---

## 4. Upload file

### 4.1 Upload (stt=119) — status 200

**`POST https://www.kimi.ai/apiv2-files/file/upload`**

**Request headers:**
```
authorization: Bearer <accessToken>
x-msh-device-id: 7685698299491314440
sec-ch-ua-platform: "Linux"
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
X-Language: en-US
Accept: application/json, text/plain, */*
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryBt4cFur8agBmgirE
X-Traffic-Id: d5ig6pin7541vtcbh9t0
x-msh-session-id: 1731473528058514141
Referer: https://www.kimi.ai/?chat_enter_method=new_chat
x-msh-platform: web
x-msh-version: 2.2.0
R-Timezone: Asia/Saigon
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-msh-shield-data: sg:3r1kOWSBRL0XoZzY6Yo1oEzsmd
```

**Request body:** `multipart/form-data` — file `image.png` (7291 bytes, image/png). Tool hiển thị body rỗng do binary multipart.

**Response 200 — body:**
```json
{"file":{"id":"1a0a4be5-29a2-8543-8000-0000ec353885","meta":{"name":"image.png","contentType":"image/png","sizeBytes":"7291","checksum":"b66a751153a50826f920ebe10ce5654c168eca615b44105cce916d07d8d5cfcc","ext":"png","createTime":"2026-09-15T11:05:31.447522910Z","type":"FILE_TYPE_IMAGE"},"blob":{"signUrl":"https://www.kimi.ai/apiv2-files/sign-obj/kimi-fs%2Ffiles%2Fblob%2Fb66a751153a50826f920ebe10ce5654c168eca615b44105cce916d07d8d5cfcc?filename=image.png&sig=akuO4pVM1XfSbW4J6Ng7li7nycnoOSZTLmC1DaZC9KA=&t=o","previewUrl":""},"parseResult":{"thumbnail":{"thumbnailUrl":"https://www.kimi.ai/apiv2-files/sign-obj/kimi-fs%2Ffiles%2Fblob%2Fb66a751153a50826f920ebe10ce5654c168eca615b44105cce916d07d8d5cfcc?filename=image.png&sig=ID76O5q2iJpHfDdE6ute3xTc7iuf9AZK8RT0UAUoZs4=&t=t","previewUrl":"https://www.kimi.ai/apiv2-files/sign-obj/kimi-fs%2Ffiles%2Fblob%2Fb66a751153a50826f920ebe10ce5654c168eca615b44105cce916d07d8d5cfcc?filename=image.png&sig=ilZ9fQ4NsnA1lidFZzjF2UUtwv4dROpnlkVNlWdtsIE=&t=p","mobileThumbnailUrl":"https://www.kimi.ai/apiv2-files/sign-obj/kimi-fs%2Ffiles%2Fblob%2Fb66a751153a50826f920ebe10ce5654c168eca615b44105cce916d07d8d5cfcc?filename=image.png&sig=HKn18394BWAD35DMfMIwXi9ITM4TbpUJDb1NwXqMAY8=&t=m"}}}}
```

### 4.2 Poll parse progress (stt=115, stt=106) — status 200

**`POST https://www.kimi.ai/apiv2-files/kimi.gateway.file.v1.FileService/GetFileParseProgress`**

**Request headers:** header chung + `authorization`.

**Request body (cả 2 lần):**
```json
{"file_ids":["1a0a4be5-29a2-8543-8000-0000ec353885"]}
```

**Response 200 — body:**
- stt=115 (11:05:32): `{"progresses":[{"fileId":"1a0a4be5-29a2-8543-8000-0000ec353885","status":"PROCESS_STATUS_PROCESSING"}]}`
- stt=106 (11:05:33): `{"progresses":[{"fileId":"1a0a4be5-29a2-8543-8000-0000ec353885","status":"PROCESS_STATUS_SUCCESS"}]}`

### 4.3 Tải file/thumbnail (stt=113) — status 200

**`GET https://www.kimi.ai/apiv2-files/sign-obj/kimi-fs%2Ffiles%2Fblob%2Fb66a751153a50826f920ebe10ce5654c168eca615b44105cce916d07d8d5cfcc?filename=image.png&sig=ID76O5q2iJpHfDdE6ute3xTc7iuf9AZK8RT0UAUoZs4=&t=t`**

**Request headers:**
```
sec-ch-ua-platform: "Linux"
Referer: https://www.kimi.ai/?chat_enter_method=new_chat
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
```
(Không cần `authorization` — dùng signed URL.)

**Response 200 headers:**
```
Content-Type: image/png
Content-Length: 3383
Content-Disposition: attachment; filename*=UTF-8''image.png
Server: TosServer
Accept-Ranges: bytes
Last-Modified: Tue, 15 Sep 2026 11:05:31 GMT
```

**Response body:** PNG base64 (`iVBORw0KGgoAAAANSUhEUgAAAasAAADwCAAAAACbRBQx...`).

### 4.4 Chat kèm file (stt=102) — status 200

**`POST https://www.kimi.ai/apiv2/kimi.gateway.chat.v1.ChatService/Chat`**

**Request body (JSON phần Connect frame) — 2 block: text + file:**
```json
{"scenario":"SCENARIO_CHAT","tools":[{"type":"TOOL_TYPE_SEARCH","search":{}},{"type":"TOOL_TYPE_CRON_JOB"}],"message":{"role":"user","blocks":[{"message_id":"","text":{"content":"xin chào"}},{"file":{"id":"1a0a4be5-29a2-8543-8000-0000ec353885","status":"PROCESS_STATUS_SUCCESS"}}],"scenario":"SCENARIO_CHAT","is_goal":false},"options":{"thinking":true,"enable_plugin":true,"reasoning_effort":"REASONING_EFFORT_LOW","model":"k2d6-chat"},"project_id":""}
```

**Response 200 — stream:**
- Tạo chat `1a0a4be7-26d2-8992-8000-09e4ac6528bb`.
- `op:append, mask:chat.files` — gắn file `1a0a4be5-...` với meta + thumbnail.
- Message user: text "xin chào" + block file.
- Đổi chat name → "xin chào".
- Assistant trả lời có phân tích ảnh: **"Xin chào! 😊\n\nTôi thấy bạn vừa gửi một ảnh chụp màn hình giao diện Kimi với dòng chữ \"Type '/' to invoke plugins and skills\"..."**

---

## 5. Usage

### 5.1 `GetSubscriptionStats` (stt=37, 57, 102, 61, 81, 126, 222) — status 200

**`POST https://www.kimi.ai/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats`**

**Request headers:** header chung + `authorization: Bearer <accessToken>`.
**Request body:**
```json
{}
```

**Response 200 — body (tất cả lần gọi đều cùng giá trị):**
```json
{"subscriptionBalance":{"id":"1a0a47ac-f2a2-82ab-8000-0000fbad03e2", "feature":"FEATURE_OMNI", "type":"SUBSCRIPTION", "unit":"UNIT_CREDIT", "amountUsedRatio":0.0319, "expireTime":"2026-10-12T14:21:26.842736Z", "domain":"DOMAIN_NEXUS"}}
```

- **Usage đã dùng:** `amountUsedRatio: 0.0319` = **3.19%**.
- **Usage còn lại:** suy ra `1 − 0.0319` = **96.81%** (API không trả field "còn lại" trực tiếp).
- **Time reset:** `expireTime: 2026-10-12T14:21:26.842736Z` (API không có field `resetTime` riêng).

### 5.2 `GetUserStorageQuota` (stt=49) — status 200

**`POST https://www.kimi.ai/apiv2/kimi.gateway.storage.v1.StorageService/GetUserStorageQuota`**

**Request headers:** header chung + `authorization`.
**Request body:**
```json
{}
```

**Response 200 — body:**
```json
{"quota":{"limitBytes":"524288000"}}
```
→ 524288000 bytes = **500 MB**.

### 5.3 `ListGoods` (stt=104) — status 200

**`POST https://www.kimi.ai/apiv2/kimi.gateway.order.v1.GoodsService/ListGoods`**

**Request headers:** header chung + `authorization`, `Referer: https://www.kimi.ai/settings/subscription?tab=quota`.

**Request body:**
```json
{"payment_channel":"PAYMENT_CHANNEL_UNSPECIFIED"}
```

**Response 200 — body:**
```json
{"goods":[{"id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890", "title":"Adagio", "durationDays":30, "useRegion":"REGION_OVERSEA", "membershipLevel":"LEVEL_FREE", "amounts":[{"currency":"USD", "priceInCents":"0"}], "subscribed":true, "billingCycle":{"duration":1, "timeUnit":"TIME_UNIT_MONTH"}, "type":"GOODS_TYPE_SUBSCRIPTION", "domain":"DOMAIN_NEXUS"}, {"id":"aaa8471a-3fbd-426c-9657-bcd7b2ccdab1", "title":"Plus", "membershipLevel":"LEVEL_BASIC", "amounts":[{"currency":"USD", "priceInCents":"1900"}], "billingCycle":{"duration":1, "timeUnit":"TIME_UNIT_MONTH"}}, {"id":"0fdf3dd6-5582-40be-908b-21138287019f", "title":"Plus", "amounts":[{"currency":"USD", "priceInCents":"18000"}], "billingCycle":{"duration":1, "timeUnit":"TIME_UNIT_YEAR"}}, {"id":"8819d857-1959-459d-9bdd-c1b5c2d3ff80", "title":"Pro", "membershipLevel":"LEVEL_INTERMEDIATE", "amounts":[{"currency":"USD", "priceInCents":"3900"}]}, {"id":"6b294fbb-7af6-481a-85ef-32f530fc23ca", "title":"Pro", "amounts":[{"currency":"USD", "priceInCents":"37200"}], "billingCycle":{"duration":1, "timeUnit":"TIME_UNIT_YEAR"}}, {"id":"e5285f0f-871a-4079-a33b-4935f1c3bb1e", "title":"Max", "membershipLevel":"LEVEL_ADVANCED", "amounts":[{"currency":"USD", "priceInCents":"9900"}]}, {"id":"c76eeb1f-401e-437d-91bb-3edcdb43f77e", "title":"Max", "amounts":[{"currency":"USD", "priceInCents":"94800"}], "billingCycle":{"duration":1, "timeUnit":"TIME_UNIT_YEAR"}}, {"id":"47279207-d0fd-4c06-8a57-240eca28eec3", "title":"Ultra", "membershipLevel":"LEVEL_STANDARD", "amounts":[{"currency":"USD", "priceInCents":"190800"}], "billingCycle":{"duration":1, "timeUnit":"TIME_UNIT_YEAR"}}, {"id":"2ea9c20a-4650-46b9-872e-de4841bc57c3", "title":"Ultra", "amounts":[{"currency":"USD", "priceInCents":"19900"}], "billingCycle":{"duration":1, "timeUnit":"TIME_UNIT_MONTH"}}], "recommendChannel":"PAYMENT_CHANNEL_UNSPECIFIED"}
```

---

## 6. Bảng tổng hợp

| # | Chức năng | Method | URL | Status |
|---|---|---|---|---|
| 1 | Login lấy credential | POST | auth.kimi.ai/api/account.gateway.v1.AuthService/LoginWithThirdParty | 200 |
| 2 | Verify user | POST | www.kimi.ai/apiv2/kimi.gateway.account.v1.UserService/GetCurrentUser | 200 |
| 3 | Danh sách model | POST | www.kimi.ai/apiv2/kimi.gateway.config.v1.ConfigService/GetAvailableModels | 200 |
| 4 | Gửi tin nhắn | POST | www.kimi.ai/apiv2/kimi.gateway.chat.v1.ChatService/Chat | 200 |
| 5 | Regenerate message | POST | www.kimi.ai/apiv2/kimi.gateway.chat.v1.ChatService/Chat | 200 |
| 6 | Upload file | POST | www.kimi.ai/apiv2-files/file/upload | 200 |
| 7 | Poll parse | POST | www.kimi.ai/apiv2-files/kimi.gateway.file.v1.FileService/GetFileParseProgress | 200 |
| 8 | Tải file (signed) | GET | www.kimi.ai/apiv2-files/sign-obj/... | 200 |
| 9 | Chat kèm file | POST | www.kimi.ai/apiv2/kimi.gateway.chat.v1.ChatService/Chat | 200 |
| 10 | Usage credit | POST | www.kimi.ai/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats | 200 |
| 11 | Quota storage | POST | www.kimi.ai/apiv2/kimi.gateway.storage.v1.StorageService/GetUserStorageQuota | 200 |
| 12 | Danh sách gói | POST | www.kimi.ai/apiv2/kimi.gateway.order.v1.GoodsService/ListGoods | 200 |

---

## 7. Ghi chú kỹ thuật & bảo mật

1. **Credential:** `accessToken` (JWT HS512) là Bearer token cho mọi API sau login; `refreshToken` để gia hạn. Cả hai trả trong **body JSON** (không HttpOnly cookie) → rủi ro XSS đọc token.
2. **Chat:** giao thức Connect streaming (`application/connect+json`), body có tiền tố nhị phân (frame length) trước JSON; response là stream các event `{op, eventOffset, ...}` + `heartbeat`.
3. **Nối file với chat:** qua `file.id`; client chỉ gửi ID, không gửi binary.
4. **Danh sách model:** trả cả `reasoningEffortOptions` (Max "consumes more credits") và `contextLengthOptions` (XL context "Allegro plan only").
5. **Usage:** chỉ trả `amountUsedRatio`; "còn lại" và "reset time" phải suy ra từ `expireTime`.
6. **Header chống bot:** `x-msh-shield-data` khác nhau mỗi request — cần cơ chế sinh mới nếu replay.
7. **Index traffic realtime thay đổi** — khi replay nên đối chiếu bằng URL + body thay vì stt.

---

**Ghi chú:** Report workspace vẫn còn `report_1` ("Kimi AI API Report") với nội dung khung ngắn từ lần tạo trước. Nếu bạn muốn tôi xóa hoặc cập nhật report đó cho khớp nội dung trên, cho tôi biết.