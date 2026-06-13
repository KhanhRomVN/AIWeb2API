import { getDb } from '../database';

export const getConfigValue = (key: string): string | null => {
  const db = getDb();
  const row = db
    .prepare('SELECT value FROM config WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
};

export const setConfigValue = (key: string, value: string): void => {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
  ).run(key, value);
};
