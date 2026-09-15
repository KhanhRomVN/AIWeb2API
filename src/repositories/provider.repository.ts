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
 * - upsertProvider()        : Thêm mới hoặc cập nhật provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getDb } from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProviderRow {
  id: string;
  title: string;
  description?: string;
  color?: string;
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

export const upsertProvider = (provider: Partial<ProviderRow> & { id: string; title: string }): void => {
  const db = getDb();
  const existing = findProviderById(provider.id);
  
  if (existing) {
    // Update existing provider
    const updateFields = [];
    const values = [];
    
    if (provider.title !== undefined) { updateFields.push('title = ?'); values.push(provider.title); }
    if (provider.description !== undefined) { updateFields.push('description = ?'); values.push(provider.description); }
    if (provider.color !== undefined) { updateFields.push('color = ?'); values.push(provider.color); }
    if (provider.platform !== undefined) { updateFields.push('platform = ?'); values.push(provider.platform); }
    if (provider.connection_type !== undefined) { updateFields.push('connection_type = ?'); values.push(provider.connection_type); }
    if (provider.is_enabled !== undefined) { updateFields.push('is_enabled = ?'); values.push(provider.is_enabled); }
    if (provider.website_url !== undefined) { updateFields.push('website_url = ?'); values.push(provider.website_url); }
    if (provider.auth_method !== undefined) { updateFields.push('auth_method = ?'); values.push(provider.auth_method); }
    if (provider.is_pausable !== undefined) { updateFields.push('is_pausable = ?'); values.push(provider.is_pausable); }
    if (provider.is_memory !== undefined) { updateFields.push('is_memory = ?'); values.push(provider.is_memory); }
    if (provider.browser_extension_folder !== undefined) { updateFields.push('browser_extension_folder = ?'); values.push(provider.browser_extension_folder); }
    
    if (updateFields.length > 0) {
      values.push(provider.id);
      db.prepare(`UPDATE providers SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
    }
  } else {
    // Insert new provider
    db.prepare(`
      INSERT INTO providers (
        id, title, description, color, platform, connection_type, 
        is_enabled, website_url, auth_method, is_pausable, is_memory, browser_extension_folder
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      provider.id.toLowerCase(),
      provider.title,
      provider.description || null,
      provider.color || null,
      provider.platform || null,
      provider.connection_type || null,
      provider.is_enabled !== undefined ? provider.is_enabled : 1,
      provider.website_url || null,
      provider.auth_method || null,
      provider.is_pausable !== undefined ? provider.is_pausable : 0,
      provider.is_memory !== undefined ? provider.is_memory : 0,
      provider.browser_extension_folder || null
    );
  }
};