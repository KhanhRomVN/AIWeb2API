import Database from 'better-sqlite3';

/**
 * Insert default / seed data after migrations have run.
 * All inserts use INSERT OR IGNORE so they are safe to re-run.
 */
export const seedDatabase = (db: Database.Database): void => {
  db.prepare(
    "INSERT OR IGNORE INTO config (key, value) VALUES ('enable_stats_collection', 'true')",
  ).run();
};
