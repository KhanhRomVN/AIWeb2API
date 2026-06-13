import { getDb } from '../database';

export interface ProviderRow {
  id: string;
  title: string;
}

export const findAllProviders = (): ProviderRow[] => {
  const db = getDb();
  return db.prepare('SELECT id, title FROM providers').all() as ProviderRow[];
};

export const findProviderById = (id: string): ProviderRow | null => {
  const db = getDb();
  return db.prepare('SELECT id, title FROM providers WHERE id = ?').get(id) as ProviderRow | null;
};

export const ensureProviderExists = (id: string, title: string): void => {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO providers (id, title) VALUES (?, ?)',
  ).run(id.toLowerCase(), title);
};

export const updateProviderTitle = (id: string, title: string): void => {
  const db = getDb();
  db.prepare('UPDATE providers SET title = ? WHERE id = ?').run(title, id.toLowerCase());
};

export const deleteProvider = (id: string): void => {
  const db = getDb();
  db.prepare('DELETE FROM providers WHERE id = ?').run(id.toLowerCase());
};