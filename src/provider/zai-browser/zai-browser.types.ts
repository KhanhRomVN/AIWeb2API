/**
 * ------------------------------------------------------------------
 * Z.AI Browser Types
 * ------------------------------------------------------------------
 * Type definitions cho Z.AI Browser provider.
 *
 * Main exports:
 * - ParsedZaiCredential      : Parsed credential structure
 * - ZaiBrowserUserInfo       : User info từ cookies
 * - WebSocketRequestHandler  : Handler callbacks cho WebSocket
 * - ZaiBrowserModel          : Model info
 * - ZaiBrowserChatSession    : Chat session info
 * ------------------------------------------------------------------
 */

// ─── Credential & Auth ───────────────────────────────────────────────

export interface ParsedZaiCredential {
  cookies: string;
  userAgent: string;
}

export interface ZaiBrowserUserInfo {
  email: string | null;
  name?: string;
  id?: string;
}

// ─── Model ────────────────────────────────────────────────────────────

export interface ZaiBrowserModel {
  id: string;
  name: string;
  is_thinking: boolean;
  max_context_length: number | null;
  is_search: boolean;
  is_image_upload: boolean;
  is_video_upload: boolean;
  description: string;
}

// ─── Chat Session ─────────────────────────────────────────────────────

export interface ZaiBrowserChatSession {
  id: string;
}

// ─── WebSocket ────────────────────────────────────────────────────────

export interface WebSocketRequestHandler {
  onContent: (chunk: string) => void;
  onThinking?: (chunk: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  onUsage?: (usage: unknown) => void;
}

// ─── Login Result ─────────────────────────────────────────────────────

export interface ZaiBrowserLoginResult {
  user_data_dir?: string;
}