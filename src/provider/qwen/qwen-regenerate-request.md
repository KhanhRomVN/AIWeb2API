### `GET` https://chat.qwen.ai/api/v2/chats/?page=1&exclude_project=true

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: f83496b4-02c1-4655-90de-322baf7059fd
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:28 GMT+0700
bx-ua: 234!gP6eKFeReePWSF6EniVLufJwzIAqwKzkWPV1mcGLuiqGP6OfmjWMnVjHd0eyhfRknx8ZQxoTZSkjNKdSJgD+yEO9Rn+8jnHPaJQOYEJ5GLR+oGbnxJ+b4ivPPRm+1SgJhR3tfKhzlvZrOhdtTQx3YrKba09UYIffRJIs8s8duwnatxr7I4d1uo+BVet/rloZQppvc2hTnJWTrmJ3PGuuSZET3ATtinZZQkp/cs4Tn3o6QQyNg4+0OVmd9iJXhIoZQppvrQ5IXZo6QCyNhsrAZ3UT31JThLZZQks/c24HelodOQ4DGxr4Z3wTd1JThqLZbLs/gsdHjPWKOQvmhsrkefwd9iJTCvnZQks/grhH1eWVOOJNCs54Z3wd9id7CI6eQpsvcsc2ePRcQCymhmkqwpim9Ad7hnoZQkpvgtBnbByLQCbthxtZnZwK9idThpoZMkHqc2WwflZaQaNNhxkZn3wH9iJ7ieIZndsDaSwXa/maP0d/hxkZZ3Ud913c355eQpsucv6MZ3oHQQVm8JMZukeRyZuagiWCUP4+EwnpawbuhKlwrj6qaPfudOcAaAX84gGuNFrx5eYwO34aT1sSAbRcF7B9cjJlfXFztquyaVrrX9y9tFuLPd/T18cA5iDAWhCcTVnycPVu53I9XILE+s6uiI5aEi48sYLweocR6WUOgeVAzz8YutJkggVh+agHXBjR48cga/iyPEj0cvtboO66OnboratVZGANck7ZEb/wLWXX+FuxLfSTR9kmnwB88xflDfwB9Aory4JDTg0zLxcFoHOuFARu0Y2VtNbRVbr5bjaOg+n2hi/qlHdl0EPlE9iwJTJu+QXWq8WoZ2p40DlrIybPdCySC6aGSPboQksrF0lKfF6TG0ezxXZAnqBhf86ivXpNeRuCCh0GehsUQ2kSxXMVUYNWBqYlwoGGwB+GYplHlKLv3WBIv9rwYnKruEkmOesWQsxpq7+Nsw68GdFShY2+jtGw0fKk17g+KFvM/dPFDjT9sAVNi83jrWS3kpDehbC4cCe+S1CKHOCH9hZ6xIWdnwZrrA3VAmylEt/hYgSP0tWlNfXbnZLPM1xyT1oCR2p9dI0uG6Kigb8wBghpvrU+OBeKK9QAJ1pZLmnVsKmGKpCmph7s9XHg1aYgvE78chu/p5CY1zt2Xkdn1xIpoe6CStFePQDVBvoIVbNG44/GpwCuVjtNJ+ocG5VHxUi+BrfE4rBVDNqcY78vsfPUBKKqX2c24HphUOXLr3XgUVl0+ddQVt6Q4gz7FuVa+HSRr15McGTK+fc7B52mfkT2TK4Cf5qaOEyWcJxO+zlnNO7ChIczWRbyYH1GosOpo2VOiI2wcUigIg70TlxLJBY/FoyiCFq2LASJK9hDupNZ/6tmrLb/kIK5QGahjLpHIcSHAhgAfceCLL5FJEgovdSwcy+173a/4+PgDgu0PDZwUY4A15+LBhvK/rg1gNMJaX/Bnh9Sh6UteuFPEFpHwFdnHW9U5IOi3BJim4FHEqm6j6Uw1GxUwpR7wTevi86pCarbSkj5Ps26ChO7QWk8rgo6Y5TeJY1dGN4Fw31rjO70NPfNlaSdT09agBey2UyuQaFOtwNctETAZ2BczqZDLdHdZt+h57l9SpBuEKbOV8VcJR9FHGoM43KSa2uUkXeSSJMpaT+a9qPHpjk6aRk2GMIWuZHXM2J5E8J942lo9AUW+JFhtMR6niXRGwIyeSGMQXnqv7HghBpzYWTkebOXHIzPXa8kTUbANPNv/Yix28N08rMc0zDYKsGRZ89zuwB+id2j891KwnAPCNtPbzQ2dDXKP8YkZqTK7vqyqxh2dKbv7whOHsvHrpSzItuKG+/7UWjjECK2/cPJSKrpzgoBf46TXYtiJ5+v/FHiopYD26qqTo2pqHB36cwDsTE+WSmj2VLWT6TN
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: f83496b4-02c1-4655-90de-322baf7059fd
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Date: Fri, 25 Sep 2026 17:12:29 GMT
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
  "request_id": "f83496b4-02c1-4655-90de-322baf7059fd",
  "data": [
    {
      "id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
      "title": "Xin chào",
      "updated_at": 1790356346,
      "created_at": 1790356321,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0029955b-e5bf-455e-9b40-2a6f7ed3af49",
      "title": "Chào Khánh",
      "updated_at": 1790352711,
      "created_at": 1790352703,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "19a31829-d790-4da9-a473-94c295419b03",
      "title": "Xin Chào Khánh",
      "updated_at": 1790352521,
      "created_at": 1790352514,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c3dc5d1e-1dcd-44e1-a157-73e3c29e6e1e",
      "title": "Lời chào hỏi",
      "updated_at": 1790351688,
      "created_at": 1790351680,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3cbd4049-aa31-4d57-bb8c-fb5e032e427b",
      "title": "Xin chào",
      "updated_at": 1790351636,
      "created_at": 1790351624,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "dd508aef-6124-4f80-bb9e-50070e602021",
      "title": "Debug HistoryCard Conversation Title",
      "updated_at": 1790342102,
      "created_at": 1790339770,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cdfcd7ab-659d-43eb-b2f1-4e377af85796",
      "title": "Tool Validation and Error Prevention",
      "updated_at": 1790341158,
      "created_at": 1790341153,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "83238147-19cb-4b31-86aa-12e6a7aee767",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340895,
      "created_at": 1790340755,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d4681ae3-5d32-497c-8866-43e94cdf0f22",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340579,
      "created_at": 1790340575,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "50ca12d4-03d6-4396-b13b-c5e37a0aec1c",
      "title": "Hello World 1",
      "updated_at": 1790340313,
      "created_at": 1790340308,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "42816896-4803-402b-a58e-9fad3b754d33",
      "title": "Debug Conversation Title Logic",
      "updated_at": 1790339686,
      "created_at": 1790339679,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ae86772e-7ab4-4c2c-af6f-c15b1127d6ba",
      "title": "Phân tích ảnh màn hình AIWeb2API & Zen",
      "updated_at": 1789527160,
      "created_at": 1789527145,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "09d664da-f78d-49cb-a169-b96612d95895",
      "title": "Kiểm tra giới hạn 500 HTTP trong RequestTable",
      "updated_at": 1789467240,
      "created_at": 1789467141,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3d393805-1f74-452e-9903-10828b8d9e75",
      "title": "Chào hỏi",
      "updated_at": 1789460029,
      "created_at": 1789459974,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a0e5716c-0098-45a9-ba4e-9f8da8b81060",
      "title": "New chat",
      "updated_at": 1789441239,
      "created_at": 1789441239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c73e41a0-bc5e-4442-99a7-aa0dabb173ca",
      "title": "New chat",
      "updated_at": 1789440777,
      "created_at": 1789440777,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "54e24535-335a-4d4b-ba14-5754b327112e",
      "title": "New chat",
      "updated_at": 1789440448,
      "created_at": 1789440448,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "650daf0d-1077-4b9c-b1be-73bda604fc9c",
      "title": "New chat",
      "updated_at": 1789439808,
      "created_at": 1789439808,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af6d12f8-7e2c-4abf-b175-a4d6f78c419f",
      "title": "Chào mừng đến Qwen Studio",
      "updated_at": 1789439381,
      "created_at": 1789439378,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8e584b88-7fea-47a1-b9db-839a1aec4468",
      "title": "New chat",
      "updated_at": 1789439271,
      "created_at": 1789439271,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d16544fd-943b-41e0-89b0-eeb0cf62677a",
      "title": "New chat",
      "updated_at": 1789438572,
      "created_at": 1789438572,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3669401b-c263-4ed5-a812-6bb077ddeb1c",
      "title": "Phân tích ảnh",
      "updated_at": 1789437663,
      "created_at": 1789437654,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ebb074af-a8f8-41c1-bbe3-81bf32833d25",
      "title": "Hỗ trợ Người Dùng",
      "updated_at": 1789437635,
      "created_at": 1789437613,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f6d0dff8-40a4-4ceb-b04c-f8b595f523d5",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434543,
      "created_at": 1789434440,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0c456796-0aac-415a-b140-ad854f59f429",
      "title": "Chào hỏi",
      "updated_at": 1789434383,
      "created_at": 1789434351,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cf8d45a9-781d-4bec-9670-b845702e6117",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789434180,
      "created_at": 1789434165,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f4e7562c-b48a-4d56-9025-817ac537ae4e",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434127,
      "created_at": 1789434106,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af8b33eb-c806-4424-a36d-6e8f1868f83f",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434027,
      "created_at": 1789434015,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "1d6a80dd-3f8d-4e3e-9080-b8ae1bcfd175",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789433962,
      "created_at": 1789433951,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "39162210-746d-448e-9c0b-5101b2687c87",
      "title": "Chào hỏi và giới thiệu",
      "updated_at": 1789433903,
      "created_at": 1789433901,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "32341c1b-ee7b-45c6-ae5c-88abc7c00a03",
      "title": "Upload ảnh qua API",
      "updated_at": 1789433246,
      "created_at": 1789433159,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8323e8c0-57d6-46be-b5f6-cb50f8bd8aab",
      "title": "New chat",
      "updated_at": 1789397343,
      "created_at": 1789397343,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "98ce7eab-bf35-4c4f-8094-5763b40e29f3",
      "title": "Tạo thanh tìm kiếm và đổi tên drawer",
      "updated_at": 1789390355,
      "created_at": 1789390077,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a9ae70e2-3450-4cab-a15b-9cb1bb562562",
      "title": "Thiếu biểu tượng tìm kiếm trong thanh tìm kiếm",
      "updated_at": 1789390032,
      "created_at": 1789389643,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e34a8f51-8664-4e40-9f8a-a85226b50d21",
      "title": "Chào hỏi người dùng",
      "updated_at": 1789384965,
      "created_at": 1789384957,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e9bb321a-ea7a-4412-bfd3-b2b0eb810ba5",
      "title": "Chào hỏi",
      "updated_at": 1789384646,
      "created_at": 1789384641,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6cd80d0b-c758-4c72-8990-36c8a00b6004",
      "title": "Chào hỏi",
      "updated_at": 1789383967,
      "created_at": 1789383962,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "b879c3e8-351d-4aae-a09d-d8f7de7c0e70",
      "title": "Chào hỏi",
      "updated_at": 1789383837,
      "created_at": 1789383833,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0ec40fd1-e8ef-400e-8ae5-07023924d416",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789367644,
      "created_at": 1789367533,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "df59c414-420f-4ecd-a2a4-207f55e27dea",
      "title": "Sửa lỗi TypeScript trong Kimi SSE Parser",
      "updated_at": 1789367078,
      "created_at": 1789366593,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0cd7a2fc-9f7f-492d-807e-90af3508dae1",
      "title": "Tách file parsing theo provider",
      "updated_at": 1789366492,
      "created_at": 1789365849,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0bc85f3c-916d-4bda-8f7e-2debc6f9c8e8",
      "title": "Chào hỏi",
      "updated_at": 1789363389,
      "created_at": 1789362698,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c77315b7-f395-4a22-aa63-4101765fbf13",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789362202,
      "created_at": 1789361784,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6b383af8-490b-4bbb-8916-de60907f8fa0",
      "title": "Chào mừng đến với trợ lý",
      "updated_at": 1789361753,
      "created_at": 1789361588,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "614829f6-576d-44f4-ab33-1923b6f2dc1a",
      "title": "Chào hỏi",
      "updated_at": 1789361245,
      "created_at": 1789361239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "07817394-2f85-493a-b2dd-40ad9d4ea1c9",
      "title": "Chào hỏi",
      "updated_at": 1789356560,
      "created_at": 1789355910,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "85b55dc0-3b52-47aa-8605-9cf717877ce7",
      "title": "Chào mừng Khánh",
      "updated_at": 1789356407,
      "created_at": 1789356405,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "48ca7a45-00ff-4095-9fc8-475b5b518dd9",
      "title": "Upload File và Hạn chế Công cụ",
      "updated_at": 1789354573,
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
    }
  ]
}
```


---

### `GET` https://chat.qwen.ai/api/v2/chats/pinned

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 2560ed92-2bfa-4ffc-bd45-33b4a240ab40
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:28 GMT+0700
bx-ua: 234!gQJeKFeGeePWbG6QniVLufJwzIAqwKzkWPV1mcGLuiqGP6OfmjWMnVjHd0eyhfRknx8ZQxoTZSkjNKdSJgD+yEO9Rn+8jnHPaJQOYEJ5GLR+oGbnxJ+b4ivPPRm+1SgJhR3tfKhzlvZrOhdtTQx3YrKba09UYIffRJIs8s8duwnatxr7I4d1uo+BVet/rloZQppvc2hTnJWTrmJ3PGuuSZET3ATtinZZQkp/cs4Tn3o6QQyNg4+0OVmd9iJXhIoZQppvrQ5IXZo6QCyNhsrAZ3UT31JThLZZQks/c24HelodOQ4DGxr4Z3wTd1JThqLZbLs/gsdHjPWKOQvmhsrkefwd9iJTCvnZQks/grhH1eWVOOJNCs54Z3wd9id7CI6eQpsvcsc2ePRcQCymhmkqwpim9Ad7hnoZQkpvgtBnbByLQCbthxtZnZwK9idThpoZMkHqc2WwflZaQaNNhxkZn3wH9iJ7ieIZndsDaSwXa/maP0d/hxkZZ3Ud913c355eQpsucv6MZ3oHQQVm8JMZukeRyZuagiWCUP4+EwnpawbuhKlwrj6qaPfudOcAaAX84gGuNFrx5eYwO34aT1sSAbRcF7B9cjJlfXFztquyaVrrX9y9tFuLPd/T18cA5iDAWhCcTVnycPVu53I9XILE+s6uiI5aEi48sYLweocR6WUOgeVAzz8YutvktoVce9gHXBjR48cga/iyPEj0cvtboO66OnboratVZGANck7ZEb/wLWXX+FuxLfSTR9kmnwB88xflDfwB9Aory4JDTg0zLxcFoHQywVGSosTn3y9wFIq7BoI9L9Qw8xkuIW+ID6Apr4dELYawcRjejoSgTV6MeymCtnOTxTxzz/MRN1ChUeFGDSKF+68Se9Ls0u1R0MAqFIXEOb3eXhE4Ay9LfqgVBK3teJFLXsvHHb9Mo9XInAk5qLmocmiMvP+AuChyg3YiiG8KD16VA9AzjY+5mJczdzrTzV0xt7hl/TLM2VN/VdMMVde8Iq8crHQsDPE5zVnp5b0leZgDU9yb5gFX6b4nKWWaXFLnFAtSpqgWH8dSBy+X1VZbbJ4Aqe/66b7x+aJaQBoAxJ9MzCY6HWCKpVaFmH52XGZk2yH4i++89yh5t4azUHhDUzpC3ds4tZXU55Ngpoo5oO+H7MKE0D9I1+cCh3QvmfLkYnIo8Tr9jefoLc2tjV4mdnvxTa8If915CwS9OVoQYTZISxwMOygnPBgEan74O5UyGQXpipNitEEoDJIDGG3LRGEEHpaorcCL2oHBHxm/2qn7MEZ3Vy4AKN9TxlAXMpdyOvqnywdITAjtg3Pi95tOx+DXzUHQpFcli8lPdUjHm/ccmKnOEwzPchuDpb9ep+9HlnvitbYwTjQvW69tGzzWcbx4ViB7hj4LNVcZj1BI22UT9joYSJV3oD9SA/GQuB8OfRD7DF1WgO75Wy9P9tMOWWHOegYtaYS+daZbxLRB8xLBP8PDEilF4ImuzRX6jr5cytR7BnTOhIQhF86XansHL35RLqKbNBzujxJUAfJSXB7S7v9AQQDgxD+Pl2UyJmpgFSb8drg17LmbPLDUl9i5k2RoPnSL6u/Jnslrw/QdOAbL1sVFp7FydhSIf0LleygLWWnvhs/zyAoRPwYxRFC9+tHmdHzzCb5vBohFzJyR19Fk79B+gcPGNXzFtqDT7QdzD+BveutXfUmfGSEO8dpKHh9t+J1QCDZSQ0bWd+38L6wsd7ahnnYG+cwf1ClmvYGTlOawkLY7AHGOlso5iBzhX08kkr8vxYmsVKp4MoQ6I4ZhLrw8ktLH3cyqGnlflSePR6dUUlxSZt+yTrBRbStn6ez8XqUWiCtYDND8ew2G4TSk/PgWQJ8MXMnzdnWJpZtnKfdk6H7yPgr9zdToCBBpDfAu32krRtQ17Otv
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
X-Robots-Tag: noindex
x-request-id: 2560ed92-2bfa-4ffc-bd45-33b4a240ab40
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Content-Length: 78
Date: Fri, 25 Sep 2026 17:12:29 GMT
Content-Type: application/json
x-frame-options: SAMEORIGIN
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "success": true,
  "request_id": "2560ed92-2bfa-4ffc-bd45-33b4a240ab40",
  "data": []
}
```


