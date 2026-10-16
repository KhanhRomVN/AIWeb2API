/**
 * ------------------------------------------------------------------
 * Shared Thinking Tag Constants
 * ------------------------------------------------------------------
 * Literal tags dùng chung cho mọi thinking parser.
 * Thay thế các chuỗi hard-code '', ...
 * ------------------------------------------------------------------
 */

export const THINKING_TAGS = {
  OPEN: '',
  CLOSE: '</thinking>',
  ELAPSED_OPEN: '<thinking_elapsed>',
  ELAPSED_CLOSE: '</thinking_elapsed>',
  TOKENS_OPEN: '<thinking_tokens>',
  TOKENS_CLOSE: '</thinking_tokens>',
} as const;