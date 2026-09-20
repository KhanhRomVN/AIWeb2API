/**
 * ------------------------------------------------------------------
 * Metrics Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng metrics. Lưu trữ thống kê usage
 * của các request gửi đến provider.
 *
 * ĐÃ MIGRATE sang Kysely (async) — chạy được trên cả SQLite lẫn
 * Postgres thông qua `getDataStore()`. Riêng `queryUsageHistory` có
 * branch theo dialect vì cú pháp format ngày khác nhau:
 *   - SQLite   : strftime('%Y-%m-%d', datetime(ts/1000, 'unixepoch', 'localtime'))
 *   - Postgres : to_char(to_timestamp(ts/1000), 'YYYY-MM-DD')
 *
 * Main functions:
 * - insertMetric()              : Ghi nhận metric của một request
 * - queryUsageHistory()         : Lấy lịch sử usage theo khoảng thời gian
 * - queryAccountStatsByPeriod() : Thống kê usage theo account
 * - queryModelStatsByPeriod()   : Thống kê usage theo model
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { sql } from 'kysely';

// ── Database ──
import { getDataStore } from '../database';

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Chuyển format date của SQLite strftime sang format của Postgres to_char.
 * Chỉ hỗ trợ các token đang dùng trong `queryUsageHistory`.
 */
const toPgDateFormat = (sqliteFormat: string): string =>
  sqliteFormat
    .replace(/%Y/g, 'YYYY')
    .replace(/%m/g, 'MM')
    .replace(/%d/g, 'DD')
    .replace(/%H/g, 'HH24')
    .replace(/%M/g, 'MI');

// ─── Inserts ────────────────────────────────────────────────────────────

export const insertMetric = async (
  providerId: string,
  modelId: string,
  accountId: string,
  totalTokens: number,
  status: 'success' | 'error' = 'success',
  timestamp?: number,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .insertInto('metrics')
    .values({
      provider_id: providerId,
      model_id: modelId,
      account_id: accountId,
      status,
      total_tokens: totalTokens,
      timestamp: timestamp ?? Date.now(),
    })
    .execute();
};

// ─── Queries ────────────────────────────────────────────────────────────

export const queryUsageHistory = async (
  groupBy: string,
  startTime: number,
  endTime: number,
  accountId?: string,
): Promise<Array<{ date: string; requests: number; tokens: number }>> => {
  const store = getDataStore();
  const db = store.kysely;

  // Expression tính cột `date` khác nhau theo dialect.
  const dateExpr =
    store.dialect === 'sqlite'
      ? sql<string>`strftime(${groupBy}, datetime(timestamp / 1000, 'unixepoch', 'localtime'))`
      : sql<string>`to_char(to_timestamp(timestamp / 1000), ${toPgDateFormat(groupBy)})`;

  let query = db
    .selectFrom('metrics')
    .select([
      dateExpr.as('date'),
      sql<number>`count(*)`.as('requests'),
      sql<number>`coalesce(sum(total_tokens), 0)`.as('tokens'),
    ])
    .where('timestamp', '>=', startTime)
    .where('timestamp', '<=', endTime);

  if (accountId) {
    query = query.where('account_id', '=', accountId);
  }

  const rows = await query
    .groupBy(dateExpr)
    .orderBy(dateExpr, 'asc')
    .execute();

  return rows as Array<{ date: string; requests: number; tokens: number }>;
};

export const queryAccountStatsByPeriod = async (
  startTime: number,
  endTime: number,
  accountId?: string,
): Promise<any[]> => {
  const db = getDataStore().kysely;

  const statsSubquery = db
    .selectFrom('metrics')
    .select([
      'account_id',
      sql<number>`count(id)`.as('total_requests'),
      sql<number>`sum(case when total_tokens > 0 then 1 else 0 end)`.as(
        'successful_requests',
      ),
      sql<number>`sum(total_tokens)`.as('total_tokens'),
    ])
    .where('timestamp', '>=', startTime)
    .where('timestamp', '<=', endTime)
    .groupBy('account_id')
    .as('stats');

  let query = db
    .selectFrom('accounts as a')
    .leftJoin(statsSubquery, 'a.id', 'stats.account_id')
    .select([
      'a.id',
      'a.email',
      'a.provider_id',
      'stats.total_requests',
      'stats.successful_requests',
      'stats.total_tokens',
    ]);

  if (accountId) {
    query = query.where('a.id', '=', accountId);
  }

  return (await query.orderBy('total_requests', 'desc').execute()) as any[];
};

export const queryModelStatsByPeriod = async (
  startTime: number,
  endTime: number,
): Promise<any[]> => {
  const db = getDataStore().kysely;

  const statsSubquery = db
    .selectFrom('metrics')
    .select([
      'model_id',
      sql<number>`count(id)`.as('total_requests'),
      sql<number>`sum(total_tokens)`.as('total_tokens'),
    ])
    .where('timestamp', '>=', startTime)
    .where('timestamp', '<=', endTime)
    .groupBy('model_id')
    .as('stats');

  return (await db
    .selectFrom('model_stats as ms')
    .leftJoin(statsSubquery, 'ms.model_id', 'stats.model_id')
    .select([
      'ms.model_id',
      'ms.provider_id',
      'stats.total_requests',
      'stats.total_tokens',
    ])
    .orderBy('total_requests', 'desc')
    .execute()) as any[];
};

export const calculateModelSuccessRate = async (
  providerId: string,
  modelId: string,
): Promise<number | null> => {
  const db = getDataStore().kysely;
  const result = await db
    .selectFrom('metrics')
    .select(
      sql<number>`round(sum(case when status = 'success' then 1 else 0 end) * 100.0 / count(*), 2)`.as(
        'success_rate',
      ),
    )
    .where('provider_id', '=', providerId)
    .where('model_id', '=', modelId)
    .executeTakeFirst();

  return result?.success_rate ?? null;
};