---

### `POST` https://chat.qwen.ai/api/v2/chat/completions?chat_id=004c84c5-6e71-4510-ad21-f41a08bf8373

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
X-Request-Id: b548c11f-4f36-4b06-8fc2-5770f8c0a030
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
X-Accel-Buffering: no
Timezone: Sat Sep 26 2026 00:12:26 GMT+0700
bx-ua: 234!gtYeKmOteePWf0vv81U1/SOwzIAqwKzkWPV1mcGLuiqGP6Ofmiyk0HpVPiIiGE68K9d9PeuKbuEWUSve+gDuvO/08kd4Ujs9jiN29RHevpzTehE8RQ6SwQzjlYIRI3sS0uuoy1ytZmpu11rgBy/ka26dljCwFQsBqcwQig/dy2hXj7NEY6R4Vet/lloZQppvc2hTnJWTrmJ3PGuuSZET3ATtinZZQkp/cs4Tn3o6QQyNg4+0OVmd9iJXhIoZQppvrQ5IXZo6QCyNhsrAZ3UT31JThLZZQks/c24HelodOQ4DGxr4Z3wTd1JThqkZXks/gsdHjPWKOQvmhsrkefwd9iJTCvnZQks/grhH1eWVOOJNCs54Z3wd9id7CI6eQpsvcsc2ePRcQCymhmkqwpim9Ad7hnoZQkpvgtBnbByLQCbthxtZnZwK9idThpoZMkHqc2WwflZaQaNNhxkZn3wH9iJ7ieIZndsDaSwXa/maP0d/hxkZZ3Ud913c355eQpsucv6MZ3oHQQVm/eJHukeRyZuagPDCUP4+Ewnpa4HQPKhpH1qTPbXcSJOSg7D2WaCc+jvbEPYBB3baJ1VFA+FzgZpAgAY5a9yuUFrqEeNP8va7e0pXpWDsS6gSaAe2fHGuOZcTzbU2iixIeq13uks3+j9YQLE1mBaXBjk17jSrD4Gvn19A/npllkkEnU+1vlMVqAT6I0/frfNfO315QqjDNPCjuNRuczONDIywszdNcn5vmqtNFY5r99F020p8ihCAw3I4a/S2O3FngotCdNaxBLnDYvjapKzQ12uYMloLbdfhIs9ab6ahYDi8K795Sj2BCSpuNuIfhdLhqK6EkNBmgbm6MemwQ/GPhfva50JJQ68cvnXyMP9MoIwTJh0d41Fas62fEYSuAJzbYyaPDChZmOuNsy4M6B0XFhlrQijaYTEGijoGtVDgsq2wFUaPHRqjK7eglCwJSWOowgLTMB9sZip5pK6kFCKKewiM7KIcOOxhSZsdjodyc8w0LS71uU/UnHgXUcVm0YHJgF8wmTTaGDhLfITkG4WZiiItvtEQukKl4GIj+8QLV8bargenhLRFfv+6x/Dt0b8VLRZfRre11znHnJ7F8CyCRhrcEyIcoNrPqOPT9ykT1HfTBW5kP91TPd0zQLfqpKtuQMVlsZHp0DSd1ZQGueVnr97OgNRMpeIz+CQTNK68OcN86JyZt6LFhSVx2KofaqWecbKfLUnYtGkvyT0XLgcP1oonb/jIv1z1MwtvOxXUCYIe+1oDG8Qyq4OQc74HikEtnxrijVKnWzD1lJJV9l5RF1RolJoYGFWBz6ULo8QMzUvcBa8xmrN7WrM/LitAjQMWE6DJ481VAmrYHAckxNkm7JNiBnFL5voLTKQJDgpE4+5n9wGMdRYXzHpkpBniVKZ13M0zLywvD6t6+0Yrmp18o/ufr1XFvQmshTfdCVDMQ5oTnoC1a+FmYmIOVA+DMCbs00+Z3sXzF7bUGZCjRmBPcO+7mAovKrfvHpE2Ni1gC1q/Z6xwUHTlcabzOUdn8TeEmU9luQUewmkRp+6Fod7RdrGqTQIjhsyyfuocjQNGOFvYwwI7NuA6V/H7uSwemlluFCW33FcrOywBDGF5D02BYT6ZnWtqXp6PCa4xweoLWNWdPQ+cI+GoWZrjs2oEb+D+f/eakAx29OtgALmztvC+Q/Hd4UneCPlCsodWOihttKR1nS/CEOYqnybX8xB8DOafUyTW2frfkEb674L/oLhRTucIKLNHYF4KKvTiJMGarYo/tRdXNqBKIpxNo68yxr8O3ZIziM1RgSQtFFQvHLZHFiq8yX/uMlm8oQ04kJyk
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
Accept: application/json
Content-Type: application/json
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: b548c11f-4f36-4b06-8fc2-5770f8c0a030
cache-control: no-cache
Content-Encoding: br
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Date: Fri, 25 Sep 2026 17:12:27 GMT
Content-Type: text/event-stream; charset=utf-8
Vary: Accept-Encoding, Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "stream": true,
  "version": "2.1",
  "incremental_output": true,
  "chatId": "004c84c5-6e71-4510-ad21-f41a08bf8373",
  "parentId": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
  "chat_id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
  "chat_mode": "normal",
  "model": "qwen3.7-plus",
  "parent_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
  "messages": [
    {
      "id": null,
      "fid": "5c9eaf1e-40d7-458b-bcf0-1c41ae59a7f9",
      "parentId": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
      "childrenIds": [
        "efae7940-2811-4ad1-be54-b6c8d86e3963"
      ],
      "role": "user",
      "content": "xin chào 2\n",
      "user_action": "edit",
      "files": [],
      "timestamp": 1790356346,
      "models": [
        "qwen3.7-plus"
      ],
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
      "parent_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3"
    }
  ],
  "timestamp": 1790356346
}
```

**Response Body:**
```
data: {"response.created":{"chat_id": "004c84c5-6e71-4510-ad21-f41a08bf8373", "parent_id": "6d612b15-9a52-4b3b-879e-0b72c911761b", "response_id":"90fdc166-7ef4-41aa-b969-b99cbdfec0cd", "response_index": "0"}} 

data: {"choices": [{"delta": {"role": "assistant", "content": "X", "phase": "answer", "status": "typing"}}], "response_id": "90fdc166-7ef4-41aa-b969-b99cbdfec0cd", "usage": {"input_tokens": 1047, "output_tokens": 1, "characters": 0, "total_tokens": 1048, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 1}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356348}

data: {"choices": [{"delta": {"role": "assistant", "content": "in chào Khánh", "phase": "answer", "status": "typing"}}], "response_id": "90fdc166-7ef4-41aa-b969-b99cbdfec0cd", "usage": {"input_tokens": 1047, "output_tokens": 4, "characters": 0, "total_tokens": 1051, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 4}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356348}

data: {"choices": [{"delta": {"role": "assistant", "content": "!", "phase": "answer", "status": "typing"}}], "response_id": "90fdc166-7ef4-41aa-b969-b99cbdfec0cd", "usage": {"input_tokens": 1047, "output_tokens": 6, "characters": 0, "total_tokens": 1053, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 6}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356348}

data: {"choices": [{"delta": {"role": "assistant", "content": " 😊", "phase": "answer", "status": "typing"}}], "response_id": "90fdc166-7ef4-41aa-b969-b99cbdfec0cd", "usage": {"input_tokens": 1047, "output_tokens": 7, "characters": 0, "total_tokens": 1054, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 7}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356348}

data: {"choices": [{"delta": {"role": "assistant", "content": "", "phase": "answer", "status": "typing"}}], "response_id": "90fdc166-7ef4-41aa-b969-b99cbdfec0cd", "usage": {"input_tokens": 1047, "output_tokens": 7, "characters": 0, "total_tokens": 1054, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 7}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356348}

data: {"choices": [{"delta": {"role": "assistant", "content": "", "phase": "answer", "status": "typing"}}], "response_id": "90fdc166-7ef4-41aa-b969-b99cbdfec0cd", "usage": {"input_tokens": 1047, "output_tokens": 7, "characters": 0, "total_tokens": 1054, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 7}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356348}

data: {"choices": [{"delta": {"content": "", "role": "assistant", "status": "finished", "phase": "answer"}}], "response_id": "90fdc166-7ef4-41aa-b969-b99cbdfec0cd"}


```


---

### `GET` https://chat.qwen.ai/api/v2/library/list?type=all

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: bc9c72dc-3932-40c2-a545-8239a2ef4f70
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
sec-ch-ua-platform: "Linux"
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:24 GMT+0700
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
x-request-id: bc9c72dc-3932-40c2-a545-8239a2ef4f70
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Content-Length: 119
Date: Fri, 25 Sep 2026 17:12:24 GMT
Content-Type: application/json
x-frame-options: SAMEORIGIN
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "success": true,
  "request_id": "bc9c72dc-3932-40c2-a545-8239a2ef4f70",
  "data": {
    "has_more": false,
    "items": [],
    "cursor": null
  }
}
```


---

