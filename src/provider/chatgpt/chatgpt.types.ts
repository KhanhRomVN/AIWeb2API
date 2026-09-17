/**
 * ------------------------------------------------------------------
 * ChatGPT Types
 * ------------------------------------------------------------------
 * Type definitions cho ChatGPT web backend (chatgpt.com).
 *
 * Main exports:
 * - ChatGPTCredential               : Credential đã parse
 * - ChatGPTUserInfo                 : Thông tin user từ /backend-api/me
 * - SentinelPrepareResponse         : Response của sentinel prepare
 * - ChatRequirements                : Token cần cho request conversation
 * - ConversationMessage             : Message theo format web
 * - ConversationPayload             : Body gửi lên /backend-api/conversation
 * - ConversationSSEEvent            : Event payload trong SSE stream
 * - ParsedConversationSSE           : Kết quả parse 1 chunk SSE
 * ------------------------------------------------------------------
 */

// ─── Credential ─────────────────────────────────────────────────────────

/**
 * Credential ChatGPT đã parse từ JSON string hoặc raw access token.
 * - `accessToken` : bearer access token (thường bắt đầu bằng `eyJ`)
 * - `deviceId`    : OAI device id; sinh UUID nếu credential không có
 */
export interface ChatGPTCredential {
  accessToken: string;
  deviceId: string | null;
}

// ─── User Info ──────────────────────────────────────────────────────────

export interface ChatGPTUserInfo {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
}

// ─── Sentinel / Requirements ────────────────────────────────────────────

export interface SentinelProofOfWork {
  required?: boolean;
  seed?: string;
  difficulty?: string;
}

export interface SentinelTurnstile {
  required?: boolean;
  dx?: string;
}

export interface SentinelArkose {
  required?: boolean;
}

export interface SentinelPrepareResponse {
  prepare_token?: string;
  proofofwork?: SentinelProofOfWork;
  turnstile?: SentinelTurnstile;
  arkose?: SentinelArkose;
}

export interface SentinelFinalizeResponse {
  token?: string;
  so_token?: string;
}

/** Token cần cho header của request conversation. */
export interface ChatRequirements {
  token: string;
  proofToken: string;
  turnstileToken: string;
  soToken: string;
}

// ─── Conversation ───────────────────────────────────────────────────────

export interface ConversationAuthor {
  role: string;
}

export interface ConversationContent {
  content_type: string;
  parts: unknown[];
}

export interface ConversationMessage {
  id: string;
  author: ConversationAuthor;
  content: ConversationContent;
  metadata?: Record<string, unknown>;
}

export interface ConversationClientContextualInfo {
  is_dark_mode: boolean;
  time_since_loaded: number;
  page_height: number;
  page_width: number;
  pixel_ratio: number;
  screen_height: number;
  screen_width: number;
}

export interface ConversationPayload {
  action: string;
  messages: ConversationMessage[];
  model: string;
  parent_message_id: string;
  conversation_mode: { kind: string };
  conversation_origin: null;
  force_paragen: boolean;
  force_paragen_model_slug: string;
  force_rate_limit: boolean;
  force_use_sse: boolean;
  history_and_training_disabled: boolean;
  reset_rate_limits: boolean;
  suggestions: unknown[];
  supported_encodings: unknown[];
  system_hints: unknown[];
  timezone: string;
  timezone_offset_min: number;
  variant_purpose: string;
  websocket_request_id: string;
  client_contextual_info: ConversationClientContextualInfo;
  thinking_effort?: string;
}

// ─── SSE Stream ─────────────────────────────────────────────────────────

export interface ConversationSSEMessage {
  id?: string;
  author?: ConversationAuthor;
  content?: ConversationContent;
  status?: string;
  end_turn?: boolean;
  metadata?: Record<string, unknown>;
  recipient?: string;
}

export interface ConversationSSEEvent {
  message?: ConversationSSEMessage;
  conversation_id?: string;
  error?: string;
  type?: string;
}

/** Kết quả parse 1 dòng SSE từ stream conversation. */
export interface ParsedConversationSSE {
  /** Nội dung text delta của assistant (nếu có). */
  content?: string;
  /** Nội dung thinking/analysis (nếu có). */
  thinking?: string;
  /** Conversation id (khi upstream gửi). */
  conversationId?: string;
  /** Message id của assistant response (khi upstream gửi). */
  messageId?: string;
  /** Status cuối cùng của response ("finished_successfully", ...). */
  status?: string;
  /** True nếu là sự kiện kết thúc stream. */
  done?: boolean;
}

// ─── Errors ─────────────────────────────────────────────────────────────

export interface ChatGPTUpstreamError extends Error {
  status?: number;
  code?: string;
  retryAfter?: number;
}