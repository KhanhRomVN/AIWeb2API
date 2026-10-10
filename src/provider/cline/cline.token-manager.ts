/**
 * ------------------------------------------------------------------
 * Cline Token Manager
 * ------------------------------------------------------------------
 * Quản lý account pool, token refresh, cooldown, và serialization
 * request để tránh upstream 429 / empty response.
 *
 * Core features:
 * - parseAccounts()       : Parse multi-line refreshToken thành pool
 * - getAccessToken()      : Lấy access token từ pool (round-robin, với fallback)
 * - buildClineHeaders()   : Tạo Cline client fingerprint headers
 * - clineFetch()          : Gọi upstream với retry on 401
 * - clineFetchWithRetry() : Retry + account rotation khi 429 / empty
 * - enqueue()             : Serialize requests qua queue
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import fetch from 'node-fetch';
import type { Response as NodeFetchResponse } from 'node-fetch';
import { createLogger } from '../../utils/logger';
import {
  BASE_URL,
  API_PATHS,
  HTTP_HEADER_NAMES,
  HTTP_HEADERS,
  AUTH_PREFIX,
  ACCOUNT_COOLDOWN_MS,
  MIN_GAP_MS,
  MAX_RETRIES,
  DEFAULT_429_COOLDOWN_MS,
  DEFAULT_EMPTY_COOLDOWN_MS,
  MAX_COOLDOWN_MS,
} from './cline.constant';
import type { ClineAccount, ClineAuthRefreshResponse } from './cline.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClineTokenManager');

// ─── Account Pool State ──────────────────────────────────────────────────

let accounts: ClineAccount[] = [];
let accountIndex = 0;
let currentAccount: ClineAccount | null = null;
let currentToken = '';

// ─── Serial Queue ────────────────────────────────────────────────────────

let queueTail: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Serialize upstream requests.
 * Upstream free channel không chịu được concurrent > 1 → trả empty response.
 * Mỗi request phải đợi request trước xong + MIN_GAP_MS trước khi gửi tiếp.
 */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail
    .then(() => sleep(MIN_GAP_MS))
    .then(fn);
  // Không để queue bị vỡ khi fn throw
  queueTail = run.then(
    () => {},
    () => {},
  );
  return run;
}

// ─── Account Pool ─────────────────────────────────────────────────────────

/**
 * Parse credential string thành danh sách ClineAccount.
 * Credential có thể là:
 *   - Raw refreshToken
 *   - JSON: `{ "refreshToken": "...", "email": "..." }`
 *   - Multi-line: nhiều token, mỗi dòng 1 token hoặc JSON
 *
 * Nếu danh sách token thay đổi (thêm/bớt account) → reset pool.
 */
export function parseAccounts(credential: string): ClineAccount[] {
  const lines = credential
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  const tokens: string[] = lines.map((line) => {
    if (line.startsWith('{')) {
      try {
        const parsed = JSON.parse(line);
        return (
          parsed.refreshToken ||
          parsed.refresh_token ||
          parsed.token ||
          line
        );
      } catch {
        return line;
      }
    }
    return line;
  });

  if (tokens.length === 0) return [];

  // Rebuild pool nếu danh sách token thay đổi
  const changed =
    accounts.length !== tokens.length ||
    accounts.some((a, i) => a.refreshToken !== tokens[i]);

  if (changed) {
    accounts = tokens.map((rt) => ({
      refreshToken: rt,
      accessToken: null,
      expiry: 0,
      cooldownUntil: 0,
    }));
    accountIndex = 0;
  }

  return accounts;
}

// ─── Token Refresh ───────────────────────────────────────────────────────

/**
 * Lấy accessToken cho 1 account cụ thể.
 * - Trả cache nếu còn hạn.
 * - Gọi /auth/refresh nếu hết hạn.
 * - Cập nhật refreshToken nếu upstream rotate.
 * - Set cooldown 60s nếu refresh fail.
 */
