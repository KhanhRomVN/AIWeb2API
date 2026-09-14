/**
 * ------------------------------------------------------------------
 * Gemini CLI Types
 * ------------------------------------------------------------------
 * Type definitions cho Gemini CLI API.
 *
 * Main exports:
 * - GeminiTokens                 : Credential JSON structure
 * - GeminiCapturedTokens         : Tokens captured từ proxy event
 * - GeminiUserInfo               : User profile info
 * - GeminiTokenResponse          : Response shape của oauth2 token endpoint
 * - GeminiUserInfoResponse       : Response shape của userinfo endpoint
 * - GeminiLoadCodeAssistResponse : Response shape của loadCodeAssist
 * - GeminiRequestPayload         : Chat completion request payload
 * - GeminiSSEChunk / nested      : SSE chunk types
 * - GeminiQuotaResponse / Bucket : Quota response types
 * - GeminiModelOutput            : Model entry trả về từ getModels()
 * ------------------------------------------------------------------
 */

// ─── Credential / Tokens ────────────────────────────────────────────────

export interface GeminiTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  projectId?: string;
}

export interface GeminiCapturedTokens {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

// ─── User Info ──────────────────────────────────────────────────────────

export interface GeminiUserInfo {
  email: string | null;
  name?: string;
  projectId?: string;
}

export interface GeminiUserInfoResponse {
  email?: string;
  name?: string;
}

// ─── OAuth ──────────────────────────────────────────────────────────────

export interface GeminiTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

// ─── Project ────────────────────────────────────────────────────────────

export interface GeminiLoadCodeAssistResponse {
  cloudaicompanionProject?: string | { id?: string };
}

// ─── Request Payload ────────────────────────────────────────────────────

export interface GeminiInputContent {
  role: string;
  parts: Array<{ text: string }>;
}

export interface GeminiRequestInner {
  contents: GeminiInputContent[];
}

export interface GeminiRequestPayload {
  model: string;
  project: string;
  user_prompt_id: string;
  request: GeminiRequestInner;
}

// ─── SSE ────────────────────────────────────────────────────────────────

export interface GeminiSSEContentPart {
  text?: string;
}

export interface GeminiSSECandidate {
  content?: {
    parts?: GeminiSSEContentPart[];
  };
}

export interface GeminiSSEPayload {
  candidates?: GeminiSSECandidate[];
}

export interface GeminiSSEChunk extends GeminiSSEPayload {
  response?: GeminiSSEPayload;
}

// ─── Quota / Models ─────────────────────────────────────────────────────

export interface GeminiQuotaBucket {
  modelId?: string;
}

export interface GeminiQuotaResponse {
  buckets?: GeminiQuotaBucket[];
}

export interface GeminiModelOutput {
  id: string;
  name: string;
}