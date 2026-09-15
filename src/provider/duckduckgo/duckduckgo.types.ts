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

// ─── Circuit Breaker State ──────────────────────────────────────────────

export interface CircuitBreakerState {
  failures: number;
  openedAt: number;
}
