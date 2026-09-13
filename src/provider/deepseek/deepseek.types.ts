/**
 * ------------------------------------------------------------------
 * DeepSeek Types
 * ------------------------------------------------------------------
 * Type definitions cho DeepSeek API.
 *
 * Main exports:
 * - PoWChallenge        : PoW challenge structure
 * - PoWResponse         : PoW response structure
 * - ChatPayload         : Chat completion request payload
 * ------------------------------------------------------------------
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface PoWChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  difficulty: number;
  signature: string;
  expire_at: number;
  target_path: string;
}

export interface PoWResponse {
  algorithm: string;
  challenge: string;
  salt: string;
  answer: number;
  signature: string;
  target_path: string;
}

export interface ChatPayload {
  chat_session_id: string;
  parent_message_id: string | null | undefined;
  model_type: string;
  prompt: string;
  ref_file_ids: string[];
  thinking_enabled: boolean;
  search_enabled: boolean;
  action: null;
  preempt: boolean;
}