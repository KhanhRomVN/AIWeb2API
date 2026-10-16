/**
 * ------------------------------------------------------------------
 * Shared Chat Limits & Defaults
 * ------------------------------------------------------------------
 * Hằng số giới hạn hội thoại dùng chung cho nhóm deepseek/qwen/zai/zai-browser.
 * Giá trị hiện tại đều giống nhau (MAX_CONTINUATIONS=10, HISTORY_MESSAGES_COUNT=20, SUCCESS_CODE=0).
 * ------------------------------------------------------------------
 */

export const MAX_CONTINUATIONS = 10;
export const HISTORY_MESSAGES_COUNT = 20;
export const SUCCESS_CODE = 0;

/**
 * Masked email indicator — xuất hiện khi server trả email đã che.
 * Dùng ở claude, deepseek, gemini, qwen.
 */
export const MASKED_EMAIL_INDICATOR = '***';
export const MASKED_EMAIL_CHAR = '*';

/**
 * Kiểm tra email có bị mask không.
 * Logic gốc: `email.includes(MASKED_EMAIL_INDICATOR) || email.includes(MASKED_EMAIL_CHAR)`
 */
export function isMaskedEmail(email: string): boolean {
  return email.includes(MASKED_EMAIL_INDICATOR) || email.includes(MASKED_EMAIL_CHAR);
}