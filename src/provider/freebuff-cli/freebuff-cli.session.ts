/**
 * ------------------------------------------------------------------
 * Freebuff CLI Session Manager
 * ------------------------------------------------------------------
 * Quản lý vòng đời session cho giao thức Bearer/CLI.
 *
 * Theo spec Freebuff2API (Rust source):
 * 1. Tạo / kiểm tra session: POST /api/v1/freebuff/session
 *    - Header: x-freebuff-model, x-freebuff-instance-id, x-freebuff-multi-session
 *    - Response có thể là "queued" (waiting room) → phải chờ
 * 2. Giữ session sống: heartbeat mỗi 45s (x-freebuff-heartbeat: 1)
 * 3. Khi session sắp hết hạn (<120s): gia hạn bằng quảng cáo
 *    - POST /api/v1/ads → POST /api/v1/ads/impression
 *
 * Instance ID: sinh tất định từ token bằng FNV-1a hash (fnv1a64).
 * Cùng token → cùng instance ID.
 *
 * Main exports:
 * - generateInstanceId()   : Sinh instance ID từ Bearer token
 * - ensureSession()        : Tạo / lấy session active
 * - FreebuffCliSessionMgr  : Class quản lý heartbeat + ads renewal
 * ------------------------------------------------------------------
 */

// ─── Imports ─────────────────────────────────────────────────────────────

import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import {
  FreebuffCliSessionResponse,
  FreebuffCliAdRequest,
  FreebuffCliAdImpressionRequest,
} from './freebuff-cli.types';
import {
  BASE_URL,
  API_PATHS,
  BEARER_PREFIX,
  BEARER_USER_AGENT,
  HTTP_HEADER_NAMES,
  SESSION_CONFIG,
  ADS_CONFIG,
} from './freebuff-cli.constant';

// ─── Logger ──────────────────────────────────────────────────────────────

const logger = createLogger('FreebuffCliSession');

// ─── FNV-1a 64-bit (truncated to 32-bit hex) ─────────────────────────────

/**
 * Sinh instance ID tất định từ Bearer token dùng FNV-1a hash.
 * Theo spec: cùng token luôn ra cùng instance ID.
 *
 * Cài đặt dùng FNV-1a 32-bit (đủ dùng, tránh BigInt phức tạp).
 * Trả về hex string 8 ký tự.
 */
export function generateInstanceId(token: string): string {
  let hash = 0x811c9dc5; // FNV offset basis 32-bit
  const FNV_PRIME = 0x01000193;

  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    // Multiply modulo 2^32 — dùng Math.imul để tránh overflow
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

// ─── Session Request ──────────────────────────────────────────────────────

/**
 * Build headers chuẩn cho request giao thức Bearer.
 */
function buildBearerHeaders(
  token: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    [HTTP_HEADER_NAMES.AUTHORIZATION]: `${BEARER_PREFIX}${token}`,
    'Content-Type': 'application/json',
    [HTTP_HEADER_NAMES.USER_AGENT]: BEARER_USER_AGENT,
    ...extra,
  };
}

// ─── Ensure Session ───────────────────────────────────────────────────────

/**
 * Tạo hoặc lấy session active từ Freebuff/Codebuff.
 *
 * POST /api/v1/freebuff/session
 * - Header: x-freebuff-model, x-freebuff-instance-id, x-freebuff-multi-session
 * - Response:
 *   - status = "active" → dùng được, trả sessionId
 *   - status = "queued" → đang trong waiting room, cần thử lại
 *   - status = "ended" / lỗi → throw Error
 *
 * @throws Error nếu session không thể tạo hoặc timeout
 */
