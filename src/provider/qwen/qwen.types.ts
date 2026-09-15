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
    thinking_format?: string;
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
  search?: boolean;
  vision?: boolean;
  document?: boolean;
  video?: boolean;
  audio?: boolean;
  citations?: boolean;
}

export interface QwenModelAbilities {
  vision?: number;
  document?: number;
  video?: number;
  audio?: number;
  mcp?: number;
  thinking?: number;
  parse_url?: number;
  citations?: number;
}

export interface QwenModelMeta {
  profile_image_url?: string;
  description?: string;
  short_description?: string;
  max_context_length?: number;
  max_summary_generation_length?: number;
  max_thinking_generation_length?: number;
  max_generation_length?: number;
  capabilities?: QwenModelCapability;
  abilities?: QwenModelAbilities;
  auto_thinking?: boolean;
  auto_search?: boolean;
  thinking_format?: string;
  chat_type?: string[];
  // TODO: MCP tools array - lists available MCP tools for this model
  // Examples: ["image-generation", "code-interpreter", "amap", "fire-crawl"]
  mcp?: string[];
  modality?: string[];
  think_skip?: {
    enable?: boolean;
  };
}

export interface QwenModelInfo {
  id: string;
  user_id?: string;
  base_model_id?: string | null;
  name: string;
  is_active: boolean;
  is_visitor_active?: boolean;
  meta?: QwenModelMeta;
  access_control?: unknown;
  updated_at?: number;
  created_at?: number;
}

export interface QwenModel {
  id: string;
  name: string;
  object: string;
  owned_by: string;
  info: QwenModelInfo;
  preset?: boolean;
  action_ids?: unknown[];
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
  parent_id?: string;
  response_id?: string;
  response_index?: string;
  created?: number;
}

export interface SSEDelta {
  role?: string;
  reasoning_content?: string;
  content?: string;
  phase?: string;
  status?: string;
  extra?: {
    summary_title?: {
      content?: string[];
    };
    summary_thought?: {
      content?: string[];
    };
    display_position?: string;
  };
  function_call?: {
    name?: string;
    arguments?: string;
  };
  function_id?: string;
  name?: string;
}

export interface SSEChoice {
  delta?: SSEDelta;
}

export interface SSEUsageDetails {
  text_tokens?: number;
  reasoning_tokens?: number;
  cached_tokens?: number;
}

export interface SSEUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  characters?: number;
  input_tokens_details?: SSEUsageDetails;
  output_tokens_details?: SSEUsageDetails;
  prompt_tokens_details?: SSEUsageDetails;
}

export interface SSEEventPayload {
  'response.created'?: SSEResponseCreated;
  response?: {
    created?: SSEResponseCreated;
  };
  choices?: SSEChoice[];
  response_id?: string;
  usage?: SSEUsage;
  timestamp?: number;
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

// ─── File Upload ──────────────────────────────────────────────────────

export interface UploadFileInput {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface UploadResult {
  id: string;
  url: string;
  token_usage: number;
}

export interface STSTokenData {
  access_key_id: string;
  access_key_secret: string;
  security_token: string;
  file_url: string;
  file_path: string;
  file_id: string;
  bucketname: string;
  region: string;
  endpoint: string;
}

export interface STSTokenResponse {
  success: boolean;
  request_id?: string;
  message?: string;
  data?: STSTokenData;
}

export interface FileStatusData {
  file_id: string;
  status: string;
  token_usage?: number;
}

export interface FileParseStatusResponse {
  success: boolean;
  request_id?: string;
  message?: string;
  data?: FileStatusData[];
}