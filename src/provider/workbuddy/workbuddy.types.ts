/**
 * ------------------------------------------------------------------
 * WorkBuddy Types
 * ------------------------------------------------------------------
 * Type definitions cho WorkBuddy / CodeBuddy provider.
 *
 * Main exports:
 * - WorkBuddyCredential       : Credential lưu trữ tài khoản
 * - WorkBuddyAuthResponse     : Response từ auth token refresh
 * - WorkBuddyLoginState       : State lưu giữa url và poll step
 * - WorkBuddyModelInfo        : Model info từ upstream
 * - WorkBuddyChatMeta         : Metadata cho 1 chat request
 * - WorkBuddyApiEnvelope<T>   : Envelope chung của mọi response
 * ------------------------------------------------------------------
 */

// ─── Credential ──────────────────────────────────────────────────────

/**
 * Credential cho một tài khoản WorkBuddy/CodeBuddy.
 * Lưu dưới dạng JSON string trong database.
 *
 * realm: 'cn' = codebuddy.cn, 'global' = workbuddy.ai
 */
export interface WorkBuddyCredential {
  accessToken: string;
  refreshToken: string;
  /** Unix timestamp (giây) khi access token hết hạn — lấy từ JWT exp */
  expiresAt: number;
  /** Realm của tài khoản: 'cn' hoặc 'global' — bắt buộc để chọn đúng upstream URL */
  realm: 'cn' | 'global';
  /** User ID từ JWT sub */
  uid: string;
  /** Enterprise ID — chỉ có với CN realm enterprise account */
  enterpriseId?: string;
  /** Device token cho X-Device-Token header (anti-fraud) */
  deviceToken?: string;
}

// ─── Auth / Token ─────────────────────────────────────────────────────

/**
 * Response body từ POST /v2/plugin/auth/token/refresh
 */
export interface WorkBuddyTokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * State file lưu giữa bước "url" và "poll" trong OAuth login flow.
 */
export interface WorkBuddyLoginState {
  state: string;
  authUrl: string;
  realm: 'cn' | 'global';
  createdAt: number; // Unix ms
}

// ─── API Envelope ─────────────────────────────────────────────────────

/**
 * Envelope chung của WorkBuddy/CodeBuddy API.
 * Hầu hết response có shape: { code: 0, msg: '', data: T }
 */
export interface WorkBuddyApiEnvelope<T = unknown> {
  code: number;
  msg?: string;
  data?: T | null;
}

// ─── Model ────────────────────────────────────────────────────────────

/**
 * Model info từ upstream (từ /v3/config hoặc /console/enterprises/...)
 */
export interface WorkBuddyModelInfo {
  /** Model ID (ví dụ: deepseek-v3, claude-3-5-sonnet) */
  id: string;
  name?: string;
  description?: string;
  /** Có hỗ trợ ảnh không */
  supportsImages?: boolean;
  /** Có hỗ trợ thinking/reasoning không */
  supportsThinking?: boolean;
  /** Có hỗ trợ tool call không */
  supportsToolCall?: boolean;
  /** Context window (tokens) */
  contextWindow?: number;
  /** Max output tokens */
  maxOutputTokens?: number;
  /** Có phải model mặc định không */
  isDefault?: boolean;
  /** Credits cost factor */
  credits?: number;
  /** Tags (e.g. 'fast', 'powerful') */
  tags?: string[];
  /** Vendor (anthropic, deepseek, openai, ...) */
  vendor?: string;
}

/**
 * Entry trong /v3/config → modelPromotions (khuyến mãi: free, 50%...)
 */
export interface WorkBuddyModelPromotion {
  modelId: string;
  discountType?: string;
  discountValue?: number;
}

// ─── Chat ─────────────────────────────────────────────────────────────

/**
 * Metadata cho một chat request – dùng để dựng conversation headers
 * (X-Conversation-ID, X-Conversation-Request-ID, X-Root-Request-ID)
 */
export interface WorkBuddyChatMeta {
  /** X-Conversation-ID: từ body request (transparent pass-through) */
  conversationId?: string;
  /** X-Conversation-Request-ID: aggregate key, required */
  conversationRequestId: string;
  /** X-Trace-ID: pass-through, fallback to conversationRequestId if empty */
  traceId?: string;
}

// ─── Credit / Billing ─────────────────────────────────────────────────

/**
 * Thông tin một gói credit của tài khoản
 */
export interface WorkBuddyCreditPackage {
  remain: number;
  used: number;
  size: number;
  expiresAt?: number;
  /** true = gói tặng lần đầu */
  isFirstGift?: boolean;
}

/**
 * Response từ /billing/meter/get-user-resource
 */
export interface WorkBuddyUserResource {
  totalRemain?: number;
  totalUsed?: number;
  packages?: WorkBuddyCreditPackage[];
}

// ─── SSE Parsing ──────────────────────────────────────────────────────

/**
 * Chunk từ SSE stream của WorkBuddy (tương thích OpenAI SSE format)
 */
export interface WorkBuddySseChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
      tool_calls?: any[];
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Error Classification ─────────────────────────────────────────────

export type WorkBuddyErrKind =
  | 'none'
  | 'hard_credit'
  | 'soft_rate'
  | 'session_dead'
  | 'not_found'
  | 'server'
  | 'content_blocked'
  | 'bad_params'
  | 'account_fault'
  | 'model_blocked'
  | 'waf_block'
  | 'prompt_too_long'
  | 'image_invalid'
  | 'client';

export interface WorkBuddyUpstreamError {
  kind: WorkBuddyErrKind;
  status: number;
  message: string;
  /** Retry-After từ upstream header (ms), 0 = upstream không khai báo */
  retryAfterMs?: number;
}
