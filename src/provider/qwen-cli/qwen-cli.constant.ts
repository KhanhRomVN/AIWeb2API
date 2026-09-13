/**
 * ------------------------------------------------------------------
 * Qwen CLI Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Qwen CLI provider.
 *
 * Main exports:
 * - PROVIDER_ID             : ID định danh provider
 * - PROVIDER_NAME           : Tên hiển thị
 * - IS_ENABLED              : Bật/tắt provider
 * - WEBSITE_URL             : URL website
 * - AUTH_METHOD             : Phương thức xác thực
 * - CONNECTION_TYPE         : Loại kết nối (https/browser)
 * - MODELS                  : Danh sách models hỗ trợ
 * - IS_PAUSABLE             : Hỗ trợ tạm dừng session
 * - IS_MEMORY               : Hỗ trợ bộ nhớ dài hạn
 * - QWEN_CLI_EVENTS         : Các event name dùng trong proxy handler
 * - CHAT_QWEN_BASE_URL      : Base URL của chat.qwen.ai
 * - PORTAL_QWEN_BASE_URL    : Base URL của portal.qwen.ai
 * - USER_INFO_URL           : URL lấy thông tin user
 * - CHAT_COMPLETIONS_URL    : URL chat completion
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'qwen-cli';
export const PROVIDER_NAME = 'Qwen Coder CLI';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://modelscope.cn/';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'coder-model',
    name: 'Coder Model',
    is_thinking: false,
    max_context_length: null,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Qwen Coder Model - Specialized for code generation, debugging, and programming assistance',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const QWEN_CLI_EVENTS = {
  TOKENS: 'qwen-cli-tokens',
  USER_INFO: 'qwen-cli-user-info',
} as const;

export const CHAT_QWEN_BASE_URL = 'https://chat.qwen.ai';
export const PORTAL_QWEN_BASE_URL = 'https://portal.qwen.ai';

export const USER_INFO_URL = `${CHAT_QWEN_BASE_URL}/api/v1/user/info`;
export const CHAT_COMPLETIONS_URL = `${PORTAL_QWEN_BASE_URL}/v1/chat/completions`;
