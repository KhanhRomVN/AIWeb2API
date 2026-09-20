/**
 * PostgreSQL Adapter
 * Dùng `pg` để test kết nối.
 */

import { formatAdapterError } from './index';
import type { DatabaseAdapter, AdapterConfig, TestResult } from './index';

export class PostgresAdapter implements DatabaseAdapter {
  private readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  async testConnection(): Promise<TestResult> {
    const { Client } = require('pg');

    const ssl = this.resolveSsl();
    const client = new Client({
      host: this.config.host ?? 'localhost',
      port: this.config.port ?? 5432,
      database: this.config.database_name ?? undefined,
      user: this.config.username ?? undefined,
      password: this.config.password ?? undefined,
      ssl,
      connectionTimeoutMillis: 8000,
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return {
        success: true,
        message: `Connected to PostgreSQL ${this.config.host}:${this.config.port ?? 5432}/${this.config.database_name}`,
      };
    } catch (err: any) {
      try { await client.end(); } catch (_) {}
      return { success: false, message: formatAdapterError(err) };
    }
  }

  private resolveSsl(): boolean | object | undefined {
    switch (this.config.ssl_mode) {
      case 'disable':  return false;
      case 'require':  return { rejectUnauthorized: false };
      case 'verify-ca':
      case 'verify-full': return { rejectUnauthorized: true };
      default:         return undefined; // pg tự quyết
    }
  }
}
