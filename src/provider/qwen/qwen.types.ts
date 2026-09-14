/**
 * ------------------------------------------------------------------
 * Qwen Types
 * ------------------------------------------------------------------
 * Type definitions cho Qwen AI API.
 *
 * Main exports:
 * - QwenCredential           : Credential structure (accessToken)
 * - QwenApiEnvelope<T>       : Envelope chung của mọi response
 * - CreateChatPayload        : /chats/new request payload
 * - ChatCompletionPayload    : /chat/completions request payload
 * - QwenUserInfo             : User info từ API
 * - QwenModel                : Model info từ API
 * - SSEResponseCreated       : SSE response.created event
 * - SSEEventPayload          : SSE event data
 * - QwenChatMessage          : Message trong conversation
 * ------------------------------------------------------------------
 */

// ─── Credential ───────────────────────────────────────────────────────

export interface QwenCredential {
  accessToken: string;
}

// ─── API Envelope ─────────────────────────────────────────────────────

/**
 * Envelope chung của Qwen API. Shape thường là:
 * `{ code, data: T }` hoặc `{ success, data: T }`.
 */
export interface QwenApiEnvelope<T = unknown> {
  code?: number;
  success?: boolean;
  msg?: string;
  message?: string;
  data?: T | null;
  details?: unknown;
}

// ─── Chat Payload ─────────────────────────────────────────────────────

export interface CreateChatPayload {
  models: string[];
  project_id?: string;
  timestamp: number;
  chat_type: string;
  chat_mode: string;
}

export interface ChatCompletionMessage {
  id: string | null;
  fid: string;
  parent_id: string | null;
  childrenIds: string[];
  role: string;
  content: string;
  user_action: string;
  files: unknown[];
  timestamp: number;
  models: string[];
  model: string;
  chat_type: string;
  feature_config?: {
    thinking_enabled: boolean;
    output_schema: string;
    research_mode: string;
    auto_thinking: boolean;
    thinking_mode: string;
    auto_search: boolean;
  };
  extra?: {
    meta: {
      subChatType: string;
    };
  };
  sub_chat_type: string;
}

export interface ChatCompletionPayload {
  stream: boolean;
  version: string;
  incremental_output: boolean;
  chatId: string;
  parentId: string | null;
  chat_id?: string;
  chat_mode: string;
  model: string;
  parent_id: string | null;
  messages: ChatCompletionMessage[];
  timestamp: number;
}

// ─── User & Model ─────────────────────────────────────────────────────

export interface QwenUserInfo {
  id: string;
  email: string;
  name?: string;
  accessToken?: string;
  bxUa?: string;
  bxUmidToken?: string;
  userAgent?: string;
}

export interface QwenModelCapability {
  thinking?: boolean;
  max_context_length?: number;
  search?: boolean;
  vision?: boolean;
}

export interface QwenModelMeta {
  short_description?: string;
  description?: string;
}

export interface QwenModelInfo {
  id: string;
  name: string;
  is_active: boolean;
  meta?: QwenModelMeta;
  capabilities?: QwenModelCapability;
}

export interface QwenModel {
  info: QwenModelInfo;
}

// ─── Chat Session & Message ───────────────────────────────────────────

export interface QwenChatSession {
  id: string;
  chatId?: string;
}

export interface QwenChatMessage {
  message_id?: string;
  id?: string;
  role: 'user' | 'assistant' | string;
  content?: string;
  parent_id?: string | null;
}

// ─── SSE ──────────────────────────────────────────────────────────────

export interface SSEResponseCreated {
  chat_id?: string;
  response_id?: string;
  created?: number;
}

export interface SSEDelta {
  reasoning_content?: string;
  content?: string;
}

export interface SSEChoice {
  delta?: SSEDelta;
}

export interface SSEEventPayload {
  'response.created'?: SSEResponseCreated;
  response?: {
    created?: SSEResponseCreated;
  };
  choices?: SSEChoice[];
}

// ─── Auth Response ────────────────────────────────────────────────────

export interface AuthResponseData {
  accessToken: string;
  access_token?: string;
  token?: string;
  email?: string;
  name?: string;
  id?: string;
  bxUa?: string;
  bxUmidToken?: string;
  userAgent?: string;
}