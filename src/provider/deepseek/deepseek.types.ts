// =============================================================================
// TYPES & INTERFACES — DeepSeek
// =============================================================================

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
  model?: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  search?: boolean;
  conversation_id?: string;
  ref_file_ids?: string[];
  thinking?: boolean;
  parent_message_id?: string;
  client_stream_id?: string;
  chat_session_id?: string;
  prompt?: string;
  thinking_enabled?: boolean;
  search_enabled?: boolean;
  model_type?: string;
}

export interface ContinuePayload {
  request: string; // JSON-stringified { chat_session_id, message_id, fallback_to_resume }
  response: string; // The prior SSE stream text (can be empty string for auto-resume)
}