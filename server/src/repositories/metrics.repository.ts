import { getDb } from '../database';

export const insertMetric = (
  providerId: string,
  modelId: string,
  accountId: string,
  totalTokens: number,
  timestamp?: number,
): void => {
  const db = getDb();
  const now = timestamp ?? Date.now();
  db.prepare(
    `INSERT INTO metrics (provider_id, model_id, account_id, total_tokens, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(providerId, modelId, accountId, totalTokens, now);
};

export const queryUsageHistory = (
  groupBy: string,
  startTime: number,
  endTime: number,
): Array<{ date: string; requests: number; tokens: number }> => {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        strftime(?, datetime(timestamp / 1000, 'unixepoch', 'localtime')) as date,
        COUNT(*) as requests,
        SUM(total_tokens) as tokens
       FROM metrics
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY date
       ORDER BY date ASC`,
    )
    .all(groupBy, startTime, endTime) as any[];
};

export const queryAccountStatsByPeriod = (
  startTime: number,
  endTime: number,
): any[] => {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        a.id, a.email, a.provider_id,
        stats.total_requests,
        stats.successful_requests,
        stats.total_tokens
       FROM accounts a
       LEFT JOIN (
         SELECT account_id,
           COUNT(id) as total_requests,
           SUM(CASE WHEN total_tokens > 0 THEN 1 ELSE 0 END) as successful_requests,
           SUM(total_tokens) as total_tokens
         FROM metrics
         WHERE timestamp >= ? AND timestamp <= ?
         GROUP BY account_id
       ) stats ON a.id = stats.account_id
       ORDER BY total_requests DESC`,
    )
    .all(startTime, endTime);
};

export const queryModelStatsByPeriod = (
  startTime: number,
  endTime: number,
): any[] => {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        m.model_id, m.provider_id,
        stats.total_requests, stats.total_tokens
       FROM models m
       LEFT JOIN (
         SELECT model_id,
           COUNT(id) as total_requests,
           SUM(total_tokens) as total_tokens
         FROM metrics
         WHERE timestamp >= ? AND timestamp <= ?
         GROUP BY model_id
       ) stats ON m.model_id = stats.model_id
       ORDER BY total_requests DESC`,
    )
    .all(startTime, endTime);
};