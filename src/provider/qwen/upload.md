gửi 1 message "xin chào" bằng Qwen3.7-Plus với FAST-mode và upload 4 định dạng mà model hỗ trợ gồm file, ảnh, video và âm thanh. nhưng khi 1 trong 4 mục này có upload lên thì các MCP  tool gồm tạo ảnh, tạo video, tìm kiếm sâu (khác tìm kiếm web) sẽ bị disable

ở qwen.constant.ts sẽ tạo thêm 1 mục là MCP chứa 3 mcp đó

### `GET` https://chat.qwen.ai/api/v2/chats/?page=1&exclude_project=true

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: e7bde9c1-00b9-4669-aee7-04c596cab45a
sec-ch-ua-platform: "Linux"
bx-umidtoken: T2gA-F7-NtX0oJ7fc8j2AXpWeibAr8qrBE9m_I79lwOS-5cvaVllreRf_m4gufG6MIw=
Referer: https://chat.qwen.ai/c/48ca7a45-00ff-4095-9fc8-475b5b518dd9
Accept-Language: en-US,en;q=0.9
Timezone: Mon Sep 14 2026 09:56:06 GMT+0700
bx-ua: 234!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
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.2.91
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: e7bde9c1-00b9-4669-aee7-04c596cab45a
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Date: Mon, 14 Sep 2026 02:56:07 GMT
Content-Type: application/json
Vary: Accept-Encoding
x-frame-options: SAMEORIGIN
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "success": true,
  "request_id": "e7bde9c1-00b9-4669-aee7-04c596cab45a",
  "data": [
    {
      "id": "48ca7a45-00ff-4095-9fc8-475b5b518dd9",
      "title": "New chat",
      "updated_at": 1789354567,
      "created_at": 1789354567,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d95ed7d3-e9ab-45f0-9141-410c8eda1ab9",
      "title": "Nguồn bài hát Vùng Lá Me Bay",
      "updated_at": 1789353649,
      "created_at": 1789353632,
      "chat_type": "search",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "753e8c47-29da-4893-9085-9281f185b7ba",
      "title": "Chào hỏi với Qwen3.7-Plus",
      "updated_at": 1789353574,
      "created_at": 1789353571,
      "chat_type": "search",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c792d549-85e8-4e7e-9915-c47fc9882162",
      "title": "Chào mừng Qwen3.7-Plus",
      "updated_at": 1789353472,
      "created_at": 1789353470,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "192b122c-8ca2-40b5-a983-6697879e7d2d",
      "title": "Xin chào từ Qwen3.7-Plus",
      "updated_at": 1789353300,
      "created_at": 1789353290,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c0f8aa90-2569-4346-8e68-d3035074211b",
      "title": "Xin chào giao tiếp",
      "updated_at": 1789353248,
      "created_at": 1789353243,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cf7dae93-0c30-4966-9634-5c9418410d8a",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789353078,
      "created_at": 1789353075,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ef13f75b-6ceb-4634-8c8a-851a3ca47c2b",
      "title": "Chào hỏi",
      "updated_at": 1789352815,
      "created_at": 1789352777,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "58685c69-f5f2-4730-a33e-be14da864adb",
      "title": "Tạo file SSE-parse cho provider",
      "updated_at": 1789352485,
      "created_at": 1789352054,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c715581d-8a8b-4c31-8455-39778f41221f",
      "title": "Sửa lỗi TypeScript trong SSE Parser",
      "updated_at": 1789350890,
      "created_at": 1789350748,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "652116cf-186a-4d8d-ab18-881d56ba5c09",
      "title": "Áp dụng mẫu cleancode cho Qwen",
      "updated_at": 1789350662,
      "created_at": 1789348513,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "09efd5e1-987c-467c-aea7-0858bbe3f7a7",
      "title": "Chào hỏi",
      "updated_at": 1789313937,
      "created_at": 1789313931,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "813c3624-592f-4488-a093-290f44190b5a",
      "title": "Chào hỏi",
      "updated_at": 1789306605,
      "created_at": 1789306537,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "bd356c43-2cae-4afe-b86b-240cdc73b248",
      "title": "Chào hỏi",
      "updated_at": 1789306462,
      "created_at": 1789306457,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8e62689b-a6c2-4629-abfb-68726adafe29",
      "title": "Chào hỏi thân mật",
      "updated_at": 1789302142,
      "created_at": 1789302140,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "be502628-0dc5-4ff1-8198-5e3030d53206",
      "title": "Xóa fallback models trong provider",
      "updated_at": 1789301974,
      "created_at": 1789299207,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "1e32c985-b41f-4005-8f50-0baf84ee8609",
      "title": "Chào hỏi",
      "updated_at": 1789299145,
      "created_at": 1789298586,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "feb5f6e3-1aaf-4f98-ae4c-8ec0b1e3e3ec",
      "title": "Chào hỏi",
      "updated_at": 1789298025,
      "created_at": 1789298019,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "90c16fd1-2eaa-4ddf-ab40-6a913388bff6",
      "title": "Xin chào giao tiếp",
      "updated_at": 1789297588,
      "created_at": 1789297582,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "590e61b6-f56d-48e1-9659-26a1f1388db6",
      "title": "New chat",
      "updated_at": 1789297387,
      "created_at": 1789297387,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "98447e2d-cb93-4013-a695-739e0b4250ad",
      "title": "New chat",
      "updated_at": 1789297247,
      "created_at": 1789297247,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ed86d2a8-3013-423d-8d93-1f76d8113901",
      "title": "New chat",
      "updated_at": 1789296947,
      "created_at": 1789296947,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "99d12c46-03a8-4663-9cdb-9ce5e14f20e2",
      "title": "New chat",
      "updated_at": 1789296928,
      "created_at": 1789296928,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "728da699-312c-4e3d-b156-54ceb7546bd6",
      "title": "Chào hỏi",
      "updated_at": 1789291211,
      "created_at": 1789291205,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "7b9ce607-0dfe-44c4-a35f-a5cc7915d067",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789283816,
      "created_at": 1789283802,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "47447838-7527-4cc9-886a-d4b9fa3cfb76",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789283273,
      "created_at": 1789283268,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    }
  ]
}
```


---

### `POST` https://chat.qwen.ai/api/v2/chats/new

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 3e84a361-5b81-434c-9025-fc55a87fec9c
sec-ch-ua-platform: "Linux"
bx-umidtoken: T2gA-F7-NtX0oJ7fc8j2AXpWeibAr8qrBE9m_I79lwOS-5cvaVllreRf_m4gufG6MIw=
Referer: https://chat.qwen.ai/c/new-chat
Accept-Language: en-US,en;q=0.9
Timezone: Mon Sep 14 2026 09:56:06 GMT+0700
bx-ua: 234!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
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Content-Type: application/json
Version: 0.2.91
bx-v: 2.5.37
```

