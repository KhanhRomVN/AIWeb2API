/**
 * ------------------------------------------------------------------
 * Provider Service
 * ------------------------------------------------------------------
 * Service quản lý provider: lấy danh sách providers, models,
 * kiểm tra trạng thái enabled, và cache kết quả.
 *
 * Main functions:
 * - getAllProviders()              : Lấy danh sách providers với models
 * - getProviderModels()            : Lấy models của một provider
 * - isProviderEnabled()            : Kiểm tra provider có enabled
 * - getAllModelsFromEnabledProviders() : Lấy models từ enabled providers
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ── Database ──
import { dbContext } from '../database/connection';

// ── Repositories ──
import { findAllModelStats } from '../repositories/model-stats.repository';
import { findFirstAccountByProvider } from '../repositories/account.repository';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ProviderService');

let cachedProviders: Provider[] | null = null;
/** DataStore reference dùng để detect khi user đổi DB active — invalidate cache khi khác. */
let cachedDataStore: object | null | undefined = undefined;
/** Promise đang build cache — tránh concurrent builds khi nhiều request cùng lúc. */
let buildingCachePromise: Promise<Provider[]> | null = null;

// ─── Types ──────────────────────────────────────────────────────────────

export interface Provider {
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  website_url?: string;
  website?: string;
  auth_method?: string[];
  platform?: string;
  description?: string;
  models?: {
    id: string;
    name: string;
    is_thinking?: boolean;
    max_context_length?: number | null;
    context_length?: number | null;
    success_rate?: number | null;
    max_req_conversation?: number;
    max_token_conversation?: number;
    is_search?: boolean;
    is_image_upload?: boolean;
    is_video_upload?: boolean;
    is_audio_upload?: boolean;
    is_file_upload?: boolean;
  }[];
  /** Error message khi getModels() thất bại — hiển thị trong UI thay vì danh sách rỗng */
  models_error?: string;
  is_pausable?: boolean;
  /**
   * Provider tự inject system prompt nội bộ — Zen không nên gửi thêm
   * system prompt sẽ conflict. Khi true: PromptLength chỉ cho phép "none",
   * StyleCode chỉ cho phép "none".
   */
  anti_system_prompt_injection?: boolean;
  /**
   * Khung giờ bị chặn (UTC). Lấy thẳng từ provider constant để Zen webview
   * không cần hardcode — đổi 1 chỗ là sync toàn bộ.
   */
  blocked_time_ranges?: Array<{ startTime: number; endTime: number }>;
  /**
   * Provider có hỗ trợ session cleanup không (xóa toàn bộ conversation khi
   * account không còn ở chat view). Detect tự động từ deleteAllSessions().
   */
  supports_session_cleanup?: boolean;
  /**
   * Loại login flow. "device_code" → không cần CDP/browser profile,
   * user authorize trên bất kỳ browser nào qua verification_url + user_code.
   */
  login_flow?: 'device_code' | 'browser' | 'api_key';
}

// ─── Helpers ────────────────────────────────────────────────────────────

const fetchProviderConfig = async (): Promise<any[]> => {
  const allProviders = providerRegistry.getAllProviders();
  const configs: any[] = [];
  const seenIds = new Set<string>();

  for (const provider of allProviders) {
    const ProviderClass = provider.constructor as any;
    const cfg = ProviderClass?.config || (provider as any).config;
    if (cfg && cfg.provider_id) {
      const id = cfg.provider_id.toLowerCase();
      if (!seenIds.has(id)) {
        seenIds.add(id);
        // Tự động detect can_refresh_token dựa vào provider instance thay vì hardcode
        configs.push({
          ...cfg,
          can_refresh_token: typeof provider.refreshToken === 'function',
          supports_session_cleanup: typeof provider.deleteAllSessions === 'function',
        });
      }
    } else {
      logger.warn(
        `[fetchProviderConfig] Provider has no config or provider_id: ${provider?.constructor?.name ?? typeof provider}`,
      );
    }
  }

  return configs;
};