### `GET` https://chat.qwen.ai/api/v2/chats/?page=1&exclude_project=true

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 3003bd61-a823-4907-bc3c-75b3e5da9322
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:16 GMT+0700
bx-ua: 234!gcNeKqWreePWXO+xxP4FTWwU48zJRd8FTTr55qiMD9dRYp8rkURejWWxmQQBka4pbAaTaL8j8MRJwubpkuIn+fvg9FMtgZ6tTxEyf27BjlnXNQY13EJKKtJGHsafDj5kDrnv9runCQSkTQYDXypyDTFdxVf5N1x03UVHnfS3kPVwOIqH/9oqaKSx71o4m/VIob8j597KOHI/dlAAebxhZ3oHQQVNhMWZVpti32QeEmFuZL2nc4btZZodQQymhsWZn3TH9iJXPkE7A3s/cAV7Z3oHQQjwd10xZ3Td9iJTCvcZQpkwc247nZodQCyNhsreZ3wTdAyzCvsZQkkUc247mZ09QCyDlxraepmT7idTCvO+/ps/c24HAlodQCyDw2rtefWTM7JHhVsZQks/cs59ZJ+HQCVmhNh+1Xmd9id7d8mWQg3vcs5TZ3odQQVXbD0URiQd9ry7hLoZokq/cs4Tn3ZhnfNNhUWvZ6/dB7J7hnoZQkp/c2tt1ZoZwGyB/aV/Sd/2zwy7hnZZQpsBcwysVP+HzhrIhuPBekUH9Ad7hpNhZ9TJgDl9T1yjsUr+e8rpHTy/fMGxdU5ngTyWSokAJjVRkjAxSzcb57eG4pCT+NvyEVDB1zNSm1YO2HRcF7B9E+XWWgCDC1uSEdCaOvL1J14RPjs2i6vkEAd5a7CzoRcE0PrZadq7+Frjky0tdPliKI+UpAV5eF03Fa7P+7FeAe+1mBaXBjk17jSrD4Gvn19A/nrPFV9XmERrGdnJp4r9obUmN/1RQkbkmqUpHWqIMxuEQvC2O1Vw+pJRhTDtwp5M6nJu6cOO0FYK3QA+k2oI3VQ36as9hQi+9IGS2o6WX93BpMszhgtgKvOBJ6EhadKFFYHRi8QnC3/UegRAvswacxNYVUUaEYrIyM1miyQjkypxvwTAOoQ3LHX3ZH4HO+KZOWH8qKROzlC1cHkc/6mc3qwybE+tK17SVsw/xURlMemJ/5CD5DipDJaQJQUVytwVjT60So1Bav0T1OzEW4VADkDFUdkEyLPbUxNoTBZphhp1LdyEiNJtMGQWreXLqEro37zCN2gpLVogPuzt6frsdd1YpNb4R6OROZqrjwPNG+4QOI0pPr7/F+PX5qFTX+zQwWWJDDiIi48X3wAmNsg/QQD0gmStSN8VDsfKu4QEBjyb7Jgc/SxCviaDQCE4oA2tQ+15DOp2sYUzZsJdSgPYwZvkxOkRlArsVX8OkubQcbk9L5O2ZNGTJCIPWW4j0tGEyOPsCvFRThqc6+llzXkFuRBXde1UKbq1FfGf3sphez8FWWxUN+N5nM8JYWvQVvJdm3ja0vM2hzaAy07X3aGgScGf91di6byF/t11HBr5NQoGuos8rDfdqi0mBxhs8zuEA+a7zXsVIPHDfI/ZOAef/QVwjiI+tn1/kGyVpu55/L87M1QuWNcEOj0inEdczvRfjbnuAA2i+bY6DM66vnWjHIHpm9yVRT08eUUtxHvCVKhk9PS1/ZUsHQRAIvX7yOHZ6xG3OAU0Atdbl6nv9AhvqtBeSxAHS3nMJPqLjPLnf+R/RvyYF2aDkd5Q6BGuLsy+nJajJIu3SUtFpf0e+BeAlcDrPplVIEXxSFfMww9wjOlIOS5SV9M8KYM/ccxmBherhQXymmnqmDJPX8ROoYxib2OPHfG06CpkXdf/EeYhGN7D18j0JHhvlE+oNRkRc0+uyiqHzpXpvVnoq2UmlN/MztEfGTMcOME9aXenMB2soKgPdrNmKMdd1clxrfRmYOgCD/OigHlAbAYn5H8nFZ2le4n6pUW4Qpx5xHaOJ4bEwev1TBVc/Sy9olL9ZHGGBDE/42+1MbDnVqD7HlIoqHIFGakSyNhiAxFkCkl1mMgUrKeF5K/YMMJDl/WjHEfO2Duu5VeIq8bflVqEWMaiMv+917i0girEGLhRA/V1ee==
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: 3003bd61-a823-4907-bc3c-75b3e5da9322
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Date: Fri, 25 Sep 2026 17:12:18 GMT
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
  "request_id": "3003bd61-a823-4907-bc3c-75b3e5da9322",
  "data": [
    {
      "id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
      "title": "Xin chào",
      "updated_at": 1790356331,
      "created_at": 1790356321,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0029955b-e5bf-455e-9b40-2a6f7ed3af49",
      "title": "Chào Khánh",
      "updated_at": 1790352711,
      "created_at": 1790352703,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "19a31829-d790-4da9-a473-94c295419b03",
      "title": "Xin Chào Khánh",
      "updated_at": 1790352521,
      "created_at": 1790352514,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c3dc5d1e-1dcd-44e1-a157-73e3c29e6e1e",
      "title": "Lời chào hỏi",
      "updated_at": 1790351688,
      "created_at": 1790351680,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3cbd4049-aa31-4d57-bb8c-fb5e032e427b",
      "title": "Xin chào",
      "updated_at": 1790351636,
      "created_at": 1790351624,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "dd508aef-6124-4f80-bb9e-50070e602021",
      "title": "Debug HistoryCard Conversation Title",
      "updated_at": 1790342102,
      "created_at": 1790339770,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cdfcd7ab-659d-43eb-b2f1-4e377af85796",
      "title": "Tool Validation and Error Prevention",
      "updated_at": 1790341158,
      "created_at": 1790341153,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "83238147-19cb-4b31-86aa-12e6a7aee767",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340895,
      "created_at": 1790340755,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d4681ae3-5d32-497c-8866-43e94cdf0f22",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340579,
      "created_at": 1790340575,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "50ca12d4-03d6-4396-b13b-c5e37a0aec1c",
      "title": "Hello World 1",
      "updated_at": 1790340313,
      "created_at": 1790340308,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "42816896-4803-402b-a58e-9fad3b754d33",
      "title": "Debug Conversation Title Logic",
      "updated_at": 1790339686,
      "created_at": 1790339679,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ae86772e-7ab4-4c2c-af6f-c15b1127d6ba",
      "title": "Phân tích ảnh màn hình AIWeb2API & Zen",
      "updated_at": 1789527160,
      "created_at": 1789527145,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "09d664da-f78d-49cb-a169-b96612d95895",
      "title": "Kiểm tra giới hạn 500 HTTP trong RequestTable",
      "updated_at": 1789467240,
      "created_at": 1789467141,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3d393805-1f74-452e-9903-10828b8d9e75",
      "title": "Chào hỏi",
      "updated_at": 1789460029,
      "created_at": 1789459974,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a0e5716c-0098-45a9-ba4e-9f8da8b81060",
      "title": "New chat",
      "updated_at": 1789441239,
      "created_at": 1789441239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c73e41a0-bc5e-4442-99a7-aa0dabb173ca",
      "title": "New chat",
      "updated_at": 1789440777,
      "created_at": 1789440777,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "54e24535-335a-4d4b-ba14-5754b327112e",
      "title": "New chat",
      "updated_at": 1789440448,
      "created_at": 1789440448,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "650daf0d-1077-4b9c-b1be-73bda604fc9c",
      "title": "New chat",
      "updated_at": 1789439808,
      "created_at": 1789439808,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af6d12f8-7e2c-4abf-b175-a4d6f78c419f",
      "title": "Chào mừng đến Qwen Studio",
      "updated_at": 1789439381,
      "created_at": 1789439378,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8e584b88-7fea-47a1-b9db-839a1aec4468",
      "title": "New chat",
      "updated_at": 1789439271,
      "created_at": 1789439271,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d16544fd-943b-41e0-89b0-eeb0cf62677a",
      "title": "New chat",
      "updated_at": 1789438572,
      "created_at": 1789438572,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3669401b-c263-4ed5-a812-6bb077ddeb1c",
      "title": "Phân tích ảnh",
      "updated_at": 1789437663,
      "created_at": 1789437654,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ebb074af-a8f8-41c1-bbe3-81bf32833d25",
      "title": "Hỗ trợ Người Dùng",
      "updated_at": 1789437635,
      "created_at": 1789437613,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f6d0dff8-40a4-4ceb-b04c-f8b595f523d5",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434543,
      "created_at": 1789434440,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0c456796-0aac-415a-b140-ad854f59f429",
      "title": "Chào hỏi",
      "updated_at": 1789434383,
      "created_at": 1789434351,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cf8d45a9-781d-4bec-9670-b845702e6117",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789434180,
      "created_at": 1789434165,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f4e7562c-b48a-4d56-9025-817ac537ae4e",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434127,
      "created_at": 1789434106,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af8b33eb-c806-4424-a36d-6e8f1868f83f",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434027,
      "created_at": 1789434015,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "1d6a80dd-3f8d-4e3e-9080-b8ae1bcfd175",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789433962,
      "created_at": 1789433951,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "39162210-746d-448e-9c0b-5101b2687c87",
      "title": "Chào hỏi và giới thiệu",
      "updated_at": 1789433903,
      "created_at": 1789433901,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "32341c1b-ee7b-45c6-ae5c-88abc7c00a03",
      "title": "Upload ảnh qua API",
      "updated_at": 1789433246,
      "created_at": 1789433159,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8323e8c0-57d6-46be-b5f6-cb50f8bd8aab",
      "title": "New chat",
      "updated_at": 1789397343,
      "created_at": 1789397343,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "98ce7eab-bf35-4c4f-8094-5763b40e29f3",
      "title": "Tạo thanh tìm kiếm và đổi tên drawer",
      "updated_at": 1789390355,
      "created_at": 1789390077,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a9ae70e2-3450-4cab-a15b-9cb1bb562562",
      "title": "Thiếu biểu tượng tìm kiếm trong thanh tìm kiếm",
      "updated_at": 1789390032,
      "created_at": 1789389643,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e34a8f51-8664-4e40-9f8a-a85226b50d21",
      "title": "Chào hỏi người dùng",
      "updated_at": 1789384965,
      "created_at": 1789384957,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e9bb321a-ea7a-4412-bfd3-b2b0eb810ba5",
      "title": "Chào hỏi",
      "updated_at": 1789384646,
      "created_at": 1789384641,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6cd80d0b-c758-4c72-8990-36c8a00b6004",
      "title": "Chào hỏi",
      "updated_at": 1789383967,
      "created_at": 1789383962,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "b879c3e8-351d-4aae-a09d-d8f7de7c0e70",
      "title": "Chào hỏi",
      "updated_at": 1789383837,
      "created_at": 1789383833,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0ec40fd1-e8ef-400e-8ae5-07023924d416",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789367644,
      "created_at": 1789367533,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "df59c414-420f-4ecd-a2a4-207f55e27dea",
      "title": "Sửa lỗi TypeScript trong Kimi SSE Parser",
      "updated_at": 1789367078,
      "created_at": 1789366593,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0cd7a2fc-9f7f-492d-807e-90af3508dae1",
      "title": "Tách file parsing theo provider",
      "updated_at": 1789366492,
      "created_at": 1789365849,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0bc85f3c-916d-4bda-8f7e-2debc6f9c8e8",
      "title": "Chào hỏi",
      "updated_at": 1789363389,
      "created_at": 1789362698,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c77315b7-f395-4a22-aa63-4101765fbf13",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789362202,
      "created_at": 1789361784,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6b383af8-490b-4bbb-8916-de60907f8fa0",
      "title": "Chào mừng đến với trợ lý",
      "updated_at": 1789361753,
      "created_at": 1789361588,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "614829f6-576d-44f4-ab33-1923b6f2dc1a",
      "title": "Chào hỏi",
      "updated_at": 1789361245,
      "created_at": 1789361239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "07817394-2f85-493a-b2dd-40ad9d4ea1c9",
      "title": "Chào hỏi",
      "updated_at": 1789356560,
      "created_at": 1789355910,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "85b55dc0-3b52-47aa-8605-9cf717877ce7",
      "title": "Chào mừng Khánh",
      "updated_at": 1789356407,
      "created_at": 1789356405,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "48ca7a45-00ff-4095-9fc8-475b5b518dd9",
      "title": "Upload File và Hạn chế Công cụ",
      "updated_at": 1789354573,
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
    }
  ]
}
```


---

### `GET` https://chat.qwen.ai/api/v2/chats/pinned

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: ce862018-77e2-445f-b62b-11e7233ba965
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:16 GMT+0700
bx-ua: 234!guXeKRZjeePWXzzJxP4FTWwU48zJRd8FTTr55qiMD9dRYp8rkURejWWxmQQBka4pbAaTaL8j8MRJwubpkuIn+fvg9FMtgZ6tTxEyf27BjlnXNQY13EJKKtJGHsafDj5kDrnv9runCQSkTQYDXypyDTFdxVf5N1x03UVHnfS3kPVwOIqH/9oqaKSx71o4m/VIob8j597KOHI/dlAAebxhZ3oHQQVNhMWZVpti32QeEmFuZL2nc4btZZodQQymhsWZn3TH9iJXPkE7A3s/cAV7Z3oHQQjwd10xZ3Td9iJTCvcZQpkwc247nZodQCyNhsreZ3wTdAyzCvsZQkkUc247mZ09QCyDlxraepmT7idTCvO+/ps/c24HAlodQCyDw2rtefWTM7JHhVsZQks/cs59ZJ+HQCVmhNh+1Xmd9id7d8mWQg3vcs5TZ3odQQVXbD0URiQd9ry7hLoZokq/cs4Tn3ZhnfNNhUWvZ6/dB7J7hnoZQkp/c2tt1ZoZwGyB/aV/Sd/2zwy7hnZZQpsBcwysVP+HzhrIhuPBekUH9Ad7hpNhZ9TJgDl9T1yjsUr+e8rpHTy/fMGxdU5ngTyWSokAJjVRkjAxSzcb57eG4pCT+NvyEVDB1zNSm1YO2HRcF7B9E+XWWgCDC1uSEdCaOvL1J14RPjs2i6vkEAd5a7CzoRcE0PrZadq7+Frjky0tdPliKI+UpAV5eF03Fa7i+7sPAe+1mBaXBjk17jSrD4Gvn19A/nrPFV9XmERrGdnJp4r9obUmN/1RQkbkmqUpHWqIMxuEQvC2O1Vw+pJRhTDtwp5M6nJu6cOOJb4s0hDz8s6eEbT36as9hBnQ1IGS2o6WX93BpMszhgtgKvOBJ6EhadKsamn9+Bm897xxk2mGtBS5Gmabbs+FLZ+nQdOTJeSO1CNQFyqhZDWz0JyGL6f+B4sGm0y5SR5XFjBRxbVboPA8JbzxqTpYH9w6xYaIABt3djnM3GSg6n9ocKTYmQnMDIjm4BoiWfu0yNTgLOTFP3wJVCD2oQnkQ0+s+EqfDxuuJhFIM8qWXDRhb40HCjfnCooBu5Mgr40ReXTFLD9+S+aV63JxWlvBfwyQ7m6/hjxTMk3liLFmyP4Fp90+xksPuYMBpVcadL8l1AnX848ouXHq6VlXQzF8eggyQznWXJ7bcROaJK0OTLRMyKFFQkXuLSuMpWK2mOTuV9kwnBi8xvltsr9bqLGYJaDWNJ0ZGg/83YcUxDSXz2kObVHndMUK0MV3Sj3MALSOJa2MfcSdK2oH28xDq5Wls51mDQhT6tWEmcK2E41JqCwXzjgCdFfiK0sM0DUxl4o4vLnFhLQLKfZM6g7isQ8jGsk1+Se446yoYGU7PD3gUS16l7o0wVb/ozcXWwvPxj0NYH/2tuUxEJVbrTjB5Cg6xRydFyEgFAHDfzt0QwpypmtshzLS0IcpUvrnU/Ju27JcnYq07LmZk0H8uNKpET3UqoLGELUiLmJlIrh/jMnjVUJ1hIWD/jYdbnh+JSqWxC02WR8LedZWvuOryJBdjT72MG3u6S3f8Tl1XSRt5R45abNf2gSbOkPNyMuigdV5Q7OUk3FErzxak8QXEyip5j8vxP896VW2B7Xcp1/vlpkhtw6fLfsPnAwGEcL5lrCxHNfkYkega1Vctvl7/nWC8fPBcCRuqs/EQd/kKYCyGhtsTpgJZUM6Y1vT/S7U28FCt9h4IJObuFhrzyFeiRu+Mji73aSTV2W9iD6iu+zhCJTOqECJWlaefBemQhVwL6owyhTN+L97vOrUgBtn95ZzlUHN5p9F6woPrJPO9LpLX8gFa6TqFt8VepV2WpTC6HVqYNbzE1QIPoyB5MJ3WpsUF1AaNnp7WjQwdTpUQ49auiJ96Evn9jyrQilvhW0BasIZA9X1LBEE6UTUv8+qHwkBtjcelHumU+1wIAQw
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
X-Robots-Tag: noindex
x-request-id: ce862018-77e2-445f-b62b-11e7233ba965
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Content-Length: 78
Date: Fri, 25 Sep 2026 17:12:17 GMT
Content-Type: application/json
x-frame-options: SAMEORIGIN
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "success": true,
  "request_id": "ce862018-77e2-445f-b62b-11e7233ba965",
  "data": []
}
```


---

### `GET` https://chat.qwen.ai/api/v2/library/list?type=all

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 8d307a29-8a52-46e4-a990-5a97e927f372
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
sec-ch-ua-platform: "Linux"
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:11 GMT+0700
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
x-request-id: 8d307a29-8a52-46e4-a990-5a97e927f372
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Content-Length: 119
Date: Fri, 25 Sep 2026 17:12:12 GMT
Content-Type: application/json
x-frame-options: SAMEORIGIN
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "success": true,
  "request_id": "8d307a29-8a52-46e4-a990-5a97e927f372",
  "data": {
    "has_more": false,
    "items": [],
    "cursor": null
  }
}
```


---

### `POST` https://chat.qwen.ai/api/v2/chat/completions?chat_id=004c84c5-6e71-4510-ad21-f41a08bf8373

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
X-Request-Id: 370d62ce-d205-45a9-b531-0770f27daf07
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
X-Accel-Buffering: no
Timezone: Sat Sep 26 2026 00:12:10 GMT+0700
bx-ua: 234!t76eKDxgeePW/gn/jP4IJaDq48zJRd8FTTr55qiMD9dRYp8raJgWxwgLtvWQM8kmqotOEUV5oBc3ssEb3v1VK9m3iqp3Tg2D0idD6u9ZerrVm/ajU5fiHp71maQLIt8h3jfnDHeu5YnOWQdlWC+vHMvbXSjZNCCuZ0Kum7bs4J8MNePlqQF/exGGGoHIDf05pRuPVVtvgIoZQppvc2hTnJWTrmJ3PGuuSZET3ATtinZZQkp/cs4Tn3o6QQyNg4+0OVmd9iJXhIoZQppvrQ5IXZo6QCyNhsrAZ3UT31JThLZZQks/c24HelodOQ4DGxr4Z3wTd1JThq2ZMLs/gsdHjPWKOQvmhsrkefwd9iJTCvnZQks/grhH1eWVOOJNCs54Z3wd9id7CI6eQpsvcsc2ePRcQCymhmkqwpim9Ad7hnoZQkpvgtBnbByLQCbthxtZnZwK9idThpoZMkHqc2WwflZaQaNNhxkZn3wH9iJ7ieIZndsDaSwXa/maP0d/hxkZZ3Ud91MC2Y4eQcLQcMcg2P+HQQVmhxWy22UNOARsoNvDAyHUePkbWoOvsUH2XTnfgIWAfVFu+7vqgyhrvdNaW1pb2jDq8ruAgAY5azNqoO5XcVVuBwmfEiIyAT+EVu52E8jOfbGuJRvv5eCurEmM6IkFUrCtgG6AFcQNQl5atF+N/agHXBjR48cga/iyPEj0cvtboO66OnboratVZGANck7ZEb/wgQ9U2NCYmSlw094FetaWWsQE6A9C5yFloqhmRlN7UA7ZSMJB7GWYdcKQyRtPVb+KxlraS90aVO21Kl4Kd/3f1WntwusHgsNlJcggFQ/GQ2bm9Bm5dwaa2Xt36ApXC8toa4nQ97e1XL/hKAwUX40rv/vUd7Z6dtxWyfvKUyOEpqC2VHYNXZaUSFYBRpDty094yS9bl5N4hKyGfY0/t9nRG+M4o6srYWD87r8o8q5/5HBzueDR7H6kCnYp/SX5/mlsAiRITctBb3GF6ZMVV99Af/MHXuQbIhsnjt8MUKcZg7vP+IeIvwHqWqA7YqKTDMc1P9UozpSNcjGrG6qdxSc+I7qGxp1yxJcV75cMmFfPMcmeZN/D6bK4MkFCkjlOy7vzHqtfqcBpGNhIM7CvbIF4Gc2dfs32P/B/5dzYdllw0DAiIrHwR9HcXCBCoi4BA5NDklzXavO3A9yR4adiPELfeIoQT8RtWhwgzsa6kD0b7bh7mqMAx3laVTtEUi4tDmOsRybzVU8KYyHpxs95ULqNYEndLFRzkZuOWcwwAEO/yTph/CQhBFU1GlEiZ+elsrAm/Opez5mXBfQ+YuljhkNgck3kX6U0tQiSdATdQeChCiD2MA3CGIHMZZaKu1VBeQIOqht2BI9fnc9rpGls6ZfAJ1+kC5TPjcdoF4k53xrXKVpmV/dKLFGK9bIOjrL7lnbrLRynFnxwaqinK+/uLswMHyCzaHLLQS4YF3qxQPb7CcmtwJth32c/gc1piehvgkYkoDySzq7ALD+4iXx2lY0YCbfs+aV8O4cyicybF8HEXHH0bjINd0Y4FH2k8PJa6TrebQUAim1mGU15RVV5VlU9nSlRvDRaux2rfc25sdi3OKy+Sp7vnKNudCrZupNm/93wGjFzx4hUgVALqlNrhJsGBx9Vz+cLSHmxIXvtnIy+bmDhmf/OFHcR90e760fvKtU/n0VIg/2h2kSM8reZP0lNuLZLCjD6HOvRbAQDFbwxM4YrXzUJJaPct/RVw0CEIKvgtnkS1ORDqMvSg5mMUXg5X1TsrxbxrmxZgg7AEvLR6ekW5jVSuvzVrXrB3jvmOz2IElHv76pWjPHjz+lbNRUehfw4dM2+ezP1e3lD
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
Accept: application/json
Content-Type: application/json
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: 370d62ce-d205-45a9-b531-0770f27daf07
cache-control: no-cache
Content-Encoding: br
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Date: Fri, 25 Sep 2026 17:12:11 GMT
Content-Type: text/event-stream; charset=utf-8
Vary: Accept-Encoding, Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "stream": true,
  "version": "2.1",
  "incremental_output": true,
  "chatId": "004c84c5-6e71-4510-ad21-f41a08bf8373",
  "parentId": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
  "chat_id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
  "chat_mode": "normal",
  "model": "qwen3.7-plus",
  "parent_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
  "messages": [
    {
      "id": null,
      "fid": "bb7a198b-a30f-4e34-b74c-b0a3e3b98a5a",
      "parentId": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
      "childrenIds": [
        "3be1341e-5275-4215-818e-f2ed360923ff"
      ],
      "role": "user",
      "content": "xin chào 2\n",
      "user_action": "chat",
      "files": [],
      "timestamp": 1790356329,
      "models": [
        "qwen3.7-plus"
      ],
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
      "parent_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3"
    }
  ],
  "timestamp": 1790356330
}
```

