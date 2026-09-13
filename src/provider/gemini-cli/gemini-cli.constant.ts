/**
 * ------------------------------------------------------------------
 * Gemini CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Gemini CLI provider.
 *
 * Main exports:
 * - PROVIDER_ID                    : ID định danh provider
 * - PROVIDER_NAME                  : Tên hiển thị
 * - IS_ENABLED                     : Bật/tắt provider
 * - WEBSITE_URL                    : URL website
 * - AUTH_METHOD                    : Phương thức xác thực
 * - CONNECTION_TYPE                : Loại kết nối (https/browser)
 * - IS_PAUSABLE                    : Hỗ trợ tạm dừng session
 * - IS_MEMORY                      : Hỗ trợ bộ nhớ dài hạn
 * - GEMINI_CLI_EVENTS              : Các event name dùng trong proxy handler
 * - CLOUDCODE_BASE_URL             : Base URL của Cloud Code API
 * - CLOUDCODE_LOAD_CODE_ASSIST_URL : URL lấy project ID
 * - CLOUDCODE_STREAM_GENERATE_URL  : URL chat completion streaming
 * - CLOUDCODE_RETRIEVE_QUOTA_URL   : URL lấy danh sách models
 * - USER_AGENT                     : User-Agent string dùng chung
 * - X_GOOG_API_CLIENT              : Google API client version
 * - CLIENT_METADATA                : Metadata cho loadCodeAssist
 * - DEFAULT_PROJECT_ID             : Fallback project ID
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'gemini-cli';
export const PROVIDER_NAME = 'Gemini CLI';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://gemini.google.com/';
export const AUTH_METHOD = ['google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

// ─── API Configuration ───────────────────────────────────────────────

export const GEMINI_CLI_EVENTS = {
  TOKENS: 'gemini-cli-tokens',
  USER_INFO: 'gemini-cli-user-info',
} as const;

export const CLOUDCODE_BASE_URL =
  'https://cloudcode-pa.googleapis.com/v1internal';
export const CLOUDCODE_LOAD_CODE_ASSIST_URL = `${CLOUDCODE_BASE_URL}:loadCodeAssist`;
export const CLOUDCODE_STREAM_GENERATE_URL = `${CLOUDCODE_BASE_URL}:streamGenerateContent?alt=sse`;
export const CLOUDCODE_RETRIEVE_QUOTA_URL = `${CLOUDCODE_BASE_URL}:retrieveUserQuota`;

export const USER_AGENT =
  'GeminiCLI/0.29.7/gemini-3-pro-preview (linux; x64) google-api-nodejs-client/9.15.1';
export const X_GOOG_API_CLIENT = 'gl-node/22.21.1';

export const CLIENT_METADATA = { ideType: 9, platform: 3, pluginType: 2 };
export const DEFAULT_PROJECT_ID = 'reference-courage-zzsgc';
