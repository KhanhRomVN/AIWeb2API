/**
 * ------------------------------------------------------------------
 * WorkBuddy Models Fetcher
 * ------------------------------------------------------------------
 * Fetch danh sách model từ WorkBuddy upstream.
 * WorkBuddy fetch động từ 2 nguồn (song song, merge):
 *   1. /v3/config (IDE UA) → modelList + modelPromotions
 *   2. /console/enterprises/personal/models (enterprise models)
 *
 * Global realm có endpoint riêng:
 *   /v2/enterprises/personal/models (fallback to /console/...)
 *
 * Main exports:
 * - fetchWorkBuddyModels()  : Fetch và merge models từ upstream
 * ------------------------------------------------------------------
 */

// ── External ──
import fetch from 'node-fetch';

// ── Types ──
import {
  WorkBuddyCredential,
  WorkBuddyModelInfo,
  WorkBuddyApiEnvelope,
} from './workbuddy.types';

// ── Constants ──
import {
  UPSTREAM_BASE_CN,
  UPSTREAM_BASE_GLOBAL,
  API_PATHS,
  HEADER_NAMES,
  CONTENT_TYPES,
  USER_AGENTS,
  CLIENT_VERSION,
  FETCH_MODELS_TIMEOUT_MS,
} from './workbuddy.constant';
import { buildBillingHeaders, chatBaseUrl, originFor } from './workbuddy.auth';
import { createLogger } from '../../utils/logger';

const logger = createLogger('WorkBuddyModels');

// ─── Types (internal) ─────────────────────────────────────────────────

interface V3ConfigModel {
  id?: string;
  modelId?: string;
  name?: string;
  description?: string;
  supportVision?: boolean;
  supportThinking?: boolean;
  supportToolCall?: boolean;
  contextLength?: number;
  maxOutputTokens?: number;
  isDefault?: boolean;
  credits?: number;
  tags?: string[];
  vendor?: string;
}

interface V3ConfigResponse {
  models?: V3ConfigModel[];
  modelList?: V3ConfigModel[];
  modelPromotions?: Array<{
    modelId: string;
    discountType?: string;
    discountValue?: number;
  }>;
}

interface EnterpriseModelsResponse {
  models?: V3ConfigModel[];
  list?: V3ConfigModel[];
}

// ─── Fetcher ──────────────────────────────────────────────────────────

/**
 * Fetch models từ /v3/config (IDE User-Agent).
 */
async function fetchV3ConfigModels(
  cred: WorkBuddyCredential,
): Promise<WorkBuddyModelInfo[]> {
  const base = chatBaseUrl(cred.realm);
  const origin = originFor(cred.realm);
  const url = `${base}${API_PATHS.MODELS_V3_CONFIG}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    FETCH_MODELS_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url, {
      signal: controller.signal as any,
      headers: {
        [HEADER_NAMES.AUTHORIZATION]: `Bearer ${cred.accessToken}`,
        [HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
        [HEADER_NAMES.ORIGIN]: origin,
        [HEADER_NAMES.REFERER]: `${origin}/`,
        // IDE UA để trigger model list từ IDE config
        [HEADER_NAMES.USER_AGENT]: `CodeBuddyIDE/${CLIENT_VERSION}`,
        [HEADER_NAMES.X_CODEBUDDY_REQUEST]: '1',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn(`[fetchV3ConfigModels] HTTP ${res.status} from ${url}`);
      return [];
    }

    const envelope =
      (await res.json()) as WorkBuddyApiEnvelope<V3ConfigResponse>;

    if (envelope.code !== 0 || !envelope.data) return [];

    const data = envelope.data;
    const rawModels = data.modelList || data.models || [];
    const result = rawModels.map(normalizeModel);
    return result;
  } catch (e: any) {
    clearTimeout(timeoutId);
    return [];
  }
}

/**
 * Fetch models từ enterprise endpoint.
 */
async function fetchEnterpriseModels(
  cred: WorkBuddyCredential,
): Promise<WorkBuddyModelInfo[]> {
  const base = chatBaseUrl(cred.realm);
  const path =
    cred.realm === 'global'
      ? API_PATHS.MODELS_GLOBAL_V2
      : API_PATHS.MODELS_ENTERPRISE;
  const url = `${base}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    FETCH_MODELS_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url, {
      signal: controller.signal as any,
      headers: buildBillingHeaders(cred),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      logger.warn(`[fetchEnterpriseModels] HTTP ${res.status} from ${url}`);
      return [];
    }

    const envelope =
      (await res.json()) as WorkBuddyApiEnvelope<EnterpriseModelsResponse>;

    if (envelope.code !== 0 || !envelope.data) return [];

    const data = envelope.data;
    const rawModels = data.models || data.list || [];
    const result = rawModels.map(normalizeModel);
    return result;
  } catch (e: any) {
    clearTimeout(timeoutId);
    logger.warn(`[fetchEnterpriseModels] error: ${e?.message}`);
    return [];
  }
}

