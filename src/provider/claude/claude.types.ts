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
 * - `content_block_delta` với `delta.text` / `delta.thinking`
 * - `message_stop` khi kết thúc
 */
export interface ClaudeSSEEvent {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
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
    text?: string;
  };
}

// ─── Proxy ──────────────────────────────────────────────────────────────

/** Payload emit qua proxyEvents khi capture được cookie + orgId. */
export interface ClaudeLoginTokenPayload {
  cookies: string;
  organizationId?: string;
  email?: string;
}