**Response Headers:**
```http
X-Robots-Tag: noindex
x-request-id: 3e84a361-5b81-434c-9025-fc55a87fec9c
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Content-Length: 121
Date: Mon, 14 Sep 2026 02:56:06 GMT
Content-Type: application/json
vary: Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "chatId": "",
  "models": [
    "qwen3.7-plus"
  ],
  "project_id": "",
  "timestamp": 1789354566060,
  "chat_type": "t2t",
  "chat_mode": "normal"
}
```

**Response Body:**
```json
{
  "success": true,
  "request_id": "3e84a361-5b81-434c-9025-fc55a87fec9c",
  "data": {
    "id": "48ca7a45-00ff-4095-9fc8-475b5b518dd9"
  }
}
```


---

### `POST` https://chat.qwen.ai/api/v2/files/getstsToken

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: f0b30cd4-31ab-4fe1-b2ec-8504741c4b6a
sec-ch-ua-platform: "Linux"
bx-umidtoken: T2gA-F7-NtX0oJ7fc8j2AXpWeibAr8qrBE9m_I79lwOS-5cvaVllreRf_m4gufG6MIw=
Referer: https://chat.qwen.ai/
Accept-Language: en-US,en;q=0.9
Timezone: Mon Sep 14 2026 09:54:07 GMT+0700
bx-ua: 234!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
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Content-Type: application/json
Version: 0.2.91
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
x-request-id: f0b30cd4-31ab-4fe1-b2ec-8504741c4b6a
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Date: Mon, 14 Sep 2026 02:54:07 GMT
Content-Type: application/json
Vary: Accept-Encoding, Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "filename": "freesound_community-in-the-air-tonight-95-bpm-82480.mp3",
  "filesize": "163004",
  "filetype": "audio"
}
```

**Response Body:**
```json
{
  "success": true,
  "request_id": "f0b30cd4-31ab-4fe1-b2ec-8504741c4b6a",
  "data": {
    "access_key_id": "STS.NY54qHai9qqE63APP5bRvYPUB",
    "access_key_secret": "EqvJ2ref2SBZN6151Q6ZvCJedqynpG2RXNhndGMUUwnN",
    "security_token": "CAIS8gN1q6Ft5B2yfSjIr5qAf8v8jLYYxrOuNBXwtFBgbt1atpX+oDz2IHhMeXZqAuEcs/8znGlU6/gYlqRtT6h+SFffbMx24plJqZtIvxIg557b16cNrbH4M/b6aXeirle7AYjQSNfaZY3iCTTtnTNyxr3XbCirW0ffX7SClZ9gaKZwPGy/diEUPMpKAQFgpcQGT664V5CXPwXtn3DbAWdxpwN4khkf06mkxdCG4ResRDSYP4YcrJ+jJYO/PYs+fsVmTNqzmfN7fLfAlTZK7BQNqa0r1fceqDyC5Y/MWhwNuk3fdrraqNYqcAIkbfI3F6NO9qHy0qUks7zaz4n9jh0cZL0QDy7RHsXxkJCdXe+lbodmLr+iYXqT3+eBLJT4qAQ5Z34sPwRPfscnK2NhTB0qDy3aJ+qu+UqPfgClSqeFzORnjN9/11CtrYDWdwDJRq3C815BYsBhPhhzbEdOhjy6L/VdSWEWLQM7XYTyZJ5ocRVTpZnvuQDvTSB6xhlVxaamP66J4PtOM9ikAsofjddDPo4nqWIvSE/sR7+wmoyXjfLu+Co/OsDITnzfgNftqI37CWVW0nypaXMhOOZ9xZ8H3cmqyZFdbKcWQhv5ncqYhaenmJhbC3BN3etERiLmUr0mlDEIrtX0gV39n+GL7OihpztQkrEagAFG2rgJH5/QoEXIW11hbzjUAO5K7Bc60A+POjzW7SXuWK/fGqVKHivzyKTLbhO2HwksMi7FT6Xh2O5zj3aauFer6H60ZPzdbAol8y/euRaTM3l8xCHp8Ay+Ept877vWuEGWo7tbfXLTZnDpa+x/igC6yprn4qddx7lM8EYK7gK5TCAA",
    "file_url": "https://qwen-webui-prod.oss-accelerate.aliyuncs.com/5b51329c-3691-4101-8f2c-4e5c2edeb21f/04a8a0eb-c914-4bf2-9831-dd0973a12f6e_freesound_community-in-the-air-tonight-95-bpm-82480.mp3?x-oss-security-token=CAIS0AJ1q6Ft5B2yfSjIr5njJPfAmIpp1pifT2WJpVgTb8xqjpHuhTz2IHhMf3RvBeAbs%2Fs1lWBZ7vwflrN6SJtIXleCZtF94plR7QKoZ73Zocur7LAJksUj09gM6kKpsvXJasDVEfn%2FGJ70GX2m%2BwZ3xbzlD0bAO3WuLZyOj7N%2Bc90TRXPWRDFaBdBQVGAAwY1gQhm3D%2Fu2NQPwiWf9FVdhvhEG6Vly8qOi2MaRmHG85R%2FYsrZN%2BNmgecP%2FNpE3bMwiCYyPsbYoJvab4kl58ANX8ap6tqtA9Arcs8uVa1sruE3eaLeLro0ycVAjN%2FhrQ%2FQZtpn1lvl1ofeWkJznAJW0o2rsz001LaPXI6uscIvBXr5R%2FqYkuMtu9KvG4DWfBomw24j%2FiK%2FAAe8KayYWJ1VFYVrBEYys81vhCQzAQJPO28xYnOQzoRyGktTiT8aqq%2BrxuU4agAFEKPyLwIIDb12xgmQhixqsIX28%2F2J0lshWhDs1xMReDfMvriP%2F9fFAEJHpMnCNhOhlB59NClMzEckE3T%2B0aVDuLS4TslZ6cvc8RiSxLcJCQAD9050Cq%2FCkfcGS4ynAIYvO%2F3bDbXmNNcvRSl3KbfENv%2FSmPm1ltfT4%2FhnsHHgQPiAA&x-oss-date=20260914T025407Z&x-oss-expires=300&x-oss-signature-version=OSS4-HMAC-SHA256&x-oss-credential=STS.NZVoMtuUHaZtMC8AXFcCFaTEg%2F20260914%2Fap-southeast-1%2Foss%2Faliyun_v4_request&x-oss-signature=43baa5fc7e6495d1f023751065e0b08090903dbe478a4e89eb80df650def1d9c",
    "file_path": "5b51329c-3691-4101-8f2c-4e5c2edeb21f/04a8a0eb-c914-4bf2-9831-dd0973a12f6e_freesound_community-in-the-air-tonight-95-bpm-82480.mp3",
    "file_id": "04a8a0eb-c914-4bf2-9831-dd0973a12f6e",
    "bucketname": "qwen-webui-prod",
    "region": "oss-ap-southeast-1",
    "endpoint": "oss-accelerate.aliyuncs.com"
  }
}
```


---

### `POST` https://chat.qwen.ai/api/v2/files/getstsToken

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 02faf148-f367-497b-ae9d-1245eb6a97ab
sec-ch-ua-platform: "Linux"
bx-umidtoken: T2gA-F7-NtX0oJ7fc8j2AXpWeibAr8qrBE9m_I79lwOS-5cvaVllreRf_m4gufG6MIw=
Referer: https://chat.qwen.ai/
Accept-Language: en-US,en;q=0.9
Timezone: Mon Sep 14 2026 09:53:18 GMT+0700
bx-ua: 234!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
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Content-Type: application/json
Version: 0.2.91
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
x-request-id: 02faf148-f367-497b-ae9d-1245eb6a97ab
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Date: Mon, 14 Sep 2026 02:53:19 GMT
Content-Type: application/json
Vary: Accept-Encoding, Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "filename": "13232-246463976_medium.mp4",
  "filesize": "3113813",
  "filetype": "video"
}
```

