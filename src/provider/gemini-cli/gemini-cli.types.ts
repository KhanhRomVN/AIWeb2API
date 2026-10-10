/**
 * ------------------------------------------------------------------
 * Gemini CLI Types
 * ------------------------------------------------------------------
 * Type definitions cho Gemini CLI provider.
 *
 * Main exports:
 * - GeminiCliCredential        : Credential đã parse từ JSON
 * - GeminiContent / GeminiPart : Gemini API request/response types
 * - GeminiRequest              : Payload gửi lên Code Assist API
 * - GeminiResponse             : Response từ Code Assist API
 * - GeminiCandidate / GeminiUsageMetadata
 * - ThinkingConfig             : Cấu hình thinking budget/level
 * - SafetySetting              : Safety filter settings
 * - SSEChunk                   : Parsed SSE event chunk
 * ------------------------------------------------------------------
 */

// ─── Credential ──────────────────────────────────────────────────────

/**
 * Credential Gemini CLI đã parse từ JSON string.
 *
 * Format JSON:
 * ```json
 * {
 *   "client_id": "...",
 *   "client_secret": "...",
 *   "token": "<access_token>",
 *   "refresh_token": "<refresh_token>",
 *   "scopes": ["..."],
 *   "token_uri": "https://oauth2.googleapis.com/token",
 *   "project_id": "<gcp_project_id>",
 *   "expiry": "2026-01-01T00:00:00+00:00"
 * }
 * ```
 */
export interface GeminiCliCredential {
  /** Access token hiện tại */
  token: string;
  /** Refresh token để lấy access token mới */
  refresh_token: string;
  /** Google Cloud Project ID */
  project_id: string;
  /** Thời điểm hết hạn của access token (ISO string) */
  expiry: string;
  /** OAuth client id (optional nếu dùng default) */
  client_id?: string;
  /** OAuth client secret (optional nếu dùng default) */
  client_secret?: string;
  /** OAuth token URI */
  token_uri?: string;
  /** Scopes được cấp */
  scopes?: string[];
}

// ─── Gemini API Types ─────────────────────────────────────────────────

export interface GeminiPart {
  text?: string;
  /** Ảnh inline base64 */
  inlineData?: {
    mimeType: string;
    data: string;
  };
  /** File trên Google Storage */
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
  /** Function call */
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  /** Function response */
  functionResponse?: {
    name: string;
    response?: Record<string, unknown>;
  };
  /** Executable code (code interpreter) */
  executableCode?: {
    language: string;
    code: string;
  };
  /** Code execution result */
  codeExecutionResult?: {
    outcome: string;
    output?: string;
  };
  /** Thought/reasoning content */
  thought?: boolean;
}

export interface GeminiContent {
  role: 'user' | 'model' | 'system';
  parts: GeminiPart[];
}

export interface ThinkingConfig {
  /** Số token tối đa cho thinking (Gemini 2.5 series) */
  thinkingBudget?: number;
  /** Mức độ thinking (Gemini 3 series) */
  thinkingLevel?: string;
  /** Có trả về thinking content cho client không */
  includeThoughts?: boolean;
}

export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: unknown;
  thinkingConfig?: ThinkingConfig;
  [key: string]: unknown;
}

export interface SafetySetting {
  category: string;
  threshold: string;
}

export interface Tool {
  googleSearch?: Record<string, unknown>;
  functionDeclarations?: Array<{
    name: string;
    description?: string;
    parameters?: unknown;
  }>;
  codeExecution?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Code Assist API Request/Response ────────────────────────────────

/**
 * Payload gửi lên Code Assist API `/v1internal:generateContent`
 * hoặc `/v1internal:streamGenerateContent`.
 */
export interface CodeAssistRequest {
  /** Model name (base model, không có suffix) */
  model: string;
  /** GCP Project ID */
  project: string;
  /** Nội dung request Gemini chuẩn */
  request: GeminiInnerRequest;
}

export interface GeminiInnerRequest {
  contents: GeminiContent[];
  generationConfig?: GenerationConfig;
  systemInstruction?: GeminiContent;
  tools?: Tool[];
  safetySettings?: SafetySetting[];
  [key: string]: unknown;
}

// ─── Response Types ──────────────────────────────────────────────────

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
}

export interface GeminiSafetyRating {
  category: string;
  probability: string;
  blocked?: boolean;
}

export interface GeminiCitationMetadata {
  citationSources?: Array<{
    startIndex?: number;
    endIndex?: number;
    uri?: string;
    license?: string;
  }>;
}

export interface GeminiCandidate {
  content?: GeminiContent;
  finishReason?: string;
  safetyRatings?: GeminiSafetyRating[];
  citationMetadata?: GeminiCitationMetadata;
  tokenCount?: number;
  index?: number;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
  [key: string]: unknown;
}

/**
 * Response từ Code Assist API — bọc GeminiResponse trong "response" key.
 */
export interface CodeAssistResponse {
  response?: GeminiResponse;
  [key: string]: unknown;
}

// ─── SSE Types ───────────────────────────────────────────────────────

/**
 * Parsed SSE chunk sau khi giải mã từ stream.
 * Có thể là data chunk hoặc error.
 */
export interface SSEChunk {
  type: 'data' | 'error' | 'done';
  /** Gemini response data (khi type='data') */
  data?: GeminiResponse;
  /** Raw JSON string (khi type='data') */
  raw?: string;
  /** Error status code (khi type='error') */
  statusCode?: number;
  /** Error message (khi type='error') */
  message?: string;
}

// ─── Token Refresh ───────────────────────────────────────────────────

export interface TokenRefreshResult {
  /** Access token mới */
  access_token: string;
  /** Số giây token còn hợp lệ */
  expires_in: number;
  /** Token type (thường là 'Bearer') */
  token_type?: string;
}

// ─── User Info ───────────────────────────────────────────────────────

export interface GoogleUserInfo {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
}
