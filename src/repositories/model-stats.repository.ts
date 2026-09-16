/**
 * ------------------------------------------------------------------
 * Model Stats Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng model_stats.
 * Lưu các thống kê per-model cần persist (hiện tại: success_rate).
 * Không lưu metadata model (name, capabilities...) vì các thứ đó
 * lấy từ provider constants hoặc API live.
 *
 * Main functions:
 * - upsertModelStats()         : Tạo hoặc cập nhật row cho model
 * - updateModelSuccessRate()   : Cập nhật success rate
 * - findAllModelStats()        : Lấy tất cả rows (để build success rate map)
 * - findModelStats()           : Lấy stats của một model cụ thể
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { getDb } from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ModelStatsRow {
  provider_id: string;
  model_id: string;
  success_rate: number | null;
  updated_at: number;
}

// ─── Queries ────────────────────────────────────────────────────────────

export const findAllModelStats = (): ModelStatsRow[] => {
  const db = getDb();
  return db.prepare('SELECT * FROM model_stats').all() as ModelStatsRow[];
};

export const findModelStats = (
  providerId: string,
  modelId: string,
): ModelStatsRow | undefined => {
  const db = getDb();
  return db
    .prepare('SELECT * FROM model_stats WHERE provider_id = ? AND model_id = ?')
    .get(providerId, modelId) as ModelStatsRow | undefined;
};

// ─── Upserts ────────────────────────────────────────────────────────────

/**
 * Đảm bảo row tồn tại cho (provider_id, model_id).
 * Không ghi đè success_rate nếu đã có.
 */
export const upsertModelStats = (
  providerId: string,
  modelId: string,
): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO model_stats (provider_id, model_id, success_rate, updated_at)
     VALUES (?, ?, NULL, ?)
     ON CONFLICT(provider_id, model_id) DO UPDATE SET
       updated_at = excluded.updated_at`,
  ).run(providerId, modelId, Date.now());
};

// ─── Updates ────────────────────────────────────────────────────────────

export const updateModelSuccessRate = (
  providerId: string,
  modelId: string,
  successRate: number | null,
): void => {
  const db = getDb();
  db.prepare(
    `UPDATE model_stats SET success_rate = ?, updated_at = ?
     WHERE provider_id = ? AND model_id = ?`,
  ).run(successRate, Date.now(), providerId, modelId);
};
