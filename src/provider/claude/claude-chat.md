# Phân tích 2 HTTPS Request gửi tin nhắn (Claude Completion API)

**Thời điểm phân tích:** 2026-09-17
**Host:** claude.ai
**Endpoint:** `/api/organizations/{org_id}/chat_conversations/{conversation_id}/completion`

Hai request dưới đây là 2 lần gửi tin nhắn (completion) duy nhất được ghi nhận trong phiên traffic, đại diện cho 2 cấu hình khác nhau.

---

## Bảng so sánh cấu hình

| Thuộc tính | Request #209 (OFF + LOW) | Request #22 (ON + MEDIUM) |
|---|---|---|
| Conversation ID | `4e2b70a8-d37d-4ea9-a373-ad8e1ff056c5` | `9cbeb609-bd14-4a17-9902-cc54136740e1` |
| Prompt | `xin chào` | `hãy suy nghĩ rồi mới xin chào` |
| model | `claude-sonnet-5` | `claude-sonnet-5` |
| **effort** | **`low`** | **`medium`** |
| **thinking_mode** | **`off`** | **`auto`** |
| **chat_memory_mode** | **`disabled`** | **`enabled`** |
| is_temporary | `false` | `false` |
| enabled_imagine | `true` | `true` |
| completion_request_id | `99284bb9-6e89-410e-8bee-8931cce3955b` | `aad95708-fd73-48e2-a9bd-6a27f261363d` |
| Kết quả | Failed (`net::ERR_ABORTED`) | Failed (`net::ERR_ABORTED`) |

**Ghi chú về "plugin":** Trường `tools` trong body của cả hai request gần như giống hệt nhau (đều chứa `web_search_v0`, `artifacts_v0`, `repl_v0`, và toàn bộ danh sách widget). Việc bật/tắt trên thực tế được thể hiện qua các trường `thinking_mode` và `chat_memory_mode`:
- Request #209: `thinking_mode: "off"`, `chat_memory_mode: "disabled"` → tắt thinking + memory
- Request #22: `thinking_mode: "auto"`, `chat_memory_mode: "enabled"` → bật thinking + memory

Không có trường riêng biệt thể hiện trạng thái on/off của `web_search` trong body — `web_search_v0` luôn xuất hiện trong mảng `tools` ở cả hai request.

---

## Request #209 — OFF hết plugin + effort LOW

### Request

- **Method:** `POST`
- **URL:** `https://claude.ai/api/organizations/bb8efd7a-e973-4271-84ab-2f85ad59ebef/chat_conversations/4e2b70a8-d37d-4ea9-a373-ad8e1ff056c5/completion`

**Headers:**

```http
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
x-datadog-parent-id: 3235646706077214051
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/new
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
x-datadog-trace-id: 16367422473804090010
traceparent: 00-0000000000000000e324c40587d68a9a-2ce7538936652563-01
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
accept: text/event-stream
Content-Type: application/json
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-sampling-priority: 1
```

**Body:**