**Response Body:**
```json
{
  "success": true,
  "request_id": "02faf148-f367-497b-ae9d-1245eb6a97ab",
  "data": {
    "access_key_id": "STS.NYprUjPrjWBSUeZ87vnuwrDZt",
    "access_key_secret": "AR6EFn4inPKDu81maYTH5nwk88nj7ek7rSwiXwBiscoc",
    "security_token": "CAIS1QN1q6Ft5B2yfSjIr5rFOe/eva1L4IC4V0Pr3DcjYvpbnYHxljz2IHhMeXZqAuEcs/8znGlU6/gYlqRtT6h+SFffbMx24plJqexCuhIg557b16cNrbH4M9n6aXeirnS7AYjQSNfaZY3iCTTtnTNyxr3XbCirW0ffX7SClZ9gaKZwPGy/diEUPMpKAQFgpcQGT7O4V5CXPwXtn3DbAWdxpwN4khkf06mkxdCG4ResZzSYIoYcrJ+jJYO/PYs+fsVmTNqzmfN7fLfAlTZK7BQNqa0r1fceqDyC5Y/MWhwNuk3fdrraqNYqcAIkbfI3F6NO9qHy0vF14LSJmdinjhtBNrsQDy+BSMXwnZDNXeqla4piL+z2NSyQjufWbcOu6UZ+PSxHalgbJIQWL3J8CAEpDDTCdo3foQiVP1b4EPPciPpmiscvlG+Fp4TaewK9JJyCyjsdN5MGaEclCgUbx2SJcNVdK1QRLAk8VuzIFtkrNUwD9/ny3BfbUyp71X1aoe015ApIMRmDAG+We+WlseJ1DPwu2wOhT2Po1odhaz8jfoVjWKBX8YfvM4ZeLnZ5rIpImRYf4xnee4S7nPEQftNApL651OybDadAFrHgEK+KpJ80hhExeGNGGoABLB1/7+L/lV7kPFEEbifwpizadN0ugAyrSDtM4EvO9frtk0OvnmMU/Y4yJzY4+6zv/MZqUJL4+AE3FRlGxDkIk0+JWksKAneYpKGqa5WsNNmkRBgWZZIke2T6ubADQoMBX5OSa5xo+ReS1qvtxblM3CMqLC7HsvnlfwGHGvSlXEkgAA==",
    "file_url": "https://qwen-webui-prod.oss-accelerate.aliyuncs.com/5b51329c-3691-4101-8f2c-4e5c2edeb21f/de202f48-edc2-4c6d-853a-ad54322ef054_13232-246463976_medium.mp4?x-oss-security-token=CAIS0AJ1q6Ft5B2yfSjIr5vYB%2FnEu6ZCwpeZUG2G0VcyWc5%2BgKTEuDz2IHhMf3RvBeAbs%2Fs1lWBZ7vwflrN6SJtIXleCZtF94plR7QKoZ73Zocur7LAJksUmyM8N6kKpsvXJasDVEfn%2FGJ70GX2m%2BwZ3xbzlD0bAO3WuLZyOj7N%2Bc90TRXPWRDFaBdBQVGAAwY1gQhm3D%2Fu2NQPwiWf9FVdhvhEG6Vly8qOi2MaRmHG85R%2FYsrZN%2BNmgecP%2FNpE3bMwiCYyPsbYoJvab4kl58ANX8ap6tqtA9Arcs8uVa1sruE3eaLeLro0ycVAjN%2FhrQ%2FQZtpn1lvl1ofeWkJznAJW0o2rsz001LaPXI6uscIvBXr5R%2Fqbuov8u9KvG4DWfBomw24j%2FiK%2FAAe8KayYWJ1VFYVrBEYys81vhCQzAQJPO28xYnOQzoRyGktTi%2FM55UOrxuU4agAFP%2F4%2B%2BhAEI%2BlnFIy6vGkxuuxubXnikb9MwW3PEY6z4Ub%2FiQeGYE31hrshkSTq20yOSdx2VPI80aB3ntPR4gOTbefTFlqhce7eOjmfuHbO5Rob0098rJJqoK1rWCIHonmhtqyO97plc5ufKC5maXc2rC6GkHCaCJpsTrJd4S0E%2BfCAA&x-oss-date=20260914T025319Z&x-oss-expires=300&x-oss-signature-version=OSS4-HMAC-SHA256&x-oss-credential=STS.NXmLCpVycuUrRK75WgUARoaoZ%2F20260914%2Fap-southeast-1%2Foss%2Faliyun_v4_request&x-oss-signature=2bec579e10ca889d64087f0c787d864143ef03dac978c91c2833360e8c7b95f1",
    "file_path": "5b51329c-3691-4101-8f2c-4e5c2edeb21f/de202f48-edc2-4c6d-853a-ad54322ef054_13232-246463976_medium.mp4",
    "file_id": "de202f48-edc2-4c6d-853a-ad54322ef054",
    "bucketname": "qwen-webui-prod",
    "region": "oss-ap-southeast-1",
    "endpoint": "oss-accelerate.aliyuncs.com"
  }
}
```


