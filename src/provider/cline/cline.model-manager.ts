/**
 * ------------------------------------------------------------------
 * Cline Model Manager
 * ------------------------------------------------------------------
 * Quản lý danh sách model của Cline (dynamic fetch + cache + fallback).
 *
 * Core features:
 * - refreshModels()      : Lấy model list từ upstream (cache TTL 10 phút)
 * - refreshFreeModels()  : Lấy free model list từ recommended-models endpoint
 * - getModelUpstreamId() : Map external model ID → upstream model ID
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import {
  BASE_URL,
  API_PATHS,
  MODELS,
  MODELS_TTL,
  FREE_MODEL_WHITELIST,
  DEFAULT_MODEL,
  HTTP_HEADERS,
  HTTP_HEADER_NAMES,
} from './cline.constant';
import type {
  ClineModelEntry,
  ClineModelsResponse,
  ClineRecommendedResponse,
} from './cline.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClineModelManager');

// ─── Cache ──────────────────────────────────────────────────────────────

let modelsCache: ClineModelEntry[] | null = null;
let modelsCacheTime = 0;

// ─── Free Models (Recommended) ──────────────────────────────────────────

/**
 * Lấy danh sách model free từ /ai/cline/recommended-models.
 * Upstream trả `{ free: [{ id }] }`.
 * Không cần auth, dùng để bổ sung vào modelsCache.
 */
async function refreshFreeModels(): Promise<ClineModelEntry[]> {
  try {
    const resp = await fetch(`${BASE_URL}${API_PATHS.RECOMMENDED_MODELS}`, {
      headers: { [HTTP_HEADER_NAMES.USER_AGENT]: HTTP_HEADERS.USER_AGENT },
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as ClineRecommendedResponse;
    const list = Array.isArray(data?.free) ? data.free : [];
    return list
      .filter((m) => m && m.id)
      .map((m) => ({
        id: m.id!,
        upstream: m.id!,
        provider: m.id!.split('/')[0] || 'cline',
        cost: 'free' as const,
      }));
  } catch (e: any) {
    logger.warn('[ClineModels] refreshFreeModels error:', e?.message);
    return [];
  }
}

// ─── Main Model Refresh ──────────────────────────────────────────────────

/**
 * Lấy model list từ upstream /v1/models, cache TTL = MODELS_TTL.
 * Chỉ giữ lại model free (suffix `:free` hoặc trong FREE_MODEL_WHITELIST).
 * Merge thêm cline-free/ models từ recommended-models endpoint.
 * Fallback về MODELS hardcode nếu upstream fail.
 */
export async function refreshModels(): Promise<ClineModelEntry[]> {
  try {
    const now = Date.now();
    if (modelsCache && now - modelsCacheTime < MODELS_TTL) {
      return modelsCache;
    }

    const resp = await fetch(`${BASE_URL}${API_PATHS.MODELS}`, {
      headers: { [HTTP_HEADER_NAMES.USER_AGENT]: HTTP_HEADERS.USER_AGENT },
    });

    if (!resp.ok) {
      logger.warn(
        `[ClineModels] Upstream /models HTTP ${resp.status}, fallback to hardcode`,
      );
      return MODELS as unknown as ClineModelEntry[];
    }

    const data = (await resp.json()) as ClineModelsResponse;
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      return MODELS as unknown as ClineModelEntry[];
    }

    const baseList: ClineModelEntry[] = data.data
      .filter((m) => {
        const id = m.id || '';
        if (m.batch) return false;
        if (id.endsWith(':batch')) return false;
        if (id.includes(':free')) return true;
        if ((FREE_MODEL_WHITELIST as readonly string[]).includes(id))
          return true;
        return false;
      })
      .map((m) => {
        const id = m.id || '';
        const prefix = id.split('/')[0] || 'cline';
        return { id, upstream: id, provider: prefix, cost: 'free' as const };
      });

    // Merge free models từ recommended-models
    const freeExtra = await refreshFreeModels();
    for (const fm of freeExtra) {
      if (!baseList.some((b) => b.id === fm.id)) {
        baseList.push(fm);
      }
    }

    modelsCache = baseList;
    modelsCacheTime = now;
    return modelsCache;
  } catch (e: any) {
    logger.warn(
      '[ClineModels] refreshModels error:',
      e?.message?.slice(0, 100),
      '— fallback to hardcode',
    );
    return MODELS as unknown as ClineModelEntry[];
  }
}

// ─── Model Lookup ────────────────────────────────────────────────────────

/**
 * Tra cứu upstream model ID từ external model ID (do client gửi lên).
 * Nếu không tìm thấy trong danh sách → dùng nguyên external ID.
 */
export async function getModelUpstreamId(externalId: string): Promise<string> {
  const list = await refreshModels();
  const found = list.find((m) => m.id === externalId);
  return found?.upstream ?? externalId;
}

/**
 * Trả về danh sách model ở format OpenAI /v1/models response.
 */
export async function getModelsListPayload(): Promise<
  Array<{ id: string; object: string; created: number; owned_by: string }>
> {
  const list = await refreshModels();
  const now = Math.floor(Date.now() / 1000);
  return list.map((m) => ({
    id: m.id,
    object: 'model',
    created: now,
    owned_by: 'cline',
  }));
}

/**
 * Kiểm tra model có cần force stream về phía upstream không.
 * Upstream không hỗ trợ non-stream cho deepseek/ / cline-free/ / cline-pass/.
 */
export function needsForceStream(upstreamModel: string): boolean {
  return (
    upstreamModel.startsWith('deepseek/') ||
    upstreamModel.startsWith('cline-free/') ||
    upstreamModel.startsWith('cline-pass/')
  );
}

export { DEFAULT_MODEL };
