/**
 * ------------------------------------------------------------------
 * Z.AI Types
 * ------------------------------------------------------------------
 * Type definitions cho Z.AI API.
 *
 * Main exports:
 * - ZAIAuthData             : Authentication data từ credential
 * - SignatureResult         : Signature generation result
 * - ZAIUserAgentDetails     : Parsed user-agent details
 * - ZAIApiEnvelope<T>       : Envelope chung của mọi response
 * - CreateChatPayload       : /chats/new request payload
 * - ChatCompletionPayload   : /chat/completions request payload
 * - ZAIUserInfo             : User info từ JWT
 * - ZAIModel                : Model info
 * - SSEEventPayload         : SSE event data
 * - ZAIChatMessage          : Message trong conversation
 * ------------------------------------------------------------------
 */

// ─── Auth & Credential ───────────────────────────────────────────────

export interface ZAIAuthData {
  token: string;
  userId: string;
  email?: string;
  cookies?: string;
  userAgent?: string;
}

export interface SignatureResult {
  signature: string;
  timestamp: string;
  requestId: string;
  queryParams: string;
}

export interface ZAIUserAgentDetails {
  osName: string;
  secChUaPlatform: string;
  secChUa: string;
}

// ─── API Envelope ─────────────────────────────────────────────────────

/**
 * Envelope chung của Z.AI API. Shape thường là:
 * `{ id, ... }` cho create chat hoặc `{ data: T }` cho completion.
 */
export interface ZAIApiEnvelope<T = unknown> {
  id?: string;
  code?: number;
  msg?: string;
  message?: string;
  data?: T | null;
}

// ─── Chat Payload ─────────────────────────────────────────────────────

export interface CreateChatHistoryMessage {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  role: string;
  content: string;
  timestamp: number;
  models: string[];
}

export interface CreateChatFeature {
  server: string;
  status: string;
  type: string;
}

export interface CreateChatPayload {
  chat: {
    id: string;
    title: string;
    models: string[];
    params: Record<string, unknown>;
    history: {
      messages: Record<string, CreateChatHistoryMessage>;
      currentId: string;
    };
    tags: string[];
    flags: string[];
    features: CreateChatFeature[];
    mcp_servers: unknown[];
    enable_thinking: boolean;
    auto_web_search: boolean;
    message_version: number;
    extra: Record<string, unknown>;
    timestamp: number;
    type: string;
  };
}

export interface ChatCompletionFeatures {
  image_generation: boolean;
  web_search: boolean;
  auto_web_search: boolean;
  preview_mode: boolean;
  flags: string[];
  vlm_tools_enable: boolean;
  vlm_web_search_enable: boolean;
  vlm_website_mode: boolean;
  enable_thinking: boolean;
}

export interface ChatCompletionVariables {
  '{{USER_NAME}}': string;
  '{{USER_LOCATION}}': string;
  '{{CURRENT_DATETIME}}': string;
  '{{CURRENT_DATE}}': string;
  '{{CURRENT_TIME}}': string;
  '{{CURRENT_WEEKDAY}}': string;
  '{{CURRENT_TIMEZONE}}': string;
  '{{USER_LANGUAGE}}': string;
}

export interface ChatCompletionMessage {
  role: string;
  content: string;
}

export interface ChatCompletionBackgroundTasks {
  title_generation: boolean;
  tags_generation: boolean;
}

export interface ChatCompletionPayload {
  stream: boolean;
  model: string;
  messages: ChatCompletionMessage[];
  signature_prompt: string;
  params: Record<string, unknown>;
  extra: Record<string, unknown>;
  features: ChatCompletionFeatures;
  variables: ChatCompletionVariables;
  chat_id: string;
  id: string;
  current_user_message_id: string;
  current_user_message_parent_id: string | null;
  background_tasks: ChatCompletionBackgroundTasks;
  requestId: string;
  timestamp: number;
}

// ─── User & Model ─────────────────────────────────────────────────────

export interface ZAIUserInfo {
  email: string | null;
  id?: string;
  name?: string;
}

export interface ZAIModel {
  id: string;
  name: string;
  is_thinking: boolean;
  max_context_length: number | null;
}

// ─── Chat Session & Message ───────────────────────────────────────────

export interface ZAIChatSession {
  id: string;
}

export interface ZAIChatMessage {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  role: 'user' | 'assistant' | string;
  content: string;
  timestamp: number;
  models: string[];
}

// ─── SSE ──────────────────────────────────────────────────────────────

export interface SSEResponseData {
  phase?: 'thinking' | 'response' | string;
  delta_content?: string;
  done?: boolean;
}

export interface SSEEventPayload {
  data?: SSEResponseData;
}