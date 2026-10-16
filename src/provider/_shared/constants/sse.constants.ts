/**
 * ------------------------------------------------------------------
 * Shared SSE Protocol Constants
 * ------------------------------------------------------------------
 * Các giá trị giao thức Server-Sent Events dùng chung.
 * Giống hệt ở groq, cerebras, codex, deepseek, qwen, claude...
 * ------------------------------------------------------------------
 */

export const SSE_PROTOCOL = {
  DATA_PREFIX: 'data: ',
  DONE: '[DONE]',
} as const;