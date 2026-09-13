/**
 * ------------------------------------------------------------------
 * Kimi Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Kimi provider.
 *
 * Main exports:
 * - PROVIDER_ID            : ID định danh provider
 * - PROVIDER_NAME          : Tên hiển thị
 * - IS_ENABLED             : Bật/tắt provider
 * - WEBSITE_URL            : URL website
 * - AUTH_METHOD            : Phương thức xác thực
 * - CONNECTION_TYPE        : Loại kết nối (https/browser)
 * - MODELS                 : Danh sách models hỗ trợ
 * - IS_PAUSABLE            : Hỗ trợ tạm dừng session
 * - IS_MEMORY              : Hỗ trợ bộ nhớ dài hạn
 * - KIMI_BASE_URL          : Base URL của Kimi AI
 * - KIMI_MODELS            : Model constants
 * - KIMI_EVENTS            : Các event name dùng trong proxy handler
 * - USER_AGENT             : User-Agent string dùng chung
 * - MSH_HEADERS            : Các header MSH dùng chung
 * - AUTH_REFRESH_URL       : URL refresh token
 * - CHAT_URL               : URL chat completion
 * - GET_USER_URL           : URL lấy thông tin user
 * - LIST_THIRD_ACCOUNTS_URL: URL lấy third-party accounts
 * ------------------------------------------------------------------
 */

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'kimi';
export const PROVIDER_NAME = 'Kimi';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://www.kimi.ai/';
export const AUTH_METHOD = ['basic', 'google'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const MODELS = [
  {
    id: 'k3',
    name: 'Kimi K3 (Flagship)',
    is_thinking: true,
    max_context_length: 262144,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    description:
      'Kimi K3 Flagship All-Rounder - Chat & Agent with state-of-the-art reasoning and problem solving.',
  },
  {
    id: 'k3-swarm',
    name: 'Kimi K3 Swarm',
    is_thinking: true,
    max_context_length: 262144,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    description:
      'Kimi K3 Swarm - Massive search, batch processing, and multi-agent workflow in one go.',
  },
  {
    id: 'instant',
    name: 'Kimi Instant',
    is_thinking: false,
    max_context_length: 262144,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    description:
      'Kimi Instant - Ultra-fast responses for everyday chat queries.',
  },
  {
    id: 'k2d6-thinking',
    name: 'Kimi K2.6 Thinking',
    is_thinking: true,
    max_context_length: 262144,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    description:
      'Kimi K2.6 Thinking delivers deep reasoning, step-by-step logic deduction, and advanced mathematical problem solving.',
  },
  {
    id: 'k2d6',
    name: 'Kimi K2.6 Instant',
    is_thinking: false,
    max_context_length: 262144,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    description:
      'Kimi K2.6 Instant provides fast text generation for conversational tasks.',
  },
  {
    id: 'k2d6-agent',
    name: 'Kimi K2.6 Agent',
    is_thinking: true,
    max_context_length: 262144,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    description:
      'Kimi K2.6 Agent autonomously performs comprehensive research, slides generation, and document processing.',
  },
  {
    id: 'k2d6-agent-ultra',
    name: 'Kimi K2.6 Agent Swarm',
    is_thinking: true,
    max_context_length: 262144,
    is_search: true,
    is_image_upload: true,
    is_video_upload: false,
    description:
      'Kimi K2.6 Agent Swarm coordinates multi-agent workers for large-scale information retrieval.',
  },
] as const;

// ─── API Configuration ───────────────────────────────────────────────

export const KIMI_BASE_URL = 'https://www.kimi.ai';

export const KIMI_MODELS = {
  K3: 'k3',
  K3_SWARM: 'k3-swarm',
  INSTANT: 'instant',
  K2D6_THINKING: 'k2d6-thinking',
  K2D6: 'k2d6',
  K2D6_AGENT: 'k2d6-agent',
  K2D6_AGENT_ULTRA: 'k2d6-agent-ultra',
  KIMI_LATEST: 'kimi-latest',
} as const;

export const KIMI_EVENTS = {
  HEADERS: 'kimi-headers',
  LOGIN_TOKEN: 'kimi-login-token',
  LOGIN_EMAIL: 'kimi-login-email',
} as const;

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const MSH_HEADERS = {
  'x-msh-platform': 'web',
  'x-msh-version': '2.0.0',
  'x-language': 'en-US',
} as const;

export const AUTH_REFRESH_URL =
  'https://auth.kimi.ai/api/account.gateway.v1.AuthService/RefreshToken';
export const CHAT_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`;
export const GET_USER_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.account.v1.UserService/GetCurrentUser`;
export const LIST_THIRD_ACCOUNTS_URL = `${KIMI_BASE_URL}/apiv2/kimi.gateway.account.v1.SecurityService/ListThirdAccounts`;