/**
 * Normalize raw model từ upstream → WorkBuddyModelInfo.
 */
function normalizeModel(raw: V3ConfigModel): WorkBuddyModelInfo {
  return {
    id: raw.id || raw.modelId || '',
    name: raw.name || raw.id || raw.modelId || '',
    description: raw.description,
    supportsImages: raw.supportVision ?? false,
    supportsThinking: raw.supportThinking ?? false,
    supportsToolCall: raw.supportToolCall ?? true,
    contextWindow: raw.contextLength,
    maxOutputTokens: raw.maxOutputTokens,
    isDefault: raw.isDefault ?? false,
    credits: raw.credits,
    tags: raw.tags,
    vendor: raw.vendor,
  };
}

/**
 * Merge hai danh sách model (v3 được ưu tiên).
 * Nếu cùng model ID: v3 thắng, enterprise bổ sung những model không có trong v3.
 */
function mergeModels(
  v3: WorkBuddyModelInfo[],
  enterprise: WorkBuddyModelInfo[],
): WorkBuddyModelInfo[] {
  const map = new Map<string, WorkBuddyModelInfo>();

  // Enterprise vào trước (độ ưu tiên thấp hơn)
  for (const m of enterprise) {
    if (m.id) map.set(m.id, m);
  }

  // V3 override (độ ưu tiên cao hơn)
  for (const m of v3) {
    if (m.id) map.set(m.id, m);
  }

  return Array.from(map.values()).filter((m) => m.id);
}

/**
 * Fetch và merge models từ tất cả upstream sources.
 * Chạy song song (Promise.allSettled), merge kết quả.
 *
 * @param cred - Credential của tài khoản (dùng để auth)
 * @returns Danh sách model đã merge, rỗng nếu upstream fail
 */
export async function fetchWorkBuddyModels(
  cred: WorkBuddyCredential,
): Promise<WorkBuddyModelInfo[]> {
  const [v3Result, enterpriseResult] = await Promise.allSettled([
    fetchV3ConfigModels(cred),
    fetchEnterpriseModels(cred),
  ]);

  const v3Models = v3Result.status === 'fulfilled' ? v3Result.value : [];
  const enterpriseModels =
    enterpriseResult.status === 'fulfilled' ? enterpriseResult.value : [];

  const merged = mergeModels(v3Models, enterpriseModels);
  return merged;
}

/**
 * Convert WorkBuddyModelInfo → Provider model format (AIWeb2API format).
 */
export function toProviderModel(info: WorkBuddyModelInfo): {
  id: string;
  name: string;
  is_thinking: boolean;
  max_context_length: number | null;
  is_search: boolean;
  is_image_upload: boolean;
  is_video_upload: boolean;
  is_audio_upload: boolean;
  is_file_upload: boolean;
  is_larger_content_paste_upload: boolean;
  is_image_generator: boolean;
  is_video_generator: boolean;
  is_deep_research: boolean;
  description: string;
} {
  return {
    id: info.id,
    name: info.name || info.id,
    is_thinking: info.supportsThinking ?? false,
    max_context_length: info.contextWindow ?? null,
    is_search: false,
    is_image_upload: info.supportsImages ?? false,
    is_video_upload: false,
    is_audio_upload: false,
    is_file_upload: false,
    is_larger_content_paste_upload: false,
    is_image_generator: false,
    is_video_generator: false,
    is_deep_research: false,
    description: info.description || `${info.name || info.id} via WorkBuddy`,
  };
}
