import { getDb } from '../database';

export interface ModelRow {
  id?: number;
  provider_id: string;
  model_id: string;
  model_name: string;
  is_thinking: number;
  context_length?: number | null;
  updated_at: number;
}

export const findAllModels = (): ModelRow[] => {
  const db = getDb();
  return db.prepare('SELECT * FROM models').all() as ModelRow[];
};

export const findModelsByProvider = (providerId: string): ModelRow[] => {
  const db = getDb();
  return db
    .prepare('SELECT * FROM models WHERE provider_id = ?')
    .all(providerId) as ModelRow[];
};

export const upsertModel = (
  providerId: string,
  modelId: string,
  modelName: string,
  isThinking: boolean,
  contextLength: number | null,
  updatedAt: number,
): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO models (provider_id, model_id, model_name, is_thinking, context_length, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider_id, model_id) DO UPDATE SET
       model_name = excluded.model_name,
       is_thinking = excluded.is_thinking,
       context_length = excluded.context_length,
       updated_at = excluded.updated_at`,
  ).run(providerId, modelId, modelName, isThinking ? 1 : 0, contextLength, updatedAt);
};

export const deleteModelsByProvider = (providerId: string): void => {
  const db = getDb();
  db.prepare('DELETE FROM models WHERE provider_id = ?').run(providerId);
};