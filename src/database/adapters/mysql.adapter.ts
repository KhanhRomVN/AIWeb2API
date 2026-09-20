/**
 * MySQL / MariaDB Adapter
 * Dùng `mysql2` để test kết nối. Tương thích cả MySQL và MariaDB.
 */

import { formatAdapterError } from './index';
import type { DatabaseAdapter, AdapterConfig, TestResult } from './index';

export class MySQLAdapter implements DatabaseAdapter {
  private readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  async testConnection(): Promise<TestResult> {
    const mysql = require('mysql2/promise');

    let connection: any;
    try {
      connection = await mysql.createConnection({
        host: this.config.host ?? 'localhost',
        port: this.config.port ?? 3306,
        database: this.config.database_name ?? undefined,
        user: this.config.username ?? undefined,
        password: this.config.password ?? undefined,
        ssl: this.resolveSsl(),
        connectTimeout: 8000,
      });
      await connection.query('SELECT 1');
      await connection.end();
      return {
        success: true,
        message: `Connected to MySQL/MariaDB ${this.config.host}:${this.config.port ?? 3306}/${this.config.database_name}`,
      };
    } catch (err: any) {
      try { if (connection) await connection.end(); } catch (_) {}
      return { success: false, message: formatAdapterError(err) };
    }
  }

  private resolveSsl(): object | undefined {
    if (!this.config.ssl_mode || this.config.ssl_mode === 'disable') {
      return undefined;
    }
    return { rejectUnauthorized: this.config.ssl_mode === 'verify-full' };
  }
}
