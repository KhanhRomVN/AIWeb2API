import { getDb } from './db';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConfigService');

export class ConfigService {
  get(key: string, defaultValue: any = null): any {
    const db = getDb();
    try {
      const row = db
        .prepare('SELECT value FROM config WHERE key = ?')
        .get(key) as { value: string };
      if (row) {
        try {
          return JSON.parse(row.value);
        } catch {
          return row.value;
        }
      }
      return defaultValue;
    } catch (err) {
      logger.error(`Failed to get config ${key}`, err);
      return defaultValue;
    }
  }

  set(key: string, value: any): void {
    const db = getDb();
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    try {
      db.prepare(
        'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      ).run(key, valueStr);
    } catch (err) {
      logger.error(`Failed to set config ${key}`, err);
    }
  }

  delete(key: string): void {
    const db = getDb();
    try {
      db.prepare('DELETE FROM config WHERE key = ?').run(key);
    } catch (err) {
      logger.error(`Failed to delete config ${key}`, err);
    }
  }
}

export const configService = new ConfigService();
