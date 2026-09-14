/**
 * ------------------------------------------------------------------
 * Mistral Types
 * ------------------------------------------------------------------
 * Type definitions cho Mistral AI API.
 *
 * Main exports:
 * - MistralUserProfile   : Profile từ /api/users/me
 * - MistralChatPayload   : Body gửi lên /api/chat
 * - MistralMessageInput  : Message input item
 * - MistralPatch         : Patch item trong stream event
 * - MistralStreamEvent   : Event payload trong SSE stream
 * ------------------------------------------------------------------
 */

// ─── User ───────────────────────────────────────────────────────────────

export interface MistralUserProfile {
  email?: string;
  name?: string;
  full_name?: string;
  id?: string;
}

// ─── Chat Payload ───────────────────────────────────────────────────────

export interface MistralMessageInput {
  type: string;
  text: string;
}

export interface MistralClientPromptData {
  currentDate: string;
  userTimezone: string;
}

export interface MistralChatPayload {
  chatId: string;
  mode: string;
  disabledFeatures: unknown[];
  clientPromptData: MistralClientPromptData;
  stableAnonymousIdentifier: string;
  shouldAwaitStreamBackgroundTasks: boolean;
  shouldUseMessagePatch: boolean;
  shouldUsePersistentStream: boolean;
  messageInput?: MistralMessageInput[];
  messageFiles?: unknown[];
  messageId?: string;
  features?: readonly string[];
  libraries?: unknown[];
  integrations?: unknown[];
}

// ─── Stream Event ───────────────────────────────────────────────────────

export interface MistralPatch {
  op: string;
  path: string;
  value?: unknown;
}

export interface MistralStreamEvent {
  json?: {
    patches?: MistralPatch[];
  };
}