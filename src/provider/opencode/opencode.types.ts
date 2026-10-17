/**
 * ------------------------------------------------------------------
 * OpenCode Types
 * ------------------------------------------------------------------
 * Type definitions cho OpenCode provider.
 *
 * Main exports:
 * - OpenCodeCredential       : Credential đã parse
 * - OpenCodeModelRef         : { providerID, modelID }
 * - OpenCodeClientLike       : Interface tối thiểu của SDK client (tránh import type từ gói ESM-only)
 * - OpenCodeMessagePart      : Part trong message của backend
 * - OpenCodeAssistantResult  : Kết quả thu từ assistant (poll/event)
 * - OpenCodeCollectOptions   : Option cho collectFromEvents
 * - OpenCodeFilePart         : Part ảnh gửi cho backend
 * - OpenCodeUploadResponse   : Kết quả "upload" (ảnh -> data URI)
 * - OpenCodeToolRegistryEntry / OpenCodeParsedToolCall : Tool bridge
 * ------------------------------------------------------------------
 */

// ─── Credential ─────────────────────────────────────────────────────────

/**
 * Credential JSON: `{ serverUrl, password? }`.
 * - `serverUrl`  : URL backend `opencode serve` (mặc định http://127.0.0.1:10001)
 * - `password`   : OPENCODE_SERVER_PASSWORD của backend (Basic auth, user `opencode`)
 */
export interface OpenCodeCredential {
  serverUrl: string;
  password?: string;
}

// ─── Models ─────────────────────────────────────────────────────────────

export interface OpenCodeModelRef {
  providerID: string;
  modelID: string;
}

export interface OpenCodeModelInfo {
  id: string;
  name?: string;
  release_date?: string;
  reasoning?: boolean;
  attachment?: boolean;
  limit?: { context?: number; output?: number };
}

export interface OpenCodeProviderInfo {
  id: string;
  name?: string;
  models?: Record<string, OpenCodeModelInfo>;
}

// ─── Backend Message / Part ─────────────────────────────────────────────

export interface OpenCodeToolState {
  status?: string;
  input?: unknown;
}

export interface OpenCodeMessagePart {
  id?: string;
  sessionID?: string;
  type: string;
  text?: string;
  tool?: string;
  state?: OpenCodeToolState;
}

export interface OpenCodeAssistantError {
  name?: string;
  data?: { message?: string; statusCode?: number };
  message?: string;
}

export interface OpenCodeMessageInfo {
  role?: string;
  sessionID?: string;
  finish?: string;
  error?: OpenCodeAssistantError | null;
  time?: { completed?: number };
  parts?: OpenCodeMessagePart[];
}

export interface OpenCodeMessageEntry {
  info?: OpenCodeMessageInfo;
  parts?: OpenCodeMessagePart[];
}

export interface OpenCodeStreamEvent {
  type: string;
  properties?: {
    part?: OpenCodeMessagePart;
    delta?: string;
    partID?: string;
    sessionID?: string;
    field?: string;
    info?: OpenCodeMessageInfo;
  };
}

// ─── Collect Results ────────────────────────────────────────────────────

export interface OpenCodeAssistantResult {
  content: string;
  reasoning: string;
  error?: OpenCodeAssistantError | null;
  /** `true` khi không nhận được event nào trong cửa sổ first-delta → caller fallback sang polling. */
  noData?: boolean;
  idleTimeout?: boolean;
  receivedDelta?: boolean;
}

export interface OpenCodeCollectOptions {
  timeoutMs: number;
  firstDeltaTimeoutMs?: number;
  idleTimeoutMs?: number;
  onDelta?: (delta: string, isReasoning: boolean) => void;
}

// ─── Client Interface ───────────────────────────────────────────────────

interface SdkResult<T> {
  data?: T;
  error?: unknown;
}

export interface OpenCodeClientLike {
  config: {
    providers(): Promise<SdkResult<any> | any>;
    get(): Promise<SdkResult<any> | any>;
    update(params: { body: Record<string, unknown> }): Promise<unknown>;
  };
  session: {
    create(params?: {
      body?: { title?: string };
    }): Promise<SdkResult<{ id: string }> | any>;
    prompt(params: {
      path: { id: string };
      body: Record<string, unknown>;
    }): Promise<SdkResult<any> | any>;
    messages(params: {
      path: { id: string };
    }): Promise<SdkResult<OpenCodeMessageEntry[]> | any>;
    delete(params: { path: { id: string } }): Promise<unknown>;
  };
  tool: {
    ids(): Promise<SdkResult<string[]> | any>;
  };
  event: {
    subscribe(params?: {
      signal?: AbortSignal;
    }): Promise<{ stream: AsyncIterable<OpenCodeStreamEvent> }>;
  };
}

// ─── Upload ─────────────────────────────────────────────────────────────

/** Part ảnh gửi cho backend — cơ chế "file" duy nhất của OpenCode SDK. */
export interface OpenCodeFilePart {
  type: 'file';
  mime: string;
  url: string;
  filename: string;
}

export interface OpenCodeTextPart {
  type: 'text';
  text: string;
}

export type OpenCodePromptPart = OpenCodeTextPart | OpenCodeFilePart;

/** Kết quả "upload": OpenCode không có endpoint upload, ảnh được chuyển thành data URI. */
export interface OpenCodeUploadResponse {
  id: string;
  url: string;
  mime: string;
  filename: string;
  size: number;
}

// ─── Tool Bridge ────────────────────────────────────────────────────────

export interface OpenCodeToolRegistryEntry {
  originalName: string;
  namespacedName: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface OpenCodeRawToolCall {
  id?: string;
  name: string;
  arguments: unknown;
}

export interface OpenCodeParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}