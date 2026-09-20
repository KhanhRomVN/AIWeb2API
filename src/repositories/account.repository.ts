/**
 * ------------------------------------------------------------------
 * Account Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng accounts. Cung cấp các hàm CRUD
 * và truy vấn cho tài khoản provider.
 *
 * ĐÃ MIGRATE sang Kysely (async) — chạy được trên cả SQLite lẫn
 * Postgres thông qua `getDataStore()`. Mọi hàm trả Promise, caller
 * phải `await`.
 *
 * Main functions:
 * - findAccountById()                : Tìm account theo id
 * - findAccountByEmailAndProvider()  : Tìm account theo email và provider
 * - listAccounts()                   : Lấy danh sách account với pagination
 * - insertAccount()                  : Thêm mới account
 * - insertAccountsBatch()            : Thêm batch accounts
 * - updateAccountCredential()        : Cập nhật credential
 * - updateAccountMemory()            : Cập nhật trạng thái memory
 * - deleteAccount()                  : Xóa account
 * - findBrowserAccountsByProvider()  : Tìm browser accounts
 * - updateAccountLastUsed()          : Cập nhật last_used_at
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { sql } from 'kysely';

// ── Database ──
import { getDataStore } from '../database';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('AccountRepository');

/** Cột được phép dùng trong ORDER BY — whitelist chống SQL injection. */
const ALLOWED_SORT_COLUMNS = new Set([
  'id',
  'provider_id',
  'email',
  'usage',
  'reset_usage_at',
  'is_memory_enabled',
  'last_used_at',
]);

// ─── Types ──────────────────────────────────────────────────────────────

export interface AccountRow {
  id: string;
  provider_id: string;
  email: string;
  credential: string | null;
  usage?: number | null;
  reset_usage_at?: string | null;
  is_memory_enabled?: number | null;
  user_data_dir?: string | null;
  last_used_at?: number | null;
}

export interface ListAccountsOptions {
  page: number;
  limit: number;
  email?: string;
  provider_id?: string;
  sort_by?: string;
  order?: 'ASC' | 'DESC';
}

// ─── Queries ────────────────────────────────────────────────────────────

export const findAccountById = async (
  id: string,
): Promise<AccountRow | null> => {
  const db = getDataStore().kysely;
  const row = await db
    .selectFrom('accounts')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return (row as AccountRow | undefined) ?? null;
};

export const findAccountByEmailAndProvider = async (
  email: string,
  providerId: string,
): Promise<AccountRow | null> => {
  const db = getDataStore().kysely;
  const row = await db
    .selectFrom('accounts')
    .selectAll()
    .where('email', '=', email)
    .where('provider_id', '=', providerId)
    .executeTakeFirst();
  return (row as AccountRow | undefined) ?? null;
};

export const findAccountByIdOrEmailProvider = async (
  id: string,
  email: string,
  providerId: string,
): Promise<AccountRow | null> => {
  const db = getDataStore().kysely;
  const row = await db
    .selectFrom('accounts')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb.and([eb('email', '=', email), eb('provider_id', '=', providerId)]),
        eb('id', '=', id),
      ]),
    )
    .executeTakeFirst();
  return (row as AccountRow | undefined) ?? null;
};

export const findFirstAccountByProvider = async (
  providerId: string,
): Promise<AccountRow | null> => {
  const db = getDataStore().kysely;
  const row = await db
    .selectFrom('accounts')
    .selectAll()
    .where(sql<boolean>`LOWER(provider_id) = ${providerId.toLowerCase()}`)
    .limit(1)
    .executeTakeFirst();
  return (row as AccountRow | undefined) ?? null;
};

export const listAccounts = async (
  options: ListAccountsOptions,
): Promise<{ rows: AccountRow[]; total: number }> => {
  const {
    page,
    limit,
    email,
    provider_id,
    sort_by = 'email',
    order = 'ASC',
  } = options;
  const offset = (page - 1) * limit;
  const db = getDataStore().kysely;

  // Base query dùng chung cho count + select
  const buildBase = () => {
    let q = db.selectFrom('accounts');
    if (email) q = q.where('email', 'like', `%${email}%`);
    if (provider_id) q = q.where('provider_id', '=', provider_id);
    return q;
  };

  const countRow = await buildBase()
    .select((eb) => eb.fn.countAll<number>().as('total'))
    .executeTakeFirst();
  const total = Number(countRow?.total ?? 0);

  const sortColumn = ALLOWED_SORT_COLUMNS.has(sort_by) ? sort_by : 'email';
  // order chỉ nhận 'ASC' | 'DESC' từ type → an toàn để nội suy raw.
  // sortColumn đã qua whitelist.
  const direction = order.toLowerCase() === 'desc' ? 'desc' : 'asc';
  const rows = (await buildBase()
    .selectAll()
    .orderBy(sql.ref(sortColumn), direction)
    .limit(limit)
    .offset(offset)
    .execute()) as AccountRow[];

  return { rows, total };
};

