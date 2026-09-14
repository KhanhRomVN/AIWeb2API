### `POST` https://chat.deepseek.com/api/v0/chat/completion

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
x-client-locale: en_US
sec-ch-ua-platform: "Linux"
authorization: Bearer 63+ChqAIlCxW/d6b/G6aoVidXQv2B/em6AtExmic4mENFCVKic/gs6/Yy7VDTXJh
x-client-bundle-id: com.deepseek.chat
Referer: https://chat.deepseek.com/a/chat/s/9750b2ea-b081-45b1-b689-522626028f9a
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
x-ds-pow-response: eyJhbGdvcml0aG0iOiJEZWVwU2Vla0hhc2hWMSIsImNoYWxsZW5nZSI6IjMyZTllZDY0MGZmMzY1M2U3YTBjMzgxN2VjZTk4NjlkNDdmNTM2Mjg5NzRlZDkwZGIxMmQ0ZTQwNGIwMTZiYjAiLCJzYWx0IjoiNDk5ODUzMDhmYTRiMzNiZWIwNmEiLCJhbnN3ZXIiOjExNDEyNywic2lnbmF0dXJlIjoiZDE0MDYwNDYyYjZkNzAyNmVkYjhjODBlNGVmMTcwZmVkYTMyN2YxYWIxZDI5ZWRhNDliMTgyMTBhZTNlYzNmMyIsInRhcmdldF9wYXRoIjoiL2FwaS92MC9jaGF0L2NvbXBsZXRpb24ifQ==
x-hif-leim: ebQVMXkPQHZ4ZcwJdsf8wufFyhYftnNM0XPEb1X4658tGVNsVx6QLnw=.RfOx/xgj4A/FHJ1E
x-client-timezone-offset: 25200
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-client-version: 2.5.0
accept: */*
content-type: application/json
x-client-platform: web
```

**Response Headers:**
```http
Transfer-Encoding: chunked
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
x-ds-trace-id: d4bce3ccda490ed98c5a9576f860dadb
cache-control: no-cache
Connection: keep-alive
X-Content-Type-Options: nosniff
x-ds-sse-heartbeat-timeout-secs: 8
Via: 1.1 85c11cc963ff3cfcc0dcb4435aa5d446.cloudfront.net (CloudFront)
X-Cache: Miss from cloudfront
X-Amz-Cf-Id: WAVE-T7hV-nNdt1c_vWM07ywZELSHSah2zjhmp0ZyXDMfaA2QQyCKw==
Date: Mon, 14 Sep 2026 13:01:12 GMT
Content-Type: text/event-stream; charset=utf-8
X-Amz-Cf-Pop: SGN50-P2
Server: elb
```

**Request Body:**
```json
{
  "chat_session_id": "9750b2ea-b081-45b1-b689-522626028f9a",
  "parent_message_id": null,
  "model_type": "default",
  "prompt": "xin chào",
  "ref_file_ids": [],
  "thinking_enabled": false,
  "search_enabled": false,
  "action": null,
  "preempt": false
}
```

**Response Body:**
```
event: ready
data: {"request_message_id":1,"response_message_id":2,"model_type":"default"}

event: update_session
data: {"updated_at":1789390873.085664}

data: {"v":{"response":{"message_id":2,"parent_id":1,"model":"","role":"ASSISTANT","thinking_enabled":false,"ban_edit":false,"ban_regenerate":false,"status":"WIP","incomplete_message":null,"accumulated_token_usage":0,"feedback":null,"inserted_at":1789390873.0725088,"search_enabled":false,"fragments":[{"id":2,"type":"RESPONSE","content":"X","references":[],"stage_id":1}],"conversation_mode":"DEFAULT","has_pending_fragment":false,"auto_continue":false,"search_triggered":false}}}

data: {"p":"response/fragments/-1/content","o":"APPEND","v":"in"}

data: {"v":" ch"}

data: {"v":"ào"}

data: {"v":"!"}

data: {"v":" T"}

data: {"v":"ôi"}

data: {"v":" có"}

data: {"v":" thể"}

data: {"v":" gi"}

data: {"v":"ú"}

data: {"v":"p"}

data: {"v":" g"}

data: {"v":"ì"}

data: {"v":" cho"}

data: {"v":" bạn"}

data: {"v":" h"}

data: {"v":"ôm"}

data: {"v":" nay"}

data: {"v":"?"}

data: {"p":"response","o":"BATCH","v":[{"p":"accumulated_token_usage","v":56},{"p":"quasi_status","v":"FINISHED"}]}

data: {"p":"response/status","o":"SET","v":"FINISHED"}

event: update_session
data: {"updated_at":1789390873.3264189}

event: title
data: {"content":"Chào hỏi"}

event: close
data: {"click_behavior":"none","auto_resume":false}


```


---

### `POST` https://chat.deepseek.com/api/v0/chat_session/create

| Status | Type |
|--------|------|
| 200 | xhr |

**Request Headers:**
```http
x-client-locale: en_US
sec-ch-ua-platform: "Linux"
authorization: Bearer 63+ChqAIlCxW/d6b/G6aoVidXQv2B/em6AtExmic4mENFCVKic/gs6/Yy7VDTXJh
x-client-bundle-id: com.deepseek.chat
Referer: https://chat.deepseek.com/a/chat/s/9750b2ea-b081-45b1-b689-522626028f9a
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
x-client-timezone-offset: 25200
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
x-client-version: 2.5.0
accept: */*
content-type: application/json
x-client-platform: web
```

**Response Headers:**
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
x-ds-trace-id: d8895efad0f36058f140af261282a13b
x-ds-served-by: chat
Connection: keep-alive
access-control-allow-credentials: true
X-Content-Type-Options: nosniff
Via: 1.1 19175f36fb9c16ba394561bae28598da.cloudfront.net (CloudFront)
X-Cache: Miss from cloudfront
Content-Length: 348
X-Amz-Cf-Id: fnhyRMih280jqOVj-UmKIl45oVzS56cnojby0UFxNjzICSDYZo2qiw==
Date: Mon, 14 Sep 2026 13:01:12 GMT
Content-Type: application/json
X-Amz-Cf-Pop: SGN50-P2
Server: elb
```

**Request Body:**
```json
{}
```

**Response Body:**
```json
{
  "code": 0,
  "msg": "",
  "data": {
    "biz_code": 0,
    "biz_msg": "",
    "biz_data": {
      "chat_session": {
        "id": "8f6d9d3d-f483-421c-b407-cef50dc4775d",
        "seq_id": 211554072,
        "agent": "chat",
        "model_type": "default",
        "title": null,
        "title_type": "WIP",
        "version": 0,
        "current_message_id": null,
        "pinned": false,
        "inserted_at": 1789390872.532,
        "updated_at": 1789390872.532
      },
      "ttl_seconds": 259200
    }
  }
}
```

