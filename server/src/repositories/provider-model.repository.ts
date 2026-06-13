import { getDb } from '../database';

export interface ProviderModelRow {
  id?: number;
  provider_id: string;
  model_id: string;
  model_name: string;
  is_thinking: number;
  context_length?: number | null;
  updated_at: number;
}

export const findAllProviderModels = (): ProviderModelRow[] => {
  const db = getDb();
  return db.prepare('SELECT * FROM provider_models').all() as ProviderModelRow[];
};

export const upsertProviderModel = (
  providerId: string,
  modelId: string,
  modelName: string,
  updatedAt: number,
): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO provider_models (provider_id, model_id, model_name, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(provider_id, model_id) DO UPDATE SET updated_at = excluded.updated_at`,
  ).run(providerId, modelId, modelName, updatedAt);
};
