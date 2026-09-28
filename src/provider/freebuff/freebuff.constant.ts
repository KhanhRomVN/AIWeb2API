/**
 * ------------------------------------------------------------------
 * Freebuff Constants
 * ------------------------------------------------------------------
 * Tập trung tất cả constant dùng chung cho Freebuff provider.
 * ------------------------------------------------------------------
 */

// ─── Provider Metadata ───────────────────────────────────────────────────

export const PROVIDER_ID = 'freebuff';
export const PROVIDER_NAME = 'Freebuff';
export const PROVIDER_DESCRIPTION =
  'Freebuff multi-model chat streaming. GLM 5.3 Flash, DeepSeek V4.1, MiMo, MiniMax, Solar, GPT-6.';
export const PROVIDER_COLOR = '#10A37F';
export const IS_ENABLED = true;
export const WEBSITE_URL = 'https://freebuff.com/';
export const AUTH_LOGIN_URL = 'https://freebuff.com/chat';
export const AUTH_METHOD = ['google', 'github'] as const;
export const CONNECTION_TYPE = 'https';
export const IS_PAUSABLE = false;
export const IS_MEMORY = false;
export const CAN_REGENERATE = false;

// ─── URLs ─────────────────────────────────────────────────────────────────

export const BASE_URL = 'https://freebuff.com';
export const STREAM_URL = 'https://freebuff.com/api/chat/stream';
export const SESSION_URL = 'https://freebuff.com/api/auth/session';
export const THREADS_URL = 'https://freebuff.com/api/chat/threads';
export const UPLOAD_URL = 'https://freebuff.com/api/chat/upload';
export const SUBSCRIPTIONS_URL = 'https://freebuff.com/api/web/subscriptions';
export const FREEBUCKS_SESSION_URL = 'https://freebuff.com/api/web/freebuff-session';

// ─── Host / Cookie ────────────────────────────────────────────────────────

export const FREEBUFF_HOST = 'freebuff.com';
export const SESSION_TOKEN_KEY = 'session-token';

// ─── Limits ──────────────────────────────────────────────────────────────

/** Giới hạn ký tự của Freebuff — truncate nếu vượt quá */
export const MAX_PROMPT_LENGTH = 32000;
/** Số ký tự giữ lại sau truncate */
export const PROMPT_TRUNCATE_TO = 31000;

// ─── Events ───────────────────────────────────────────────────────────────

export const FREEBUFF_EVENTS = {
  LOGIN_TOKEN: 'freebuff-login-token',
  LOGIN_EMAIL: 'freebuff-login-email',
} as const;

// ─── HTTP Headers ─────────────────────────────────────────────────────────

export const FREEBUFF_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  Origin: BASE_URL,
  Referer: `${BASE_URL}/chat`,
  'sec-ch-ua':
    '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
} as const;

// ─── SSE Event Types ──────────────────────────────────────────────────────

export const SSE_TYPES = {
  META: 'meta',
  DELTA: 'delta',
  REASONING_DELTA: 'reasoning_delta',
  SUGGESTIONS: 'suggestions',
  TITLE: 'title',
  DONE: 'done',
} as const;

// ─── Default model fallback ───────────────────────────────────────────────

/**
 * Model ID mặc định khi caller không truyền model hoặc model không hợp lệ.
 * GLM 5.3 Flash là default của Freebuff trên mọi platform.
 */
export const DEFAULT_MODEL_ID = 'z-ai/glm-5.3-flash';

/**
 * Models chỉ có ở tài khoản "full" (không có ở limited/VPN).
 * Dùng để filter trong getModels() khi accessTier = "limited".
 * Nguồn: JS bundle Freebuff (FREEBUFF_WEB_LIMITED_MODEL_IDS).
 */
export const FULL_ONLY_MODEL_IDS: readonly string[] = [
  'deepseek/deepseek-v4-pro',
  'mimo/mimo-v2.6-pro',
  'minimax/minimax-m3',
  'openai/gpt-6-luna',
  'google/gemini-3.8-flash',
  'anthropic/claude-fable-5.1',
  'meta/muse-spark-1.2-contributor',
  'meta/muse-spark-1.3-contributor',
];

/**
 * Toàn bộ model IDs Freebuff hỗ trợ.
 * Nguồn: JS bundle Freebuff (FREEBUFF_WEB_MODELS + FREEBUFF_MODELS).
 * limited tier chỉ thấy những model KHÔNG có trong FULL_ONLY_MODEL_IDS.
 */
export const ALL_MODEL_IDS: readonly string[] = [
  'z-ai/glm-5.3-flash',        // GLM 5.3 Flash — default, limited OK
  'deepseek/deepseek-v4-flash', // DeepSeek V4.1 Flash — limited OK
  'mimo-v2.6-flash',            // MiMo 2.6 Flash — limited OK
  'solar-mini-4',               // Solar Mini 4 — limited OK
  'solar-pro4',                 // Solar Pro 4 — limited OK
  'stealth/space-bunny-alpha',  // Space Bunny Alpha — limited OK
  'deepseek/deepseek-v4-pro',   // DeepSeek V4 Pro — full only
  'mimo/mimo-v2.6-pro',         // MiMo 2.6 Pro — full only
  'minimax/minimax-m3',         // MiniMax M3 — full only
  'openai/gpt-6-luna',          // GPT-6 Luna — full only
  'google/gemini-3.8-flash',    // Gemini 3.8 Flash — full only
  'anthropic/claude-fable-5.1', // Claude Fable 5.1 — full only
  'meta/muse-spark-1.3-contributor', // Muse Spark 1.3 — full only
  'meta/muse-spark-1.2-contributor', // Muse Spark 1.2 — full only
];

/**
 * Models có hỗ trợ thinking/reasoning effort.
 * Map: model ID → danh sách effort hợp lệ.
 * Nguồn: JS bundle Freebuff (efforts field trong model definition).
 */
export const THINKING_MODEL_EFFORTS: Readonly<
  Record<string, readonly string[]>
> = {
  'z-ai/glm-5.3-flash': ['low', 'high', 'max'],
  'deepseek/deepseek-v4-flash': ['low', 'high', 'max'],
  'deepseek/deepseek-v4-pro': ['low', 'high', 'max'],
  'openai/gpt-6-luna': ['low', 'medium', 'high', 'xhigh', 'max'],
  'google/gemini-3.8-flash': ['low', 'medium', 'high', 'xhigh', 'max'],
  'anthropic/claude-fable-5.1': ['low', 'medium', 'high', 'xhigh', 'max'],
  'meta/muse-spark-1.2-contributor': [
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
  ],
  'meta/muse-spark-1.3-contributor': [
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
  ],
  'stealth/space-bunny-alpha': ['low', 'medium', 'high', 'xhigh', 'max'],
  'stealth/ox-alpha': ['low', 'high', 'max'],
};

/**
 * Default reasoning effort cho từng thinking model.
 * Nguồn: defaultEffort field trong JS bundle Freebuff.
 */
export const THINKING_MODEL_DEFAULT_EFFORT: Readonly<Record<string, string>> = {
  'z-ai/glm-5.3-flash': 'max',
  'deepseek/deepseek-v4-flash': 'high',
  'deepseek/deepseek-v4-pro': 'high',
  'openai/gpt-6-luna': 'high',
  'google/gemini-3.8-flash': 'high',
  'anthropic/claude-fable-5.1': 'high',
  'meta/muse-spark-1.2-contributor': 'xhigh',
  'meta/muse-spark-1.3-contributor': 'xhigh',
  'stealth/space-bunny-alpha': 'high',
  'stealth/ox-alpha': 'high',
};
