import { providerRegistry } from '../provider/registry';
import { providers } from '../provider/provider-config';
import { createLogger } from '../utils/logger';
import { getDb } from '../database';
import { findFirstAccountByProvider } from '../repositories/account.repository';

const logger = createLogger('ModelsSyncService');

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const getDynamicProvidersList = (): string[] => {
  return providers
    .filter((p) => p.is_enabled && !p.models)
    .map((p) => p.provider_id);
};

export const getMsUntilNextGmtMidnight = (): number => {
  const now = new Date();
  const nextMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return nextMidnight.getTime() - now.getTime();
};

export const scheduleNextGmtSync = (callback: () => Promise<void>): void => {
  const msUntilMidnight = getMsUntilNextGmtMidnight();
  setTimeout(async () => {
    try {
      await callback();
    } catch (error) {
      logger.error('Scheduled GMT sync failed:', error);
    }
    scheduleNextGmtSync(callback);
  }, msUntilMidnight);
};

export interface CachedModel {
  id: string;
  name: string;
  is_thinking: boolean;
  context_length: number | null;
}

export const getCachedModels = (providerId: string): CachedModel[] => {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT model_id, model_name, is_thinking, context_length FROM provider_models WHERE provider_id = ?',
    )
    .all(providerId) as any[];

  return rows.map((r) => ({
    id: r.model_id,
    name: r.model_name,
    is_thinking: r.is_thinking === 1,
    context_length: r.context_length,
  }));
};

export const saveCachedModels = (
  providerId: string,
  models: CachedModel[],
  isDynamic: boolean = false,
): void => {
  const db = getDb();
  const now = Date.now();

  db.prepare('DELETE FROM provider_models WHERE provider_id = ?').run(providerId);

  const insertStmt = db.prepare(`
    INSERT INTO provider_models (provider_id, model_id, model_name, is_thinking, context_length, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const model of models) {
    insertStmt.run(providerId, model.id, model.name, model.is_thinking ? 1 : 0, model.context_length, now);
  }

  db.prepare(`
    INSERT INTO provider_models_sync (provider_id, last_sync_at, is_dynamic)
    VALUES (?, ?, ?)
    ON CONFLICT(provider_id) DO UPDATE SET last_sync_at = ?, is_dynamic = ?
  `).run(providerId, now, isDynamic ? 1 : 0, now, isDynamic ? 1 : 0);
};

export const shouldSyncProvider = (providerId: string): boolean => {
  const db = getDb();
  const row = db
    .prepare('SELECT last_sync_at, is_dynamic FROM provider_models_sync WHERE provider_id = ?')
    .get(providerId) as any;

  if (!row) return true;
  if (!row.is_dynamic) return false;
  return Date.now() - row.last_sync_at > SYNC_INTERVAL_MS;
};

export const syncProviderModels = async (providerId: string): Promise<CachedModel[]> => {
  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (!dynamicProvider?.getModels) return [];

  const account = findFirstAccountByProvider(providerId);
  if (!account) return [];

  try {
    const models = await dynamicProvider.getModels(account.credential, account.id);
    const cachedModels: CachedModel[] = models.map((m: any) => ({
      id: m.id,
      name: m.name,
      is_thinking: m.is_thinking || false,
      context_length: m.context_length !== undefined ? m.context_length : null,
    }));
    saveCachedModels(providerId, cachedModels, true);
    return cachedModels;
  } catch (error) {
    logger.error(`Failed to sync models for ${providerId}:`, error);
    return getCachedModels(providerId);
  }
};

export const syncAllDynamicProviders = async (): Promise<void> => {
  const dynamicProviderIds = getDynamicProvidersList();
  for (const providerId of dynamicProviderIds) {
    if (shouldSyncProvider(providerId)) {
      try {
        await syncProviderModels(providerId);
      } catch (error) {
        logger.error(`Failed to sync ${providerId}:`, error);
      }
    } else {
      logger.debug(`Provider ${providerId} does not need sync yet`);
    }
  }
};

export const getModelsForProvider = async (providerId: string): Promise<CachedModel[]> => {
  const dynamicProviderIds = getDynamicProvidersList();
  if (dynamicProviderIds.includes(providerId.toLowerCase()) && shouldSyncProvider(providerId)) {
    return await syncProviderModels(providerId);
  }

  const cached = getCachedModels(providerId);
  if (cached.length > 0) return cached;

  if (dynamicProviderIds.includes(providerId.toLowerCase())) {
    return await syncProviderModels(providerId);
  }

  return [];
};

export const isDynamicProvider = (providerId: string): boolean => {
  return getDynamicProvidersList().includes(providerId.toLowerCase());
};

export { getDynamicProvidersList };
