import { getDb } from '../database';
import { createLogger } from '../utils/logger';

const logger = createLogger('AccountRepository');

export interface AccountRow {
  id: string;
  provider_id: string;
  email: string;
  credential: string;
  last_refreshed_at?: number;
  usage?: string;
  reset_period?: string;
}

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

export interface ListAccountsOptions {
  page: number;
  limit: number;
  email?: string;
  provider_id?: string;
  sort_by?: string;
  order?: 'ASC' | 'DESC';
}

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

export const insertAccount = (account: {
  id: string;
  provider_id: string;
  email: string;
  credential: string;
}): void => {
  const db = getDb();
  db.prepare(
    'INSERT INTO accounts (id, provider_id, email, credential) VALUES (?, ?, ?, ?)',
  ).run(account.id, account.provider_id, account.email, account.credential);
};

export const insertAccountsBatch = (
  accounts: Array<{
    id: string;
    provider_id: string;
    email: string;
    credential: string;
  }>,
): void => {
  const db = getDb();
  db.prepare('BEGIN IMMEDIATE').run();
  try {
    const stmt = db.prepare(
      'INSERT INTO accounts (id, provider_id, email, credential) VALUES (?, ?, ?, ?)',
    );
    for (const a of accounts) {
      stmt.run(a.id, a.provider_id, a.email, a.credential);
    }
    db.prepare('COMMIT').run();
  } catch (err) {
    try {
      db.prepare('ROLLBACK').run();
    } catch (rollbackErr) {
      logger.error('Error during rollback', rollbackErr);
    }
    throw err;
  }
};

export const updateAccountCredential = (
  id: string,
  credential: string,
): void => {
  const db = getDb();
  db.prepare('UPDATE accounts SET credential = ? WHERE id = ?').run(
    credential,
    id,
  );
};

export const updateAccountCredentialAndRefresh = (
  id: string,
  credential: string,
  lastRefreshedAt: number,
): void => {
  const db = getDb();
  db.prepare(
    'UPDATE accounts SET credential = ?, last_refreshed_at = ? WHERE id = ?',
  ).run(credential, lastRefreshedAt, id);
};

export const deleteAccount = (id: string): void => {
  const db = getDb();
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
};
