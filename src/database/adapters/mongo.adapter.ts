/**
 * MongoDB Adapter
 * Dùng `mongoose` (đã có trong deps) để test kết nối.
 * Hỗ trợ cả connection string (extra_json.uri) lẫn field riêng lẻ.
 */

import { formatAdapterError } from './index';
import type { DatabaseAdapter, AdapterConfig, TestResult } from './index';

export class MongoAdapter implements DatabaseAdapter {
  private readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  async testConnection(): Promise<TestResult> {
    const mongoose = require('mongoose');

    const uri = this.resolveUri();
    if (!uri) {
      return {
        success: false,
        message: 'host or uri (in extra_json) is required',
      };
    }

    // Tạo connection riêng để không ảnh hưởng global mongoose connection
    let conn: any;
    try {
      conn = await mongoose.createConnection(uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
      }).asPromise();
      await conn.close();
      return { success: true, message: `Connected to MongoDB: ${this.maskUri(uri)}` };
    } catch (err: any) {
      try { if (conn) await conn.close(); } catch (_) {}
      return { success: false, message: formatAdapterError(err) };
    }
  }

  /**
   * Ưu tiên `extra_json.uri` nếu có, fallback về build từ field riêng lẻ.
   */
  private resolveUri(): string | null {
    // extra_json có thể chứa: { uri: "mongodb://..." }
    if (this.config.extra_json) {
      try {
        const extra = JSON.parse(this.config.extra_json);
        if (extra?.uri) return extra.uri as string;
      } catch (_) {}
    }

    if (!this.config.host) return null;

    const host = this.config.host;
    const port = this.config.port ?? 27017;
    const db   = this.config.database_name ?? '';
    const user = this.config.username;
    const pass = this.config.password;

    const auth = user && pass
      ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`
      : '';

    const ssl = this.config.ssl_mode && this.config.ssl_mode !== 'disable'
      ? '?ssl=true'
      : '';

    return `mongodb://${auth}${host}:${port}/${db}${ssl}`;
  }

  /** Ẩn password trong URI trước khi log. */
  private maskUri(uri: string): string {
    return uri.replace(/:([^@]+)@/, ':****@');
  }
}
