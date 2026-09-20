/**
 * Microsoft SQL Server Adapter
 * Dùng `mssql` để test kết nối.
 */

import { formatAdapterError } from './index';
import type { DatabaseAdapter, AdapterConfig, TestResult } from './index';

export class MSSQLAdapter implements DatabaseAdapter {
  private readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  async testConnection(): Promise<TestResult> {
    const sql = require('mssql');

    // mssql dùng pool — phải close sau khi test
    let pool: any;
    try {
      pool = await sql.connect({
        server: this.config.host ?? 'localhost',
        port: this.config.port ?? 1433,
        database: this.config.database_name ?? undefined,
        user: this.config.username ?? undefined,
        password: this.config.password ?? undefined,
        options: {
          encrypt: this.config.ssl_mode !== 'disable',
          trustServerCertificate: this.config.ssl_mode !== 'verify-full',
          connectTimeout: 8000,
        },
      });
      await pool.request().query('SELECT 1 AS result');
      await pool.close();
      return {
        success: true,
        message: `Connected to SQL Server ${this.config.host}:${this.config.port ?? 1433}/${this.config.database_name}`,
      };
    } catch (err: any) {
      try { if (pool) await pool.close(); } catch (_) {}
      // mssql thường đóng global pool — reset để tránh state leak
      try { sql.close(); } catch (_) {}
      return { success: false, message: formatAdapterError(err) };
    }
  }
}