export async function ensureSession(
  token: string,
  modelId: string,
): Promise<string> {
  const instanceId = generateInstanceId(token);
  const headers = buildBearerHeaders(token, {
    [HTTP_HEADER_NAMES.X_FREEBUFF_MODEL]: modelId,
    [HTTP_HEADER_NAMES.X_FREEBUFF_INSTANCE_ID]: instanceId,
    [HTTP_HEADER_NAMES.X_FREEBUFF_MULTI_SESSION]: '1',
    [HTTP_HEADER_NAMES.X_FREEBUFF_INCLUDE_UNUSED_RATE_LIMITS]: '1',
  });

  const url = `${BASE_URL}${API_PATHS.FREEBUFF_SESSION}`;
  const startTime = Date.now();

  while (true) {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `FreebuffCLI session request failed (${res.status}): ${errText.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as FreebuffCliSessionResponse;

    if (json.status === 'active') {
      const sessionId = json.sessionId ?? json.instanceId ?? instanceId;
      return sessionId;
    }

    if (json.status === 'queued') {
      const elapsed = Date.now() - startTime;
      if (elapsed >= SESSION_CONFIG.QUEUE_MAX_WAIT_MS) {
        throw new Error(
          `FreebuffCLI session queued timeout (${SESSION_CONFIG.QUEUE_MAX_WAIT_MS}ms). Try again later.`,
        );
      }

      const waitMs = (json.retryAfter ?? 5) * 1000;
      await sleep(waitMs);
      continue;
    }

    // ended / superseded / unknown
    throw new Error(
      `FreebuffCLI session in unexpected state: ${json.status}. Re-login may be required.`,
    );
  }
}

// ─── Session Manager ──────────────────────────────────────────────────────

/**
 * Quản lý heartbeat và ads renewal cho session đang active.
 *
 * Usage:
 * ```ts
 * const mgr = new FreebuffCliSessionMgr(token, sessionId);
 * mgr.start();
 * // ... sau khi chat xong ...
 * mgr.stop();
 * ```
 */
export class FreebuffCliSessionMgr {
  private token: string;
  private sessionId: string;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private instanceId: string;

  constructor(token: string, sessionId: string) {
    this.token = token;
    this.sessionId = sessionId;
    this.instanceId = generateInstanceId(token);
  }

  /** Bắt đầu heartbeat loop */
  start(): void {
    this.stopped = false;
    this.scheduleHeartbeat();
  }

  /** Dừng heartbeat loop */
  stop(): void {
    this.stopped = true;
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleHeartbeat(): void {
    if (this.stopped) return;
    this.heartbeatTimer = setTimeout(async () => {
      if (!this.stopped) {
        await this.sendHeartbeat();
        this.scheduleHeartbeat();
      }
    }, SESSION_CONFIG.HEARTBEAT_INTERVAL_MS);
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      const headers = buildBearerHeaders(this.token, {
        [HTTP_HEADER_NAMES.X_FREEBUFF_HEARTBEAT]: '1',
        [HTTP_HEADER_NAMES.X_FREEBUFF_INSTANCE_ID]: this.instanceId,
      });

      const url = `${BASE_URL}${API_PATHS.FREEBUFF_SESSION}`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        logger.warn(
          `[FreebuffCLI] Heartbeat failed (${res.status}) for session=${this.sessionId}`,
        );
        return;
      }

      const json = (await res.json()) as FreebuffCliSessionResponse;

      // Nếu session sắp hết hạn → gia hạn bằng ads
      if (
        json.status === 'active' &&
        json.retryAfter !== undefined &&
        json.retryAfter < SESSION_CONFIG.ADS_RENEWAL_THRESHOLD_SECS
      ) {
        await this.renewViaAds();
      }
    } catch (err) {
      logger.warn('[FreebuffCLI] Heartbeat error:', err);
    }
  }

  /**
   * Gia hạn session bằng cách simulate xem quảng cáo.
   * POST /api/v1/ads → lấy adId → POST /api/v1/ads/impression
   */
  private async renewViaAds(): Promise<void> {
    try {
      const headers = buildBearerHeaders(this.token, {
        [HTTP_HEADER_NAMES.X_FREEBUFF_INSTANCE_ID]: this.instanceId,
      });

      // 1. Request ad
      const adBody: FreebuffCliAdRequest = { placement: ADS_CONFIG.PLACEMENT };
      const adRes = await fetch(`${BASE_URL}${API_PATHS.ADS}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(adBody),
      });

      if (!adRes.ok) {
        logger.warn(`[FreebuffCLI] Ads request failed (${adRes.status})`);
        return;
      }

      const adJson = (await adRes.json()) as { adId?: string; id?: string };
      const adId = adJson.adId ?? adJson.id;

      if (!adId) {
        logger.warn('[FreebuffCLI] Ads response missing adId');
        return;
      }

      // 2. Send impression
      const impressionBody: FreebuffCliAdImpressionRequest = {
        adId,
        placement: ADS_CONFIG.PLACEMENT,
      };
      await fetch(`${BASE_URL}${API_PATHS.ADS_IMPRESSION}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(impressionBody),
      });
    } catch (err) {
      logger.warn('[FreebuffCLI] Ads renewal error:', err);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
