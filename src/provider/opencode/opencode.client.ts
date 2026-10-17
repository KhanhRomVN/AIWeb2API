/**
 * ------------------------------------------------------------------
 * OpenCode Client
 * ------------------------------------------------------------------
 * Khởi tạo và cache SDK client, kiểm tra health backend, liệt kê và
 * phân giải model.
 *
 * @opencode-ai/sdk là ESM-only còn dự án build CJS → import động
 * bằng `await import()`.
 *
 * Main functions:
 * - parseCredential() : JSON string -> OpenCodeCredential
 * - checkHealth()     : GET {serverUrl}/global/health
 * - getClient()       : SDK client (cache theo serverUrl + password)
 * - listProviders()   : config.providers() -> mảng provider chuẩn hoá
 * - resolveModel()    : tên model client gửi -> { providerID, modelID }
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import fetch from 'node-fetch';

import { createLogger } from '../../utils/logger';
import { ProviderAuthError, ProviderHttpError } from '../_shared/http';

import {
  API_PATHS,
  BACKEND_MAJOR_VERSION_UNSUPPORTED,
  BACKEND_USERNAME,
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER_SEGMENT,
  DEFAULT_SERVER_URL,
  HEALTH_TIMEOUT_MS,
  HTTP_HEADER_NAMES,
  MODEL_FREE_SUFFIX,
} from './opencode.constant';
import {
  OpenCodeClientLike,
  OpenCodeCredential,
  OpenCodeModelInfo,
  OpenCodeModelRef,
  OpenCodeProviderInfo,
} from './opencode.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('OpenCodeClient');

const clientCache = new Map<string, OpenCodeClientLike>();

// ─── Credential ─────────────────────────────────────────────────────────

/**
 * Credential chuẩn: JSON `{ serverUrl, password? }`.
 * Fallback: chuỗi thô được coi là serverUrl.
 */
export function parseCredential(credential: string): OpenCodeCredential {
  const trimmed = (credential || '').trim();
  if (!trimmed) return { serverUrl: DEFAULT_SERVER_URL };

  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as Partial<OpenCodeCredential>;
      return {
        serverUrl: (json.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, ''),
        password: json.password || undefined,
      };
    } catch (e) {
      logger.warn('[OpenCode] Credential không phải JSON hợp lệ:', e);
    }
  }
  return { serverUrl: trimmed.replace(/\/+$/, '') };
}

export function buildAuthHeaders(cred: OpenCodeCredential): Record<string, string> {
  if (!cred.password) return {};
  const token = Buffer.from(`${BACKEND_USERNAME}:${cred.password}`).toString('base64');
  return { [HTTP_HEADER_NAMES.AUTHORIZATION]: `Basic ${token}` };
}

// ─── Health ─────────────────────────────────────────────────────────────

/**
 * Kiểm tra backend sống và là OpenCode 1.x.
 * @throws ProviderAuthError (401/403), ProviderHttpError (khác) hoặc Error (unreachable / 2.x).
 */
