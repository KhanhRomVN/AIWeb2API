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

// ── Repositories ──
import {
  findAllProviders as findAllProviderRows,
  upsertProvider,
} from '../repositories/provider.repository';
import { findAllModelStats } from '../repositories/model-stats.repository';
import { findFirstAccountByProvider } from '../repositories/account.repository';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ProviderService');

let cachedProviders: Provider[] | null = null;

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
  is_pausable?: boolean;
  is_memory?: boolean;
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
        configs.push(cfg);
      }
    }
  }

  return configs;
};

const fetchModelsFromProvider = async (providerId: string): Promise<any[]> => {
  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (!dynamicProvider?.getModels) {
    return [];
  }

  const account = findFirstAccountByProvider(providerId);
  if (!account || account.credential === null) {
    return [];
  }

  try {
    const models = await dynamicProvider.getModels(
      account.credential,
      account.id,
    );
    return models;
  } catch (error) {
    logger.error(`Failed to fetch models from provider ${providerId}:`, error);
    return [];
  }
};

// ─── Main Functions ────────────────────────────────────────────────────

export const invalidateProviderCache = (): void => {
  cachedProviders = null;
};

export const getAllProviders = async (): Promise<Provider[]> => {
  if (cachedProviders !== null) {
    return cachedProviders;
  }

  const config = await fetchProviderConfig();
  const dbProviders = findAllProviderRows();
  const providersMap = new Map(dbProviders.map((p) => [p.id.toLowerCase(), p]));

  // Chỉ lấy success_rate từ DB — metadata model (name, capabilities) lấy từ provider constants/API
  const allModelStats = findAllModelStats();
  const successRateMap = new Map<string, number | null>(
    allModelStats.map((s) => [
      `${s.provider_id.toLowerCase()}:${s.model_id.toLowerCase()}`,
      s.success_rate ?? null,
    ]),
  );

  const providersWithModels: Provider[] = [];
  const seenIds = new Set<string>();

  for (const p of config) {
    if (!p?.provider_id) continue;
    const pid = p.provider_id.toLowerCase();
    if (seenIds.has(pid)) continue;
    seenIds.add(pid);

    // Upsert provider metadata to database
    upsertProvider({
      id: p.provider_id,
      title: p.provider_name || p.provider_id,
      description: p.description,
      color: p.color,
      platform: p.platform,
      connection_type: p.connection_type,
      is_enabled: p.is_enabled !== false ? 1 : 0,
      website_url: p.website_url,
      auth_method: Array.isArray(p.auth_method)
        ? JSON.stringify(p.auth_method)
        : (p.auth_method ?? null),
      is_pausable: p.is_pausable ? 1 : 0,
      is_memory: p.is_memory ? 1 : 0,
      browser_extension_folder: p.browser_extension_folder,
    });

    let models: any[] | undefined = p.models;
    if ((!models || models.length === 0) && p.is_enabled) {
      try {
        const dynamicModels = await fetchModelsFromProvider(p.provider_id);
        if (dynamicModels.length > 0) {
          models = dynamicModels;
        } else {
          logger.warn(
            `[getAllProviders] ${p.provider_id}: dynamic getModels() returned 0 models`,
          );
        }
      } catch (e) {
        logger.warn(`Failed to fetch dynamic models for ${p.provider_id}:`, e);
      }
    }

    const dbProvider = providersMap.get(p.provider_id.toLowerCase());
    providersWithModels.push({
      ...p,
      website_url: p.website_url || (p as any).website,
      website: p.website_url || (p as any).website,
      is_memory: dbProvider?.is_memory === 1 ? true : (p.is_memory ?? false),
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
    });
  }

  cachedProviders = providersWithModels;
  return providersWithModels;
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
    const freshModels = await fetchModelsFromProvider(providerId);
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
    const account = findFirstAccountByProvider(providerId);
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
      const freshModels = await fetchModelsFromProvider(provider.provider_id);
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
        const account = findFirstAccountByProvider(provider.provider_id);
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
