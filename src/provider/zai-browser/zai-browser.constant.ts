/**
 * ------------------------------------------------------------------
 * Z.AI Browser Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Z.AI Browser provider.
 *
 * Main exports:
 * - PROVIDER_ID         : ID định danh provider
 * - PROVIDER_NAME       : Tên hiển thị
 * - IS_ENABLED          : Bật/tắt provider
 * - WEBSITE_URL         : URL website
 * - AUTH_METHOD         : Phương thức xác thực
 * - CONNECTION_TYPE     : Loại kết nối (browser)
 * - IS_PAUSABLE         : Hỗ trợ tạm dừng session
 * - IS_MEMORY           : Hỗ trợ bộ nhớ dài hạn
 * - PLATFORM            : Platform type
 * - BROWSER_EXTENSION_FOLDER: Folder chứa extension
 * - MODELS              : Danh sách models hỗ trợ
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'zai-browser';
export const PROVIDER_NAME = 'Z.AI Browser';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://chat.z.ai/';
export const AUTH_METHOD = ['google', 'basic'] as const;
export const CONNECTION_TYPE = 'browser';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;
export const PLATFORM = 'web';
export const BROWSER_EXTENSION_FOLDER = 'zai-bridge';

export const MODELS = [
  {
    id: 'GLM-5.1',
    name: 'GLM-5.1',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Z.AI GLM-5.1 - Advanced language model with thinking mode and web search (browser-based)',
  },
  {
    id: 'GLM-5',
    name: 'GLM-5',
    is_thinking: true,
    max_context_length: null,
    is_search: true,
    is_image_upload: false,
    is_video_upload: false,
    description:
      'Z.AI GLM-5 - Fast and efficient model with thinking capabilities (browser-based)',
  },
] as const;