export async function checkHealth(cred: OpenCodeCredential): Promise<void> {
  let res;
  try {
    res = await fetch(`${cred.serverUrl}${API_PATHS.HEALTH}`, {
      headers: buildAuthHeaders(cred),
      timeout: HEALTH_TIMEOUT_MS,
    });
  } catch (e) {
    throw new Error(
      `Không kết nối được OpenCode backend tại ${cred.serverUrl}: ${(e as Error).message}`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new ProviderAuthError(
      'OpenCode: password backend sai hoặc thiếu.',
      res.status,
    );
  }
  if (!res.ok) {
    throw new ProviderHttpError(
      `OpenCode health check trả về ${res.status}`,
      res.status,
    );
  }

  const json = (await res.json().catch(() => ({}))) as {
    healthy?: boolean;
    version?: string;
  };
  if (!json.healthy) throw new Error('OpenCode backend chưa healthy.');

  const major = parseInt(String(json.version || '').split('.')[0], 10);
  if (Number.isFinite(major) && major >= BACKEND_MAJOR_VERSION_UNSUPPORTED) {
    throw new Error(
      `OpenCode backend ${json.version} không được hỗ trợ (SDK 1.x). Cài opencode-ai@1.19.0.`,
    );
  }
}

// ─── Client ─────────────────────────────────────────────────────────────

export async function getClient(cred: OpenCodeCredential): Promise<OpenCodeClientLike> {
  const key = `${cred.serverUrl}|${cred.password || ''}`;
  const cached = clientCache.get(key);
  if (cached) return cached;

  const { createOpencodeClient } = await import('@opencode-ai/sdk');
  const client = createOpencodeClient({
    baseUrl: cred.serverUrl,
    headers: buildAuthHeaders(cred),
  }) as unknown as OpenCodeClientLike;

  clientCache.set(key, client);
  return client;
}

// ─── Models ─────────────────────────────────────────────────────────────

/** `config.providers()` trả mảng HOẶC object {id: info}; models cũng có thể là mảng. */
export async function listProviders(
  client: OpenCodeClientLike,
): Promise<OpenCodeProviderInfo[]> {
  const res = await client.config.providers();
  const data = res?.data ?? res;
  const raw = data?.providers ?? data;
  if (!raw) return [];

  const entries: any[] = Array.isArray(raw)
    ? raw
    : Object.keys(raw).map((id) => ({ id, ...(raw as Record<string, any>)[id] }));

  return entries.map((p) => {
    const models: Record<string, OpenCodeModelInfo> = {};
    if (Array.isArray(p.models)) {
      for (const m of p.models) if (m?.id) models[m.id] = m;
    } else if (p.models && typeof p.models === 'object') {
      for (const id of Object.keys(p.models)) {
        models[id] = { ...p.models[id], id: p.models[id]?.id || id };
      }
    }
    return { id: p.id, name: p.name, models };
  });
}

export function normalizeModelId(modelId: string): string {
  return modelId.replace(/^gpt(\d)/, 'gpt-$1').replace(/^o(\d)/, 'o$1');
}

/**
 * Phân giải tên model: chỉ hỗ trợ free tier.
 * - Không truyền model → dùng DEFAULT_MODEL_ID (`opencode/kimi-k2.5-free`).
 * - Tách provider/model, chuẩn hoá alias.
 * - Luôn ép sang phiên bản `-free`: nếu chưa có suffix thì thêm vào;
 *   nếu đã có thì giữ nguyên.
 * - Khớp chính xác trong danh sách model của backend.
 * @throws ProviderHttpError 404 khi không tìm thấy model free tương ứng.
 */
export async function resolveModel(
  client: OpenCodeClientLike,
  requested: string | undefined,
): Promise<OpenCodeModelRef> {
  const raw = (requested || '').trim() || DEFAULT_MODEL_ID;
  const slash = raw.indexOf('/');
  const providerID = slash === -1 ? DEFAULT_PROVIDER_SEGMENT : raw.slice(0, slash);
  let modelID = normalizeModelId(slash === -1 ? raw : raw.slice(slash + 1));

  if (!modelID.endsWith(MODEL_FREE_SUFFIX)) {
    modelID = `${modelID}${MODEL_FREE_SUFFIX}`;
  }

  const providers = await listProviders(client);
  const provider = providers.find((p) => p.id === providerID);
  const ids = Object.keys(provider?.models ?? {});

  if (!ids.includes(modelID)) {
    const freeAvailable = providers
      .flatMap((p) =>
        Object.keys(p.models ?? {})
          .filter((m) => m.endsWith(MODEL_FREE_SUFFIX))
          .map((m) => `${p.id}/${m}`),
      )
      .slice(0, 30)
      .join(', ');
    throw new ProviderHttpError(
      `Free model not found: ${providerID}/${modelID}. Only free-tier models are supported. Available: ${freeAvailable}`,
      404,
    );
  }
  return { providerID, modelID };
}