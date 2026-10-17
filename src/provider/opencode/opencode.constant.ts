/**
 * ------------------------------------------------------------------
 * OpenCode Constants
 * ------------------------------------------------------------------
 * Tập trung constant dùng chung cho OpenCode provider.
 * Provider điều khiển một backend `opencode serve` (OpenCode 1.x) qua
 * @opencode-ai/sdk: tạo session -> gửi prompt -> đọc message -> xoá session.
 *
 * Credential format: JSON string `{ serverUrl, password? }`.
 * ------------------------------------------------------------------
 */

import { STANDARD_HTTP_HEADERS } from '../_shared/constants/http.constants';

// ─── Provider Configuration ──────────────────────────────────────────

export const PROVIDER_ID = 'opencode';
export const PROVIDER_NAME = 'OpenCode';
export const PROVIDER_DESCRIPTION =
  'OpenCode Zen free models via a local opencode serve backend';
export const PROVIDER_COLOR = '#211E1E';
export const IS_ENABLED = true;
export const TOKEN_COUNT_MODE: 'incremental' | 'cumulative' = 'incremental';
export const WEBSITE_URL = 'https://opencode.ai/';
export const AUTH_METHOD = ['basic'] as const;
export const CONNECTION_TYPE = 'http';
export const IS_PAUSABLE = false;
export const MAX_INPUT_TOKEN = 20000;
export const CAN_REGENERATE = false;
/**
 * OpenCode không có browser login — chỉ cần kết nối tới backend local.
 * Khi bật flag này, provider.service sẽ tự bootstrap một account mặc định
 * (serverUrl = http://127.0.0.1:10001) khi chưa có account nào trong DB,
 * để người dùng không phải thao tác thủ công.
 */
export const AUTO_BOOTSTRAP_ACCOUNT = true;

// ─── Backend Configuration ───────────────────────────────────────────

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:10001';
export const BACKEND_USERNAME = 'opencode';
export const BACKEND_MAJOR_VERSION_UNSUPPORTED = 2;
export const DEFAULT_SERVER_PORT = '10001';
export const BACKEND_PACKAGE_VERSION = '1.19.0';
export const BACKEND_INSTALL_DIR_NAME = '.opencode-1x';
export const BACKEND_INSTALL_TIMEOUT_MS = 180000;
export const BACKEND_START_TIMEOUT_MS = 30000;
export const BACKEND_START_POLL_MS = 500;
export const BACKEND_LOCAL_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '[::1]'];
export const BACKEND_UNREACHABLE_REGEX = /ECONNREFUSED/;

export const API_PATHS = {
  HEALTH: '/global/health',
} as const;

export const HTTP_HEADER_NAMES = {
  ...STANDARD_HTTP_HEADERS,
} as const;

// ─── Models ──────────────────────────────────────────────────────────

export const DEFAULT_PROVIDER_SEGMENT = 'opencode';
export const DEFAULT_MODEL_ID = 'opencode/kimi-k2.5-free';
export const MODEL_FREE_SUFFIX = '-free';
export const MODEL_DEFAULT_CREATED = 1704067200;

// ─── Timeouts / Retry ────────────────────────────────────────────────

export const REQUEST_TIMEOUT_MS = 180000;
export const HEALTH_TIMEOUT_MS = 2000;
export const POLL_INTERVAL_MS = 500;
export const EVENT_FIRST_DELTA_TIMEOUT_MS = 30000;
export const EVENT_IDLE_TIMEOUT_MS = 8000;
export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = 800;
export const REQUEST_COOLDOWN_MS = '0';

export const TRANSIENT_ERROR_REGEX =
  /insufficient balance|CreditsError|rate limit|too many requests|worker request limit|overloaded|temporarily unavailable|internal server error|bad gateway|service unavailable|stream error/i;
export const TRANSIENT_STATUS_CODES: readonly number[] = [401, 402, 429];
export const TRANSIENT_STATUS_MIN_SERVER_ERROR = 500;

// ─── Tool Policy ─────────────────────────────────────────────────────

export const SESSION_TITLE_PREFIX = 'opencode2api';
export const TOOL_POLICY_NONE = 'none';
export const EXTERNAL_TOOL_PREFIX = 'external__';

export const TOOL_GUARD_MESSAGE =
  'Tools are disabled. Do not call tools or function calls. Answer directly from the conversation and general knowledge.';
export const EXTERNAL_TOOL_GUARD_MESSAGE =
  'OpenCode internal tools remain disabled. If an external tool contract is present, use only that contract and never call or mention OpenCode internal tools.';

export const OPENCODE_TOOL_MARKER = {
  START: '__OPENCODE_TOOL__:',
  END: '__END_TOOL__',
} as const;

// ─── Reasoning Effort ────────────────────────────────────────────────

export const REASONING_EFFORT_MAP: Readonly<Record<string, string>> = {
  minimal: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'high',
};

// ─── SSE Event / Part Types ──────────────────────────────────────────

export const EVENT_TYPES = {
  PART_UPDATED: 'message.part.updated',
  PART_DELTA: 'message.part.delta',
  MESSAGE_UPDATED: 'message.updated',
} as const;

export const PART_TYPES = {
  TEXT: 'text',
  REASONING: 'reasoning',
  TOOL: 'tool',
  FILE: 'file',
} as const;

export const TOOL_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;

export const FINISH_REASONS = {
  TOOL: 'tool',
  STOP: 'stop',
} as const;

// ─── Upload (image only) ─────────────────────────────────────────────

export const IMAGE_FETCH_TIMEOUT_MS = 10000;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_IMAGE_MIME = 'image/jpeg';
export const DEFAULT_IMAGE_FILENAME = 'image';

// ─── Events ──────────────────────────────────────────────────────────

export const OPENCODE_EVENTS = {
  LOGIN_TOKEN: 'opencode-login-token',
} as const;