/**
 * ------------------------------------------------------------------
 * Cline Types
 * ------------------------------------------------------------------
 * Type definitions cho Cline provider.
 *
 * Main exports:
 * - ClineAccount           : Thông tin 1 Cline account trong pool
 * - ClineModelEntry        : Entry của 1 model trong danh sách
 * - ClineModelsResponse    : Response của /v1/models upstream
 * - ClineRecommendedResponse: Response của /ai/cline/recommended-models
 * - ClineAuthRefreshRequest  : Request body cho /auth/refresh
 * - ClineAuthRefreshResponse : Response của /auth/refresh
 * - ClineRegisterRequest   : Request body cho /auth/register (WorkOS)
 * - ClineRegisterResponse  : Response của /auth/register
 * - WorkOSDeviceResponse   : Response của WorkOS device authorization
 * - WorkOSTokenResponse    : Response của WorkOS authenticate
 * - ClineCredential        : Credential được parse từ JSON string
 * ------------------------------------------------------------------
 */

// ─── Account Pool ───────────────────────────────────────────────────────

/**
 * Mỗi account trong pool: lưu refreshToken + cache accessToken + trạng thái cooldown.
 * Cline rotate refreshToken mỗi lần refresh → phải cập nhật liên tục.
 */
export interface ClineAccount {
  /** WorkOS refresh token — có thể bị rotate sau mỗi lần gọi /auth/refresh */
  refreshToken: string;
  /** Cached WorkOS access token (prefixed với "workos:") */
  accessToken: string | null;
  /** Timestamp (ms) khi accessToken hết hạn */
  expiry: number;
  /** Timestamp (ms) khi hết cooldown (0 = không cooldown) */
  cooldownUntil: number;
}

// ─── Model ──────────────────────────────────────────────────────────────

export interface ClineModelEntry {
  id: string;
  upstream: string;
  provider: string;
  cost: 'free' | 'pass' | 'paid';
}

export interface ClineModelsResponse {
  data?: Array<{
    id?: string;
    batch?: boolean;
  }>;
}

export interface ClineRecommendedResponse {
  free?: Array<{
    id?: string;
  }>;
}

// ─── Auth ────────────────────────────────────────────────────────────────

export interface ClineAuthRefreshRequest {
  refreshToken: string;
  grantType: 'refresh_token';
}

export interface ClineAuthRefreshData {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number | string;
}

export interface ClineAuthRefreshResponse {
  data?: ClineAuthRefreshData;
}

export interface ClineRegisterRequest {
  accessToken: string;
  refreshToken: string;
}

export interface ClineRegisterUserInfo {
  email?: string;
  id?: string;
}

export interface ClineRegisterData {
  refreshToken?: string;
  accessToken?: string;
  userInfo?: ClineRegisterUserInfo;
}

export interface ClineRegisterResponse {
  data?: ClineRegisterData;
}

// ─── WorkOS OAuth ────────────────────────────────────────────────────────

export interface WorkOSDeviceResponse {
  device_code: string;
  user_code: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  interval?: number;
  expires_in?: number;
}

export interface WorkOSTokenResponse {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

// ─── Credential ──────────────────────────────────────────────────────────

/**
 * Credential đã parse — lưu refreshToken (bắt buộc) và email (tùy chọn).
 * Credential string có thể là:
 *   - Raw refreshToken (legacy)
 *   - JSON: `{ "refreshToken": "...", "email": "..." }`
 */
export interface ClineCredential {
  refreshToken: string;
  email?: string;
}

// ─── Chat Request / Response ─────────────────────────────────────────────

export interface ClineMessage {
  role: string;
  content: string;
}

export interface ClineChatBody {
  model: string;
  session_id: string;
  reasoning_effort: string;
  messages: ClineMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  stop?: unknown;
  presence_penalty?: number;
  frequency_penalty?: number;
  response_format?: unknown;
  user?: string;
  n?: number;
  seed?: number;
}

// ─── SSE Aggregation ─────────────────────────────────────────────────────

export interface AggregatedChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
      reasoning?: string;
      reasoning_used_as_content?: boolean;
    };
    finish_reason: string;
    logprobs: null;
    native_finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
