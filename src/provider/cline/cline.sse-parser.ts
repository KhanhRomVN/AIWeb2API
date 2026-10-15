/**
 * ------------------------------------------------------------------
 * Cline SSE Parser
 * ------------------------------------------------------------------
 * Utility functions for parsing Cline upstream responses.
 *
 * Core features:
 * - unwrapData() : Bóc lớp { data: {...} } của upstream nếu có.
 * ------------------------------------------------------------------
 */

// ─── Unwrap Data ─────────────────────────────────────────────────────────

/**
 * Upstream Cline đôi khi bọc response trong `{ data: { choices, id, usage } }`.
 * Hàm này bóc lớp đó ra, trả về object OpenAI chuẩn.
 */
export function unwrapData(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  if (obj && obj['data'] && typeof obj['data'] === 'object') {
    const d = obj['data'] as Record<string, unknown>;
    if (d['choices'] || d['id'] || d['usage']) return d;
  }
  return obj;
}