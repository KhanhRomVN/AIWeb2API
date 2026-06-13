import { getDb } from '../database';

export interface ModelSequenceRow {
  provider_id: string;
  model_id: string;
  sequence: number;
  updated_at: number;
}

export const findAllModelSequences = (): ModelSequenceRow[] => {
  const db = getDb();
  return db
    .prepare('SELECT * FROM model_sequences ORDER BY provider_id, sequence ASC')
    .all() as ModelSequenceRow[];
};

export const findFirstSequenceByProvider = (
  providerId: string,
): { provider_id: string; model_id: string } | null => {
  const db = getDb();
  return (
    (db
      .prepare(
        'SELECT provider_id, model_id FROM model_sequences WHERE provider_id = ? ORDER BY sequence ASC LIMIT 1',
      )
      .get(providerId) as { provider_id: string; model_id: string }) ?? null
  );
};

export const findFirstSequenceGlobal = (): { provider_id: string } | null => {
  const db = getDb();
  return (
    (db
      .prepare(
        'SELECT provider_id FROM model_sequences ORDER BY sequence ASC LIMIT 1',
      )
      .get() as { provider_id: string }) ?? null
  );
};

export const findModelSequence = (
  providerId: string,
  modelId: string,
): ModelSequenceRow | null => {
  const db = getDb();
  return (
    (db
      .prepare(
        'SELECT * FROM model_sequences WHERE provider_id = ? AND model_id = ?',
      )
      .get(providerId, modelId) as ModelSequenceRow) ?? null
  );
};

export const upsertModelSequence = (
  providerId: string,
  modelId: string,
  sequence: number,
  updatedAt: number,
): void => {
  const db = getDb();
  const existing = findModelSequence(providerId, modelId);

  if (existing) {
    db.prepare(
      'UPDATE model_sequences SET sequence = ?, updated_at = ? WHERE provider_id = ? AND model_id = ?',
    ).run(sequence, updatedAt, providerId, modelId);
  } else {
    db.prepare(
      'INSERT INTO model_sequences (provider_id, model_id, sequence, updated_at) VALUES (?, ?, ?, ?)',
    ).run(providerId, modelId, sequence, updatedAt);
  }
};

export const shiftSequencesUp = (fromSequence: number): void => {
  const db = getDb();
  db.prepare(
    'UPDATE model_sequences SET sequence = sequence + 1 WHERE sequence >= ?',
  ).run(fromSequence);
};

export const normalizeSequences = (): void => {
  const db = getDb();
  const all = db
    .prepare('SELECT * FROM model_sequences ORDER BY sequence ASC')
    .all() as ModelSequenceRow[];

  const updateStmt = db.prepare(
    'UPDATE model_sequences SET sequence = ? WHERE provider_id = ? AND model_id = ?',
  );
  const updateAll = db.transaction((models: ModelSequenceRow[]) => {
    models.forEach((model, index) => {
      updateStmt.run(index + 1, model.provider_id, model.model_id);
    });
  });
  updateAll(all);
};

export const deleteModelSequence = (
  providerId: string,
  modelId: string,
): void => {
  const db = getDb();
  db.prepare(
    'DELETE FROM model_sequences WHERE provider_id = ? AND model_id = ?',
  ).run(providerId, modelId);
};