**Response Body:**
```
data: {"response.created":{"chat_id": "004c84c5-6e71-4510-ad21-f41a08bf8373", "parent_id": "1796d3da-07de-4e37-84eb-402ccc82e573", "response_id":"db65bfd4-bae0-4f63-a637-6b77c371c469", "response_index": "0"}} 

data: {"choices": [{"delta": {"role": "assistant", "content": "X", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 1, "characters": 0, "total_tokens": 1048, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 1}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": "in chào Khánh", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 4, "characters": 0, "total_tokens": 1051, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 4}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": "! Tôi", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 6, "characters": 0, "total_tokens": 1053, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 6}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": " vẫn", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 7, "characters": 0, "total_tokens": 1054, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 7}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": " ở đây và sẵn", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 11, "characters": 0, "total_tokens": 1058, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 11}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": " sàng hỗ trợ", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 14, "characters": 0, "total_tokens": 1061, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 14}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": " bạn. Bạn có", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 18, "characters": 0, "total_tokens": 1065, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 18}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": " câu hỏi hoặc cần", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 22, "characters": 0, "total_tokens": 1069, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 22}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": " giúp", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 23, "characters": 0, "total_tokens": 1070, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 23}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": " đỡ về điều gì", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 27, "characters": 0, "total_tokens": 1074, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 27}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": " không", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 28, "characters": 0, "total_tokens": 1075, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 28}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": "?", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 29, "characters": 0, "total_tokens": 1076, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 29}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": "", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 29, "characters": 0, "total_tokens": 1076, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 29}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"role": "assistant", "content": "", "phase": "answer", "status": "typing"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469", "usage": {"input_tokens": 1047, "output_tokens": 29, "characters": 0, "total_tokens": 1076, "input_tokens_details": {"text_tokens": 1047}, "output_tokens_details": {"text_tokens": 29}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356333}

data: {"choices": [{"delta": {"content": "", "role": "assistant", "status": "finished", "phase": "answer"}}], "response_id": "db65bfd4-bae0-4f63-a637-6b77c371c469"}


```


---

### `GET` https://chat.qwen.ai/api/v2/chats/?page=1&exclude_project=true

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 04b1c71c-989f-4b5d-b77b-d33f959da344
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:06 GMT+0700
bx-ua: 234!tMreKXndeePWvtv2VV4qm9oF48zJRd8FTTr55qiMD9dRYp8raJ2cg15toCVlsC8MD7c22Nqt6dI8wS97JtGaJmTzOcD3dnfGuKpGrnCvrBuWph2e9sPGnNJ6D8t/glTsJnOrcYwqZRtjZ3c6vMsFqHzbq1iMryUB9ajCe0ax7e8EiwYwrqQcTGhpP30dSX/yVVtv5loZQppvc2hTnJWTrmJ3PGuuSZET3ATtinZZQkp/cs4Tn3o6QQyNg4+0OVmd9iJXhIoZQppvrQ5IXZo6QCyNhsrAZ3UT31JThLZZQks/c24HelodOQ4DGxr4Z3wTd1JThRpZT3s/gsdHjPWKOQvmhsrkefwd9iJTCvnZQks/grhH1eWVOOJNCs54Z3wd9id7CI6eQpsvcsc2ePRcQCymhmkqwpim9Ad7hnoZQkpvgtBnbByLQCbthxtZnZwK9idThpoZMkHqc2WwflZaQaNNhxkZn3wH9iJ7ieIZndsDaSwXa/maP0d/hxkZZ3Ud91MC2Y4eQcLQcMcg2P+HQQVmhxWz2loNOARsoNvD5rHUePkbWoO/aUNMXoWik7N/+/IwJN5vgjYPXEF7EihV2jWMOPuatGvgfXFztqvFkeoB1zNSmFPB+wixBsvSEFQ2wLatYN5jgy5rJdIa+0PmA+Nx8ZB10nyWlTmg6Vub5wEl1Q42dFqJUUJXAecImzjN9VvBe4DAvqfjRaXwYNX/bgw2SkYmVSpHMMTT0pHPvS26YgJNncZSUx4t1K8ej6L2mMKctAYYbln7lRuE4v6PnT6FHtB7uhsencbqIS2DTkCuCJbWyAJW+uGLGKX2zDZM4u6wLdbYWZ2itBJqJV5Yigg6R0Ff4UfZjknuqlVhXz74U4mCKgcpHd0ZypM+/i5LpsMnWdYyQNvPMdErXVYUhfMZqdPA5NAPrfnTDCDDipuq3HTI4csEy5H1uBrAz6JL69hVe6X4l+6EGfAUhki5eSqu3dcyyx4jQEO8GE1lerTt3rgrOsRtH6MqFv+tzWPlJ33sWgLAagybClXt4/twyXW0dwgfILJwkIOxTtwagupnpQ7LL5Rnljhoaw1wnJ17mBpdFjyUXOmrUNJRT7ZJbqtYN9bDCo9fXqtfXCq3tj1wKQMuAJtjamb98zBueXiHvqzP5tLIcGObGeLwhGcIQvHuvg5rcrYtRO+qZf1PIXsMLu6jkzCyPjh9fu2PNg09r2FZJYFGAvGrcrV98NEgh4ax1l8Q7CPARlfpjjOzAfEUqOOVzT7oGPRVR1HTSRo2UUCzw0C4c5mz52VhzK/05YPvSvRIB3UHLhODJoGYSu4mtlSkkQ7vIrI4ZZ7JBnlH46RkNXiT5uYblQ+a9GbEnmEdCxXZQ/e+/fQ3K6aWOi5aV/Xm5QIUA7vwX5ewi+gPXZbiPNIjpVRP/WQdm2DizZ44Hy3HRLC40RDPG86W4M79Lzk1XgAXCaRLJpr0IMegEnuF8lrijz3vwaZxoWugAouehr81nfBKfjDK87DmaiNPptM4VsFvt2J9rQSWETueA5aYya8YlkSneAS27sHzSD7WUNxychmXEb+vdyXV3I6hAfFFKiOH7V6vGKrJ7+RzYnod0VmIx9iqoiL8GrPf2WMgxGxgKC1GeAf6YvJOAV/9Jlc8e9IQ2ldpfTWjHV9GsYc/iyUR1MO4Udpq3IRbUZ1vrKRzBs379oe9MF68XCq0qoFtVnVGshRmz/OHw4sFuHcXAdQ2xW3gpLQYO6VMMNgHKh8O0d3/9wwOCpdcjDFA3T214RABVg3Z2y2Q53j13aPjqP4fOMrUotn3sQS0xB3a3124wehCTr4361yqWV2LFv3KqtDRPtVEEE6=
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: 04b1c71c-989f-4b5d-b77b-d33f959da344
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Date: Fri, 25 Sep 2026 17:12:06 GMT
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
  "request_id": "04b1c71c-989f-4b5d-b77b-d33f959da344",
  "data": [
    {
      "id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
      "title": "Xin chào",
      "updated_at": 1790356324,
      "created_at": 1790356321,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0029955b-e5bf-455e-9b40-2a6f7ed3af49",
      "title": "Chào Khánh",
      "updated_at": 1790352711,
      "created_at": 1790352703,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "19a31829-d790-4da9-a473-94c295419b03",
      "title": "Xin Chào Khánh",
      "updated_at": 1790352521,
      "created_at": 1790352514,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c3dc5d1e-1dcd-44e1-a157-73e3c29e6e1e",
      "title": "Lời chào hỏi",
      "updated_at": 1790351688,
      "created_at": 1790351680,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3cbd4049-aa31-4d57-bb8c-fb5e032e427b",
      "title": "Xin chào",
      "updated_at": 1790351636,
      "created_at": 1790351624,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "dd508aef-6124-4f80-bb9e-50070e602021",
      "title": "Debug HistoryCard Conversation Title",
      "updated_at": 1790342102,
      "created_at": 1790339770,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cdfcd7ab-659d-43eb-b2f1-4e377af85796",
      "title": "Tool Validation and Error Prevention",
      "updated_at": 1790341158,
      "created_at": 1790341153,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "83238147-19cb-4b31-86aa-12e6a7aee767",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340895,
      "created_at": 1790340755,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d4681ae3-5d32-497c-8866-43e94cdf0f22",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340579,
      "created_at": 1790340575,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "50ca12d4-03d6-4396-b13b-c5e37a0aec1c",
      "title": "Hello World 1",
      "updated_at": 1790340313,
      "created_at": 1790340308,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "42816896-4803-402b-a58e-9fad3b754d33",
      "title": "Debug Conversation Title Logic",
      "updated_at": 1790339686,
      "created_at": 1790339679,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ae86772e-7ab4-4c2c-af6f-c15b1127d6ba",
      "title": "Phân tích ảnh màn hình AIWeb2API & Zen",
      "updated_at": 1789527160,
      "created_at": 1789527145,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "09d664da-f78d-49cb-a169-b96612d95895",
      "title": "Kiểm tra giới hạn 500 HTTP trong RequestTable",
      "updated_at": 1789467240,
      "created_at": 1789467141,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3d393805-1f74-452e-9903-10828b8d9e75",
      "title": "Chào hỏi",
      "updated_at": 1789460029,
      "created_at": 1789459974,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a0e5716c-0098-45a9-ba4e-9f8da8b81060",
      "title": "New chat",
      "updated_at": 1789441239,
      "created_at": 1789441239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c73e41a0-bc5e-4442-99a7-aa0dabb173ca",
      "title": "New chat",
      "updated_at": 1789440777,
      "created_at": 1789440777,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "54e24535-335a-4d4b-ba14-5754b327112e",
      "title": "New chat",
      "updated_at": 1789440448,
      "created_at": 1789440448,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "650daf0d-1077-4b9c-b1be-73bda604fc9c",
      "title": "New chat",
      "updated_at": 1789439808,
      "created_at": 1789439808,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af6d12f8-7e2c-4abf-b175-a4d6f78c419f",
      "title": "Chào mừng đến Qwen Studio",
      "updated_at": 1789439381,
      "created_at": 1789439378,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8e584b88-7fea-47a1-b9db-839a1aec4468",
      "title": "New chat",
      "updated_at": 1789439271,
      "created_at": 1789439271,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d16544fd-943b-41e0-89b0-eeb0cf62677a",
      "title": "New chat",
      "updated_at": 1789438572,
      "created_at": 1789438572,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3669401b-c263-4ed5-a812-6bb077ddeb1c",
      "title": "Phân tích ảnh",
      "updated_at": 1789437663,
      "created_at": 1789437654,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ebb074af-a8f8-41c1-bbe3-81bf32833d25",
      "title": "Hỗ trợ Người Dùng",
      "updated_at": 1789437635,
      "created_at": 1789437613,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f6d0dff8-40a4-4ceb-b04c-f8b595f523d5",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434543,
      "created_at": 1789434440,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0c456796-0aac-415a-b140-ad854f59f429",
      "title": "Chào hỏi",
      "updated_at": 1789434383,
      "created_at": 1789434351,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cf8d45a9-781d-4bec-9670-b845702e6117",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789434180,
      "created_at": 1789434165,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f4e7562c-b48a-4d56-9025-817ac537ae4e",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434127,
      "created_at": 1789434106,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af8b33eb-c806-4424-a36d-6e8f1868f83f",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434027,
      "created_at": 1789434015,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "1d6a80dd-3f8d-4e3e-9080-b8ae1bcfd175",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789433962,
      "created_at": 1789433951,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "39162210-746d-448e-9c0b-5101b2687c87",
      "title": "Chào hỏi và giới thiệu",
      "updated_at": 1789433903,
      "created_at": 1789433901,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "32341c1b-ee7b-45c6-ae5c-88abc7c00a03",
      "title": "Upload ảnh qua API",
      "updated_at": 1789433246,
      "created_at": 1789433159,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8323e8c0-57d6-46be-b5f6-cb50f8bd8aab",
      "title": "New chat",
      "updated_at": 1789397343,
      "created_at": 1789397343,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "98ce7eab-bf35-4c4f-8094-5763b40e29f3",
      "title": "Tạo thanh tìm kiếm và đổi tên drawer",
      "updated_at": 1789390355,
      "created_at": 1789390077,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a9ae70e2-3450-4cab-a15b-9cb1bb562562",
      "title": "Thiếu biểu tượng tìm kiếm trong thanh tìm kiếm",
      "updated_at": 1789390032,
      "created_at": 1789389643,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e34a8f51-8664-4e40-9f8a-a85226b50d21",
      "title": "Chào hỏi người dùng",
      "updated_at": 1789384965,
      "created_at": 1789384957,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e9bb321a-ea7a-4412-bfd3-b2b0eb810ba5",
      "title": "Chào hỏi",
      "updated_at": 1789384646,
      "created_at": 1789384641,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6cd80d0b-c758-4c72-8990-36c8a00b6004",
      "title": "Chào hỏi",
      "updated_at": 1789383967,
      "created_at": 1789383962,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "b879c3e8-351d-4aae-a09d-d8f7de7c0e70",
      "title": "Chào hỏi",
      "updated_at": 1789383837,
      "created_at": 1789383833,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0ec40fd1-e8ef-400e-8ae5-07023924d416",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789367644,
      "created_at": 1789367533,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "df59c414-420f-4ecd-a2a4-207f55e27dea",
      "title": "Sửa lỗi TypeScript trong Kimi SSE Parser",
      "updated_at": 1789367078,
      "created_at": 1789366593,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0cd7a2fc-9f7f-492d-807e-90af3508dae1",
      "title": "Tách file parsing theo provider",
      "updated_at": 1789366492,
      "created_at": 1789365849,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0bc85f3c-916d-4bda-8f7e-2debc6f9c8e8",
      "title": "Chào hỏi",
      "updated_at": 1789363389,
      "created_at": 1789362698,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c77315b7-f395-4a22-aa63-4101765fbf13",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789362202,
      "created_at": 1789361784,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6b383af8-490b-4bbb-8916-de60907f8fa0",
      "title": "Chào mừng đến với trợ lý",
      "updated_at": 1789361753,
      "created_at": 1789361588,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "614829f6-576d-44f4-ab33-1923b6f2dc1a",
      "title": "Chào hỏi",
      "updated_at": 1789361245,
      "created_at": 1789361239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "07817394-2f85-493a-b2dd-40ad9d4ea1c9",
      "title": "Chào hỏi",
      "updated_at": 1789356560,
      "created_at": 1789355910,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "85b55dc0-3b52-47aa-8605-9cf717877ce7",
      "title": "Chào mừng Khánh",
      "updated_at": 1789356407,
      "created_at": 1789356405,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "48ca7a45-00ff-4095-9fc8-475b5b518dd9",
      "title": "Upload File và Hạn chế Công cụ",
      "updated_at": 1789354573,
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
    }
  ]
}
```


---

### `GET` https://chat.qwen.ai/api/v2/chats/pinned

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 34d6694a-c2a2-4172-8b9e-f62d3b5e216d
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:06 GMT+0700
bx-ua: 234!tZ4eKXnOeePWfEuqVV4qm9oF48zJRd8FTTr55qiMD9dRYp8raJ2cg15toCVlsC8MD7c22Nqt6dI8wS97JtGaJmTzOcD3dnfGuKpGrnCvrBuWph2e9sPGnNJ6D8t/glTsJnOrcYwqZRtjZ3c6vMsFqHzbq1iMryUB9ajCe0ax7e8EiwYwrqQcTGhpP30dSX/yVVtv5loZQppvc2hTnJWTrmJ3PGuuSZET3ATtinZZQkp/cs4Tn3o6QQyNg4+0OVmd9iJXhIoZQppvrQ5IXZo6QCyNhsrAZ3UT31JThLZZQks/c24HelodOQ4DGxr4Z3wTd1JThRpZT3s/gsdHjPWKOQvmhsrkefwd9iJTCvnZQks/grhH1eWVOOJNCs54Z3wd9id7CI6eQpsvcsc2ePRcQCymhmkqwpim9Ad7hnoZQkpvgtBnbByLQCbthxtZnZwK9idThpoZMkHqc2WwflZaQaNNhxkZn3wH9iJ7ieIZndsDaSwXa/maP0d/hxkZZ3Ud91MC2Y4eQcLQcMcg2P+HQQVmhxWz2loNOARsoNvD5rHUePkbWoO/aUNMXoWik7N/+/IwJN5vgjYPXEF7EihV2jWMOPuatGvgfXFztqvFkeoB1zNSmFPB+wixBsvSEFQ2wLatYN5jgy5rJdIa+0PmA+Nx8ZB10nyWlTmg6Vub5wEl1Q42dFqJUUJXAecImzjNHPvfX4b+vqfjRaXwYNX/bgw2SkYmVSpHMMTT0pHPvS26YgJNncZSUx4t1K8ej6L2mMKctAYYbln7lRuE4v6PnT6FHtB7uhsencbqISbj3wEHdPLzlkuOdfBLgg7yuc7+jCifHuFt6mgzROxju092mpqxFklsWi3iJns8rX46MU1f8zMEFuwgKnb/i4VXJb/mM4rrZdWo0O4wUNecImAca0QorpPDs/od8b8vPaUFXJgHc2bMuRKVn+aqClBxpaZxRZQOl3QwEYSyx/xeBT8OgSoA5E5Ca7KkrE9I6XRhA4u2RwiAvlyVUkyqV2XkVDeHTXTuMcc6zIzOEBsPwbPTlmkMhgmQIMvkLdxVX6puYUyUs3wILAvaUHZOND+3mcZF2WknmrmZMazMimMevbsZnVEsgCNnopMon0pH8NSlshkL5dXcLcL3czF8s78nJZJ8TGm/0fXVUBbuZoljkUBz7tSVBTnyUi/mmy7GoojRSLQY8y8jpRdU2jkHZnkfC7jMAWhJuEDv45mPPt4P7UXur50Qxo3RIIz85OLDWQthKoIe6RgqI+A+qr2XFxcyMM+d9qgLnJLkPjDjJcMFIX7pCn+y4TrFvsKOMoDYtyAJ2aqVE1fYplBEwipgTpkaE8xx1SV75d3bI+2tKX5w6cm89vQpxpZGd2ll5zUAxGUMWgx6dABEpc85kJVhUJMmluru4NZL9dEslvpqyv5dYkKtf5vqiv8OjhBbUcqearMTnpGgpuEmgsC04DkE3jsqoyIqnHfon4mg4NgR1rdHtWs62IJ4Cz6kKpC9uJ4PPtaW++Fxkdb2a1Rs2yln7kVMXd/U5ZrNbBVl7hrT9uMY3/JDeiG6pZMVPRwrIel6sd2X06dV/mfBoXMiug8IaE+zBbXONijqBVRFD7RezZORr/xm/AkJ2KPXIirDhSXnDAeue7mgcM/JaMUUiHALyszI5mJFrs5KCvj/YgXgMrzbTGhmezX1iM7nDV/DniPB9f1vBMjF0eY3U6tHkcEad1HgmUBgap1D/zPI/vxnGc8Hu6CIMVRc114XbHoEGMVwpaMR4H7EPKd9rQt5qQ2KOYqUYkzn7m//59v9aEyLwJ99AeRUKc4M90bbNmEDd48deuCnW7cekYitEo2u
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
X-Robots-Tag: noindex
x-request-id: 34d6694a-c2a2-4172-8b9e-f62d3b5e216d
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Content-Length: 78
Date: Fri, 25 Sep 2026 17:12:06 GMT
Content-Type: application/json
x-frame-options: SAMEORIGIN
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "success": true,
  "request_id": "34d6694a-c2a2-4172-8b9e-f62d3b5e216d",
  "data": []
}
```


