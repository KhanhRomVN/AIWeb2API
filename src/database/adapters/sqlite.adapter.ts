/**
 * SQLite Adapter
 * Dùng better-sqlite3 để test kết nối file local.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { DatabaseAdapter, AdapterConfig, TestResult } from './index';

export class SqliteAdapter implements DatabaseAdapter {
  private readonly filePath: string;

  constructor(config: AdapterConfig) {
    const raw = config.file_path ?? '';
    this.filePath = raw.startsWith('~')
      ? path.join(os.homedir(), raw.slice(1))
      : raw;
  }

  async testConnection(): Promise<TestResult> {
    if (!this.filePath) {
      return { success: false, message: 'file_path is required' };
    }
    try {
      const stat = fs.statSync(this.filePath);
      if (!stat.isFile()) {
        return { success: false, message: `Not a file: ${this.filePath}` };
      }
      // Thử mở thực sự bằng better-sqlite3 để verify file hợp lệ
      const Database = require('better-sqlite3');
      const db = new Database(this.filePath, { readonly: true, timeout: 5000 });
      db.close();
      return { success: true, message: `Connected: ${this.filePath}` };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || `Cannot open: ${this.filePath}`,
      };
    }
  }
}
