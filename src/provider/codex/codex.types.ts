/**
 * ------------------------------------------------------------------
 * Codex Types
 * ------------------------------------------------------------------
 * Type definitions cho Codex provider (ChatGPT/Codex OAuth gateway).
 *
 * Main exports:
 * - CodexCredential             : Credential format (refresh_token / access_token)
 * - CodexChatPayload            : Request payload cho /backend-api/codex/responses
 * - CodexInputItem              : Input item trong request
 * - CodexSSEEvent / CodexSSEChunk : SSE stream types
 * - CodexUsageInfo              : Token usage info
 * - CodexModelInfo              : Model info từ manifest
 * ------------------------------------------------------------------
 */

// ─── Credential ─────────────────────────────────────────────────────────

/**
 * Credential cho Codex provider.
 * - `accessToken`  : JWT access token (ngắn hạn, ~1 giờ).
 * - `refreshToken` : Refresh token (dài hạn, dùng để gia hạn access token).
 * - `email`        : Email tài khoản (tùy chọn, dùng cho logging).
 *
 * Format lưu trữ: JSON string `{"accessToken":"...","refreshToken":"...","email":"..."}`
 * hoặc raw access token (legacy).
 */
export interface CodexCredential {
  accessToken: string;
  refreshToken?: string;
  email?: string;
}

// ─── Request Payload ─────────────────────────────────────────────────────

/**
 * Input item trong request body (message, image, tool call, v.v.)
 */
export interface CodexInputItem {
  type: 'message' | 'function_call_output' | string;
  role?: 'user' | 'assistant' | 'system' | string;
  content?: string | CodexContentPart[];
  call_id?: string;
  output?: string;
  [key: string]: unknown;
}

/**
 * Content part (text hoặc image) bên trong một message
 */
export interface CodexContentPart {
  type: 'input_text' | 'input_image' | 'input_file' | 'text' | string;
  text?: string;
  image_url?: string;
  file_id?: string;
  filename?: string;
  file_data?: string;
  [key: string]: unknown;
}

/**
 * Request payload gửi tới `POST /backend-api/codex/responses`
 */
export interface CodexChatPayload {
  model: string;
  input: CodexInputItem[];
  instructions?: string;
  stream?: boolean;
  prompt_cache_key?: string;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  reasoning?: {
    effort?: 'low' | 'medium' | 'high';
    summary?: string;
    context?: string;
  };
  tools?: unknown[];
  tool_choice?: unknown;
  parallel_tool_calls?: boolean;
  [key: string]: unknown;
}

// ─── SSE Response ─────────────────────────────────────────────────────────

/**
 * Một chunk từ SSE stream của Codex /responses
 */
export interface CodexSSEChunk {
  type: string;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    refusal?: string;
  };
  output_index?: number;
  content_index?: number;
  item_id?: string;
  response?: CodexSSEResponse;
  part?: CodexSSEPart;
  sequence_number?: number;
  error?: {
    type?: string;
    code?: string;
    message?: string;
    resets_in_seconds?: number;
  };
  [key: string]: unknown;
}

export interface CodexSSEResponse {
  id?: string;
  object?: string;
  model?: string;
  status?: 'in_progress' | 'completed' | 'failed' | 'cancelled' | string;
  output?: CodexSSEOutputItem[];
  usage?: CodexUsageInfo;
  error?: {
    type?: string;
    code?: string;
    message?: string;
  };
}

export interface CodexSSEOutputItem {
  type?: string;
  id?: string;
  status?: string;
  role?: string;
  content?: CodexSSEContentPart[];
}

export interface CodexSSEContentPart {
  type?: string;
  text?: string;
  annotations?: unknown[];
}

export interface CodexSSEPart {
  type?: string;
  text?: string;
}

/**
 * Token usage information
 */
export interface CodexUsageInfo {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
    text_tokens?: number;
    image_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
    text_tokens?: number;
  };
}

// ─── SSE Event Types ─────────────────────────────────────────────────────

/**
 * Các event type trong SSE stream của Codex
 */
export type CodexSSEEventType =
  | 'response.created'
  | 'response.in_progress'
  | 'response.output_item.added'
  | 'response.output_item.done'
  | 'response.content_part.added'
  | 'response.content_part.done'
  | 'response.output_text.delta'
  | 'response.output_text.done'
  | 'response.output_text.annotation.added'
  | 'response.reasoning.delta'
  | 'response.reasoning.done'
  | 'response.reasoning_summary.delta'
  | 'response.reasoning_summary.done'
  | 'response.refusal.delta'
  | 'response.refusal.done'
  | 'response.function_call_arguments.delta'
  | 'response.function_call_arguments.done'
  | 'response.file_search_call.searching'
  | 'response.file_search_call.completed'
  | 'response.web_search_call.searching'
  | 'response.web_search_call.completed'
  | 'response.image_generation_call.generating'
  | 'response.image_generation_call.partial_image'
  | 'response.image_generation_call.completed'
  | 'response.usage'
  | 'response.done'
  | 'response.failed'
  | 'response.cancelled'
  | 'rate_limit_exceeded'
  | 'error'
  | string;

// ─── Models ──────────────────────────────────────────────────────────────

export interface CodexModelInfo {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  capabilities?: string[];
}

// ─── OAuth Token Response ─────────────────────────────────────────────────

export interface CodexTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export interface CodexIDTokenClaims {
  email?: string;
  sub?: string;
  name?: string;
  'https://api.openai.com/auth'?: {
    user_id?: string;
    account_id?: string;
  };
  'https://api.openai.com/profile'?: {
    email?: string;
    name?: string;
  };
}

// ─── Error ───────────────────────────────────────────────────────────────

export interface CodexAPIError {
  error?: {
    type?: string;
    code?: string;
    message?: string;
    resets_in_seconds?: number;
  };
  message?: string;
  type?: string;
  code?: string;
  status?: number;
}
