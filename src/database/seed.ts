import Database from 'better-sqlite3';

/**
 * Insert default / seed data after migrations have run.
 * All inserts use INSERT OR IGNORE so they are safe to re-run.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const seedDatabase = (_db: Database.Database): void => {
  // The `config` table has been dropped from the schema.
  // Add future seed statements here as needed.
};
