/**
 * ------------------------------------------------------------------
 * Cerebras Cloud Types
 * ------------------------------------------------------------------
 * Type definitions cho Cerebras Cloud API.
 *
 * Main exports:
 * - CerebrasMessage               : Message structure
 * - CerebrasCompletionPayload     : Chat completion request payload
 * - CerebrasUserInfo              : User profile info
 * - CerebrasUsageData             : Rate limiting usage data
 * - CerebrasModelEntry            : Model entry từ /v1/models
 * - CerebrasModelsResponse        : Response shape của /v1/models
 * - CerebrasUserSessionResponse   : Response shape của /api/auth/session
 * - CerebrasSSEChunk / Delta / Choice / Usage : SSE chunk types
 * ------------------------------------------------------------------
 */

// ─── Chat / Payload ─────────────────────────────────────────────────────

export interface CerebrasMessage {
  role: string;
  content: string;
}

export interface CerebrasCompletionPayload {
  messages: CerebrasMessage[];
  model: string;
  stream: boolean;
  temperature?: number;
  max_completion_tokens?: number;
  top_p?: number | string;
  tools?: unknown[];
}

// ─── User ───────────────────────────────────────────────────────────────

export interface CerebrasUserInfo {
  email: string | null;
}

export interface CerebrasUserSessionResponse {
  user?: {
    email?: string;
    name?: string;
    id?: string;
  };
}

// ─── Models ─────────────────────────────────────────────────────────────

export interface CerebrasModelEntry {
  id: string;
  description?: string;
  context_window?: number;
  max_tokens?: number;
}

export interface CerebrasModelsResponse {
  data?: CerebrasModelEntry[];
  models?: CerebrasModelEntry[];
}

export interface CerebrasModelOutput {
  id: string;
  name: string;
  description: string;
  max_context_length: number;
  is_thinking: boolean;
}

// ─── Usage / Rate Limiting ──────────────────────────────────────────────

export interface CerebrasUsageData {
  requests: {
    minute: { used: number; limit: number };
    hour: { used: number; limit: number };
    day: { used: number; limit: number };
  };
  tokens: {
    minute: { used: number; limit: number };
    hour: { used: number; limit: number };
    day: { used: number; limit: number };
  };
}

// ─── SSE ────────────────────────────────────────────────────────────────

export interface CerebrasSSEUsage {
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

export interface CerebrasSSEDelta {
  content?: string;
  reasoning?: string;
}

export interface CerebrasSSEChoice {
  delta?: CerebrasSSEDelta;
  finish_reason?: string | null;
}

export interface CerebrasSSEChunk {
  choices?: CerebrasSSEChoice[];
  usage?: CerebrasSSEUsage;
  time_info?: Record<string, unknown>;
}

// ─── Constants (re-export) ──────────────────────���──────────────────────

export {
  RATE_LIMITS,
  WINDOW_MS,
  BASE_URL,
  API_BASE_URL,
} from './cerebras-cloud.constant';