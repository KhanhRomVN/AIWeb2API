/**
 * ------------------------------------------------------------------
 * Codex CLI Types
 * ------------------------------------------------------------------
 * Type definitions cho Codex CLI API.
 *
 * Main exports:
 * - CodexTokens              : Credential JSON structure
 * - CodexCapturedTokens      : Tokens captured từ proxy event
 * - CodexUserInfo            : User profile info từ usage API
 * - CodexUsageResponse       : Response shape của chatgpt.com usage API
 * - CodexTokenResponse       : Response shape của auth.openai.com/oauth/token
 * - CodexRequestPayload      : Chat completion request payload
 * - CodexInputItem / CodexInputContentPart : Input message structure
 * - CodexReasoningConfig     : Reasoning config
 * - CodexJwtPayload          : JWT payload claim shape
 * - CodexSSEChunk / Delta / Choice : SSE chunk types
 * ------------------------------------------------------------------
 */

// ─── Credential / Tokens ────────────────────────────────────────────────

export interface CodexTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CodexCapturedTokens {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

// ─── User / Usage ───────────────────────────────────────────────────────

export interface CodexUserInfo {
  email: string | null;
  userId?: string;
  accountId?: string;
}

export interface CodexUsageResponse {
  email?: string;
  user_id?: string;
  account_id?: string;
}

// ─── OAuth ──────────────────────────────────────────────────────────────

export interface CodexTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

// ─── Request Payload ────────────────────────────────────────────────────

export interface CodexInputContentPart {
  type: 'output_text' | 'input_text' | string;
  text: string;
}

export interface CodexInputItem {
  type: 'message' | string;
  role: string;
  content: CodexInputContentPart[];
}

export interface CodexReasoningConfig {
  effort: string;
}

export interface CodexRequestPayload {
  model: string;
  instructions: string;
  input: CodexInputItem[];
  store: boolean;
  stream: boolean;
  include: string[];
  reasoning: CodexReasoningConfig;
  conversation_id?: string;
}

// ─── JWT ────────────────────────────────────────────────────────────────

export interface CodexJwtPayload {
  'https://api.openai.com/auth'?: {
    chatgpt_account_id?: string;
  };
}

// ─── SSE ────────────────────────────────────────────────────────────────

export interface CodexSSEChoiceDelta {
  content?: string;
}

export interface CodexSSEChoice {
  delta?: CodexSSEChoiceDelta;
  message?: { content?: string };
}

export interface CodexSSEMessage {
  content?: {
    parts?: string[];
  };
}

export interface CodexSSEChunk {
  delta?: string;
  choices?: CodexSSEChoice[];
  message?: CodexSSEMessage;
}