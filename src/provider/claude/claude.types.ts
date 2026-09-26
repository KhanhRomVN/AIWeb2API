/**
 * ------------------------------------------------------------------
 * Claude Types
 * ------------------------------------------------------------------
 * Type definitions cho Claude AI API (claude.ai web).
 *
 * Main exports:
 * - ClaudeCredential          : Credential đã parse ({ cookies, organizationId })
 * - ClaudeUserProfile         : User info (từ bootstrap hoặc conversation load)
 * - ClaudeBootstrapModel      : Model item trong bootstrap models config
 * - ClaudeBootstrapResponse   : Response của /edge-api/bootstrap/{org}/app_start
 * - ClaudeCompletionPayload   : Body gửi lên /completion
 * - ClaudeUploadResponse      : Response của /wiggle/upload-file
 * - ClaudeSSEEvent            : Event payload trong SSE stream
 * - ClaudeLoginTokenPayload   : Payload emit qua proxyEvents khi capture cookie
 * ------------------------------------------------------------------
 */

// ─── Credential ─────────────────────────────────────────────────────────

/**
 * Credential Claude đã parse từ JSON string.
 * - `cookies`        : Chuỗi cookie thô (chứa `sessionKey`, `__cf_bm`, ...)
 * - `organizationId` : UUID organization — bắt buộc cho mọi request chat/upload
 *                      (lấy từ bootstrap response khi login lần đầu).
 */
export interface ClaudeCredential {
  cookies: string;
  organizationId: string | null;
  /** Unix timestamp (giây) khi sessionKey hết hạn. Null nếu không xác định được. */
  sessionKeyExpiresAt?: number | null;
}

// ─── User ───────────────────────────────────────────────────────────────

export interface ClaudeUserProfile {
  email?: string;
  name?: string;
  id?: string;
}

/** Account object trong bootstrap response. */
export interface ClaudeBootstrapAccount {
  tagged_id?: string;
  uuid?: string;
  email_address?: string;
  full_name?: string;
  display_name?: string;
  memberships?: Array<{
    organization?: {
      id?: number;
      uuid?: string;
      name?: string;
      claude_ai_bootstrap_models_config?: ClaudeBootstrapModel[];
    };
    role?: string;
  }>;
}

// ─── Models ─────────────────────────────────────────────────────────────

/**
 * Model item trong `claude_ai_bootstrap_models_config[]`.
 * Chỉ khai báo các trường được dùng; các trường khác giữ optional.
 */
export interface ClaudeBootstrapModel {
  model: string;
  name: string;
  description?: string;
  notice_text?: string;
  /** `true` nếu model cũ, không còn hiển thị mặc định trong UI. */
  inactive?: boolean;
  /** `true` nếu model này nằm trong overflow menu. */
  overflow?: boolean;
  paprika_modes?: string[];
  thinking_modes?: Array<{
    id?: string;
    mode?: string;
    title?: string;
    description?: string;
    selection_title?: string;
    paprika_mode_value?: string;
  }>;
  capabilities?: {
    mm_pdf?: boolean;
    mm_images?: boolean;
    web_search?: boolean;
    gsuite_tools?: boolean;
    compass?: boolean;
  };
  hard_limit?: number;
  knowledgeCutoff?: string;
}

/** Response của `/edge-api/bootstrap/{org}/app_start`. */
export interface ClaudeBootstrapResponse {
  account?: ClaudeBootstrapAccount;
  /**
   * Nguồn dữ liệu ĐÚNG cho effort/capabilities/trạng thái disabled (mới),
   * thay thế `claude_ai_bootstrap_models_config` (legacy, xem claude.md).
   * Nằm ở root response, không phải trong `account.memberships[]`.
   */
  model_selector_config?: ClaudeModelSelectorSurface[];
}

// ─── Model Selector Config (nguồn effort/capabilities đúng — xem claude.md) ─

/** 1 mức effort trong `thinking.effort_options[]`. */
export interface ClaudeEffortOption {
  /** `low` | `medium` | `high` | `xhigh` (hiển thị "Extra") | `max` | `ultracode` (chỉ surface code). */
  id: string;
  name: string;
  /** `true` nếu đây là effort mặc định của model này (khác nhau giữa các model). */
  recommended?: boolean;
}

/** Cấu hình thinking/effort của 1 model trong `model_selector_config`. */
export interface ClaudeThinkingConfig {
  /**
   * `effort` | `effort_and_mode` → model có effort (dùng `effort_options[]`).
   * `mode` → chỉ có thinking mode (auto/extended/off), không có effort.
   * `none` → không hỗ trợ thinking.
   */
  type: 'effort' | 'effort_and_mode' | 'mode' | 'none';
  effort_options?: ClaudeEffortOption[];
}