---

### `GET` https://chat.qwen.ai/api/v2/chats/?page=1&exclude_project=true

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 9b7c8d8c-129f-410c-bc69-09c40f25199a
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:06 GMT+0700
bx-ua: 234!t6XeKXuaeePWpEpUVV4qm9oF48zJRd8FTTr55qiMD9dRYp8raJ2cg15toCVlsC8MD7c22Nqt6dI8wS97JtGaJmTzOcD3dnfGuKpGrnCvrBuWph2e9sPGnNJ6D8t/glTsJnOrcYwqZRtjZ3c6vMsFqHzbq1iMryUB9ajCe0ax7e8EiwYwrqQcTGhpP30dSX/yVVtpLIoZQppvc2hTnJWTrmJ3PGuuSZET3ATtinZZQkp/cs4Tn3o6QQyNg4+0OVmd9iJXhIoZQppvrQ5IXZo6QCyNhsrAZ3UT31JThLZZQks/c24HelodOQ4DGxr4Z3wTd1JTh1uZTks/gsdHjPWKOQvmhsrkefwd9iJTCvnZQks/grhH1eWVOOJNCs54Z3wd9id7CI6eQpsvcsc2ePRcQCymhmkqwpim9Ad7hnoZQkpvgtBnbByLQCbthxtZnZwK9idThpoZMkHqc2WwflZaQaNNhxkZn3wH9iJ7ieIZndsDaSwXa/maP0d/hxkZZ3Ud91MC2Y4eQcLQcMcg2P+HQQVmhxWz2loNOARsoNvD5rHUePkbWoO/aUNMXoWik7N/+/IwJN5vgjYPXEF7EihV2jWMOPuatGvgfXFztqvFkeoB1zNSmFPB+wixBsvSEFQ2wLatYN5jgy5rJdIa+0PmA+Nx8ZB10nyWlTmg6Vub5wEl1Q42dFqJUUJXAecImzjN9PvOhWtBvqfjRaXwYNX/bgw2SkYmVSpHMMTT0pHPvS26YgJNncZSUx4RkrCHQBFlGKrx8IluI8daVoALMKVudqAeVSqBEP+E35vCgOQ+gyYtASCcHWj0lBT/PuUfR9TezKl9RwBL/6M1oc2qzgk+nCwXds8at0At1Azsh3qlPHE0TyN+nvqPMDBnG6+HKKq1ZlE0BkEmEKDYhGgxvJNAH3LaA/Zt1bj4sKGCH9QUIT2B9elpjTVS+/8UHZsWWIQJOgRPrRRlVdfcQBIiivIZa5FFV4gmWzAabM/6HEW3ZO6CVZ+dO28x6qb9Mnoqeggu0RQby0x1MSQxQCC4ScNPjRNWoLCFnidPh4Hm+vCnEMK8KS7qquLmw3IeoYmXkRs+q4Dj5TqFfID+fg1QH9gccWyOvEX1B6h6XYa125+NKJ0FmVmJJVXKy+MtH4uuGNRoaxS6ZOdAh9Vav01u1lPjGVZerMyYpPsLcvHFO4yFzvr2AEiVvhENRgWZwqzigfrf8fAse29hTj4dEcVQa4ru7x9fftq0YqrZJLscKoOtgEEWRiqbP72vfB6DOJHMV4w5GPN9nzjTu1nt0ng2IPYsV1HvTBkaNffsg4g7PWjfNLXFL/AE7ajPJ4Ge7pdBeUUUxKfZqsvt1KMjLWJ5vkWVtljayl9VUvNH2jtUm4Un71GdO8aFDt/2heU1mEDV7hKkg2gAqsZOnNvEzPljmB3hx+LXabS04h4YSdxyogchUpzM0pcwfaQHZmJVP/a/5hO53KbUApFmXvKERTYftomjWVe96vQqjJcLd0pZ2HRYynCI56J8emgAIOd+5O7CiGJwM9ZcnzrmoPO0150rU0PoNgFAIsScbAPZbCmXaidnKRaa9LBd5Wz8b6oC+3DWdF833UfRHbdVSNNbzr3nA+rSSYLswaqoZUJ4o9DvuECN/gSQp40aXUNGqPOZT+1Y6jOphGuVilK7K4G83Q3xScwCwgpZlWjEicrKqViko0xl3o2uxrY0OktcD+IW+HPCntnS8naJ6YI8G1tJ7AdSw3pYlsqI1fP2jI9MtpfJvBPTOY0oQnhi9mYvFY0DsYJtIUnB0UoclQ7rcOlgnJriyl3+rUoNh1GoFShi/OQqedFgBdJAcvioB8Nf1Yv9YP==
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: 9b7c8d8c-129f-410c-bc69-09c40f25199a
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Date: Fri, 25 Sep 2026 17:12:06 GMT
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
  "request_id": "9b7c8d8c-129f-410c-bc69-09c40f25199a",
  "data": [
    {
      "id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
      "title": "Xin chào",
      "updated_at": 1790356324,
      "created_at": 1790356321,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0029955b-e5bf-455e-9b40-2a6f7ed3af49",
      "title": "Chào Khánh",
      "updated_at": 1790352711,
      "created_at": 1790352703,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "19a31829-d790-4da9-a473-94c295419b03",
      "title": "Xin Chào Khánh",
      "updated_at": 1790352521,
      "created_at": 1790352514,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c3dc5d1e-1dcd-44e1-a157-73e3c29e6e1e",
      "title": "Lời chào hỏi",
      "updated_at": 1790351688,
      "created_at": 1790351680,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3cbd4049-aa31-4d57-bb8c-fb5e032e427b",
      "title": "Xin chào",
      "updated_at": 1790351636,
      "created_at": 1790351624,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "dd508aef-6124-4f80-bb9e-50070e602021",
      "title": "Debug HistoryCard Conversation Title",
      "updated_at": 1790342102,
      "created_at": 1790339770,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cdfcd7ab-659d-43eb-b2f1-4e377af85796",
      "title": "Tool Validation and Error Prevention",
      "updated_at": 1790341158,
      "created_at": 1790341153,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "83238147-19cb-4b31-86aa-12e6a7aee767",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340895,
      "created_at": 1790340755,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d4681ae3-5d32-497c-8866-43e94cdf0f22",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340579,
      "created_at": 1790340575,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "50ca12d4-03d6-4396-b13b-c5e37a0aec1c",
      "title": "Hello World 1",
      "updated_at": 1790340313,
      "created_at": 1790340308,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "42816896-4803-402b-a58e-9fad3b754d33",
      "title": "Debug Conversation Title Logic",
      "updated_at": 1790339686,
      "created_at": 1790339679,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ae86772e-7ab4-4c2c-af6f-c15b1127d6ba",
      "title": "Phân tích ảnh màn hình AIWeb2API & Zen",
      "updated_at": 1789527160,
      "created_at": 1789527145,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "09d664da-f78d-49cb-a169-b96612d95895",
      "title": "Kiểm tra giới hạn 500 HTTP trong RequestTable",
      "updated_at": 1789467240,
      "created_at": 1789467141,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3d393805-1f74-452e-9903-10828b8d9e75",
      "title": "Chào hỏi",
      "updated_at": 1789460029,
      "created_at": 1789459974,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a0e5716c-0098-45a9-ba4e-9f8da8b81060",
      "title": "New chat",
      "updated_at": 1789441239,
      "created_at": 1789441239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c73e41a0-bc5e-4442-99a7-aa0dabb173ca",
      "title": "New chat",
      "updated_at": 1789440777,
      "created_at": 1789440777,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "54e24535-335a-4d4b-ba14-5754b327112e",
      "title": "New chat",
      "updated_at": 1789440448,
      "created_at": 1789440448,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "650daf0d-1077-4b9c-b1be-73bda604fc9c",
      "title": "New chat",
      "updated_at": 1789439808,
      "created_at": 1789439808,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af6d12f8-7e2c-4abf-b175-a4d6f78c419f",
      "title": "Chào mừng đến Qwen Studio",
      "updated_at": 1789439381,
      "created_at": 1789439378,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8e584b88-7fea-47a1-b9db-839a1aec4468",
      "title": "New chat",
      "updated_at": 1789439271,
      "created_at": 1789439271,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d16544fd-943b-41e0-89b0-eeb0cf62677a",
      "title": "New chat",
      "updated_at": 1789438572,
      "created_at": 1789438572,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3669401b-c263-4ed5-a812-6bb077ddeb1c",
      "title": "Phân tích ảnh",
      "updated_at": 1789437663,
      "created_at": 1789437654,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ebb074af-a8f8-41c1-bbe3-81bf32833d25",
      "title": "Hỗ trợ Người Dùng",
      "updated_at": 1789437635,
      "created_at": 1789437613,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f6d0dff8-40a4-4ceb-b04c-f8b595f523d5",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434543,
      "created_at": 1789434440,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0c456796-0aac-415a-b140-ad854f59f429",
      "title": "Chào hỏi",
      "updated_at": 1789434383,
      "created_at": 1789434351,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cf8d45a9-781d-4bec-9670-b845702e6117",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789434180,
      "created_at": 1789434165,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f4e7562c-b48a-4d56-9025-817ac537ae4e",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434127,
      "created_at": 1789434106,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af8b33eb-c806-4424-a36d-6e8f1868f83f",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434027,
      "created_at": 1789434015,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "1d6a80dd-3f8d-4e3e-9080-b8ae1bcfd175",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789433962,
      "created_at": 1789433951,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "39162210-746d-448e-9c0b-5101b2687c87",
      "title": "Chào hỏi và giới thiệu",
      "updated_at": 1789433903,
      "created_at": 1789433901,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "32341c1b-ee7b-45c6-ae5c-88abc7c00a03",
      "title": "Upload ảnh qua API",
      "updated_at": 1789433246,
      "created_at": 1789433159,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8323e8c0-57d6-46be-b5f6-cb50f8bd8aab",
      "title": "New chat",
      "updated_at": 1789397343,
      "created_at": 1789397343,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "98ce7eab-bf35-4c4f-8094-5763b40e29f3",
      "title": "Tạo thanh tìm kiếm và đổi tên drawer",
      "updated_at": 1789390355,
      "created_at": 1789390077,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a9ae70e2-3450-4cab-a15b-9cb1bb562562",
      "title": "Thiếu biểu tượng tìm kiếm trong thanh tìm kiếm",
      "updated_at": 1789390032,
      "created_at": 1789389643,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e34a8f51-8664-4e40-9f8a-a85226b50d21",
      "title": "Chào hỏi người dùng",
      "updated_at": 1789384965,
      "created_at": 1789384957,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e9bb321a-ea7a-4412-bfd3-b2b0eb810ba5",
      "title": "Chào hỏi",
      "updated_at": 1789384646,
      "created_at": 1789384641,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6cd80d0b-c758-4c72-8990-36c8a00b6004",
      "title": "Chào hỏi",
      "updated_at": 1789383967,
      "created_at": 1789383962,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "b879c3e8-351d-4aae-a09d-d8f7de7c0e70",
      "title": "Chào hỏi",
      "updated_at": 1789383837,
      "created_at": 1789383833,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0ec40fd1-e8ef-400e-8ae5-07023924d416",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789367644,
      "created_at": 1789367533,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "df59c414-420f-4ecd-a2a4-207f55e27dea",
      "title": "Sửa lỗi TypeScript trong Kimi SSE Parser",
      "updated_at": 1789367078,
      "created_at": 1789366593,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0cd7a2fc-9f7f-492d-807e-90af3508dae1",
      "title": "Tách file parsing theo provider",
      "updated_at": 1789366492,
      "created_at": 1789365849,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0bc85f3c-916d-4bda-8f7e-2debc6f9c8e8",
      "title": "Chào hỏi",
      "updated_at": 1789363389,
      "created_at": 1789362698,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c77315b7-f395-4a22-aa63-4101765fbf13",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789362202,
      "created_at": 1789361784,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6b383af8-490b-4bbb-8916-de60907f8fa0",
      "title": "Chào mừng đến với trợ lý",
      "updated_at": 1789361753,
      "created_at": 1789361588,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "614829f6-576d-44f4-ab33-1923b6f2dc1a",
      "title": "Chào hỏi",
      "updated_at": 1789361245,
      "created_at": 1789361239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "07817394-2f85-493a-b2dd-40ad9d4ea1c9",
      "title": "Chào hỏi",
      "updated_at": 1789356560,
      "created_at": 1789355910,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "85b55dc0-3b52-47aa-8605-9cf717877ce7",
      "title": "Chào mừng Khánh",
      "updated_at": 1789356407,
      "created_at": 1789356405,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "48ca7a45-00ff-4095-9fc8-475b5b518dd9",
      "title": "Upload File và Hạn chế Công cụ",
      "updated_at": 1789354573,
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
    }
  ]
}
```


---

### `GET` https://chat.qwen.ai/api/v2/chats/pinned

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 3c66ab16-6911-486f-bb8e-3f194e1dc970
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:06 GMT+0700
bx-ua: 234!t0deKXBxeePWftf7VV4qm9oF48zJRd8FTTr55qiMD9dRYp8raJ2cg15toCVlsC8MD7c22Nqt6dI8wS97JtGaJmTzOcD3dnfGuKpGrnCvrBuWph2e9sPGnNJ6D8t/glTsJnOrcYwqZRtjZ3c6vMsFqHzbq1iMryUB9ajCe0ax7e8EiwYwrqQcTGhpP30dSX/yVVtpLIoZQppvc2hTnJWTrmJ3PGuuSZET3ATtinZZQkp/cs4Tn3o6QQyNg4+0OVmd9iJXhIoZQppvrQ5IXZo6QCyNhsrAZ3UT31JThLZZQks/c24HelodOQ4DGxr4Z3wTd1JTh1uZTks/gsdHjPWKOQvmhsrkefwd9iJTCvnZQks/grhH1eWVOOJNCs54Z3wd9id7CI6eQpsvcsc2ePRcQCymhmkqwpim9Ad7hnoZQkpvgtBnbByLQCbthxtZnZwK9idThpoZMkHqc2WwflZaQaNNhxkZn3wH9iJ7ieIZndsDaSwXa/maP0d/hxkZZ3Ud91MC2Y4eQcLQcMcg2P+HQQVmhxWz2loNOARsoNvD5rHUePkbWoO/aUNMXoWik7N/+/IwJN5vgjYPXEF7EihV2jWMOPuatGvgfXFztqvFkeoB1zNSmFPB+wixBsvSEFQ2wLatYN5jgy5rJdIa+0PmA+Nx8ZB10nyWlTmg6Vub5wEl1Q42dFqJUUJXAecImzjNdVvfFWW/vqfjRaXwYNX/bgw2SkYmVSpHMMTT0pHPvS26YgJNncZSUx4RkrCHQBFlGKrx8IluI8daVoALMKVudqAeVSqBEP+E35vCgOyw+cpZt8dZwGxKz+wld6kgQhDI2pHtC/JasB7OgYlTMNZCzR52HHJlg9E/y3tylPAdFbdKz70j87tyB4EGfO11ZgO29giM8Z8bhwTd37E3uiUNlKE0wEuj4NN9sehg/z6ooI4zlCB6iGSAyGoeQ9kQLgpM/XWgoUEthlpiCtFdEtMpxQqOiHKa5QPsaBVBgk7fawjqJVAe4aG2LaXUlhvyTcs5cA3GTzY6Yw1bgEs1a5cXiXnYitQuCm7HJYYNoF1CqBpp4XuaxKZRD8CnPYkZHkZ4lwZkVrR09TpQHb8epThAvKWtw0IJwDKWMKAG0+gzdKbt5zd8xJTsTQWuy9U5uQ9Fe5JEMAbsUxR+wbmCnmGgXJ7fQlqDKcnzsJkGse0lFoScvs1HWruB+4M1P7YxZhLZMstJl6MHg2slhoPqHSouOP7IFN8/uNv4e9tSLxKlDzhrDf7e2ioIGdmkGDAAfPupRzZymn5zZOgFUl5amz7XIXzv/coJKQXnSKQZFkk1n6SqQnQHMULXHvb16qOjeJk7pSwhMbunAi4UkeJluEC5umFS46ENFiFvXAH5/jSLAKgw5zIRwKMVgAfeqO1BlgZ8vizwchkOi2TJoJlMQM7law211V1n8NFbw1zdUR/eS4g/T3j2RA/urjdRbhdDxVik1NHYxZAJFAldzhuF6tB+9e8a+PpFk8mks7ij61I1iYcHOQn6bV8e3wTqMAh95NeYduH4a/kTj7k+Z9Eslv3q+CnvvCj3+vUuwaeNsdRsTA/L7H5aVBO3v/F+kVVKXfnk+V0Vzr+rEGH8/9dwjP512OHYI5l2kmNq6AO33eAAU9TX0uk6ZFTR4rmeh4p20Yam6oXNvAvtij327xGClkN6Sq0CthQBGGWHwtPR9epNoh3xjQuTtiB1DJ00k+kEsUFp/BZpo7mAMC5vu/cAngC16TYfOzd0f0VPy9YiFfYqnJwk91kfK9NEZAHH3GJ4PQ9Gxra8ikSBM1wfozyXP861r/4xX+Y3wvlAbA4uiUftQnmMq3kD
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
X-Robots-Tag: noindex
x-request-id: 3c66ab16-6911-486f-bb8e-3f194e1dc970
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Content-Length: 78
Date: Fri, 25 Sep 2026 17:12:06 GMT
Content-Type: application/json
x-frame-options: SAMEORIGIN
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "success": true,
  "request_id": "3c66ab16-6911-486f-bb8e-3f194e1dc970",
  "data": []
}
```


