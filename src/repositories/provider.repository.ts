/**
 * ------------------------------------------------------------------
 * Provider Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng providers. Quản lý thông tin provider
 * và cấu hình của chúng.
 *
 * Main functions:
 * - findAllProviders()      : Lấy tất cả providers
 * - findProviderById()      : Tìm provider theo id
 * - ensureProviderExists()  : Đảm bảo provider tồn tại trong DB
 * - upsertProvidr()        : Thêm mới hoặc cập nhật provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getDb } from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProviderRow {
  id: string;
  title: string;
  platform?: string;
  connection_type?: string;
  is_enabled?: number;
  website_url?: string;
  auth_method?: string;
  is_pausable?: number;
  is_memory?: number;
  browser_extension_folder?: string;
}

// ─── Queries ────────────────────────────────────────────────────────────

export const findAllProviders = (): ProviderRow[] => {
  const db = getDb();
  return db.prepare('SELECT * FROM providers').all() as ProviderRow[];
};

export const findProviderById = (id: string): ProviderRow | null => {
  const db = getDb();
  return db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as ProviderRow | null;
};

// ─── Inserts / Upserts ─────────────────────────────────────────────────

export const ensureProviderExists = (id: string, title: string): void => {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO providers (id, title) VALUES (?, ?)',
  ).run(id.toLowerCase(), title);
};