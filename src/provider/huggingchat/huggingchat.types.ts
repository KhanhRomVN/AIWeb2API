/**
 * ------------------------------------------------------------------
 * HuggingChat Types
 * ------------------------------------------------------------------
 * Type definitions cho HuggingChat API.
 *
 * Main exports:
 * - HuggingChatUserInfo                   : User profile info
 * - HuggingChatUserResponse               : Response shape của /chat/api/v2/user
 * - HuggingChatConversationCreateRequest  : Request body tạo conversation
 * - HuggingChatConversationCreateResponse : Response của create conversation
 * - HuggingChatConversationDetails        : Response của conversation detail
 * - HuggingChatConversationMessage        : Message entry trong conversation
 * - HuggingChatStreamPayload              : Request payload cho stream completion
 * - HuggingChatSSEChunk                   : Một dòng stream từ API
 * - HuggingChatModelProvider / Entry      : Model metadata từ models API
 * - HuggingChatModelOutput                : Kết quả trả về của getModels()
 * ------------------------------------------------------------------
 */

// ─── User ───────────────────────────────────────────────────────────────

export interface HuggingChatUserInfo {
  email: string | null;
}

export interface HuggingChatUserResponse {
  email?: string;
  username?: string;
}

// ─── Conversation ───────────────────────────────────────────────────────

export interface HuggingChatConversationCreateRequest {
  model: string;
  preprompt: string;
}

export interface HuggingChatConversationCreateResponse {
  conversationId?: string;
}

export interface HuggingChatConversationMessage {
  id: string;
}

export interface HuggingChatConversationDetails {
  json?: {
    messages?: HuggingChatConversationMessage[];
    rootMessageId?: string;
  };
  messages?: HuggingChatConversationMessage[];
  rootMessageId?: string;
}

// ─── Stream Payload ─────────────────────────────────────────────────────

export interface HuggingChatStreamPayload {
  inputs: string;
  id: string;
  is_retry: boolean;
  is_continue: boolean;
  selectedMcpServerNames: string[];
  selectedMcpServers: string[];
}

export interface HuggingChatSSEChunk {
  type?: string;
  token?: string;
}

// ─── Models ─────────────────────────────────────────────────────────────

export interface HuggingChatModelProvider {
  context_length?: number;
}

export interface HuggingChatModelEntry {
  id: string;
  displayName?: string;
  name?: string;
  providers?: HuggingChatModelProvider[];
}

export interface HuggingChatModelOutput {
  id: string;
  name: string;
  is_thinking: boolean;
  max_context_length: number | null;
}

export interface HuggingChatModelsResponse {
  json?: HuggingChatModelEntry[];
  models?: HuggingChatModelEntry[];
}