// ─── Inserts ────────────────────────────────────────────────────────────

export const insertAccount = async (account: {
  id: string;
  provider_id: string;
  email: string;
  credential: string | null;
  usage?: number;
  reset_usage_at?: string;
  is_memory_enabled?: number;
  user_data_dir?: string | null;
}): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .insertInto('accounts')
    .values({
      id: account.id,
      provider_id: account.provider_id,
      email: account.email,
      credential: account.credential,
      usage: account.usage ?? null,
      reset_usage_at: account.reset_usage_at || null,
      is_memory_enabled: account.is_memory_enabled === 1 ? 1 : 0,
      user_data_dir: account.user_data_dir || null,
    })
    .execute();
};

export const insertAccountsBatch = async (
  accounts: Array<{
    id: string;
    provider_id: string;
    email: string;
    credential: string;
    is_memory_enabled?: boolean;
  }>,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('accounts')
      .values(
        accounts.map((a) => ({
          id: a.id,
          provider_id: a.provider_id,
          email: a.email,
          credential: a.credential,
          is_memory_enabled: a.is_memory_enabled ? 1 : 0,
        })),
      )
      .execute();
  });
};

// ─── Updates ────────────────────────────────────────────────────────────

export const updateAccountCredential = async (
  id: string,
  credential: string | null,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .updateTable('accounts')
    .set({ credential })
    .where('id', '=', id)
    .execute();
};

/**
 * Cập nhật các field có thể chỉnh sửa của account (email, credential).
 * Chỉ update những field được truyền vào (khác undefined).
 */
export const updateAccountFields = async (
  id: string,
  fields: { email?: string; credential?: string | null },
): Promise<void> => {
  const patch: { email?: string; credential?: string | null } = {};
  if (fields.email !== undefined) patch.email = fields.email;
  if (fields.credential !== undefined) patch.credential = fields.credential;
  if (Object.keys(patch).length === 0) return;

  const db = getDataStore().kysely;
  await db.updateTable('accounts').set(patch).where('id', '=', id).execute();
};

export const updateAccountUserDataDir = async (
  id: string,
  userDataDir: string,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .updateTable('accounts')
    .set({ user_data_dir: userDataDir })
    .where('id', '=', id)
    .execute();
};

export const updateAccountCredentialAndRefresh = async (
  id: string,
  credential: string,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .updateTable('accounts')
    .set({ credential })
    .where('id', '=', id)
    .execute();
};

export const updateAccountMemory = async (
  id: string,
  isMemoryEnabled: boolean,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .updateTable('accounts')
    .set({ is_memory_enabled: isMemoryEnabled ? 1 : 0 })
    .where('id', '=', id)
    .execute();
};

/**
 * Cập nhật thời điểm account được dùng gần nhất (ms timestamp).
 */
export const updateAccountLastUsed = async (
  id: string,
  ts: number = Date.now(),
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .updateTable('accounts')
    .set({ last_used_at: ts })
    .where('id', '=', id)
    .execute();
};

export const updateAccountUsage = async (
  id: string,
  usage: number,
  resetUsageAt: string | null,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .updateTable('accounts')
    .set({ usage, reset_usage_at: resetUsageAt })
    .where('id', '=', id)
    .execute();
};

export const findAccountsNeedingRefresh = async (
  _threshold: number,
): Promise<AccountRow[]> => {
  const db = getDataStore().kysely;
  return (await db
    .selectFrom('accounts')
    .selectAll()
    .where('usage', 'is', null)
    .execute()) as AccountRow[];
};

// ─── Delete ────────────────────────────────────────────────────────────

export const deleteAccount = async (id: string): Promise<void> => {
  const db = getDataStore().kysely;
  await db.deleteFrom('accounts').where('id', '=', id).execute();
};

// ─── Browser Accounts ──────────────────────────────────────────────────

export const findBrowserAccountsByProvider = async (
  providerId: string,
): Promise<AccountRow[]> => {
  const db = getDataStore().kysely;
  return (await db
    .selectFrom('accounts')
    .selectAll()
    .where(sql<boolean>`LOWER(provider_id) = ${providerId.toLowerCase()}`)
    .where('user_data_dir', 'is not', null)
    .orderBy('email', 'asc')
    .execute()) as AccountRow[];
};