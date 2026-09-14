/**
 * ------------------------------------------------------------------
 * Claude Types
 * ------------------------------------------------------------------
 * Type definitions cho Claude AI API.
 *
 * Main exports:
 * - ClaudeUserProfile       : User info từ /api/auth/me
 * - ClaudeChatMessage       : Message item trong chat payload
 * - ClaudeChatPayload       : Body gửi lên /api/chat
 * - ClaudeSSEEvent          : Event payload trong SSE stream
 * - ClaudeLoginTokenPayload : Payload emit qua proxyEvents khi capture token
 * ------------------------------------------------------------------
 */

// ─── User ───────────────────────────────────────────────────────────────

export interface ClaudeUserProfile {
  email?: string;
  name?: string;
  id?: string;
}

// ─── Chat ───────────────────────────────────────────────────────────────

export interface ClaudeChatMessage {
  role: string;
  content: string;
}

export interface ClaudeChatPayload {
  model: string;
  messages: ClaudeChatMessage[];
  stream: true;
  max_tokens: number;
  conversation_id?: string;
}

// ─── SSE ────────────────────────────────────────────────────────────────

/**
 * Event payload của Claude SSE stream (Anthropic Message API).
 * Chỉ khai báo các trường được dùng trong parser; các trường khác
 * để optional và bỏ qua khi parse.
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

/** Payload emit qua proxyEvents khi capture được login token. */
export interface ClaudeLoginTokenPayload {
  cookies: string;
  email?: string;
}