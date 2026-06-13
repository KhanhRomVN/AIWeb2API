import { getDb } from '../database';

export interface ProviderRow {
  id: string;
  name: string;
  total_accounts: number;
}

export const findAllProviders = (): ProviderRow[] => {
  const db = getDb();
  return db.prepare('SELECT id, total_accounts FROM providers').all() as ProviderRow[];
};

export const ensureProviderExists = (id: string, name: string): void => {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO providers (id, name, total_accounts) VALUES (?, ?, 0)',
  ).run(id.toLowerCase(), name);
};

export const incrementProviderCount = (providerId: string): void => {
  const db = getDb();
  db.prepare(
    'UPDATE providers SET total_accounts = total_accounts + 1 WHERE LOWER(id) = LOWER(?)',
  ).run(providerId);
};

export const decrementProviderCount = (providerId: string): void => {
  const db = getDb();
  db.prepare(
    'UPDATE providers SET total_accounts = MAX(0, total_accounts - 1) WHERE LOWER(id) = LOWER(?)',
  ).run(providerId);
};

export const recalcProviderCount = (providerId: string): void => {
  const db = getDb();
  db.prepare(
    'UPDATE providers SET total_accounts = (SELECT COUNT(*) FROM accounts WHERE LOWER(provider_id) = LOWER(?)) WHERE LOWER(id) = LOWER(?)',
  ).run(providerId, providerId);
};