---

### `POST` https://chat.qwen.ai/api/v2/files/parse/status

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 4fe16a3b-88ca-4990-8d94-00e415003466
sec-ch-ua-platform: "Linux"
bx-umidtoken: T2gA-F7-NtX0oJ7fc8j2AXpWeibAr8qrBE9m_I79lwOS-5cvaVllreRf_m4gufG6MIw=
Referer: https://chat.qwen.ai/
Accept-Language: en-US,en;q=0.9
Timezone: Mon Sep 14 2026 09:49:35 GMT+0700
bx-ua: 234!cVXeKF9beePawl7dxP4J+fjD48zJRd8FTTr55qiMD9dRH76gBfjmFMb0lX5+MMSvslgDlBF58Z4+Ez2hsVCKn61Mc8ItTzDjfOvtzdJKsy/v9Gny0kAcakboiu5SV9BCyR99XQpgFKNkwk/Ysc7lE4Fax0Jrx2D9yZ53oPRSr6o2gkp41PEybeN93o1JK6Yi/Wu2Wgc3Rhw7CmAAebqWZZoHQQVNhMWZVpti32QeEmFuZL2nc4btZZodQQymhsWZn3TH9iJXPkE7A3s/cAV7Z3oHQQxRVZDLZ3Td9iJTCvcZQpkwc247nZodQCyNhsreZ3wTdAyzCvsZQkkUc247AZ0GQCyDlxraepmT7idTCvO+/ps/c24HAloJQCyDw2rtefWTM7JHhVsZQks/cs59ZJ+HQCVmhNh+1Xmd9id7dO38eeuvcs5TZ3odQQVXbD0URiQd9w5ThLoZokq/cs4Tn3ZhnfNNhUWvZ6/dB7J7hnoZQkp/c2tt1ZoZwGyB/aV/S4C+Ywd7hnZZQpsBc8uCXJ+HbFYIhQ02ekUH9Ad7hp5hGSTJgDl9T1yvsUr+e8rpHTy/fMGxdU5ngTyWSokAJjVRkjAxSzcb57eG4pCT+NvyEVDB1zNSm1YO2HRcF7B9E+XWWgCDC1uSEdCkOOL1J14RPjs2i6vkEAd5a7Czoq5jgbQ4d/LieZ2Iwke5a8ZnFc16Aa1YAP+1mBaXBjk17jSrD4Gvn19A/nrPFV9XmERrGdnJp4r9obUmrPjAt/5uwpyt7ecFPW2E/V+MhkJzLki8/usQkkICT/t9NNJg38ojEV6GmabXGjfrdRMr/QZ+7/B8Sd9aYSMAECRqpa6DsSVxypngrF/Pkkm/gyoJ+j2bK0y+mQzUjHIm7z3/w7d+I29O5255apXsSPVSOPAxEhkf4Ej2tTlyJcRpewSRokEEJ3hXIBYltxqfJDPC4CU5U9UJOHPBgh1atMK139u7MT/k0i1AAJcxpMdtjcXRxPAz3C/ehZiFeuu4F/b3bWLhO3pg33WgSGhUBPlL4sd2tZLTV3pdNMz2sw5Z1ULBnkX4HzOSsOfs29ROnRbhyZxizZWerhR8FyktN0+0KZk9+FF4NWH9WQCInXl+VE3nlopaBKF1rNdT08vceJMQTAICF5LNxK9tA4KUbP/ZHWh5qH12DIViMu/czkGLpiuDVwuu4USqLPLOMNVepMBdFn/23YqmYbDeSvYD32X18UyGZDjceAAtTHk3hPehsFzVuts8+4zLpphUc7ibd9p8ZZz1gviJe3G9+sZF/bDy2DK86zZKrwAs3miCSwG6pazJSMwHYHoFE0H85Ws8TSi4X2tsainvBcYdDxA1eqzMx3atcAVrqJ8cnzRZ5aEQ1N/LVwBs7wdvhVaFmO8JnVw6Prg13amohDmgy8L3EH5VgTy1qv56mX59Vlg2DWs7B81QbE5xxwlaoAII091dTo1ajVJoq6lCyBJIDe7cerTQcd4DFW4dbIpzh8mxzVmVXPcGP9SU4k//T97uOG9dfnAEwWPJOLMqrmADvMlwYhHZn0aYe2yfAp/cteohcDS7dwBWYJNgSfvGJOpbeO1/QQ6/qtKHGm2Du69b3aGmjuOWWoFLmtQFT6WWrIOMrgfs9s7xy/2espJ54kGl4DIQso8CYl7z8hYixUjfCUIfuKQrvKm9YGcMoJ0LhQlrV+J36lQcf17PhiYyqL4/hl2VN8/8MujJAdQ0g76pMAlGLdU0RCal7AiRKcVQIRw3yaVpc9KPMK1UVh89S7j1Kqxwkc4G4w2Ua5Jj2KsoarwkDHGNezTH/m7/qWKl6zvyXwcsyRLBGjOX4VWpwXQpmyTvpI192PtTVCWdpya/XDIgp0waIpT1QIMnZGgmlbJ2L741+TGPlBw/9IxFiSXeZFYYKK1OvKGLg3AHp3XcnE9ZzXKj5Qdl1Y5Yciu9kJo//Nrm0ejAm8A8tkxWvDhr0muoT7ftaiYYGSknn7G9cih1ysTbph+HKbyqIhGlfVnZZt9ajZKoUYv5hGsPOuF+E2nZbHqGRP306VT0BK7z9ox59u976nTi/tle71061AzVmVUwEAL+lEEPh6RXaIhTo/AL6vG03LgkbLhWacNdgEwkJ0Dh9ELt9Xz/NsLfARwltvGAiXawFIX=
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Content-Type: application/json
Version: 0.2.91
bx-v: 2.5.37
```

**Response Headers:**
```http
x-request-id: 4fe16a3b-88ca-4990-8d94-00e415003466
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Content-Length: 194
Date: Mon, 14 Sep 2026 02:49:36 GMT
Content-Type: application/json
vary: Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "file_id_list": [
    "7c926139-b1a8-42d0-b77e-c75528934b6d"
  ]
}
```

**Response Body:**
```json
{
  "success": true,
  "request_id": "4fe16a3b-88ca-4990-8d94-00e415003466",
  "data": [
    {
      "file_id": "7c926139-b1a8-42d0-b77e-c75528934b6d",
      "status": "success",
      "error_msg": "",
      "error_code": null,
      "retry": false
    }
  ]
}
```


---

### `POST` https://chat.qwen.ai/api/v2/files/parse

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: c12e9f63-8582-40ee-944a-89c95461be43
sec-ch-ua-platform: "Linux"
bx-umidtoken: T2gA-F7-NtX0oJ7fc8j2AXpWeibAr8qrBE9m_I79lwOS-5cvaVllreRf_m4gufG6MIw=
Referer: https://chat.qwen.ai/
Accept-Language: en-US,en;q=0.9
Timezone: Mon Sep 14 2026 09:49:33 GMT+0700
bx-ua: 234!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
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Content-Type: application/json
Version: 0.2.91
bx-v: 2.5.37
```