const fetchModelsFromProvider = async (
  providerId: string,
): Promise<{ models: any[]; error?: string }> => {
  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (!dynamicProvider?.getModels) {
    return { models: [] };
  }

  const account = await findFirstAccountByProvider(providerId);

  // Provider không cần auth (auth_method=[]) — gọi getModels với credential rỗng
  const ProviderClass = (dynamicProvider as any).constructor as any;
  const cfg = ProviderClass?.config || (dynamicProvider as any).config;
  const noAuthRequired =
    Array.isArray(cfg?.auth_method) && cfg.auth_method.length === 0;

  if (!noAuthRequired && (!account || account.credential === null)) {
    const msg = `No accounts configured. Add a ${providerId} account to load models.`;
    return { models: [], error: msg };
  }

  try {
    const models = await dynamicProvider.getModels(
      account?.credential ?? '',
      account?.id,
    );

    return { models };
  } catch (error: any) {
    const accountInfo = account
      ? `account_id=${account.id}${account.email ? ` email=${account.email}` : ''}`
      : 'no_account';
    const isAuthError = error?.isAuthError === true;
    if (isAuthError) {
      logger.warn(
        `[${providerId}] Session expired (${accountInfo}) — user needs to re-login.`,
      );
      return {
        models: [],
        error: `Session expired. Please re-login your ${providerId} account (${account?.email ?? accountInfo}).`,
      };
    }
    logger.error(
      `Failed to fetch models from provider ${providerId} (${accountInfo}): ${error?.message ?? error}`,
    );
    return {
      models: [],
      error: error?.message ?? 'Unknown error fetching models',
    };
  }
};

// ─── Main Functions ────────────────────────────────────────────────────

export const invalidateProviderCache = (): void => {
  cachedProviders = null;
  cachedDataStore = undefined;
  buildingCachePromise = null;
};

/** Tách phần build cache ra hàm riêng để dùng cho cả inline và background. */
const buildProvidersCache = async (
  _currentDataStore: object | null,
): Promise<Provider[]> => {
  const config = await fetchProviderConfig();
  // Chỉ lấy success_rate từ DB — provider metadata lấy từ registry (constants/API).
  let allModelStats: any[] = [];
  try {
    allModelStats = await findAllModelStats();
  } catch (err) {
    logger.warn('Could not fetch model stats from DB:', (err as any)?.message);
  }

  // Chỉ lấy success_rate từ DB — metadata model (name, capabilities) lấy từ provider constants/API
  const successRateMap = new Map<string, number | null>(
    allModelStats.map((s) => [
      `${s.provider_id.toLowerCase()}:${s.model_id.toLowerCase()}`,
      s.success_rate ?? null,
    ]),
  );

  const providersWithModels: Provider[] = [];
  const seenIds = new Set<string>();

  for (const p of config) {
    if (!p?.provider_id) {
      continue;
    }
    const pid = p.provider_id.toLowerCase();
    if (seenIds.has(pid)) {
      continue;
    }
    seenIds.add(pid);

    let models: any[] | undefined = p.models;
    let modelsError: string | undefined;
    if ((!models || models.length === 0) && p.is_enabled) {
      try {
        const result = await fetchModelsFromProvider(p.provider_id);
        if (result.models.length > 0) {
          models = result.models;
        } else if (result.error) {
          modelsError = result.error;
        }
      } catch (e) {
        logger.warn(`Failed to fetch dynamic models for ${p.provider_id}:`, e);
      }
    }

    const entry: Provider = {
      ...p,
      website_url: p.website_url || (p as any).website,
      website: p.website_url || (p as any).website,
      ...(modelsError ? { models_error: modelsError } : {}),
      ...(p.blocked_time_ranges != null ? { blocked_time_ranges: p.blocked_time_ranges } : {}),
      models: models?.map((m: any) => ({
        ...m,
        is_search: m.is_search !== undefined ? m.is_search : false,
        is_image_upload:
          m.is_image_upload !== undefined ? m.is_image_upload : false,
        is_video_upload:
          m.is_video_upload !== undefined ? m.is_video_upload : false,
        is_audio_upload:
          m.is_audio_upload !== undefined ? m.is_audio_upload : false,
        is_file_upload:
          m.is_file_upload !== undefined ? m.is_file_upload : false,
        max_context_length: m.max_context_length ?? m.context_length ?? null,
        context_length: m.max_context_length ?? m.context_length ?? null,
        success_rate:
          successRateMap.get(
            `${p.provider_id.toLowerCase()}:${m.id?.toLowerCase()}`,
          ) ??
          m.success_rate ??
          null,
      })),
    };

    providersWithModels.push(entry);
  }

  return providersWithModels;
};

