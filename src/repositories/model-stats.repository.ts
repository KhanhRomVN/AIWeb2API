/**
 * ------------------------------------------------------------------
 * Model Stats Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng model_stats.
 * Lưu các thống kê per-model cần persist (hiện tại: success_rate).
 * Không lưu metadata model (name, capabilities...) vì các thứ đó
 * lấy từ provider constants hoặc API live.
 *
 * ĐÃ MIGRATE sang Kysely (async) — chạy được trên cả SQLite lẫn
 * Postgres thông qua `getDataStore()`. Mọi hàm trả Promise, caller
 * phải `await`.
 *
 * Main functions:
 * - upsertModelStats()         : Tạo hoặc cập nhật row cho model
 * - updateModelSuccessRate()   : Cập nhật success rate
 * - findAllModelStats()        : Lấy tất cả rows (để build success rate map)
 * - findModelStats()           : Lấy stats của một model cụ thể
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { getDataStore } from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ModelStatsRow {
  provider_id: string;
  model_id: string;
  success_rate: number | null;
  updated_at: number;
}

// ─── Queries ────────────────────────────────────────────────────────────

export const findAllModelStats = async (): Promise<ModelStatsRow[]> => {
  const db = getDataStore().kysely;
  return (await db
    .selectFrom('model_stats')
    .selectAll()
    .execute()) as ModelStatsRow[];
};

export const findModelStats = async (
  providerId: string,
  modelId: string,
): Promise<ModelStatsRow | undefined> => {
  const db = getDataStore().kysely;
  const row = await db
    .selectFrom('model_stats')
    .selectAll()
    .where('provider_id', '=', providerId)
    .where('model_id', '=', modelId)
    .executeTakeFirst();
  return row as ModelStatsRow | undefined;
};

// ─── Upserts ────────────────────────────────────────────────────────────

/**
 * Đảm bảo row tồn tại cho (provider_id, model_id).
 * Không ghi đè success_rate nếu đã có.
 */
export const upsertModelStats = async (
  providerId: string,
  modelId: string,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .insertInto('model_stats')
    .values({
      provider_id: providerId,
      model_id: modelId,
      success_rate: null,
      updated_at: Date.now(),
    })
    .onConflict((oc) =>
      oc.columns(['provider_id', 'model_id']).doUpdateSet({
        updated_at: (eb) => eb.ref('excluded.updated_at'),
      }),
    )
    .execute();
};

// ─── Updates ────────────────────────────────────────────────────────────

export const updateModelSuccessRate = async (
  providerId: string,
  modelId: string,
  successRate: number | null,
): Promise<void> => {
  const db = getDataStore().kysely;
  await db
    .updateTable('model_stats')
    .set({ success_rate: successRate, updated_at: Date.now() })
    .where('provider_id', '=', providerId)
    .where('model_id', '=', modelId)
    .execute();
};