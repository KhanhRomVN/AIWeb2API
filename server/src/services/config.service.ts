import { createLogger } from '../utils/logger';
import { getConfigValue, setConfigValue } from '../repositories/config.repository';
import { getDb } from '../database';

const logger = createLogger('ConfigService');

export class ConfigService {
  get(key: string, defaultValue: any = null): any {
    try {
      const value = getConfigValue(key);
      if (value !== null) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return defaultValue;
    } catch (err) {
      logger.error(`Failed to get config ${key}`, err);
      return defaultValue;
    }
  }

  set(key: string, value: any): void {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    try {
      setConfigValue(key, valueStr);
    } catch (err) {
      logger.error(`Failed to set config ${key}`, err);
    }
  }

  delete(key: string): void {
    try {
      const db = getDb();
      db.prepare('DELETE FROM config WHERE key = ?').run(key);
    } catch (err) {
      logger.error(`Failed to delete config ${key}`, err);
    }
  }
}

export const configService = new ConfigService();