```json
{
  "prompt": "xin chào",
  "timezone": "Asia/Saigon",
  "locale": "en-US",
  "model": "claude-sonnet-5",
  "effort": "low",
  "thinking_mode": "off",
  "tools": [
    {
      "name": "read_me",
      "description": "Returns required context for show_widget (CSS variables, colors, typography, layout rules, examples). Call before your first show_widget call. Call again later if you need a different module. Do NOT mention or narrate this call to the user — it is an internal setup step. Call it silently and proceed directly to the visualization in your response.",
      "input_schema": {
        "type": "object",
        "properties": {
          "modules": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": ["diagram", "mockup", "interactive", "data_viz", "art", "chart", "elicitation"]
            },
            "description": "Which module(s) to load. Pick all that fit."
          },
          "platform": {
            "type": "string",
            "enum": ["mobile", "desktop", "unknown"],
            "description": "The client platform the widget will render on. Pass 'mobile' when your system prompt indicates a mobile client (narrow ~380px viewport) so SVG viewBox and layout guidance are sized accordingly; otherwise pass 'desktop'. Defaults to 'unknown' (desktop sizing)."
          }
        }
      },
      "integration_name": "visualize",
      "mcp_server_uuid": "6f616b42-0ed8-571e-823f-ee4aca6b7ce9",
      "mcp_server_url": "https://sandbox.claudemcpcontent.com/imagine_mcp",
      "needs_approval": false,
      "backend_execution": true,
      "read_only_hint": true,
      "is_mcp_app": false
    },
    {
      "name": "show_widget",
      "description": "Show visual content — SVG graphics, diagrams, charts, or interactive HTML widgets — that renders inline alongside your text response. Use for flowcharts, architecture diagrams, dashboards, forms, calculators, data tables, games, illustrations, or any visual content. The code is auto-detected: starts with <svg = SVG mode, otherwise HTML mode. A global sendPrompt(text) function is available — it sends a message to chat as if the user typed it. IMPORTANT: Call read_me before your first show_widget call. Do NOT narrate or mention the read_me call to the user — call it silently, then respond as if you went straight to building the visualization.",
      "input_schema": {
        "type": "object",
        "properties": {
          "loading_messages": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
            "maxItems": 4,
            "description": "1–4 loading messages shown to the user while the visual renders, each roughly 5 words long. Write them in the same language the user is using. Use 1 for simple visuals, more for complex ones. If the topic is serious — illness, disease, pandemics, death, grief, war, conflict, poverty, disaster, trauma, abuse, addiction, medical decisions, politically charged subjects, or anything where the reader might be personally affected — keep these BORING: describe what the code is doing in the dullest generic way, no jargon-as-drama, no evocative terms. Pandemic growth model — NOT ['Simulating patient zero', 'Modeling the curve'] (documentary-narrator voice), YES ['Setting up the model', 'Running the calculation']. Cancer timeline — NOT ['Charting the battle ahead'], YES ['Laying out the stages']. If you have to ask whether it's serious, it is. Otherwise, have fun — reach for alliteration, puns, personification, wordplay, whatever lands in that language. Playful examples — revenue chart: ['Bribing bars to stand taller', 'Asking Q4 where it went']; kanban: ['Herding cards into columns', 'Dragging, dropping, not stopping']."
          },
          "title": {
            "type": "string",
            "description": "Short snake_case identifier for this visual. Must be specific and disambiguating — if the conversation has multiple visuals, this title alone should tell you which one is being referenced (e.g. 'q4_revenue_by_product_line' not 'chart', 'oauth_login_flow' not 'diagram'). Also used as the download filename, so no spaces or special characters."
          },
          "widget_code": {
            "type": "string",
            "description": "SVG or HTML code to render. For SVG: raw SVG code starting with <svg> tag, must use CSS variables for colors. Example: <svg viewBox=\"0 0 700 400\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>. For HTML: raw HTML content to render, do NOT include DOCTYPE, <html>, <head>, or <body> tags. Use CSS variables for theming. Keep background transparent and avoid top-level padding. Scripts are supported but execute after streaming completes."
          }
        },
        "required": ["loading_messages", "title", "widget_code"]
      },
      "integration_name": "visualize",
      "mcp_server_uuid": "6f616b42-0ed8-571e-823f-ee4aca6b7ce9",
      "mcp_server_url": "https://sandbox.claudemcpcontent.com/imagine_mcp",
      "needs_approval": false,
      "backend_execution": true,
      "read_only_hint": true,
      "is_mcp_app": true
    },
    {"type": "artifacts_v0", "name": "artifacts"},
    {"type": "repl_v0", "name": "repl"},
    {"type": "widget", "name": "weather_fetch"},
    {"type": "widget", "name": "recipe_display_v0"},
    {"type": "widget", "name": "places_map_display_v0"},
    {"type": "widget", "name": "message_compose_v1"},
    {"type": "widget", "name": "ask_user_input_v0"},
    {"type": "widget", "name": "recommend_claude_apps"},
    {"type": "widget", "name": "show_recommendation_cards"},
    {"type": "widget", "name": "chart_display_v0"},
    {"type": "widget", "name": "places_search"},
    {"type": "widget", "name": "fetch_sports_data"},
    {"type": "widget", "name": "options_card_display_v0"},
    {"type": "widget", "name": "step_card_display_v0"},
    {"type": "widget", "name": "itinerary_display_v0"},
    {"type": "widget", "name": "translation_display_v0"},
    {"type": "widget", "name": "comparison_card_display_v0"},
    {"type": "widget", "name": "featured_card_display_v0"},
    {"type": "widget", "name": "product_carousel_display_v0"},
    {"type": "widget", "name": "link_preview_display_v0"},
    {"type": "widget", "name": "places_list_display_v0"},
    {"type": "widget", "name": "quiz_display_v0"}
  ],
  "turn_message_uuids": {
    "human_message_uuid": "01a0aeae-b252-781c-8045-eed7ed24f724",
    "assistant_message_uuid": "01a0aeae-b252-76c0-8888-a616ed31fdb7"
  },
  "attachments": [],
  "files": [],
  "sync_sources": [],
  "completion_request_id": "99284bb9-6e89-410e-8bee-8931cce3955b",
  "rendering_mode": "messages",
  "create_conversation_params": {
    "name": "",
    "model": "claude-sonnet-5",
    "include_conversation_preferences": true,
    "paprika_mode": null,
    "compass_mode": null,
    "tool_search_mode": "auto",
    "is_temporary": false,
    "chat_memory_mode": "disabled",
    "enabled_imagine": true
  }
}
```

