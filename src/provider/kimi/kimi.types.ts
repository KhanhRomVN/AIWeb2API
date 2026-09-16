/**
 * ------------------------------------------------------------------
 * Kimi Types
 * ------------------------------------------------------------------
 * Type definitions cho Kimi AI API.
 *
 * Main exports:
 * - KimiCredential         : Credential structure
 * - KimiChatRequest        : Chat request payload
 * - KimiChatBlock / KimiChatTool
 * - KimiSSEEvent / KimiSSEMetadata
 * - KimiTokenResponse / KimiUserResponse / KimiUserInfo
 * - KimiHeadersPayload / KimiLoginTokenPayload / KimiLoginResult
 * ------------------------------------------------------------------
 */

// ─── Credential ─────────────────────────────────────────────────────────

export interface KimiCredential {
  accessToken: string;
  refreshToken?: string;
}

// ─── Chat Request ───────────────────────────────────────────────────────

export interface KimiChatBlock {
  text?: { content: string };
  think?: { content: string };
  multiStage?: { stage?: string; status?: string };
  file?: { id: string; status?: string };
  [key: string]: unknown;
}

export interface KimiChatTool {
  type: string;
  search?: Record<string, unknown>;
}

export interface KimiChatRequest {
  chat_id?: string;
  scenario?: string;
  tools?: KimiChatTool[];
  options?: {
    thinking?: boolean;
    enable_plugin?: boolean;
    reasoning_effort?: string;
    model?: string;
  };
  message?: {
    role: string;
    blocks: KimiChatBlock[];
  };
  kimiplus_id?: string;
}

// ─── SSE ────────────────────────────────────────────────────────────────

export interface KimiSSEMetadata {
  conversation_id?: string;
  error?: string;
  thinking_stage?: string;
  message_status?: string;
}

export interface KimiSSEErrorDetail {
  details?: Array<{
    debug?: {
      localizedMessage?: { message?: string };
    };
  }>;
  message?: string;
  code?: string;
}

export interface KimiSSEEvent {
  done?: unknown;
  heartbeat?: unknown;
  error?: KimiSSEErrorDetail;
  chat?: {
    id?: string;
    lastRequest?: { id?: string };
  };
  block?: {
    text?: { content?: string };
    think?: { content?: string };
    multiStage?: { stage?: string; status?: string };
  };
  mask?: string;
  message?: { status?: string };
}

// ─── API Response ───────────────────────────────────────────────────────

export interface KimiUserInfo {
  id?: string;
  email?: string;
  name?: string;
  nickname?: string;
}

export interface KimiTokenResponse {
  accessToken?: string;
  access_token?: string;
  token?: string;
  refreshToken?: string;
  refresh_token?: string;
  data?: {
    token?: string;
    access_token?: string;
    accessToken?: string;
    refresh_token?: string;
    refreshToken?: string;
    email?: string;
    name?: string;
  };
  user?: KimiUserInfo;
  email?: string;
  name?: string;
  nickname?: string;
  thirdParty?: unknown;
}

export interface KimiUserResponse {
  user?: KimiUserInfo;
  data?: { email?: string; name?: string };
}

// ─── Models API ─────────────────────────────────────────────────────────

export interface KimiAvailableModel {
  id?: string;
  key?: string;
  displayName?: string;
  description?: string;
  scenario?: string;
  reasoningEffortOptions?: Array<{ effort?: string; displayName?: string }>;
  defaultReasoningEffort?: string;
  contextLengthOptions?: Array<{ contextLength?: string; available?: boolean }>;
  defaultContextLength?: string;
  minMembershipLevel?: string;
  label?: string[];
}

export interface KimiAvailableModelsResponse {
  availableModels?: KimiAvailableModel[];
}

export interface KimiHeadersPayload {
  [key: string]: string;
}

export interface KimiLoginTokenPayload {
  token?: string;
  cookies?: string;
  email?: string;
  refreshToken?: string;
  refresh_token?: string;
  headers?: KimiHeadersPayload;
}

export interface KimiLoginResult {
  email: string;
  cookies: string;
  headers?: KimiHeadersPayload;
}

// ─── Upload ─────────────────────────────────────────────────────────────

export interface KimiFileMeta {
  name?: string;
  contentType?: string;
  sizeBytes?: string;
  ext?: string;
  createTime?: string;
  type?: string;
}

export interface KimiFileBlob {
  signUrl?: string;
  previewUrl?: string;
}

export interface KimiFileParseResult {
  thumbnail?: {
    thumbnailUrl?: string;
    previewUrl?: string;
    mobileThumbnailUrl?: string;
  };
}

export interface KimiFile {
  id?: string;
  meta?: KimiFileMeta;
  blob?: KimiFileBlob;
  parseResult?: KimiFileParseResult;
}

export interface KimiUploadResponse {
  file?: KimiFile;
}

export interface KimiFileParseProgress {
  fileId?: string;
  status?: string;
}

export interface KimiFileParseProgressResponse {
  progresses?: KimiFileParseProgress[];
}

export interface KimiUploadResult {
  id: string;
  url?: string;
}