export const getAllProviders = async (): Promise<Provider[]> => {
  // Detect khi user đổi DB active: dùng dataStore reference làm cache key.
  const ctx = dbContext.getStore();
  const currentDataStore = ctx?.dataStore ?? null;

  if (cachedProviders !== null && currentDataStore !== cachedDataStore) {
    // DB đã đổi — schedule background refresh nhưng trả về cache cũ ngay
    // để tránh block request và tránh EAI_AGAIN khi nhiều calls đồng thời.
    const staleCache = cachedProviders;
    cachedDataStore = currentDataStore;
    cachedProviders = null; // mark stale

    if (!buildingCachePromise) {
      buildingCachePromise = buildProvidersCache(currentDataStore)
        .then((result) => {
          cachedProviders = result;
          buildingCachePromise = null;
          return result;
        })
        .catch((err) => {
          logger.warn('Background provider cache refresh failed:', err?.message);
          buildingCachePromise = null;
          return staleCache;
        });
    }

    return staleCache;
  }

  if (cachedProviders !== null) {
    return cachedProviders;
  }

  // Nếu đang build, chờ kết quả thay vì build thêm lần nữa
  if (buildingCachePromise) {
    return buildingCachePromise;
  }

  cachedDataStore = currentDataStore;
  buildingCachePromise = buildProvidersCache(currentDataStore)
    .then((result) => {
      cachedProviders = result;
      buildingCachePromise = null;
      return result;
    })
    .catch((err) => {
      buildingCachePromise = null;
      throw err;
    });

  return buildingCachePromise;
};

export const getProviderModels = async (
  providerId: string,
): Promise<
  {
    id: string;
    name: string;
    is_thinking?: boolean;
    context_length?: number | null;
  }[]
> => {
  const isEnabled = await isProviderEnabled(providerId);
  if (!isEnabled) throw new Error(`Provider ${providerId} is disabled`);

  const remoteConfig = await fetchProviderConfig();
  const provider = remoteConfig.find((c: any) => c.provider_id === providerId);

  try {
    const { models: freshModels } = await fetchModelsFromProvider(providerId);
    if (freshModels.length > 0) {
      return freshModels;
    }
  } catch (e) {
    logger.warn(`Failed to fetch fresh models from ${providerId}:`, e);
  }

  if (
    provider?.models &&
    Array.isArray(provider.models) &&
    provider.models.length > 0
  ) {
    return provider.models.map((m: any) => ({
      id: m.id,
      name: m.name,
      is_thinking: m.is_thinking || false,
      context_length: m.context_length !== undefined ? m.context_length : null,
    }));
  }

  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (dynamicProvider?.getModels) {
    const account = await findFirstAccountByProvider(providerId);
    if (account && account.credential !== null) {
      try {
        const directModels = await dynamicProvider.getModels(
          account.credential,
          account.id,
        );
        if (directModels?.length > 0) return directModels;
      } catch (e) {
        logger.error(`Failed to fetch models directly from ${providerId}:`, e);
      }
    }
  }

  return [];
};

export const isProviderEnabled = async (
  providerId: string,
): Promise<boolean> => {
  const remoteConfig = await fetchProviderConfig();
  const config = remoteConfig.find((c: any) => c.provider_id === providerId);
  return config ? config.is_enabled : false;
};

export interface ModelWithProvider {
  id: string;
  name: string;
  provider_id: string;
  provider_name: string;
  is_thinking?: boolean;
  context_length?: number | null;
  is_search?: boolean;
  is_image_upload?: boolean;
  success_rate?: number | null;
}

export const getAllModelsFromEnabledProviders = async (): Promise<
  ModelWithProvider[]
> => {
  const remoteConfig = await fetchProviderConfig();
  const enabledProviders = remoteConfig.filter((c: any) => c.is_enabled);
  const allModels: ModelWithProvider[] = [];

  for (const provider of enabledProviders) {
    let models: any[] = [];
    try {
      const { models: freshModels } = await fetchModelsFromProvider(
        provider.provider_id,
      );
      if (freshModels.length > 0) {
        models = freshModels;
      }
    } catch (e) {
      logger.warn(
        `Failed to fetch fresh models for ${provider.provider_id}:`,
        e,
      );
    }

    if (
      models.length === 0 &&
      provider.models &&
      Array.isArray(provider.models)
    ) {
      models = provider.models;
    }

    if (models.length === 0) {
      const dynamicProvider = providerRegistry.getProvider(
        provider.provider_id,
      );
      if (dynamicProvider?.getModels) {
        const account = await findFirstAccountByProvider(provider.provider_id);
        if (account && account.credential !== null) {
          try {
            const directModels = await dynamicProvider.getModels(
              account.credential,
              account.id,
            );
            if (directModels?.length > 0) models = directModels;
          } catch (e) {
            logger.error(
              `Failed to fetch models directly from ${provider.provider_id}:`,
              e,
            );
          }
        }
      }
    }

    for (const model of models) {
      allModels.push({
        id: model.id,
        name: model.name,
        provider_id: provider.provider_id,
        provider_name: provider.provider_name,
        is_thinking: model.is_thinking || false,
        context_length:
          model.context_length !== undefined ? model.context_length : null,
        is_search:
          model.is_search !== undefined
            ? model.is_search
            : (provider.is_search ?? false),
        is_image_upload: model.is_image_upload ?? false,
        success_rate:
          model.success_rate !== undefined ? model.success_rate : null,
      });
    }
  }

  return allModels;
};