async function getAccountToken(account: ClineAccount): Promise<string> {
  const now = Date.now();

  if (account.cooldownUntil > now) {
    throw new Error('account_cooldown');
  }

  if (account.accessToken && now < account.expiry) {
    return account.accessToken;
  }

  const resp = await fetch(`${BASE_URL}${API_PATHS.AUTH_REFRESH}`, {
    method: 'POST',
    headers: { [HTTP_HEADER_NAMES.CONTENT_TYPE]: 'application/json' },
    body: JSON.stringify({
      refreshToken: account.refreshToken,
      grantType: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    account.cooldownUntil = now + ACCOUNT_COOLDOWN_MS;
    throw new Error(`refresh_failed:${resp.status}`);
  }

  const data = (await resp.json()) as ClineAuthRefreshResponse;
  const accessToken = data?.data?.accessToken;

  if (!accessToken) {
    account.cooldownUntil = now + ACCOUNT_COOLDOWN_MS;
    throw new Error('refresh_no_token');
  }

  account.accessToken = accessToken;

  // Cline rotate refreshToken → lưu lại để tránh invalid_grant lần sau
  if (
    typeof data?.data?.refreshToken === 'string' &&
    data.data.refreshToken.trim()
  ) {
    account.refreshToken = data.data.refreshToken.trim();
  }

  // Tính expiry: ưu tiên server expiresAt, fallback 10 phút, trừ 60s buffer
  const expiresAt = data?.data?.expiresAt;
  let expiry = now + 10 * 60 * 1000;
  if (typeof expiresAt === 'number') {
    expiry = expiresAt;
  } else if (typeof expiresAt === 'string') {
    const t = Date.parse(expiresAt);
    if (!isNaN(t)) expiry = t;
  }
  account.expiry = expiry - 60_000;

  return accessToken;
}

/**
 * Lấy accessToken từ pool.
 * Round-robin + skip account đang cooldown.
 * Nếu tất cả cooldown → reset account đầu tiên và retry 1 lần.
 */
export async function getAccessToken(credential: string): Promise<string> {
  const pool = parseAccounts(credential);
  if (pool.length === 0) {
    throw new Error('Cline: thiếu refreshToken trong credential');
  }

  for (let attempt = 0; attempt < pool.length; attempt++) {
    const acc = pool[attempt % pool.length];
    if (acc.cooldownUntil && acc.cooldownUntil > Date.now()) continue;
    currentAccount = acc;
    try {
      return await getAccountToken(acc);
    } catch (e: any) {
      if (e.message === 'account_cooldown') continue;
      continue;
    }
  }

  // Tất cả cooldown → xóa cooldown account đầu và thử 1 lần
  const acc = pool[0];
  currentAccount = acc;
  acc.cooldownUntil = 0;
  try {
    return await getAccountToken(acc);
  } catch (e: any) {
    throw new Error('Cline: tất cả account fail refresh token');
  }
}

// ─── Request Headers ─────────────────────────────────────────────────────

/**
 * Tạo Cline client fingerprint headers cho 1 request.
 * Upstream 403 nếu thiếu các header này (chỉ chấp nhận Cline SDK traffic).
 */
export function buildClineHeaders(
  token: string,
  sessionId: string,
): Record<string, string> {
  return {
    [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIX}${token}`,
    [HTTP_HEADER_NAMES.CONTENT_TYPE]: 'application/json',
    [HTTP_HEADER_NAMES.USER_AGENT]: HTTP_HEADERS.USER_AGENT,
    [HTTP_HEADER_NAMES.HTTP_REFERER]: HTTP_HEADERS.HTTP_REFERER,
    [HTTP_HEADER_NAMES.X_TITLE]: HTTP_HEADERS.X_TITLE,
    [HTTP_HEADER_NAMES.X_IS_MULTIROOT]: HTTP_HEADERS.X_IS_MULTIROOT,
    [HTTP_HEADER_NAMES.X_CLIENT_TYPE]: HTTP_HEADERS.X_CLIENT_TYPE,
    [HTTP_HEADER_NAMES.X_CLIENT_VERSION]: HTTP_HEADERS.X_CLIENT_VERSION,
    [HTTP_HEADER_NAMES.X_PLATFORM]: HTTP_HEADERS.X_PLATFORM,
    [HTTP_HEADER_NAMES.X_PLATFORM_VERSION]: HTTP_HEADERS.X_PLATFORM_VERSION,
    [HTTP_HEADER_NAMES.X_CORE_VERSION]: HTTP_HEADERS.X_CORE_VERSION,
    [HTTP_HEADER_NAMES.X_TASK_ID]: sessionId,
  };
}

// ─── Upstream Fetch ───────────────────────────────────────────────────────

/**
 * Gọi upstream với auto-retry on 401 (token rotation).
 * - Lấy token từ pool.
 * - Nếu 401 → đánh dấu cooldown account hiện tại và retry 1 lần (dùng account khác).
 */
export async function clineFetch(
  credential: string,
  path: string,
  bodyObj: Record<string, unknown>,
  sessionId: string,
  retried = false,
): Promise<NodeFetchResponse> {
  const token = await getAccessToken(credential);
  currentToken = token;
  const headers = buildClineHeaders(token, sessionId);

  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyObj),
  });

  if (resp.status === 401 && !retried) {
    if (currentAccount) {
      currentAccount.cooldownUntil = Date.now() + ACCOUNT_COOLDOWN_MS;
      currentAccount.accessToken = null;
      currentAccount.expiry = 0;
    }
    return clineFetch(credential, path, bodyObj, sessionId, true);
  }

  return resp;
}

// ─── Cooldown Parser ──────────────────────────────────────────────────────

/**
 * Parse thời gian cooldown từ body upstream.
 * Format: "Try again in 2h 51m" / "Try again in 30m" / "Try again in 15s".
 * Fallback: 429 → 5 phút, empty → 60 giây.
 */
export function parseCooldown(body: string, status: number): number {
  const m = (body || '').match(
    /try again in (?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i,
  );
  if (m) {
    const h = parseInt(m[1] || '0', 10);
    const min = parseInt(m[2] || '0', 10);
    const s = parseInt(m[3] || '0', 10);
    const ms = (h * 3600 + min * 60 + s) * 1000;
    if (ms > 0) return Math.min(ms, MAX_COOLDOWN_MS);
  }
  if (status === 429) return DEFAULT_429_COOLDOWN_MS;
  return DEFAULT_EMPTY_COOLDOWN_MS;
}

// ─── Fetch With Retry ────────────────────────────────────────────────────

/**
 * Gọi upstream với retry + account rotation.
 *
 * Khi nào rotate:
 *  - 429 (rate limit / daily limit reached)
 *  - 5xx + body chứa "empty response content"
 *  - 200 non-stream + body chứa "empty response content"
 *
 * Khi tất cả account cooldown → trả ngay response gốc (không vòng lặp vô ích).
 */
export async function clineFetchWithRetry(
  credential: string,
  path: string,
  bodyObj: Record<string, unknown>,
  sessionId: string,
  _isStream = false,
  maxRetries = MAX_RETRIES,
): Promise<NodeFetchResponse> {
  let lastResp: NodeFetchResponse | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await enqueue(() =>
      clineFetch(credential, path, bodyObj, sessionId),
    );
    lastResp = resp;

    let bodyText = '';
    try {
      bodyText = await resp.clone().text();
    } catch {
      /* ignore */
    }

    const isLimitHit =
      resp.status === 429 ||
      (resp.status >= 500 && bodyText.includes('empty response content')) ||
      (resp.ok && !_isStream && bodyText.includes('empty response content'));

    if (isLimitHit) {
      const cooldownMs = parseCooldown(bodyText, resp.status);
      if (currentAccount) {
        currentAccount.cooldownUntil = Date.now() + cooldownMs;
        currentAccount.accessToken = null;
        currentAccount.expiry = 0;
        logger.warn(
          `[ClineToken] Limit hit — cooldown ${Math.round(cooldownMs / 1000)}s, rotating account`,
        );
      }

      const pool = parseAccounts(credential);
      const hasOther = pool.some(
        (a) => !a.cooldownUntil || a.cooldownUntil <= Date.now(),
      );
      if (!hasOther) {
        logger.warn('[ClineToken] All accounts in cooldown, returning upstream response');
        return resp;
      }
      await sleep(500 + Math.floor(Math.random() * 500));
      continue;
    }

    if (resp.ok) return resp;

    // Lỗi khác (403, 400...) → không retry
    return resp;
  }

  return lastResp!;
}
