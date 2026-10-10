/**
 * ------------------------------------------------------------------
 * Freebuff CLI Types
 * ------------------------------------------------------------------
 * Type definitions cho Freebuff CLI / Bearer protocol.
 * Giao thức này giao tiếp với https://www.codebuff.com thông qua
 * Authorization: Bearer <authToken>.
 *
 * Main exports:
 * - FreebuffCliCredential      : Bearer token credential
 * - FreebuffCliSessionResponse : Response từ /api/v1/freebuff/session
 * - FreebuffCliAgentRunRequest / Response
 * - FreebuffCliChatPayload     : Request body cho /api/v1/chat/completions
 * - FreebuffCliSSEEvent        : Union type của tất cả SSE events
 * - FreebuffCliChatMetadata    : Metadata thu được từ SSE stream
 * ------------------------------------------------------------------
 */

// ─── Credential ─────────────────────────────────────────────────────────

/**
 * Credential Freebuff CLI đã parse.
 * Format lưu trong DB: raw Bearer token string hoặc JSON { token }.
 */
export interface FreebuffCliCredential {
  token: string;
}

// ─── Session ─────────────────────────────────────────────────────────────

export type FreebuffCliSessionStatus = 'active' | 'queued' | 'ended' | 'superseded';

export interface FreebuffCliSessionResponse {
  status: FreebuffCliSessionStatus;
  sessionId?: string;
  /** Thời gian (giây) cần chờ khi status = "queued" */
  retryAfter?: number;
  /** Rate limits theo model */
  rateLimitsByModel?: Record<string, { limit: number; remaining: number }>;
  /** Instance ID của session này */
  instanceId?: string;
}

// ─── Agent Run ────────────────────────────────────────────────────────────

export interface FreebuffCliAgentRunRequest {
  action: 'START' | 'FINISH';
  agentId?: string;
  ancestorRunIds?: string[];
  runId?: string;
  status?: 'completed' | 'error';
  totalSteps?: number;
}

export interface FreebuffCliAgentRunResponse {
  runId: string;
  status?: string;
}

// ─── Chat Payload ─────────────────────────────────────────────────────────

export interface FreebuffCliCodebuffMetadata {
  run_id: string;
  cost_mode: 'free';
  client_id: string;
  freebuff_instance_id: string;
}

export interface FreebuffCliChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface FreebuffCliChatPayload {
  model: string;
  messages: FreebuffCliChatMessage[];
  stream: boolean;
  /** Mức độ thinking: "low" | "medium" | "high" | "max" */
  reasoning_effort?: string | null;
  codebuff_metadata: FreebuffCliCodebuffMetadata;
  max_tokens?: number;
}

// ─── SSE Events ──────────────────────────────────────────────────────────

/** Chunk thông thường (OpenAI-compatible format) */
export interface FreebuffCliSSEChunk {
  id?: string;
  object?: string;
  model?: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/** Kết quả parse SSE stream */
export interface FreebuffCliParseResult {
  /** Content text đã tích luỹ */
  accumulatedContent: string;
  /** Thinking text đã tích luỹ */
  accumulatedThinking: string;
  /** Token usage từ server */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// ─── Metadata (phát ra qua onMetadata) ───────────────────────────────────

export interface FreebuffCliChatMetadata {
  conversation_id?: string;
  total_token?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  model?: string;
}

// ─── Ads (gia hạn session) ────────────────────────────────────────────────

export interface FreebuffCliAdRequest {
  placement: string;
}

export interface FreebuffCliAdImpressionRequest {
  adId: string;
  placement: string;
}

// ─── User / Profile ──────────────────────────────────────────────────────

export interface FreebuffCliUserProfile {
  id?: string;
  email?: string;
  name?: string;
}

// ─── Stop Generation ─────────────────────────────────────────────────────

export interface FreebuffCliStopRequest {
  model?: string;
}