---

### `GET` https://chat.qwen.ai/api/v2/chats/004c84c5-6e71-4510-ad21-f41a08bf8373?direction=up&limit=10

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 69c924b6-b195-4295-84d7-33b6019093f3
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:04 GMT+0700
bx-ua: 234!t0deKXAxeePWu507jV4S/UUr48zJRd8FTTr55qiMD9dRYp8rckwHpAL2cBTB9jh/TwUk2NkIuK94i+CH0r1rT2DwGdpyHv75bkkAGVhVsdRIBXa/Z1kb5ah6624dZBxcjvHKAMRCUMJHrRWQgFYrdarwApIZ0eMqwlPAjcjf3CTqHuBE2Z1Sn4jsw3bXpJH/wTrQuv5AfwzZn3UH9AJMhp0+ObcOCd2S9EI0OC6NirLZZ3wH9idThpoZnkp/cAjenL5cQCyNg2cZn3UH9WkicKlZnks/c24HVIoHOQ4NhstZZ3wd9iJTCP2ZQkkPgsNHjlodOQrNhs5SZoEd9iy0CPv+83ktcs4HjJWbQCyNhsr5Z3wd9ib4CPy+vpklc2r7+lodQCymhxuZekUd9Ad7JJag13s/cscwKdUdqQVmhxkZn3wH9A1fLEfDt3s/is57n3Zd8mymhsWZn6ToB7JTrUxZTLwqc25TZ3odQQyNhyScZ3o4KwDyB+Suwylmas5TZZoHQCXNMP0+ekiE3i677VdeQppvcs5T8JMZukeRyZuagiWCUP4+EwnpawbuhKlwrj6qaPfudOcAaAX84gGuNFrx5eYwO34aT1sSAbRcF7B9cjJlfXFztquyaVrrX9y9tFuLPd/T18cA5iDAWhCcTVnycPVu53I9XILE+s6uiI5aEi48sYLweocR6WUOgeVAzz8YuG5ago+T8fgHXBjR48cga/iyPEj0cvtbowAK2B13SDPzwZ+Owsu9Uf9wBN9depZZZjOdhuw0LZU26TCrLRi+iqVq0vy06gJIhrTXXApmZXJklkmO/7b4W7S2OETGqqhMFBKuuV1ZjrjYiwVdEWp49k0NNZ2Q3rzuoBWomtRIRIQHREDrPnh3LSGAbaYRhxTguYnffIWDD4JNUzhHGEEqoKPNaw/QvN+xYJN7VG9eWE/0DeJ+1oDOwDDvlKzujRCBx1xVYlcmEmnoV9B5G9gx6LhuzdvNKo3+43q8+gwKuYAa/hRavoR6xkYZDmSah/yLRQoqRUZSN24G6YWlrw7Wz75mUr5GnZT2ned2DX9C8t7kOuvv/X7FnAWZ8c+mSiZ/RA0kgnh+IyYCyXlnu7cyQltmX09z5PcMHlg4dkrJZdR9hKQ2Rr1oKZeSCmbekuu6AokNRawniCCmb/IzC0+yR1tPg6ETLXwlj0CnQ5ej3DiLEQKF7QkF7Zc5YQM0yR4IzCYYIALPUEXToBep2A/WXIay9dqp+GkTsgovUGKAOvXp2vRW9o5CQ79HHlwMYgCsE4FJfXyV2H0+ZhSOEctRDvW27QfRJsaJpqUdcnESNU3qnetImZgashacIXE0qoO4im6Snra4aciu7rz7a0OFpJ8orkeOVT8t8x7RohTkIK5xyKhs3JJbhIu6pJJ0kesaBjI2Woq8m8Dm++vYX6oy4J5DB23j6J+8MCVS7+VBCeRy1FA94J/TZxixXVyrka2B2MFW/+QKl7aojD51rfRmJuPQEdT90J0ZaBi6k9jgXB8XONhS6l0uYokYg1xpoMXzhI4aEnc7P8mSXqnujbJmdsyvT/mGx6kfAkfNRrBs25FmOSnrJqoPw91x5LfYiCaS5od5EAdw2Gx6b+1YqX23SChLGjZtemtNOAllo9MTXPOb3xSdTUteDQzJmDcivobqI60tPEfyDratmmyXnoNjobxejp0edwnhJyFEnpsG5ia+S+Sjtb2MOAaavKDOcD7t4+eM1qCUE6DWObFDLFc7DxpJQWYD5y1TncU2Icg3ConZLKu9BhgZFVMRQw0RX6dElZkdMwpZc4lNY7O2Jhwgj2sonwKLeGHJ9RZLqF8YMz7ueFzY4+dwfH0y7qCkteK7ByUFAQr=
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: 69c924b6-b195-4295-84d7-33b6019093f3
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Date: Fri, 25 Sep 2026 17:12:04 GMT
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
  "request_id": "69c924b6-b195-4295-84d7-33b6019093f3",
  "data": {
    "id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
    "user_id": "5b51329c-3691-4101-8f2c-4e5c2edeb21f",
    "title": "Xin chào",
    "chat": {
      "history": {
        "messages": {
          "4e27c42d-8b78-43b2-9b31-19f02f6df9f2": {
            "id": "4e27c42d-8b78-43b2-9b31-19f02f6df9f2",
            "role": "user",
            "content": "xin chào 1\n",
            "models": [
              "qwen3.7-plus"
            ],
            "chat_type": "t2t",
            "sub_chat_type": "t2t",
            "edited": false,
            "error": null,
            "extra": {
              "meta": {
                "subChatType": "t2t"
              }
            },
            "feature_config": {
              "thinking_enabled": false,
              "output_schema": "phase",
              "instructions": null,
              "research_mode": "normal",
              "auto_thinking": false,
              "thinking_mode": "Fast",
              "auto_search": true
            },
            "parentId": null,
            "turn_id": null,
            "childrenIds": [
              "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3"
            ],
            "files": [],
            "timestamp": 1790356320
          },
          "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3": {
            "role": "assistant",
            "content": "",
            "reasoning_content": null,
            "chat_type": "t2t",
            "sub_chat_type": "t2t",
            "model": "qwen3.7-plus",
            "modelName": "Qwen3.7-Plus",
            "modelIdx": 0,
            "id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
            "parentId": "4e27c42d-8b78-43b2-9b31-19f02f6df9f2",
            "childrenIds": [],
            "feature_config": {
              "thinking_enabled": false,
              "output_schema": "phase",
              "instructions": null,
              "research_mode": "normal",
              "auto_thinking": false,
              "thinking_mode": "Fast",
              "auto_search": true
            },
            "content_list": [
              {
                "content": "Xin chào Khánh! Rất vui được gặp bạn. Hôm nay tôi có thể giúp gì cho bạn không?",
                "phase": "answer",
                "status": "finished",
                "extra": null,
                "role": "assistant",
                "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
                "usage": {
                  "input_tokens": 1011,
                  "output_tokens": 22,
                  "characters": 0,
                  "total_tokens": 1033,
                  "input_tokens_details": {
                    "text_tokens": 1011
                  },
                  "output_tokens_details": {
                    "text_tokens": 22
                  },
                  "prompt_tokens_details": {
                    "cached_tokens": 512
                  }
                },
                "timestamp": 1790356323
              }
            ],
            "is_stop": false,
            "edited": false,
            "error": null,
            "meta": {},
            "extra": {
              "meta": {
                "subChatType": "t2t"
              },
              "endTime": 1790356323.619218
            },
            "feedbackId": null,
            "turn_id": null,
            "annotation": null,
            "done": true,
            "info": null,
            "timestamp": 1790356320
          }
        },
        "currentId": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
        "currentResponseIds": [
          "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3"
        ],
        "pagination": {
          "enabled": true,
          "oldest_id": "4e27c42d-8b78-43b2-9b31-19f02f6df9f2",
          "newest_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
          "has_more_older": false,
          "has_more_newer": false,
          "path_count": 2
        }
      },
      "models": [
        "qwen3.7-plus"
      ],
      "messages": [
        {
          "id": "4e27c42d-8b78-43b2-9b31-19f02f6df9f2",
          "role": "user",
          "content": "xin chào 1\n",
          "models": [
            "qwen3.7-plus"
          ],
          "chat_type": "t2t",
          "sub_chat_type": "t2t",
          "edited": false,
          "error": null,
          "extra": {
            "meta": {
              "subChatType": "t2t"
            }
          },
          "feature_config": {
            "thinking_enabled": false,
            "output_schema": "phase",
            "instructions": null,
            "research_mode": "normal",
            "auto_thinking": false,
            "thinking_mode": "Fast",
            "auto_search": true
          },
          "parentId": null,
          "turn_id": null,
          "childrenIds": [
            "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3"
          ],
          "files": [],
          "timestamp": 1790356320
        },
        {
          "role": "assistant",
          "content": "",
          "reasoning_content": null,
          "chat_type": "t2t",
          "sub_chat_type": "t2t",
          "model": "qwen3.7-plus",
          "modelName": "Qwen3.7-Plus",
          "modelIdx": 0,
          "id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
          "parentId": "4e27c42d-8b78-43b2-9b31-19f02f6df9f2",
          "childrenIds": [],
          "feature_config": {
            "thinking_enabled": false,
            "output_schema": "phase",
            "instructions": null,
            "research_mode": "normal",
            "auto_thinking": false,
            "thinking_mode": "Fast",
            "auto_search": true
          },
          "content_list": [
            {
              "content": "Xin chào Khánh! Rất vui được gặp bạn. Hôm nay tôi có thể giúp gì cho bạn không?",
              "phase": "answer",
              "status": "finished",
              "extra": null,
              "role": "assistant",
              "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
              "usage": {
                "input_tokens": 1011,
                "output_tokens": 22,
                "characters": 0,
                "total_tokens": 1033,
                "input_tokens_details": {
                  "text_tokens": 1011
                },
                "output_tokens_details": {
                  "text_tokens": 22
                },
                "prompt_tokens_details": {
                  "cached_tokens": 512
                }
              },
              "timestamp": 1790356323
            }
          ],
          "is_stop": false,
          "edited": false,
          "error": null,
          "meta": {},
          "extra": {
            "meta": {
              "subChatType": "t2t"
            },
            "endTime": 1790356323.619218
          },
          "feedbackId": null,
          "turn_id": null,
          "annotation": null,
          "done": true,
          "info": null,
          "timestamp": 1790356320
        }
      ]
    },
    "updated_at": 1790356324,
    "created_at": 1790356321,
    "share_id": null,
    "archived": false,
    "pinned": false,
    "meta": {
      "timestamp": 1790356319732
    },
    "folder_id": null,
    "currentResponseIds": [
      "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3"
    ],
    "currentId": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3",
    "chat_type": "t2t",
    "models": null,
    "project_id": null,
    "data_source": null
  }
}
```


---

### `GET` https://chat.qwen.ai/api/v2/chats/?page=1&exclude_project=true

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 0199f2ed-f10c-4b7d-983d-c4d6b2cc542c
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:00 GMT+0700
bx-ua: 234!t95eKL5feePW/X4bVJ4mqSjD48zJRd8FTTr55qiMD9dRYp8rckgyTvykXEJ4mImzYVup2x67/RPsUOfRiBT9LIEWcChBR9w19YJg9HmYHvV6FN8dTtN6dMMTxYd04YjwKqDUGP2bvmeuFZ0/7u+q4UPrXn1Aj+niI3ezjzxmdyFw7JPOCmVM6ZqlOLszQidAmv4Af1lZn3UH9AJMhp0+ObcOCd2S9EI0OC6NirLZZ3wH9idThpoZnkp/cAjenL5cQCyNg2cZn3UH9WkicKlZnks/c24HVIoHOQ4NhstZZ3wd9iJTCP2ZQkkPgsNHjlodOQrNhsg1Z0Qd9iy0CPv+83ktcs4HjJWbQCyNhsr5Z3wd9ib4CPy+vpklc2r7+lodQCymhxuZekUd9Ad7JJag13s/cscwKdUdqQVmhxkZn3wH9A1fLEfDt3s/is57n3Zd8mymhsWZn6ToB7JTrUxZTLwqc25TZ3odQQyNhyScZ3o4KwDyB+Suwylmas5TZZoHQCXN9JS+eksB3A67Qe2ZQks/c2Wz2loNOARsoNvD5rHUePkbWoO/aUNMXoWik7N/+/IwJN5vgjYPXEF7EihV2jWMOPuatGvgfXFztqvFkeoB1zNSmFPB+wixBsvSEFQ2wLatYN5jgy5rJdIa+0PmA+Nx8ZB10nyWlTmg6Vub5wEl1Q42dFqJUUJXAecImzjNYevGBkmMvqfjRaXwYNX/bgw2SkYmVSpH4cXCRc8Bb2mk6WTWCI/Uu/k1mgF17vZ8hq13xsEjQmhcUy0NdqQtGCMF6+VHgLQ/7scGcUqRKGH2UEyE+dcYQLR/L3p5zrM7P2xRnNdujV2YS6S4Te4Mh8WvB5Zcuu84rh0qVPs1Fs2ogwdnSoM40BSCH1bCN0ehu4B7qRV+p0AfFcdj4fXDP97VR7N/I+mpfXz7h/v3mIf3n9T/HRpR8QkywZYQhUhZPSDMbI+pomIFB2oYmVIaA2ZlrHuDbSwNL0nerWMQIAHkan2HPLeBvEBarVWE+CZGL7hIQu62/QS+9rfelK7nZwYZ5ZxLTmHGge/Q/eMBV++pDLH7QV4yGwvcZb3ptiCxcSwQK9u/4Meid3jjEi7bYd2HNh6VaQ3tlQuX8fyQDoIiGE/wcxxfUn0+ntMpsEhDp/dN+95H+uFCAUCqB4bP6+xisVrKtqP2fK2umsxLagHwe+F6AArDkIF12SuDZASL3Jo6eS3hAyjAL0DJdcI/j547zOPW7ek/xm1O++W3y+bXy4votf5sULZd8n+HEUU/ebXKmH+98wTDgaPmlcep+u3Mox62dxB2ZJ6aifKvIq92JvgPP89LmXASkTwdjkoDYN9YIHVmAqFi6xEcAY67XujISDP36Ul42ZghS4k1byWVUxm55dqssu+6YSfzI+/sws2ez3iTB51DGotyoH9tGd9TyeFt70DDCtQ1U1lqvvh+b0EsWM37cwlNpnOVL0WQy+poYrwAQpQTQMtSB4FS7wX8DrZgL4imX0ueLMENVL2xeObi56f/VU9EnT1G5ePSC/lFZW6nF9ypNL1vUUOg+mdkO/buYI65xtYCw0hG7Ksaf2pVvEi/PXUTZydo8RqVKDSgejCrA13uQ+cPb7HoQnkXr+GXiMsW0sHp1hUw0Os9kgmBNuVNXt/tzYUPerdhMyqjXY6W98q6uzuO7h2Q3xVyOW+YHVSXA2c9/DTIPo0J6l7PNo78dYJk2HM4Wb6uSESSm3FAkOzRkKIqT6q5QC1TN+17aQwX0BnOQH739fyDFSahEyAwkbVxAcPQQ/vQD1gY/PmY2yG+RWr1+Kgt+rMnm5UBuLa3el4Q4Z/xvn/PgaZ/HSDbo3xpObuQ/VFSNVe=
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: 0199f2ed-f10c-4b7d-983d-c4d6b2cc542c
cache-control: no-cache
Content-Encoding: gzip
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Date: Fri, 25 Sep 2026 17:12:00 GMT
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
  "request_id": "0199f2ed-f10c-4b7d-983d-c4d6b2cc542c",
  "data": [
    {
      "id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
      "title": "New chat",
      "updated_at": 1790356321,
      "created_at": 1790356321,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0029955b-e5bf-455e-9b40-2a6f7ed3af49",
      "title": "Chào Khánh",
      "updated_at": 1790352711,
      "created_at": 1790352703,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "19a31829-d790-4da9-a473-94c295419b03",
      "title": "Xin Chào Khánh",
      "updated_at": 1790352521,
      "created_at": 1790352514,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c3dc5d1e-1dcd-44e1-a157-73e3c29e6e1e",
      "title": "Lời chào hỏi",
      "updated_at": 1790351688,
      "created_at": 1790351680,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3cbd4049-aa31-4d57-bb8c-fb5e032e427b",
      "title": "Xin chào",
      "updated_at": 1790351636,
      "created_at": 1790351624,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "dd508aef-6124-4f80-bb9e-50070e602021",
      "title": "Debug HistoryCard Conversation Title",
      "updated_at": 1790342102,
      "created_at": 1790339770,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cdfcd7ab-659d-43eb-b2f1-4e377af85796",
      "title": "Tool Validation and Error Prevention",
      "updated_at": 1790341158,
      "created_at": 1790341153,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "83238147-19cb-4b31-86aa-12e6a7aee767",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340895,
      "created_at": 1790340755,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d4681ae3-5d32-497c-8866-43e94cdf0f22",
      "title": "Tool Validation Error Prevention",
      "updated_at": 1790340579,
      "created_at": 1790340575,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "50ca12d4-03d6-4396-b13b-c5e37a0aec1c",
      "title": "Hello World 1",
      "updated_at": 1790340313,
      "created_at": 1790340308,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "42816896-4803-402b-a58e-9fad3b754d33",
      "title": "Debug Conversation Title Logic",
      "updated_at": 1790339686,
      "created_at": 1790339679,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ae86772e-7ab4-4c2c-af6f-c15b1127d6ba",
      "title": "Phân tích ảnh màn hình AIWeb2API & Zen",
      "updated_at": 1789527160,
      "created_at": 1789527145,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "09d664da-f78d-49cb-a169-b96612d95895",
      "title": "Kiểm tra giới hạn 500 HTTP trong RequestTable",
      "updated_at": 1789467240,
      "created_at": 1789467141,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3d393805-1f74-452e-9903-10828b8d9e75",
      "title": "Chào hỏi",
      "updated_at": 1789460029,
      "created_at": 1789459974,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a0e5716c-0098-45a9-ba4e-9f8da8b81060",
      "title": "New chat",
      "updated_at": 1789441239,
      "created_at": 1789441239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c73e41a0-bc5e-4442-99a7-aa0dabb173ca",
      "title": "New chat",
      "updated_at": 1789440777,
      "created_at": 1789440777,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "54e24535-335a-4d4b-ba14-5754b327112e",
      "title": "New chat",
      "updated_at": 1789440448,
      "created_at": 1789440448,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "650daf0d-1077-4b9c-b1be-73bda604fc9c",
      "title": "New chat",
      "updated_at": 1789439808,
      "created_at": 1789439808,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af6d12f8-7e2c-4abf-b175-a4d6f78c419f",
      "title": "Chào mừng đến Qwen Studio",
      "updated_at": 1789439381,
      "created_at": 1789439378,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8e584b88-7fea-47a1-b9db-839a1aec4468",
      "title": "New chat",
      "updated_at": 1789439271,
      "created_at": 1789439271,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "d16544fd-943b-41e0-89b0-eeb0cf62677a",
      "title": "New chat",
      "updated_at": 1789438572,
      "created_at": 1789438572,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "3669401b-c263-4ed5-a812-6bb077ddeb1c",
      "title": "Phân tích ảnh",
      "updated_at": 1789437663,
      "created_at": 1789437654,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "ebb074af-a8f8-41c1-bbe3-81bf32833d25",
      "title": "Hỗ trợ Người Dùng",
      "updated_at": 1789437635,
      "created_at": 1789437613,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f6d0dff8-40a4-4ceb-b04c-f8b595f523d5",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434543,
      "created_at": 1789434440,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0c456796-0aac-415a-b140-ad854f59f429",
      "title": "Chào hỏi",
      "updated_at": 1789434383,
      "created_at": 1789434351,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "cf8d45a9-781d-4bec-9670-b845702e6117",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789434180,
      "created_at": 1789434165,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "f4e7562c-b48a-4d56-9025-817ac537ae4e",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434127,
      "created_at": 1789434106,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "af8b33eb-c806-4424-a36d-6e8f1868f83f",
      "title": "Phân tích cơ chế upload ảnh",
      "updated_at": 1789434027,
      "created_at": 1789434015,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "1d6a80dd-3f8d-4e3e-9080-b8ae1bcfd175",
      "title": "Phân tích cơ chế upload ảnh Qwen",
      "updated_at": 1789433962,
      "created_at": 1789433951,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "39162210-746d-448e-9c0b-5101b2687c87",
      "title": "Chào hỏi và giới thiệu",
      "updated_at": 1789433903,
      "created_at": 1789433901,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "32341c1b-ee7b-45c6-ae5c-88abc7c00a03",
      "title": "Upload ảnh qua API",
      "updated_at": 1789433246,
      "created_at": 1789433159,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "8323e8c0-57d6-46be-b5f6-cb50f8bd8aab",
      "title": "New chat",
      "updated_at": 1789397343,
      "created_at": 1789397343,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "98ce7eab-bf35-4c4f-8094-5763b40e29f3",
      "title": "Tạo thanh tìm kiếm và đổi tên drawer",
      "updated_at": 1789390355,
      "created_at": 1789390077,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "a9ae70e2-3450-4cab-a15b-9cb1bb562562",
      "title": "Thiếu biểu tượng tìm kiếm trong thanh tìm kiếm",
      "updated_at": 1789390032,
      "created_at": 1789389643,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e34a8f51-8664-4e40-9f8a-a85226b50d21",
      "title": "Chào hỏi người dùng",
      "updated_at": 1789384965,
      "created_at": 1789384957,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "e9bb321a-ea7a-4412-bfd3-b2b0eb810ba5",
      "title": "Chào hỏi",
      "updated_at": 1789384646,
      "created_at": 1789384641,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6cd80d0b-c758-4c72-8990-36c8a00b6004",
      "title": "Chào hỏi",
      "updated_at": 1789383967,
      "created_at": 1789383962,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "b879c3e8-351d-4aae-a09d-d8f7de7c0e70",
      "title": "Chào hỏi",
      "updated_at": 1789383837,
      "created_at": 1789383833,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0ec40fd1-e8ef-400e-8ae5-07023924d416",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789367644,
      "created_at": 1789367533,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "df59c414-420f-4ecd-a2a4-207f55e27dea",
      "title": "Sửa lỗi TypeScript trong Kimi SSE Parser",
      "updated_at": 1789367078,
      "created_at": 1789366593,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0cd7a2fc-9f7f-492d-807e-90af3508dae1",
      "title": "Tách file parsing theo provider",
      "updated_at": 1789366492,
      "created_at": 1789365849,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "0bc85f3c-916d-4bda-8f7e-2debc6f9c8e8",
      "title": "Chào hỏi",
      "updated_at": 1789363389,
      "created_at": 1789362698,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "c77315b7-f395-4a22-aa63-4101765fbf13",
      "title": "Chào hỏi thân thiện",
      "updated_at": 1789362202,
      "created_at": 1789361784,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "6b383af8-490b-4bbb-8916-de60907f8fa0",
      "title": "Chào mừng đến với trợ lý",
      "updated_at": 1789361753,
      "created_at": 1789361588,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "614829f6-576d-44f4-ab33-1923b6f2dc1a",
      "title": "Chào hỏi",
      "updated_at": 1789361245,
      "created_at": 1789361239,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "07817394-2f85-493a-b2dd-40ad9d4ea1c9",
      "title": "Chào hỏi",
      "updated_at": 1789356560,
      "created_at": 1789355910,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "85b55dc0-3b52-47aa-8605-9cf717877ce7",
      "title": "Chào mừng Khánh",
      "updated_at": 1789356407,
      "created_at": 1789356405,
      "chat_type": "t2t",
      "project_id": null,
      "pinned": false,
      "content": null,
      "highlight_indexes": null,
      "message_id": null
    },
    {
      "id": "48ca7a45-00ff-4095-9fc8-475b5b518dd9",
      "title": "Upload File và Hạn chế Công cụ",
      "updated_at": 1789354573,
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
    }
  ]
}
```


