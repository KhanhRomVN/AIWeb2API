/**
 * ------------------------------------------------------------------
 * Provider Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng providers. Quản lý thông tin provider
 * và cấu hình của chúng.
 *
 * ĐÃ MIGRATE sang Kysely (async) — chạy được trên cả SQLite lẫn
 * Postgres thông qua `getDataStore()`. Mọi hàm trả Promise, caller
 * phải `await`.
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
import { getDataStore } from '../database';

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

export const findAllProviders = async (): Promise<ProviderRow[]> => {
  const db = getDataStore().kysely;
  return (await db
    .selectFrom('providers')
    .selectAll()
    .execute()) as ProviderRow[];
};

export const findProviderById = async (
  id: string,
): Promise<ProviderRow | null> => {
  const db = getDataStore().kysely;
  const row = await db
    .selectFrom('providers')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return (row as ProviderRow | undefined) ?? null;
};

// ─── Inserts / Upserts ─────────────────────────────────────────────────

export const ensureProviderExists = async (
  id: string,
  title: string,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .insertInto('providers')
    .values({ id: id.toLowerCase(), title })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
};

export const upsertProvider = async (
  provider: Partial<ProviderRow> & { id: string; title: string },
): Promise<void> => {
  const db = getDataStore().kysely;
  const existing = await findProviderById(provider.id);

  if (existing) {
    // Update existing provider — chỉ set field nào được truyền vào.
    const patch: Record<string, unknown> = {};
    if (provider.title !== undefined) patch.title = provider.title;
    if (provider.description !== undefined) patch.description = provider.description;
    if (provider.color !== undefined) patch.color = provider.color;
    if (provider.platform !== undefined) patch.platform = provider.platform;
    if (provider.connection_type !== undefined)
      patch.connection_type = provider.connection_type;
    if (provider.is_enabled !== undefined) patch.is_enabled = provider.is_enabled;
    if (provider.website_url !== undefined) patch.website_url = provider.website_url;
    if (provider.auth_method !== undefined) patch.auth_method = provider.auth_method;
    if (provider.is_pausable !== undefined) patch.is_pausable = provider.is_pausable;
    if (provider.is_memory !== undefined) patch.is_memory = provider.is_memory;
    if (provider.browser_extension_folder !== undefined)
      patch.browser_extension_folder = provider.browser_extension_folder;

    if (Object.keys(patch).length > 0) {
      await db
        .updateTable('providers')
        .set(patch as any)
        .where('id', '=', provider.id)
        .execute();
    }
  } else {
    // Insert new provider
    await db
      .insertInto('providers')
      .values({
        id: provider.id.toLowerCase(),
        title: provider.title,
        description: provider.description || null,
        color: provider.color || null,
        platform: provider.platform || null,
        connection_type: provider.connection_type || null,
        is_enabled: provider.is_enabled !== undefined ? provider.is_enabled : 1,
        website_url: provider.website_url || null,
        auth_method: provider.auth_method || null,
        is_pausable: provider.is_pausable !== undefined ? provider.is_pausable : 0,
        is_memory: provider.is_memory !== undefined ? provider.is_memory : 0,
        browser_extension_folder: provider.browser_extension_folder || null,
      })
      .execute();
  }
};