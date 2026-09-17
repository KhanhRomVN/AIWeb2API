/**
 * ------------------------------------------------------------------
 * DeepSeek Types
 * ------------------------------------------------------------------
 * Type definitions cho DeepSeek API.
 *
 * Main exports:
 * - PoWChallenge / PoWResponse     : PoW challenge & response
 * - ChatPayload                    : Chat completion request payload
 * - ContinuePayload                : /chat/continue request payload
 * - DeepSeekApiEnvelope<T>         : Envelope chung của mọi response
 * - DeepSeekChatSession / DeepSeekChatMessage
 * - DeepSeekUserInfo               : User info từ /users/current
 * - DeepSeekFileItem / UploadFileInput
 * - SSEMetadata / SSEEventPayload  : SSE parser types
 * - WasmExports                    : WASM instance exports
 * ------------------------------------------------------------------
 */

// ─── PoW ────────────────────────────────────────────────────────────────

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

// ─── Chat Payload ───────────────────────────────────────────────────────

export interface ChatPayload {
  chat_session_id: string;
  parent_message_id: string | null | undefined;
  model_type: string | null;
  prompt: string;
  ref_file_ids: string[];
  thinking_enabled: boolean;
  search_enabled: boolean;
  action: null;
  preempt: boolean;
}

export interface ContinuePayload {
  chat_session_id: string;
  message_id: number;
  fallback_to_resume: boolean;
}

// ─── API Envelope ───────────────────────────────────────────────────────

/**
 * Envelope chung của DeepSeek API. Hầu hết response có shape:
 * `{ code, msg, data: { biz_data: T } }`.
 * Với endpoint không có biz_data, `data` chính là `T`.
 */
export interface DeepSeekApiEnvelope<T = unknown> {
  code: number;
  msg?: string;
  data?:
    | (T & {
        biz_data?: T;
      })
    | null;
}

// ─── Session & Message ──────────────────────────────────────────────────

export interface DeepSeekChatSession {
  id: string;
}

export interface DeepSeekChatMessage {
  message_id: string;
  role: 'USER' | 'ASSISTANT' | string;
  content?: string;
}

// ─── User ───────────────────────────────────────────────────────────────

export interface DeepSeekUserInfo {
  id: string;
  email: string;
  name?: string;
  token: string;
}

// ─── Credential ─────────────────────────────────────────────────────────

/**
 * Credential DeepSeek đã parse từ JSON string.
 * - `token`    : bearer token opaque (không phải JWT)
 * - `deviceId` : UUID v4 do client sinh, lưu cố định theo credential.
 *                `null` nếu credential cũ chưa có trường này.
 */
export interface DeepSeekCredential {
  token: string;
  deviceId: string | null;
}

// ─── Auth Renew (check_device) ──────────────────────────────────────────

/**
 * Response của `/api/v0/users/auth_token/check_device`.
 * `rotate` là token mới nếu server muốn rotate, `null` nếu token còn hợp lệ.
 * Doc ghi chú: chưa capture được traffic rotate thực, nên giữ union string|object.
 */
export interface CheckDeviceResponse {
  rotate: string | null | { token?: string };
}

/** Kết quả của renewTokenIfPossible() — trả về credential mới (JSON string) */
export interface RenewResult {
  token: string;
  rotated: boolean;
  newCredential: string;
}

// ─── Upload ─────────────────────────────────────────────────────────────

export interface UploadFileInput {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export type DeepSeekFileStatus = 'SUCCESS' | 'READY' | 'FAIL' | 'ERROR';

export interface DeepSeekFileItem {
  id: string;
  status: DeepSeekFileStatus;
  token_usage: number;
}

export interface UploadResult {
  id: string;
  token_usage: number;
}

// ─── SSE ────────────────────────────────────────────────────────────────

export interface SSEMetadata {
  total_token?: number;
  thinking_elapsed?: number;
  response_message_id?: number;
  conversation_id?: string;
  continuing?: boolean;
  continuation_count?: number;
  continuation_complete?: boolean;
  total_continuations?: number;
}

export interface SSEFragment {
  type: string;
  content?: string;
}

export interface SSEResponseInner {
  message_id?: number;
  status?: string;
  fragments?: SSEFragment[];
}

/**
 * Wrapper cho `json.v` khi SSE event trả về snapshot đầy đủ.
 * Shape: `{ response: { message_id, status, fragments } }`.
 */
export interface SSEResponseSnapshot {
  response?: SSEResponseInner;
}

export interface SSEEventPayload {
  p?: string;
  v?: unknown;
  o?: string;
  type?: string;
  content?: string;
  response_message_id?: number;
  response?: SSEResponseSnapshot;
  choices?: Array<{
    delta: { content?: string };
  }>;
}

// ─── WASM ───────────────────────────────────────────────────────────────

export interface WasmExports {
  memory: WebAssembly.Memory;
  __wbindgen_export_0: (length: number, align: number) => number;
  __wbindgen_add_to_stack_pointer: (offset: number) => number;
  wasm_solve: (
    retptr: number,
    challengePtr: number,
    challengeLen: number,
    prefixPtr: number,
    prefixLen: number,
    difficulty: number,
  ) => void;
}