---

### `POST` https://chat.qwen.ai/api/v2/chat/completions?chat_id=004c84c5-6e71-4510-ad21-f41a08bf8373

| Status | Type |
|--------|------|
| 200 | fetch |

**Request Headers:**
```http
X-Request-Id: 3b1f19bd-3630-481a-9c57-ba816f80718d
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
X-Accel-Buffering: no
Timezone: Sat Sep 26 2026 00:12:00 GMT+0700
bx-ua: 234!t9JeKLkSeePWwY2HVJ4mqSjD48zJRd8FTTr55qiMD9dRYp8rckgyTvykXEJ4mImzYVup2x67/RPsUOfRiBT9LIEWcChBR9w19YJg9HmYHvV6FN8dTtN6dMMTxYd04YjwKqDUGP2bvmeuFZ0/7u+q4UPrXn1Aj+niI3ezjzxmdyFw7JPOCmVM6ZqlOLszQidAmv4Af1lZn3UH9AJMhp0+ObcOCd2S9EI0OC6NirLZZ3wH9idThpoZnkp/cAjenL5cQCyNg2cZn3UH9WkicKlZnks/c24HVIoHOQ4NhstZZ3wd9iJTCP2ZQkkPgsNHjlodOQrNhsg1Z0Qd9iy0CPv+83ktcs4HjJWbQCyNhsr5Z3wd9ib4CPy+vpklc2r7+lodQCymhxuZekUd9Ad7JJag13s/cscwKdUdqQVmhxkZn3wH9A1fLEfDt3s/is57n3Zd8mymhsWZn6ToB7JTrUxZTLwqc25TZ3odQQyNhyScZ3o4KwDyB+Suwylmas5TZZoHQCXN9JS+eksB3A67Qe2ZQks/c2Wy22UNOARsoNvDAyHUePkbWoOvsUH2XTnfgIWAfVFu+7vqgyhrvdNaW1pb2jDq8ruAgAY5azNqoO5XcVVuBwmfEiIyAT+EVu52E8jOfbGuJRvv5eCurEmM6IkFUrCtgG6AFcQNQCVa4ajYOagHXBjR48cga/iyPEj0cvtbowAK2B13SDPzwZ+Owsu9Uf9wYqiqXNSl3xgYmYd0vpusAH/lqCg3isxOzIevCiD3fOy7M19x2rO4e763CU9cS2Im1hOBGrNqmY7NFYsbBOQqq5U7vMwxD241X/94sdiiiniWxorSnshB/oJtt3Eag2Mb3kfr6GRZPe+4N3JgdrJ7vBPo9edDPtlojd2zRpE0Ywrh4VZbTyk4fWIKPqTru/K7yZtH84VjJrH516estXzOiPY+7ZiDnNWlrzPl/VthUwie/edhCa21/6R8XO525x+GhZ0hoEjPXb+o6qmArfz3hzdMjTiLZMpOs2oSwN2fcI6fzazDPwFVsu/KubJedDkhcl/TmbGPsjYMf9K0dTwcFHq1bZqhGD705uSQncAxnFaF8KbhMI+Kq14q6TpeMKac5n8oVeCmnd9DjukialrgCt3TIrk/3/0H4HlaIMaC5sN2ThNySKgmJ3rOK9/jbaXUQVzQwu5EdYmrAgMOYagCLS6akKKRUTOJMdX59D4nsEMazigCu2mvD5ePclAE1DF6se11E9e7PyGQwFtF1ZgcHK67ZOe5+5WZXs+exv1kqC6WTtJ5yfMXK2Zn75FQoTjTSbjus8tGeVLd5AQ7XMNx+FNWlye31l5pcmQ7aN6DYL7OpS0E8T1zNi8DElI2ITNGMr98G084aXsFN6fFOD42aLa0iAzNaHLsJwFPo/8DQ1j4x4jQpJ92IDsrqwh36xUXHHkjCH4YSrxivNznWPmiFplerLnA3PCKyF70T5gG/B14Uke1apZCEikBxlNonHMN8g+/IuNY+pj5cKY2XYKzjdqpfAh2lS5mI9S1fBo/LwMGLcVOfYRwhukgnVwUH5+rwq2c5IrItSI/LE+BsWRikUEPoOWmQLjJWMr1jvyIpfS/b6VW9d42G8/IzdUXYQaoywMuUTMJstt7BruOIs2s2ho6i/3NbGhiSiGhYX0yFDNrvGdQUMXLlwKnw3DaBX0IB4n2L/KROJmV4HKuEAQPccRiDQ73L2qmW5u+AzIHZeOD2f4xaDrm2pO/2lbykp1HGkg5n22/3nyzS5tjIGcFDJM4A039g3+Jd5SiFBXlvNsL1vCkkwE4C+Zp/CkZovZF4e==
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
Accept: application/json
Content-Type: application/json
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
Transfer-Encoding: chunked
X-Robots-Tag: noindex
x-request-id: 3b1f19bd-3630-481a-9c57-ba816f80718d
cache-control: no-cache
Content-Encoding: br
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Date: Fri, 25 Sep 2026 17:12:02 GMT
Content-Type: text/event-stream; charset=utf-8
Vary: Accept-Encoding, Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "stream": true,
  "version": "2.1",
  "incremental_output": true,
  "chatId": "004c84c5-6e71-4510-ad21-f41a08bf8373",
  "parentId": "",
  "chat_id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
  "chat_mode": "normal",
  "model": "qwen3.7-plus",
  "parent_id": null,
  "messages": [
    {
      "id": null,
      "fid": "909abbf4-95ea-490c-9dc9-1e5af9e02686",
      "parentId": null,
      "childrenIds": [
        "4f42f146-9077-4c62-a5a7-c37f7fffbfc8"
      ],
      "role": "user",
      "content": "xin chào 1\n",
      "user_action": "chat",
      "files": [],
      "timestamp": 1790356319,
      "models": [
        "qwen3.7-plus"
      ],
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
      "parent_id": null
    }
  ],
  "timestamp": 1790356320
}
```

