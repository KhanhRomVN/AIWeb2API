/**
 * ------------------------------------------------------------------
 * Account Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng accounts. Cung cấp các hàm CRUD
 * và truy vấn cho tài khoản provider.
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
// ── Database ──
import { getDb } from '../database';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('AccountRepository');

// ─── Types ──────────────────────────────────────────────────────────────

export interface AccountRow {
  id: string;
  provider_id: string;
  email: string;
  credential: string | null;
  usage?: number;
  reset_usage_at?: string;
  is_memory_enabled?: number;
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

export const findAccountById = (id: string): AccountRow | null => {
  const db = getDb();
  return (db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow) ?? null;
};

export const findAccountByEmailAndProvider = (
  email: string,
  providerId: string,
): AccountRow | null => {
  const db = getDb();
  return (
    (db
      .prepare('SELECT * FROM accounts WHERE email = ? AND provider_id = ?')
      .get(email, providerId) as AccountRow) ?? null
  );
};

export const findAccountByIdOrEmailProvider = (
  id: string,
  email: string,
  providerId: string,
): AccountRow | null => {
  const db = getDb();
  return (
    (db
      .prepare(
        'SELECT * FROM accounts WHERE (email = ? AND provider_id = ?) OR id = ?',
      )
      .get(email, providerId, id) as AccountRow) ?? null
  );
};

export const findFirstAccountByProvider = (providerId: string): AccountRow | null => {
  const db = getDb();
  return (
    (db
      .prepare('SELECT * FROM accounts WHERE LOWER(provider_id) = ? LIMIT 1')
      .get(providerId.toLowerCase()) as AccountRow) ?? null
  );
};

export const listAccounts = (
  options: ListAccountsOptions,
): { rows: AccountRow[]; total: number } => {
  const {
    page,
    limit,
    email,
    provider_id,
    sort_by = 'email',
    order = 'ASC',
  } = options;
  const offset = (page - 1) * limit;
  const db = getDb();

  const conditions: string[] = [];
  const params: any[] = [];

  if (email) {
    conditions.push('email LIKE ?');
    params.push(`%${email}%`);
  }
  if (provider_id) {
    conditions.push('provider_id = ?');
    params.push(provider_id);
  }

  const whereClause =
    conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countResult = db
    .prepare(`SELECT COUNT(*) as total FROM accounts ${whereClause}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `SELECT * FROM accounts ${whereClause} ORDER BY ${sort_by} ${order} LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as AccountRow[];

  return { rows, total: countResult.total };
};

// ─── Inserts ────────────────────────────────────────────────────────────

export const insertAccount = (account: {
  id: string;
  provider_id: string;
  email: string;
  credential: string | null;
  usage?: number;
  reset_usage_at?: string;
  is_memory_enabled?: number;
  user_data_dir?: string | null;
}): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO accounts (id, provider_id, email, credential, usage, reset_usage_at, is_memory_enabled, user_data_dir)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    account.id,
    account.provider_id,
    account.email,
    account.credential,
    account.usage ?? null,
    account.reset_usage_at || null,
    account.is_memory_enabled === 1 ? 1 : 0,
    account.user_data_dir || null,
  );
};

export const insertAccountsBatch = (
  accounts: Array<{
    id: string;
    provider_id: string;
    email: string;
    credential: string;
    is_memory_enabled?: boolean;
  }>,
): void => {
  const db = getDb();
  db.prepare('BEGIN IMMEDIATE').run();
  try {
    const stmt = db.prepare(
      'INSERT INTO accounts (id, provider_id, email, credential, is_memory_enabled) VALUES (?, ?, ?, ?, ?)',
    );
    for (const a of accounts) {
      stmt.run(
        a.id,
        a.provider_id,
        a.email,
        a.credential,
        a.is_memory_enabled ? 1 : 0,
      );
    }
    db.prepare('COMMIT').run();
  } catch (err) {
    logger.error('Error during batch insert, rolling back:', err);
    try {
      db.prepare('ROLLBACK').run();
    } catch (rollbackErr) {
      logger.error('Error during rollback', rollbackErr);
    }
    throw err;
  }
};

// ─── Updates ────────────────────────────────────────────────────────────

export const updateAccountCredential = (
  id: string,
  credential: string | null,
): void => {
  const db = getDb();
  db.prepare('UPDATE accounts SET credential = ? WHERE id = ?').run(
    credential,
    id,
  );
};

export const updateAccountUserDataDir = (
  id: string,
  userDataDir: string,
): void => {
  const db = getDb();
  db.prepare('UPDATE accounts SET user_data_dir = ? WHERE id = ?').run(
    userDataDir,
    id,
  );
};

export const updateAccountCredentialAndRefresh = (
  id: string,
  credential: string,
): void => {
  const db = getDb();
  db.prepare(
    'UPDATE accounts SET credential = ? WHERE id = ?',
  ).run(credential, id);
};

export const updateAccountMemory = (id: string, isMemoryEnabled: boolean): void => {
  const db = getDb();
  db.prepare('UPDATE accounts SET is_memory_enabled = ? WHERE id = ?').run(
    isMemoryEnabled ? 1 : 0,
    id,
  );
};

/**
 * Cập nhật thời điểm account được dùng gần nhất (ms timestamp).
 * Được gọi mỗi khi sendMessage() thực sự dispatch request tới provider.
 */
export const updateAccountLastUsed = (id: string, ts: number = Date.now()): void => {
  const db = getDb();
  db.prepare('UPDATE accounts SET last_used_at = ? WHERE id = ?').run(ts, id);
};

export const updateAccountUsage = (
  id: string,
  usage: number,
  resetUsageAt: string | null,
): void => {
  const db = getDb();
  db.prepare('UPDATE accounts SET usage = ?, reset_usage_at = ? WHERE id = ?').run(
    usage,
    resetUsageAt,
    id,
  );
};

export const findAccountsNeedingRefresh = (threshold: number): AccountRow[] => {
  const db = getDb();
  // Include accounts that have never had usage fetched or need usage refresh
  return db
    .prepare(
      `SELECT * FROM accounts
       WHERE usage IS NULL`,
    )
    .all() as AccountRow[];
};

// ─── Delete ────────────────────────────────────────────────────────────

export const deleteAccount = (id: string): void => {
  const db = getDb();
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
};

// ─── Browser Accounts ──────────────────────────────────────────────────

export const findBrowserAccountsByProvider = (providerId: string): AccountRow[] => {
  const db = getDb();
  return db
    .prepare('SELECT * FROM accounts WHERE provider_id = ? AND user_data_dir IS NOT NULL ORDER BY email ASC')
    .all(providerId.toLowerCase()) as AccountRow[];
};