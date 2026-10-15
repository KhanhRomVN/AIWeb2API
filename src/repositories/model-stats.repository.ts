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
 * Postgres thông qua `getMetricsDataStore()`. Mọi hàm trả Promise, caller
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
import { sql } from 'kysely';
import { getMetricsDataStore } from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ModelStatsRow {
  provider_id: string;
  model_id: string;
  success_rate: number | null;
  max_input_token: number | null;
  updated_at: number;
}

// ─── Queries ────────────────────────────────────────────────────────────

export const findAllModelStats = async (): Promise<ModelStatsRow[]> => {
  const db = getMetricsDataStore().kysely;
  return (await db
    .selectFrom('model_stats')
    .selectAll()
    .execute()) as ModelStatsRow[];
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
  const db = getMetricsDataStore().kysely;
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
  const db = getMetricsDataStore().kysely;
  await db
    .updateTable('model_stats')
    .set({ success_rate: successRate, updated_at: Date.now() })
    .where('provider_id', '=', providerId)
    .where('model_id', '=', modelId)
    .execute();
};

/**
 * Cập nhật max_input_token nếu giá trị mới lớn hơn giá trị hiện tại.
 * Sử dụng Kysely `sql` tagged template để tạo expression CASE WHEN chuẩn ANSI SQL,
 * đảm bảo tính nguyên tử (atomicity) và tương thích cả SQLite lẫn PostgreSQL.
 */
export const updateMaxInputToken = async (
  providerId: string,
  modelId: string,
  inputTokens: number,
): Promise<void> => {
  const db = getMetricsDataStore().kysely;
  
  // Đảm bảo row tồn tại trước khi update
  await upsertModelStats(providerId, modelId);

  await db
    .updateTable('model_stats')
    .set({
      max_input_token: sql`CASE 
        WHEN max_input_token IS NULL OR max_input_token < ${inputTokens} 
        THEN ${inputTokens} 
        ELSE max_input_token 
      END`,
      updated_at: Date.now(),
    })
    .where('provider_id', '=', providerId)
    .where('model_id', '=', modelId)
    .execute();
};