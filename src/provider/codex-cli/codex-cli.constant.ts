/**
 * ------------------------------------------------------------------
 * Codex CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Codex CLI provider.
 *
 * Main exports:
 * - PROVIDER_ID         : ID định danh provider
 * - PROVIDER_NAME       : Tên hiển thị
 * - IS_ENABLED          : Bật/tắt provider
 * - WEBSITE_URL         : URL website
 * - AUTH_METHOD         : Phương thức xác thực
 * - CONNECTION_TYPE     : Loại kết nối (https/browser)
 * - MODELS              : Danh sách models hỗ trợ
 * - IS_PAUSABLE         : Hỗ trợ tạm dừng session
 * - CODEX_CLI_EVENTS    : Các event name dùng trong proxy handler
 * - CHATGPT_USAGE_URL   : URL lấy thông tin usage
 * - CODEX_RESPONSES_URL : URL chat completion
 * - AUTH_TOKEN_URL      : URL refresh token
 * - USER_AGENT          : User-Agent string dùng chung
 * - CLIENT_ID           : Client ID cho OAuth refresh
 * - ORIGINATOR          : Originator header
 * - DEFAULT_INSTRUCTIONS: System instructions mặc định
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'codex-cli';
export const PROVIDER_NAME = 'Codex CLI';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://google.com/';
export const AUTH_METHOD = ['google', 'basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;

export const MODELS = [
  {
    id: 'gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.3 Codex - Advanced coding model with extensive programming knowledge and problem-solving',
  },
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.2 Codex - Powerful code generation model with strong reasoning for complex algorithms',
  },
  {
    id: 'gpt-5.1-codex-max',
    name: 'GPT-5.1 Codex Max',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.1 Codex Max - Maximum capacity coding model for large-scale software development',
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.2 - General purpose model with balanced capabilities for diverse tasks',
  },
  {
    id: 'gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'OpenAI GPT-5.1 Codex Mini - Compact coding assistant for quick iterations and lightweight tasks',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const CODEX_CLI_EVENTS = {
  TOKENS: 'codex-cli-tokens',
  USER_INFO: 'codex-cli-user-info',
} as const;

export const CHATGPT_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
export const CODEX_RESPONSES_URL =
  'https://chatgpt.com/backend-api/codex/responses';
export const AUTH_TOKEN_URL = 'https://auth.openai.com/oauth/token';

export const USER_AGENT =
  'codex_cli_rs/0.104.0 (Ubuntu 24.4.0; x86_64) gnome-terminal';

export const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const ORIGINATOR = 'codex_cli_rs';
export const DEFAULT_INSTRUCTIONS = 'You are Codex, a GPT-5 coding agent';
