import { createLogger } from '../utils/logger';
import { providerRegistry } from '../provider/registry';
import { providers as bundledProviders } from '../provider/provider-config';
import { getDb } from './db';
import {
  getCachedModels,
  getModelsForProvider,
  isDynamicProvider,
} from './models-sync.service';

const logger = createLogger('ProviderService');

export interface Provider {
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  website?: string;
  is_search?: boolean;
  is_upload?: boolean;
  auth_method?: string[];
  total_accounts?: number;
  models?: {
    id: string;
    name: string;
    is_thinking?: boolean;
    context_length?: number | null;
    success_rate?: number;
    max_req_conversation?: number;
    max_token_conversation?: number;
    is_search?: boolean;
    is_upload?: boolean;
  }[];
  connection_mode?: string;
}

const fetchProviderConfig = async (): Promise<any[]> => {
  return bundledProviders;
};

export const getAllProviders = async (): Promise<Provider[]> => {
  const config = await fetchProviderConfig();
  const db = getDb();

  // Get account counts from DB
  const dbProviders = db
    .prepare('SELECT id, total_accounts FROM providers')
    .all() as {
    id: string;
    total_accounts: number;
  }[];

  // Get model stats from DB
  const dbModelStats = db
    .prepare('SELECT * FROM provider_models')
    .all() as any[];
  const modelStatsMap = new Map<string, any>();
  dbModelStats.forEach((stat) => {
    // Key: provider_id:model_id (using lowercase for safer matching if needed, but IDs should be consistent)
    modelStatsMap.set(`${stat.provider_id}:${stat.model_id}`, stat);
  });

  // Use lowercase keys for case-insensitive matching
  const countsMap = new Map(
    dbProviders.map((p) => [p.id.toLowerCase(), p.total_accounts]),
  );

  // Build providers with models
  const providersWithModels: Provider[] = [];

  for (const p of config) {
    let models = p.models;

    // If no static models in config, try to get from cache or dynamic fetch
    if (!models || !Array.isArray(models) || models.length === 0) {
      // First check cache
      const cachedModels = getCachedModels(p.provider_id);
      if (cachedModels.length > 0) {
        models = cachedModels;
      } else if (isDynamicProvider(p.provider_id)) {
        // Try to fetch dynamically (but don't block too long)
        try {
          const dynamicModels = await getModelsForProvider(p.provider_id);
          if (dynamicModels.length > 0) {
            models = dynamicModels;
          }
        } catch (e) {
          logger.warn(`Failed to get dynamic models for ${p.provider_id}:`, e);
        }
      }
    }

    // Merge stats into models
    let modelsWithStats: any[] | undefined = undefined;
    if (models && Array.isArray(models)) {
      modelsWithStats = models.map((m: any) => {
        const stats =
          modelStatsMap.get(`${p.provider_id}:${m.id || m.model_id}`) || {};
        const total = stats.total_requests || 0;
        const success = stats.successful_requests || 0;
        const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

        // Filter out internal fields if necessary, or just spread
        return {
          ...m,
          is_search: m.is_search !== undefined ? m.is_search : (p.is_search ?? false),
          is_upload: m.is_upload !== undefined ? m.is_upload : (p.is_upload ?? false),
          success_rate: successRate,
          max_req_conversation: stats.max_req_conversation || 0,
          max_token_conversation: stats.max_token_conversation || 0,
        };
      });
    }

    providersWithModels.push({
      ...p,
      total_accounts: countsMap.get(p.provider_id.toLowerCase()) || 0,
      models: modelsWithStats,
    });
  }

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
  // Check if provider is enabled first
  const isEnabled = await isProviderEnabled(providerId);
  if (!isEnabled) {
    throw new Error(`Provider ${providerId} is disabled`);
  }

  // Fetch remote config to get models
  const remoteConfig = await fetchProviderConfig();
  const provider = remoteConfig.find((c: any) => c.provider_id === providerId);

  // 1. Check if this is a dynamic provider and use cache/sync service
  if (isDynamicProvider(providerId)) {
    try {
      const models = await getModelsForProvider(providerId);
      if (models.length > 0) {
        return models;
      }
    } catch (e) {
      logger.warn(
        `Failed to get models from sync service for ${providerId}:`,
        e,
      );
    }
  }

  // 2. Return static models from config if available
  if (provider && provider.models && Array.isArray(provider.models)) {
    return provider.models.map((m: any) => ({
      id: m.id,
      name: m.name,
      is_thinking: m.is_thinking || false,
      context_length: m.context_length !== undefined ? m.context_length : null,
      is_search: m.is_search !== undefined ? m.is_search : (provider.is_search ?? false),
      is_upload: m.is_upload !== undefined ? m.is_upload : (provider.is_upload ?? false),
    }));
  }

  // 3. Fallback to direct provider registry call
  // 3. Fallback to direct provider registry call
  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (dynamicProvider && dynamicProvider.getModels) {
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE LOWER(provider_id) = ? LIMIT 1')
      .get(providerId.toLowerCase()) as any;

    try {
      const credential = account ? account.credential : '';
      const accountId = account ? account.id : undefined;

      const dynamicModels = await dynamicProvider.getModels(
        credential,
        accountId,
      );
      if (dynamicModels && dynamicModels.length > 0) {
        return dynamicModels;
      }
    } catch (e) {
      logger.error(
        `[DEBUG] Failed to fetch dynamic models for ${providerId}:`,
        e,
      );
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
  is_upload?: boolean;
}

export const getAllModelsFromEnabledProviders = async (): Promise<
  ModelWithProvider[]
> => {
  const remoteConfig = await fetchProviderConfig();
  const enabledProviders = remoteConfig.filter((c: any) => c.is_enabled);

  const allModels: ModelWithProvider[] = [];

  for (const provider of enabledProviders) {
    // 1. Static models from config
    if (provider.models && Array.isArray(provider.models)) {
      for (const model of provider.models) {
        allModels.push({
          id: model.id,
          name: model.name,
          provider_id: provider.provider_id,
          provider_name: provider.provider_name,
          is_thinking: model.is_thinking || false,
          context_length:
            model.context_length !== undefined ? model.context_length : null,
          is_search: model.is_search !== undefined ? model.is_search : (provider.is_search ?? false),
          is_upload: model.is_upload !== undefined ? model.is_upload : (provider.is_upload ?? false),
        });
      }
    } else {
      // 2. Fallback to dynamic models from provider registry
      const dynamicProvider = providerRegistry.getProvider(
        provider.provider_id,
      );
      if (dynamicProvider && dynamicProvider.getModels) {
        const db = getDb();
        const account = db
          .prepare(
            'SELECT * FROM accounts WHERE LOWER(provider_id) = ? LIMIT 1',
          )
          .get(provider.provider_id.toLowerCase()) as any;

        if (account) {
          try {
            const dynamicModels = await dynamicProvider.getModels(
              account.credential,
              account.id,
            );
            for (const model of dynamicModels) {
              allModels.push({
                id: model.id,
                name: model.name,
                provider_id: provider.provider_id,
                provider_name: provider.provider_name,
                is_thinking: model.is_thinking || false,
                context_length:
                  model.context_length !== undefined
                    ? model.context_length
                    : null,
                is_search: model.is_search !== undefined ? model.is_search : (provider.is_search ?? false),
                is_upload: model.is_upload !== undefined ? model.is_upload : (provider.is_upload ?? false),
              });
            }
          } catch (e) {
            logger.error(
              `Failed to fetch dynamic models for ${provider.provider_id} in getAllModels:`,
              e,
            );
          }
        }
      }
    }
  }

  return allModels;
};
