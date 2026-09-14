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
  cookies?: string;
  deviceId?: string;
  sessionId?: string;
  trafficId?: string;
  userAgent?: string;
}

// ─── Chat Request ───────────────────────────────────────────────────────

export interface KimiChatBlock {
  text?: { content: string };
  think?: { content: string };
  multiStage?: { stage?: string; status?: string };
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

// ─── Proxy ──────────────────────────────────────────────────────────────

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