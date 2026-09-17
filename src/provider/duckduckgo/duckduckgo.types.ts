/**
 * ------------------------------------------------------------------
 * DuckDuckGo Types
 * ------------------------------------------------------------------
 * Type definitions cho DuckDuckGo API.
 *
 * Main exports:
 * - DuckDuckGoRequestMessage  : Request message format
 * - DuckDuckGoVqdHeaders      : VQD headers từ status endpoint
 * - DuckDuckGoModelCapabilities : Model capabilities
 * - ChatPayload               : Chat completion request payload
 * ------------------------------------------------------------------
 */

// ─── Request Message ────────────────────────────────────────────────────

export type DuckDuckGoRequestMessage = Record<string, unknown> & {
  role: string;
  content: unknown;
};

// ─── VQD Headers ────────────────────────────────────────────────────────

export interface DuckDuckGoVqdHeaders {
  vqd4: string | null;
  vqdHash1: string | null;
  status: number | null;
  retryAfter: string | null;
}

// ─── Model Capabilities ─────────────────────────────────────────────────

export interface DuckDuckGoModelCapabilities {
  reasoningEffort: string | null;
}

// ─── Chat Payload ───────────────────────────────────────────────────────

export interface ChatPayload {
  model: string;
  messages: DuckDuckGoRequestMessage[];
  metadata?: {
    toolChoice?: Record<string, boolean>;
  };
  canUseTools?: boolean;
  reasoningEffort?: string;
  canUseApproxLocation?: null;
  canDelegateImageGeneration?: null;
  durableStream?: {
    messageId: string;
    conversationId: string;
    publicKey: JsonWebKey;
  };
}

// ─── Chat Options ────────────────────────────────────────────────────────

/**
 * Options điều khiển thinking và search per-request.
 * Được truyền vào buildChatPayload() và handleMessage().
 *
 * - enableSearch  : true → NewsSearch bật trong toolChoice
 * - enableThinking: true → dùng reasoningEffort từ MODEL_CAPABILITIES
 *                   false → force reasoningEffort = "none"
 */
export interface DuckDuckGoChatOptions {
  enableSearch?: boolean;
  enableThinking?: boolean;
}

// ─── Circuit Breaker State ──────────────────────────────────────────────

export interface CircuitBreakerState {
  failures: number;
  openedAt: number;
}
