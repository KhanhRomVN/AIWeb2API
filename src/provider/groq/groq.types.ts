/**
 * ------------------------------------------------------------------
 * Groq Types
 * ------------------------------------------------------------------
 * Type definitions cho Groq API.
 *
 * Main exports:
 * - GroqUserProfile     : Profile trả về từ getUserProfile
 * - GroqChatMessage     : Message item trong chat payload
 * - GroqChatPayload     : Body gửi lên /chat/completions
 * - GroqSSEEvent        : Event payload trong SSE stream
 * - GroqJwtPayload      : Cấu trúc JWT session của Stytch
 * - GroqModelRaw        : Raw item từ models API
 * - GroqModelInfo       : Model đã normalize cho frontend
 * ------------------------------------------------------------------
 */

// ─── User ───────────────────────────────────────────────────────────────

export interface GroqUserProfile {
  email?: string;
  name?: string;
  id?: string;
}

// ─── Chat ───────────────────────────────────────────────────────────────

export interface GroqChatMessage {
  role: string;
  content: string;
}

export interface GroqChatPayload {
  model: string;
  messages: GroqChatMessage[];
  stream: true;
}

// ─── SSE ────────────────────────────────────────────────────────────────

export interface GroqSSEEvent {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

// ─── JWT (Stytch session) ───────────────────────────────────────────────

export interface GroqJwtEmailFactor {
  email_address?: string;
}

export interface GroqJwtAuthFactor {
  email_factor?: GroqJwtEmailFactor;
}

export interface GroqJwtSession {
  authentication_factors?: GroqJwtAuthFactor[];
}

export interface GroqJwtPayload {
  'https://stytch.com/session'?: GroqJwtSession;
}

// ─── Models ─────────────────────────────────────────────────────────────

/** Raw model item trả về từ Groq models API. */
export interface GroqModelRaw {
  id: string;
  active?: boolean;
  context_window?: number;
  metadata?: {
    display_name?: string;
    model_card?: string;
  };
  features?: {
    reasoning?: boolean;
  };
}

/** Model đã normalize cho frontend. */
export interface GroqModelInfo {
  id: string;
  name: string;
  description?: string;
  max_context_length?: number;
  is_thinking: boolean;
}