/** Model item trong `model_selector_config[].models[]` (nguồn mới, thay legacy). */
export interface ClaudeModelSelectorModel {
  id: string;
  name: string;
  description?: string;
  /** `true` nếu model bị khóa (cần upgrade plan) — nguồn duy nhất đáng tin để filter. */
  disabled?: boolean;
  capabilities?: {
    mm_pdf?: boolean;
    mm_images?: boolean;
    web_search?: boolean;
    gsuite_tools?: boolean;
    compass?: boolean;
  };
  thinking?: ClaudeThinkingConfig;
  hard_limit?: number;
}

/** 1 surface trong `model_selector_config[]` (vd: `chat`, `code`, `cowork`...). */
export interface ClaudeModelSelectorSurface {
  id: string;
  models: ClaudeModelSelectorModel[];
}

// ─── Chat Completion ────────────────────────────────────────────────────

/** Payload của `create_conversation_params` trong completion request. */
export interface ClaudeCreateConversationParams {
  name?: string;
  model: string;
  include_conversation_preferences?: boolean;
  paprika_mode?: string | null;
  compass_mode?: string | null;
  tool_search_mode?: string;
  is_temporary?: boolean;
  chat_memory_mode?: string;
  enabled_imagine?: boolean;
}

/**
 * Body gửi lên `POST /api/organizations/{org}/chat_conversations/{conv}/completion`.
 */
export interface ClaudeCompletionPayload {
  prompt: string;
  timezone: string;
  locale: string;
  model: string;
  effort?: string;
  thinking_mode?: string;
  /** Danh sách tool bật cho request này (ví dụ `web_search_v0`). */
  tools?: Array<Record<string, unknown>>;
  turn_message_uuids: {
    human_message_uuid: string;
    assistant_message_uuid: string;
  };
  attachments?: string[];
  files?: string[];
  sync_sources?: string[];
  completion_request_id: string;
  rendering_mode: string;
  create_conversation_params?: ClaudeCreateConversationParams;
}

/**
 * Body gửi lên `POST /api/organizations/{org}/chat_conversations/{conv}/retry_completion`.
 * Dùng để regenerate response hoặc edit+regenerate từ 1 parent message cụ thể.
 */
export interface ClaudeRetryCompletionPayload {
  /** Prompt mới (rỗng nếu regenerate không đổi nội dung). */
  prompt: string;
  /**
   * UUID của human message mà assistant sẽ reply lại.
   * Đây là parent của assistant message muốn regenerate.
   */
  parent_message_uuid: string;
  timezone: string;
  locale: string;
  model: string;
  effort?: string;
  thinking_mode?: string;
  tools?: Array<Record<string, unknown>>;
  /**
   * Chỉ có `assistant_message_uuid` (không có `human_message_uuid`).
   * Claude sẽ tạo assistant message mới với UUID này.
   */
  turn_message_uuids: {
    assistant_message_uuid: string;
  };
  attachments?: string[];
  files?: string[];
  sync_sources?: string[];
  completion_request_id: string;
  rendering_mode: string;
}

/** Message item trong response của GET conversation. */
export interface ClaudeConversationMessage {
  uuid: string;
  sender: 'human' | 'assistant';
  index: number;
  parent_message_uuid?: string;
  content?: Array<{ type: string; text?: string }>;
  files?: Array<{ file_uuid: string }>;
  input_mode?: string;
}

/** Response của GET conversation endpoint. */
export interface ClaudeConversationResponse {
  uuid: string;
  current_leaf_message_uuid?: string;
  chat_messages?: ClaudeConversationMessage[];
}

// ─── Upload ─────────────────────────────────────────────────────────────

/**
 * Response của `POST /api/organizations/{org}/conversations/{conv}/wiggle/upload-file`.
 */
export interface ClaudeUploadResponse {
  success: boolean;
  path?: string;
  sanitized_name?: string;
  file_kind?: string;
  file_uuid: string;
  file_name?: string;
  created_at?: string;
  user_uuid?: string | null;
  size_bytes?: number;
  thumbnail_url?: string;
  preview_url?: string;
  uuid: string;
}

// ─── SSE ────────────────────────────────────────────────────────────────

/**
 * Event payload của Claude SSE stream.
 * Format tương tự Anthropic Message API:
 * - `content_block_start` với `content_block.type = "tool_use"` (bắt đầu tool call)
 * - `content_block_delta` với `delta.text` / `delta.thinking` (text/thinking chunk)
 * - `content_block_delta` với `delta.type = "input_json_delta"` (tool input chunk)
 * - `message_stop` khi kết thúc
 */
export interface ClaudeSSEEvent {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  message?: {
    id?: string;
    role?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  content_block?: {
    type?: string;
    id?: string;
    name?: string;
    text?: string;
    input?: Record<string, unknown>;
  };
}

// ─── Proxy ──────────────────────────────────────────────────────────────

/** Payload emit qua proxyEvents khi capture được cookie + orgId. */
export interface ClaudeLoginTokenPayload {
  cookies: string;
  organizationId?: string;
  email?: string;
}