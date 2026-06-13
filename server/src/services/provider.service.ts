import { createLogger } from '../utils/logger';
import { providerRegistry } from '../provider/registry';
import { providers as bundledProviders } from '../provider/provider-config';
import { findAllProviders as findAllProviderRows } from '../repositories/provider.repository';
import { findAllModels, upsertModel } from '../repositories/model.repository';
import { findFirstAccountByProvider } from '../repositories/account.repository';

const logger = createLogger('ProviderService');

export interface Provider {
  provider_id: string;
  provider_name: string;
  is_enabled: boolean;
  website?: string;
  is_search?: boolean;
  is_upload?: boolean;
  auth_method?: string[];
  platform?: string;
  description?: string;
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

const fetchProviderConfig = async (): Promise<any[]> => bundledProviders;

const fetchModelsFromProvider = async (providerId: string): Promise<any[]> => {
  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (!dynamicProvider?.getModels) return [];

  const account = findFirstAccountByProvider(providerId);
  if (!account) {
    logger.warn(`No account found for provider ${providerId}, cannot fetch models`);
    return [];
  }

  try {
    const models = await dynamicProvider.getModels(account.credential, account.id);
    // Cache models to database for future use
    const now = Date.now();
    for (const model of models) {
      upsertModel(
        providerId,
        model.id,
        model.name,
        model.is_thinking || false,
        model.context_length !== undefined ? model.context_length : null,
        now,
      );
    }
    return models;
  } catch (error) {
    logger.error(`Failed to fetch models from provider ${providerId}:`, error);
    return [];
  }
};

export const getAllProviders = async (): Promise<Provider[]> => {
  const config = await fetchProviderConfig();

  const dbProviders = findAllProviderRows();
  const providersMap = new Map(dbProviders.map((p) => [p.id.toLowerCase(), p]));

  const dbModels = findAllModels();
  const modelsMap = new Map<string, any[]>();
  dbModels.forEach((model) => {
    const key = model.provider_id.toLowerCase();
    if (!modelsMap.has(key)) modelsMap.set(key, []);
    modelsMap.get(key)!.push({
      id: model.model_id,
      name: model.model_name,
      is_thinking: model.is_thinking === 1,
      context_length: model.context_length,
    });
  });

  const providersWithModels: Provider[] = [];

  for (const p of config) {
    let models: any[] | undefined = p.models;

    // If provider has dynamic models (no static models in config), fetch from provider API
    if ((!models || models.length === 0) && p.is_enabled) {
      try {
        const dynamicModels = await fetchModelsFromProvider(p.provider_id);
        if (dynamicModels.length > 0) {
          models = dynamicModels;
        } else {
          // Fallback to cached models from database
          const cached = modelsMap.get(p.provider_id.toLowerCase()) || [];
          if (cached.length > 0) models = cached;
        }
      } catch (e) {
        logger.warn(`Failed to fetch dynamic models for ${p.provider_id}:`, e);
        const cached = modelsMap.get(p.provider_id.toLowerCase()) || [];
        if (cached.length > 0) models = cached;
      }
    }

    const dbProvider = providersMap.get(p.provider_id.toLowerCase());

    providersWithModels.push({
      ...p,
      models: models?.map((m: any) => ({
        ...m,
        is_search: m.is_search !== undefined ? m.is_search : (p.is_search ?? false),
        is_upload: m.is_upload !== undefined ? m.is_upload : (p.is_upload ?? false),
      })),
    });
  }

  return providersWithModels;
};

export const getProviderModels = async (
  providerId: string,
): Promise<{ id: string; name: string; is_thinking?: boolean; context_length?: number | null }[]> => {
  const isEnabled = await isProviderEnabled(providerId);
  if (!isEnabled) throw new Error(`Provider ${providerId} is disabled`);

  const remoteConfig = await fetchProviderConfig();
  const provider = remoteConfig.find((c: any) => c.provider_id === providerId);

  // Try to fetch fresh models from provider API
  try {
    const freshModels = await fetchModelsFromProvider(providerId);
    if (freshModels.length > 0) {
      return freshModels;
    }
  } catch (e) {
    logger.warn(`Failed to fetch fresh models from ${providerId}:`, e);
  }

  // Fallback to static config if available
  if (provider?.models && Array.isArray(provider.models) && provider.models.length > 0) {
    return provider.models.map((m: any) => ({
      id: m.id,
      name: m.name,
      is_thinking: m.is_thinking || false,
      context_length: m.context_length !== undefined ? m.context_length : null,
    }));
  }

  // Last resort: try direct provider.getModels()
  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (dynamicProvider?.getModels) {
    const account = findFirstAccountByProvider(providerId);
    if (account) {
      try {
        const directModels = await dynamicProvider.getModels(account.credential, account.id);
        if (directModels?.length > 0) return directModels;
      } catch (e) {
        logger.error(`Failed to fetch models directly from ${providerId}:`, e);
      }
    }
  }

  return [];
};

export const isProviderEnabled = async (providerId: string): Promise<boolean> => {
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

export const getAllModelsFromEnabledProviders = async (): Promise<ModelWithProvider[]> => {
  const remoteConfig = await fetchProviderConfig();
  const enabledProviders = remoteConfig.filter((c: any) => c.is_enabled);
  const allModels: ModelWithProvider[] = [];

  for (const provider of enabledProviders) {
    // Try to fetch fresh models from provider API
    let models: any[] = [];
    try {
      const freshModels = await fetchModelsFromProvider(provider.provider_id);
      if (freshModels.length > 0) {
        models = freshModels;
      }
    } catch (e) {
      logger.warn(`Failed to fetch fresh models for ${provider.provider_id}:`, e);
    }

    // Fallback to static config
    if (models.length === 0 && provider.models && Array.isArray(provider.models)) {
      models = provider.models;
    }

    // Last resort: try direct provider.getModels()
    if (models.length === 0) {
      const dynamicProvider = providerRegistry.getProvider(provider.provider_id);
      if (dynamicProvider?.getModels) {
        const account = findFirstAccountByProvider(provider.provider_id);
        if (account) {
          try {
            const directModels = await dynamicProvider.getModels(account.credential, account.id);
            if (directModels?.length > 0) models = directModels;
          } catch (e) {
            logger.error(`Failed to fetch models directly from ${provider.provider_id}:`, e);
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
        context_length: model.context_length !== undefined ? model.context_length : null,
        is_search: model.is_search !== undefined ? model.is_search : (provider.is_search ?? false),
        is_upload: model.is_upload !== undefined ? model.is_upload : (provider.is_upload ?? false),
      });
    }
  }

  return allModels;
};