**Response Headers:**
```http
x-request-id: c12e9f63-8582-40ee-944a-89c95461be43
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Content-Length: 126
Date: Mon, 14 Sep 2026 02:49:33 GMT
Content-Type: application/json
vary: Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "file_id": "7c926139-b1a8-42d0-b77e-c75528934b6d"
}
```

**Response Body:**
```json
{
  "success": true,
  "request_id": "c12e9f63-8582-40ee-944a-89c95461be43",
  "data": {
    "file_id": "7c926139-b1a8-42d0-b77e-c75528934b6d"
  }
}
```


---

### `POST` https://chat.qwen.ai/api/v2/files/getstsToken

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 16f1071d-a1c4-45cc-8d57-d22161ae9ebb
sec-ch-ua-platform: "Linux"
bx-umidtoken: T2gA-F7-NtX0oJ7fc8j2AXpWeibAr8qrBE9m_I79lwOS-5cvaVllreRf_m4gufG6MIw=
Referer: https://chat.qwen.ai/
Accept-Language: en-US,en;q=0.9
Timezone: Mon Sep 14 2026 09:49:31 GMT+0700
bx-ua: 234!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
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Content-Type: application/json
Version: 0.2.91
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
x-request-id: 16f1071d-a1c4-45cc-8d57-d22161ae9ebb
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Date: Mon, 14 Sep 2026 02:49:32 GMT
Content-Type: application/json
Vary: Accept-Encoding, Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "filename": "ba1-thanh-toan-hoa-don.md",
  "filesize": "4451",
  "filetype": "file"
}
```

**Response Body:**
```json
{
  "success": true,
  "request_id": "16f1071d-a1c4-45cc-8d57-d22161ae9ebb",
  "data": {
    "access_key_id": "STS.NZq7R616SBLdVK3LqUwkNhdfM",
    "access_key_secret": "4R4wk7VBBzQrJuZ3woqzCnGagbBZ4W7fyMBQgem4DWDA",
    "security_token": "CAIS0wN1q6Ft5B2yfSjIr5nEfOiC3Oly9Y6PVG2CqHEAe+Rih6HNrzz2IHhMeXZqAuEcs/8znGlU6/gYlqRtT6h+SFffbMx24plJqYFVqBIg557b16cNrbH4M9f6aXeirna7AYjQSNfaZY3iCTTtnTNyxr3XbCirW0ffX7SClZ9gaKZwPGy/diEUPMpKAQFgpcQGT424V5CXPwXtn3DbAWdxpwN4khkf06mkxdCG4ResZTSY3eYevNb2OYP2LZsubo5gXtHww+F8a6uEyDRX518X/vov1/YV8nKc4IDERgUIu0zDY+SO+ZgzIVJyPKU2FqQe9fa7yvYp4LKKzNWywU9EbaQJCSiHAYr/n8aBE7z0a4xpJO2nMSrB5dqGb9zpswoiYTcHMwpMPtomIzp8DhpqTz34Uvb/pw2bOVz4EvDegPpri8FPog+2rYbQFT+mWK6E1CsUAJg4Yn4zOgQetW6bKfdeLlMWKAI9Wu3JFdwvMU4Es8LytAjVTTZsw29HdH4H+XhvJsn1AKCIvfIuueJ1DPwuOHv32MQkbcnnXOt+webx+0yybAVnQ6qUqd7jzqzaaoWtAcscwTZhSiuajEmuIjhrQEO8mJtNIDT39ayoLMqzovsIeBqAATC0XgDGLHCdyV3l2A1KewU/eyhAr1AXJM2ZnDlrljnPHHmuZ1jV66vOQrREEUIF6phAyAWB45hYcNfaApZLLTRZqK1K9sbllmj5TtdJlwISIhTABsvOZhXyIMRtxyQYLKgfmNZkCGm3gSvWrKhxfOpemswEUylEnUq0Oy77d0A7IAA=",
    "file_url": "https://qwen-webui-prod.oss-accelerate.aliyuncs.com/5b51329c-3691-4101-8f2c-4e5c2edeb21f/7c926139-b1a8-42d0-b77e-c75528934b6d_ba1-thanh-toan-hoa-don.md?x-oss-security-token=CAIS0AJ1q6Ft5B2yfSjIr5r9JfjGjL0V3IC7cFTIolY7QslWvoH7kDz2IHhMf3RvBeAbs%2Fs1lWBZ7vwflrN6SJtIXleCZtF94plR7QKoZ73Zocur7LAJksUGw5QD6kKpsvXJasDVEfn%2FGJ70GX2m%2BwZ3xbzlD0bAO3WuLZyOj7N%2Bc90TRXPWRDFaBdBQVGAAwY1gQhm3D%2Fu2NQPwiWf9FVdhvhEG6Vly8qOi2MaRmHG85R%2FYsrZN%2BNmgecP%2FNpE3bMwiCYyPsbYoJvab4kl58ANX8ap6tqtA9Arcs8uVa1sruE3eaLeLro0ycVAjN%2FhrQ%2FQZtpn1lvl1ofeWkJznAJW0o2rsz001LaPXI6uscIvBXr5R%2FubuOccO9KvG4DWfBomw24j%2FiK%2FAAe8KayYWJ1VFYVrBEYys81vhCQzAQJPO28xYnOQzoRyGktTiMNY9B%2BrxuU4agAG02UrBe%2FC4mtWjcsEyIXC1%2FJe7FqNv3C0uHzVrhEUgjeif%2FNX4Docr%2FVdv2jMm4rpTs9Mc1guXrGWDgSwpi%2B%2BF640dbtT0hPLfWXpx7ydGMe0UxkYXY31KcN6DdSU65q5og7z7OGtLJ7t1dG5myL3mHCuZA893aSVdz0kWQO0D3SAA&x-oss-date=20260914T024932Z&x-oss-expires=300&x-oss-signature-version=OSS4-HMAC-SHA256&x-oss-credential=STS.NYHnBrab4kBPrryFVnNFzQDPr%2F20260914%2Fap-southeast-1%2Foss%2Faliyun_v4_request&x-oss-signature=3805fe6dd8c4cff2023fcba9a1b045a62411a428102e9c7b7590bb464c7138c3",
    "file_path": "5b51329c-3691-4101-8f2c-4e5c2edeb21f/7c926139-b1a8-42d0-b77e-c75528934b6d_ba1-thanh-toan-hoa-don.md",
    "file_id": "7c926139-b1a8-42d0-b77e-c75528934b6d",
    "bucketname": "qwen-webui-prod",
    "region": "oss-ap-southeast-1",
    "endpoint": "oss-accelerate.aliyuncs.com"
  }
}
```