### Response

- **Status:** N/A
- **Headers:**

```http
X-Request-Status: Failed
X-Error: net::ERR_ABORTED
```

- **Body:** (empty)

---

## Request #22 — BẬT hết plugin + effort MEDIUM

### Request

- **Method:** `POST`
- **URL:** `https://claude.ai/api/organizations/bb8efd7a-e973-4271-84ab-2f85ad59ebef/chat_conversations/9cbeb609-bd14-4a17-9902-cc54136740e1/completion`

**Headers:**

```http
x-datadog-origin: rum
anthropic-device-id: 6c9e5798-0d9c-4bb2-957f-4bd743a94370
x-datadog-parent-id: 3469898184392788535
sec-ch-ua-platform: "Linux"
Referer: https://claude.ai/new
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-mobile: ?0
x-datadog-trace-id: 5480885852690684786
traceparent: 00-00000000000000004c1004a4e0179b72-30278e03af814a37-01
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
accept: text/event-stream
Content-Type: application/json
anthropic-client-platform: web_claude_ai
tracestate: dd=s:1;o:rum
x-datadog-sampling-priority: 1
```

**Body:**

```json
{
  "prompt": "hãy suy nghĩ rồi mới xin chào",
  "timezone": "Asia/Saigon",
  "locale": "en-US",
  "model": "claude-sonnet-5",
  "effort": "medium",
  "thinking_mode": "auto",
  "tools": [
    {
      "name": "read_me",
      "description": "Returns required context for show_widget (CSS variables, colors, typography, layout rules, examples). Call before your first show_widget call. Call again later if you need a different module. Do NOT mention or narrate this call to the user — it is an internal setup step. Call it silently and proceed directly to the visualization in your response.",
      "input_schema": {
        "type": "object",
        "properties": {
          "modules": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": ["diagram", "mockup", "interactive", "data_viz", "art", "chart", "elicitation"]
            },
            "description": "Which module(s) to load. Pick all that fit."
          },
          "platform": {
            "type": "string",
            "enum": ["mobile", "desktop", "unknown"],
            "description": "The client platform the widget will render on. Pass 'mobile' when your system prompt indicates a mobile client (narrow ~380px viewport) so SVG viewBox and layout guidance are sized accordingly; otherwise pass 'desktop'. Defaults to 'unknown' (desktop sizing)."
          }
        }
      },
      "integration_name": "visualize",
      "mcp_server_uuid": "6f616b42-0ed8-571e-823f-ee4aca6b7ce9",
      "mcp_server_url": "https://sandbox.claudemcpcontent.com/imagine_mcp",
      "needs_approval": false,
      "backend_execution": true,
      "read_only_hint": true,
      "is_mcp_app": false
    },
    {
      "name": "show_widget",
      "description": "Show visual content — SVG graphics, diagrams, charts, or interactive HTML widgets — that renders inline alongside your text response. Use for flowcharts, architecture diagrams, dashboards, forms, calculators, data tables, games, illustrations, or any visual content. The code is auto-detected: starts with <svg = SVG mode, otherwise HTML mode. A global sendPrompt(text) function is available — it sends a message to chat as if the user typed it. IMPORTANT: Call read_me before your first show_widget call. Do NOT narrate or mention the read_me call to the user — call it silently, then respond as if you went straight to building the visualization.",
      "input_schema": {
        "type": "object",
        "properties": {
          "loading_messages": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
            "maxItems": 4,
            "description": "1–4 loading messages shown to the user while the visual renders, each roughly 5 words long. Write them in the same language the user is using. Use 1 for simple visuals, more for complex ones. If the topic is serious — illness, disease, pandemics, death, grief, war, conflict, poverty, disaster, trauma, abuse, addiction, medical decisions, politically charged subjects, or anything where the reader might be personally affected — keep these BORING: describe what the code is doing in the dullest generic way, no jargon-as-drama, no evocative terms. Pandemic growth model — NOT ['Simulating patient zero', 'Modeling the curve'] (documentary-narrator voice), YES ['Setting up the model', 'Running the calculation']. Cancer timeline — NOT ['Charting the battle ahead'], YES ['Laying out the stages']. If you have to ask whether it's serious, it is. Otherwise, have fun — reach for alliteration, puns, personification, wordplay, whatever lands in that language. Playful examples — revenue chart: ['Bribing bars to stand taller', 'Asking Q4 where it went']; kanban: ['Herding cards into columns', 'Dragging, dropping, not stopping']."
          },
          "title": {
            "type": "string",
            "description": "Short snake_case identifier for this visual. Must be specific and disambiguating — if the conversation has multiple visuals, this title alone should tell you which one is being referenced (e.g. 'q4_revenue_by_product_line' not 'chart', 'oauth_login_flow' not 'diagram'). Also used as the download filename, so no spaces or special characters."
          },
          "widget_code": {
            "type": "string",
            "description": "SVG or HTML code to render. For SVG: raw SVG code starting with <svg> tag, must use CSS variables for colors. Example: <svg viewBox=\"0 0 700 400\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>. For HTML: raw HTML content to render, do NOT include DOCTYPE, <html>, <head>, or <body> tags. Use CSS variables for theming. Keep background transparent and avoid top-level padding. Scripts are supported but execute after streaming completes."
          }
        },
        "required": ["loading_messages", "title", "widget_code"]
      },
      "integration_name": "visualize",
      "mcp_server_uuid": "6f616b42-0ed8-571e-823f-ee4aca6b7ce9",
      "mcp_server_url": "https://sandbox.claudemcpcontent.com/imagine_mcp",
      "needs_approval": false,
      "backend_execution": true,
      "read_only_hint": true,
      "is_mcp_app": true
    },
    {"type": "web_search_v0", "name": "web_search"},
    {"type": "artifacts_v0", "name": "artifacts"},
    {"type": "repl_v0", "name": "repl"},
    {"type": "widget", "name": "weather_fetch"},
    {"type": "widget", "name": "recipe_display_v0"},
    {"type": "widget", "name": "places_map_display_v0"},
    {"type": "widget", "name": "message_compose_v1"},
    {"type": "widget", "name": "ask_user_input_v0"},
    {"type": "widget", "name": "recommend_claude_apps"},
    {"type": "widget", "name": "show_recommendation_cards"},
    {"type": "widget", "name": "chart_display_v0"},
    {"type": "widget", "name": "places_search"},
    {"type": "widget", "name": "fetch_sports_data"},
    {"type": "widget", "name": "options_card_display_v0"},
    {"type": "widget", "name": "step_card_display_v0"},
    {"type": "widget", "name": "itinerary_display_v0"},
    {"type": "widget", "name": "translation_display_v0"},
    {"type": "widget", "name": "comparison_card_display_v0"},
    {"type": "widget", "name": "featured_card_display_v0"},
    {"type": "widget", "name": "product_carousel_display_v0"},
    {"type": "widget", "name": "link_preview_display_v0"},
    {"type": "widget", "name": "places_list_display_v0"},
    {"type": "widget", "name": "quiz_display_v0"}
  ],
  "turn_message_uuids": {
    "human_message_uuid": "01a0aeaf-18ed-78d0-b05b-220cb6b51ef4",
    "assistant_message_uuid": "01a0aeaf-18ee-728d-a542-2c3dbc47dc67"
  },
  "attachments": [],
  "files": [],
  "sync_sources": [],
  "completion_request_id": "aad95708-fd73-48e2-a9bd-6a27f261363d",
  "rendering_mode": "messages",
  "create_conversation_params": {
    "name": "",
    "model": "claude-sonnet-5",
    "include_conversation_preferences": true,
    "paprika_mode": "auto",
    "compass_mode": null,
    "tool_search_mode": "auto",
    "is_temporary": false,
    "chat_memory_mode": "enabled",
    "enabled_imagine": true
  }
}
```

### Response

- **Status:** N/A
- **Headers:**

```http
X-Request-Status: Failed
X-Error: net::ERR_ABORTED
```

- **Body:** (empty)

---

## Ghi chú quan trọng

1. **Cả hai request đều bị hủy** (`net::ERR_ABORTED`, status 0) — không có response body. Điều này có thể do người dùng hủy gửi hoặc kết nối bị ngắt giữa chừng.
2. **Không có header `Authorization`** trong cả hai request — phiên này sử dụng cookie (không thấy trong header capture) để xác thực, không dùng Bearer token tường minh.
3. **Sự khác biệt "plugin bật/tắt"** chủ yếu thể hiện ở các trường `thinking_mode` và `chat_memory_mode`. Mảng `tools` gần như đồng nhất giữa hai request (request #22 có thêm `web_search_v0` trong khi #209 không có).
4. **`tool_search_mode`**: cả hai đều là `"auto"`.
5. **`paprika_mode`**: #209 = `null`, #22 = `"auto"`.