**Response Body:**
```
data: {"response.created":{"chat_id": "004c84c5-6e71-4510-ad21-f41a08bf8373", "parent_id": "4e27c42d-8b78-43b2-9b31-19f02f6df9f2", "response_id":"2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "response_index": "0"}} 

data: {"choices": [{"delta": {"role": "assistant", "content": "X", "phase": "answer", "status": "typing"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "usage": {"input_tokens": 1011, "output_tokens": 1, "characters": 0, "total_tokens": 1012, "input_tokens_details": {"text_tokens": 1011}, "output_tokens_details": {"text_tokens": 1}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356323}

data: {"choices": [{"delta": {"role": "assistant", "content": "in chào Khánh!", "phase": "answer", "status": "typing"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "usage": {"input_tokens": 1011, "output_tokens": 5, "characters": 0, "total_tokens": 1016, "input_tokens_details": {"text_tokens": 1011}, "output_tokens_details": {"text_tokens": 5}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356323}

data: {"choices": [{"delta": {"role": "assistant", "content": " Rất", "phase": "answer", "status": "typing"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "usage": {"input_tokens": 1011, "output_tokens": 6, "characters": 0, "total_tokens": 1017, "input_tokens_details": {"text_tokens": 1011}, "output_tokens_details": {"text_tokens": 6}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356323}

data: {"choices": [{"delta": {"role": "assistant", "content": " vui được gặp bạn", "phase": "answer", "status": "typing"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "usage": {"input_tokens": 1011, "output_tokens": 10, "characters": 0, "total_tokens": 1021, "input_tokens_details": {"text_tokens": 1011}, "output_tokens_details": {"text_tokens": 10}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356323}

data: {"choices": [{"delta": {"role": "assistant", "content": ". Hôm nay tôi", "phase": "answer", "status": "typing"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "usage": {"input_tokens": 1011, "output_tokens": 14, "characters": 0, "total_tokens": 1025, "input_tokens_details": {"text_tokens": 1011}, "output_tokens_details": {"text_tokens": 14}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356323}

data: {"choices": [{"delta": {"role": "assistant", "content": " có thể giúp gì", "phase": "answer", "status": "typing"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "usage": {"input_tokens": 1011, "output_tokens": 18, "characters": 0, "total_tokens": 1029, "input_tokens_details": {"text_tokens": 1011}, "output_tokens_details": {"text_tokens": 18}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356323}

data: {"choices": [{"delta": {"role": "assistant", "content": " cho bạn không?", "phase": "answer", "status": "typing"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "usage": {"input_tokens": 1011, "output_tokens": 22, "characters": 0, "total_tokens": 1033, "input_tokens_details": {"text_tokens": 1011}, "output_tokens_details": {"text_tokens": 22}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356323}

data: {"choices": [{"delta": {"role": "assistant", "content": "", "phase": "answer", "status": "typing"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "usage": {"input_tokens": 1011, "output_tokens": 22, "characters": 0, "total_tokens": 1033, "input_tokens_details": {"text_tokens": 1011}, "output_tokens_details": {"text_tokens": 22}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356323}

data: {"choices": [{"delta": {"role": "assistant", "content": "", "phase": "answer", "status": "typing"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3", "usage": {"input_tokens": 1011, "output_tokens": 22, "characters": 0, "total_tokens": 1033, "input_tokens_details": {"text_tokens": 1011}, "output_tokens_details": {"text_tokens": 22}, "prompt_tokens_details": {"cached_tokens": 512}}, "timestamp": 1790356323}

data: {"choices": [{"delta": {"content": "", "role": "assistant", "status": "finished", "phase": "answer"}}], "response_id": "2b7b2da2-6c1a-4db2-a2d2-9f45bc7d0bc3"}


```


---

### `GET` https://chat.qwen.ai/api/v2/chats/pinned

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 3d6459b1-68e4-4063-8107-6595c08bfdca
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:00 GMT+0700
bx-ua: 234!tdNeKLk2eePWpv2iVJ4mqSjD48zJRd8FTTr55qiMD9dRYp8rckgyTvykXEJ4mImzYVup2x67/RPsUOfRiBT9LIEWcChBR9w19YJg9HmYHvV6FN8dTtN6dMMTxYd04YjwKqDUGP2bvmeuFZ0/7u+q4UPrXn1Aj+niI3ezjzxmdyFw7JPOCmVM6ZqlOLszQidAmv4Af1lZn3UH9AJMhp0+ObcOCd2S9EI0OC6NirLZZ3wH9idThpoZnkp/cAjenL5cQCyNg2cZn3UH9WkicKlZnks/c24HVIoHOQ4NhstZZ3wd9iJTCP2ZQkkPgsNHjlodOQrNhsg1Z0Qd9iy0CPv+83ktcs4HjJWbQCyNhsr5Z3wd9ib4CPy+vpklc2r7+lodQCymhxuZekUd9Ad7JJag13s/cscwKdUdqQVmhxkZn3wH9A1fLEfDt3s/is57n3Zd8mymhsWZn6ToB7JTrUxZTLwqc25TZ3odQQyNhyScZ3o4KwDyB+Suwylmas5TZZoHQCXN9JS+eksB3A67Qe2ZQks/c2Wz2loNOARsoNvD5rHUePkbWoO/aUNMXoWik7N/+/IwJN5vgjYPXEF7EihV2jWMOPuatGvgfXFztqvFkeoB1zNSmFPB+wixBsvSEFQ2wLatYN5jgy5rJdIa+0PmA+Nx8ZB10nyWlTmg6Vub5wEl1Q42dFqJUUJXAecImzjNHJviF4QlvqfjRaXwYNX/bgw2SkYmVSpH4cXCRc8Bb2mk6WTWCI/Uu/k1mgF17vZ8hq13xsEjQmhcUy0NdqQtGCMF6+VHgLQ/7scGcBcYrhtVHietpqQdbuPuR/y/ydDGg1N3oXlFUEWagNTJd1ARynj7qnRZSr9QIH19/6rLE0sOkwc3r/+cFaoUtwkCMe3fsr3qKPROLWEstBWUEtN5QuSkBbcwIkG4Rbz28/AeV+TvXJh+fGAMppbFvusFkqal6To3BiUDRyPK4UjURRfwE43JVn1YwxqQDAutznRCJ874/WH/VeweV5xom7+JzNRanopbmOKK0e/1fSN94OOQbWhWxqWIDkoiGgPrSNm83J3F2RvZMlJlFdhN4pv9UKK9Kfqnv3YUm4X2vtkUnKgxXxueAT1CgPQyISVPUAcDLv7r5yZIBC7rSL/yf9sO54VbwTj6MJcB03VxNf7HrKf3SXoROaRWsyZNY2o7clpc3p1EUHvBzJg1Pt/yiITaToCL5RgtVI0dIEmMsM6JOoIBLa+H4iEWtR7mZyNCY4xLV97TEStN3AVlc+7wiX7AELP3tShfV2B0zJaJSgpl7NeJkx2yYgE6d30k+yUAcfqXSVenx0bjHHVJ/38AjcSPCyH9I/S9g3I/4BGaTgUBQOGZbVMg7bLLZV30KDBGOJy4tXVSWcgCmLz0uUE6iPW4YQtlU84CSzHboY72x8W5rYwe6Ttc5XE87PGpQ3vydlKGyfzefOdz6YT0G7A789WRsnB5YvEr7dBb3UNoCbENkJ0hfzAl7Y9VAei+hedFZjDp/lOnecDuX9ROkjsoTYB2Qc/fZ+GboDR/QbALg4t9NNMrJg/8U+A1pc9HPeF7V9qrevZ2TDQy9c12mfqM+4zoqwH8pcSykVoYQhCpao9jUq62OU6MYeBVgq5tQxXcUwEhhREKS42tC6O2MPUkwbmIyRutPZESPQW8auWBL7pErCGDdJvbhYaRr+uhJdGf/qmIej4qs3Wwc+Xv6NNbIHUrqTAvetu3g71/WzvHMXiryO9onpyhwy8/YmbgF/NzkEAEfkzGwG1Xuu6m0kIJd2Clv3jLb2BDCha4EUkzh2Gmo4t8gCpL3tPTKZ07M5m1mfl/IAgtX/LBMCNJlbe=
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
X-Robots-Tag: noindex
x-request-id: 3d6459b1-68e4-4063-8107-6595c08bfdca
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
Content-Length: 78
Date: Fri, 25 Sep 2026 17:12:00 GMT
Content-Type: application/json
x-frame-options: SAMEORIGIN
```

**Request Body:**
*(No body)*

**Response Body:**
```json
{
  "success": true,
  "request_id": "3d6459b1-68e4-4063-8107-6595c08bfdca",
  "data": []
}
```


---

### `POST` https://chat.qwen.ai/api/v2/users/status

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: e90c28f0-936a-4bb3-8b91-4cd2764c6478
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
sec-ch-ua-platform: "Linux"
Referer: https://chat.qwen.ai/c/004c84c5-6e71-4510-ad21-f41a08bf8373
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:12:00 GMT+0700
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Content-Type: application/json
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
x-request-id: e90c28f0-936a-4bb3-8b91-4cd2764c6478
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Content-Length: 80
Date: Fri, 25 Sep 2026 17:12:00 GMT
Content-Type: application/json
vary: Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "typarms": {
    "typarm1": "web",
    "typarm2": "5b51329c-3691-4101-8f2c-4e5c2edeb21f",
    "typarm3": "prod",
    "typarm4": "qwen_chat",
    "typarm5": "product",
    "typarm6": "",
    "orgid": "tongyi",
    "share_id": "",
    "project_id": "",
    "channel_type": "",
    "community_type": "",
    "from_id": "",
    "cdn_version": "0.3.11",
    "page_id": "//chat.qwen.ai/c/",
    "session_id": "004c84c5-6e71-4510-ad21-f41a08bf8373",
    "language": "en-US",
    "biz_id": "tongyi",
    "device": "LINUX",
    "chat_entry": "qwen_web",
    "init_session_type": "0",
    "mode_type": "main_chat",
    "utc_timestamp": "1790356320522",
    "spmId": "a2ty_o01.29997173",
    "aemPageId": "//chat.qwen.ai/c/",
    "domain": "chat.qwen.ai"
  }
}
```

**Response Body:**
```json
{
  "success": true,
  "request_id": "e90c28f0-936a-4bb3-8b91-4cd2764c6478",
  "data": true
}
```


---

### `POST` https://chat.qwen.ai/api/v2/chats/new

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: cdee2ff4-3d51-4738-9120-5d59cbd62809
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
bx-umidtoken: T2gAjMU75A0yTPmskYXe_FJA_RxXXXs47E3KWYLkxYtz6xlUFbFG-oOeGv0t18QF4Y0=
Timezone: Sat Sep 26 2026 00:11:59 GMT+0700
bx-ua: 234!tXeeKSK3eePWi33aVJ4mqSjD48zJRd8FTTr55qiMD9dRYp8rckgyTvykXEJ4mImzYVup2x67/RPsUOfRiBT9LIEWcChBR9w19YJg9HmYHvV6FN8dTtN6dMMTxYd04YjwKqDUGP2bvmeuFZ0/7u+q4UPrXn1Aj+niI3ezjzxmdyFw7JPOCmVM6ZqlOLszQidAmv5AfU3Zn3UH9AJMhp0+ObcOCd2S9EI0OC6NirLZZ3wH9idThpoZnkp/cAjenL5cQCyNg2cZn3UH9WkicKlZnks/c24HVIoHOQ4NhstZZ3wd9iJTCP2ZQkkPgsNHjlodOQrNhs5lZZHd9iy0CPv+83ktcs4HjJWbQCyNhsr5Z3wd9ib4CPy+vpklc2r7+lodQCymhxuZekUd9Ad7JJag13s/cscwKdUdqQVmhxkZn3wH9A1fLEfDt3s/is57n3Zd8mymhsWZn6ToB7JTrUxZTLwqc25TZ3odQQyNhyScZ3o4KwDyB+Suwylmas5TZZoHQCXN9IG+eks17167aJeeQppvcs5T8JMZukeRyZuagiWCUP4+EwnpawbuhKlwrj6qaPfudOcAaAX84gGuNFrx5eYwO34aT1sSAbRcF7B9cjJlfXFztquyaVrrX9y9tFuLPd/T18cA5iDAWhCcTVnycPVu53I9XILE+s6uiI5aEi48sYLweocR6WUOgeVAzz8YuhPa2rVL5agHXBjR48cga/iyPEj0cvtbowAK2B13SDPzwZ+Owsu9UfHwytcrBg5ZCVbXYVLedlbbp3BaeOjXsFoUlPyjNERDDZINkbjeUhKPlC7npCqm9T7TMzgKYjge3Vh7vCFqtRYnd6hFEDDiT3mD22ZDm+U5/30tKm3me4udg92hypu5XRJrynAggU06H/o3l4dxbiwp7/cmn+pMAJZctXmMoLsVpFBB7v5trnq5w51q3L5fdnCHj/UPJ/cUnFvUbZH4NC/8Jdkz8WS89prA9rsB1eLxzRSpbW1mhGTZ6Be1QAgKB2ovSMqqd7cm7ynr+iG6STNxCwqHK1TDU3HrgmV7/O6pfPD7eJas6WgPz7koq8vgIB0kpzckL2wZ9hKGk/EaztWcLOFMXE4+QHS/J5UKtRsSp6nIZm8Pv9EezweNLQbtuwnLqKHREE4i9h0EORNxr++7Nq/JfgVCW+UGuyvMxkU7NfWO/OWXr9kmB7G2Ldjepokrimqdbb4Vp+5pPfla0dt9UxgHF7V6p/YP6m+xVZtxqGLphmVXxtgG2RW6zQSFY3nKxFNdnqICFVp/15VsmSj4IrcA7JUEogsF/5qWOH5d5rHGt1EnNtwZN+ZuT5yKawCvI2PkIusFqmvwrUwotgTzsdPmg3nPVT4lHqJ1/WOrjJkG8a5NH6tsow+6mPhmIOxIQlujFnt1HO4bbjzX0ZEXC0ybM/ICM+YeJVN1otQQuG8WFTB1MHkmW7C4aUjQf8YXk+TLHnnD6dbWtqTmsSFbky/oBVNzZOhkeA9tJnM4EVOme0iy+iAfWHLhd3pajjF935Bd9JVFdjriSwT3D2ag2/+pKeMkHorsIprHpOzvI+SsKBgkc7qs3pOblm0zofaoM/0pYjNociVtASEHuawdzLnX6T+NkVCIAz7xjPqkk6DfzNyIhCF1kLcJW/Xbfd+VxsazuUo1IBUVjut2Vk4r9P6UUXppDleV+JmBTzkUvkag8a4JMx14K5fGnvjbAqcvOmfpyCAeVIJUZSG7bJFqGsKxa0otN9XO3sMC4DqvpxCfzrxFrkfjrjIhbKGXVaN1VYghYPvzQuF6QZ+znb4J/rtpl6axRjNYZlYKihV=
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Linux"
Accept: application/json, text/plain, */*
Content-Type: application/json
Referer: https://chat.qwen.ai/c/new-chat
Accept-Language: en-US,en;q=0.9
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
X-Robots-Tag: noindex
x-request-id: cdee2ff4-3d51-4738-9120-5d59cbd62809
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Content-Length: 121
Date: Fri, 25 Sep 2026 17:12:00 GMT
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
  "timestamp": 1790356319732,
  "chat_type": "t2t",
  "chat_mode": "normal"
}
```

**Response Body:**
```json
{
  "success": true,
  "request_id": "cdee2ff4-3d51-4738-9120-5d59cbd62809",
  "data": {
    "id": "004c84c5-6e71-4510-ad21-f41a08bf8373"
  }
}
```


---

### `POST` https://chat.qwen.ai/api/v2/users/status

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
X-Request-Id: 048a27ba-6fa2-484d-8f31-b10f32c0b8d5
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6ImxlZ2FjeSIsInR5cCI6IkpXVCJ9.eyJpZCI6IjViNTEzMjljLTM2OTEtNDEwMS04ZjJjLTRlNWMyZWRlYjIxZiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg5MjgyNDE2LCJ0eXBlIjoiYWNjZXNzX3Rva2VuIiwiZXhwIjoxNzkwMzU3MTI1LCJpYXQiOjE3OTAzNTYyMjV9.NYQ1KwZFCXqHUB2jzEzm6-likWA74MNRiEJTBTIAr9c
sec-ch-ua-platform: "Linux"
Referer: https://chat.qwen.ai/c/new-chat
Accept-Language: en-US,en;q=0.9
Timezone: Sat Sep 26 2026 00:11:59 GMT+0700
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
source: web
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Content-Type: application/json
Version: 0.3.11
bx-v: 2.5.37
```

**Response Headers:**
```http
x-request-id: 048a27ba-6fa2-484d-8f31-b10f32c0b8d5
cache-control: no-cache
GA-AP: ap-southeast-1
x-actual-status-code: 200
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-origin: https://chat.qwen.ai
Content-Length: 80
Date: Fri, 25 Sep 2026 17:12:00 GMT
Content-Type: application/json
vary: Origin, Origin
x-frame-options: SAMEORIGIN
```

**Request Body:**
```json
{
  "typarms": {
    "typarm1": "web",
    "typarm2": "5b51329c-3691-4101-8f2c-4e5c2edeb21f",
    "typarm3": "prod",
    "typarm4": "qwen_chat",
    "typarm5": "product",
    "typarm6": "",
    "orgid": "tongyi",
    "share_id": "",
    "project_id": "",
    "channel_type": "",
    "community_type": "",
    "from_id": "",
    "cdn_version": "0.3.11",
    "page_id": "//chat.qwen.ai/c/new-chat",
    "session_id": "",
    "language": "en-US",
    "biz_id": "tongyi",
    "device": "LINUX",
    "chat_entry": "qwen_web",
    "init_session_type": "0",
    "mode_type": "main_chat",
    "utc_timestamp": "1790356319912",
    "spmId": "a2ty_o01.29997170",
    "aemPageId": "//chat.qwen.ai/c/new-chat",
    "domain": "chat.qwen.ai"
  }
}
```

**Response Body:**
```json
{
  "success": true,
  "request_id": "048a27ba-6fa2-484d-8f31-b10f32c0b8d5",
  "data": true
}
```

