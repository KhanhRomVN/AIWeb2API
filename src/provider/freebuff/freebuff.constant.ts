/**
 * ------------------------------------------------------------------
 * Freebuff Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Freebuff provider.
 * ------------------------------------------------------------------
 */

export const PROVIDER_ID = 'freebuff';
export const PROVIDER_NAME = 'Freebuff';
export const PROVIDER_DESCRIPTION =
  'Freebuff multi-model chat streaming (GLM-5.3, MiMo 2.5, DeepSeek v4, MiniMax m3, Solar Pro)';
export const PROVIDER_COLOR = '#10A37F';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://freebuff.com/';
export const AUTH_LOGIN_URL = 'https://freebuff.com/chat';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;

export const BASE_URL = 'https://freebuff.com';
export const STREAM_URL = 'https://freebuff.com/api/chat/stream';
export const SESSION_URL = 'https://freebuff.com/api/auth/session';
export const THREADS_URL = 'https://freebuff.com/api/chat/threads';
export const FREEBUFF_HOST = 'freebuff.com';
export const SESSION_TOKEN_KEY = 'session-token';

export const FREEBUFF_EVENTS = {
  LOGIN_TOKEN: 'freebuff-login-token',
  LOGIN_EMAIL: 'freebuff-login-email',
} as const;

export const FREEBUFF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  'Origin': 'https://freebuff.com',
  'Referer': 'https://freebuff.com/chat',
  'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

export const MODELS = [
  {
    id: 'glm-5.3-flash',
    name: 'GLM 5.3 Flash (Zhipu AI)',
    is_thinking: true,
    max_context_length: 131072,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'GLM 5.3 Flash by Zhipu AI - Flagship default with thinking capabilities.',
  },
  {
    id: 'mimo-v2.5',
    name: 'MiMo v2.5 (Xiaomi)',
    is_thinking: true,
    max_context_length: 131072,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'MiMo v2.5 by Xiaomi - High performance reasoning model.',
  },
  {
    id: 'deepseek-v4',
    name: 'DeepSeek v4',
    is_thinking: true,
    max_context_length: 131072,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'DeepSeek v4 - Advanced reasoning and code generation.',
  },
  {
    id: 'minimax-m3',
    name: 'MiniMax m3',
    is_thinking: true,
    max_context_length: 131072,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'MiniMax m3 - Multi-agent conversation and reasoning.',
  },
  {
    id: 'solar-pro4',
    name: 'Solar Pro 4 (Upstage)',
    is_thinking: false,
    max_context_length: 65536,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'Solar Pro 4 by Upstage - Fast standard chat without thinking.',
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4 (Buff)',
    is_thinking: true,
    max_context_length: 131072,
    is_search: false,
    is_image_upload: false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: 'GPT-5.4 flagship preview model.',
  },
];
