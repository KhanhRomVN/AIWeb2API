import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { createLogger } from '../utils/logger';

const logger = createLogger('KiroAccountService');

export class KiroAccountService {
  private getKiroDbPath(): string {
    return path.join(
      os.homedir(),
      '.local',
      'share',
      'kiro-cli',
      'data.sqlite3',
    );
  }

  /**
   * Sync a session JSON from Elara to the local kiro-cli SQLite database
   * @param sessionJson The full JSON string from kirocli:social:token
   */
  async syncToLocal(sessionJson: string): Promise<void> {
    const dbPath = this.getKiroDbPath();

    if (!fs.existsSync(dbPath)) {
      // If the directory doesn't exist, create it if possible, but usually kiro-cli creates it.
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      logger.warn(
        `Kiro CLI database not found at ${dbPath}. Creating a new one.`,
      );
    }

    let db: Database.Database | null = null;
    try {
      db = new Database(dbPath, { timeout: 5000 });

      // Ensure the table exists (it should, but safety first)
      db.exec(`
        CREATE TABLE IF NOT EXISTS auth_kv (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      // Update or Insert the token
      const stmt = db.prepare(
        'INSERT OR REPLACE INTO auth_kv (key, value) VALUES (?, ?)',
      );
      stmt.run('kirocli:social:token', sessionJson);

      logger.info('Successfully synced Kiro session to local SQLite.');
    } catch (error: any) {
      logger.error(
        'Failed to sync Kiro session to local SQLite:',
        error.message,
      );
      throw new Error(`Kiro Sync Error: ${error.message}`);
    } finally {
      if (db) db.close();
    }
  }

  /**
   * Read the current session from local SQLite
   */
  async getFromLocal(): Promise<string | null> {
    const dbPath = this.getKiroDbPath();
    if (!fs.existsSync(dbPath)) return null;

    let db: Database.Database | null = null;
    try {
      db = new Database(dbPath, { readonly: true, timeout: 5000 });
      const row = db
        .prepare('SELECT value FROM auth_kv WHERE key = ?')
        .get('kirocli:social:token') as { value: string } | undefined;
      return row ? row.value : null;
    } catch (error: any) {
      logger.error(
        'Failed to read Kiro session from local SQLite:',
        error.message,
      );
      return null;
    } finally {
      if (db) db.close();
    }
  }
}

export const kiroAccountService = new KiroAccountService();
