/**
 * ------------------------------------------------------------------
 * Qwen CLI Types
 * ------------------------------------------------------------------
 * Type definitions cho Qwen CLI API.
 *
 * Main exports:
 * - QwenTokens        : Credential tokens (access + refresh)
 * - QwenUserProfile   : Profile từ user info API
 * - QwenTokenResponse : Response từ OAuth token endpoint
 * - QwenChatPayload   : Body gửi lên chat completions
 * - QwenChatMessage   : Message item trong chat payload
 * - QwenSSEEvent      : Event payload trong SSE stream
 * ------------------------------------------------------------------
 */

// ─── Credential / Token ─────────────────────────────────────────────────

export interface QwenTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface QwenTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  response?: string;
}

// ─── User ───────────────────────────────────────────────────────────────

export interface QwenUserProfile {
  email?: string;
  username?: string;
  data?: {
    email?: string;
  };
}

// ─── Chat ───────────────────────────────────────────────────────────────

export interface QwenChatMessage {
  role: string;
  content: Array<{ type: string; text: string }>;
}

export interface QwenChatPayload {
  model: string;
  messages: QwenChatMessage[];
  stream: boolean;
  stream_options?: { include_usage: boolean };
}

// ─── SSE ────────────────────────────────────────────────────────────────

export interface QwenSSEEvent {
  choices?: Array<{
    delta?: { content?: string };
    message?: { content?: string };
  }>;
}