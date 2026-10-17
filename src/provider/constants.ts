/**
 * ------------------------------------------------------------------
 * Centralized Provider Constants
 * ------------------------------------------------------------------
 * Tập trung các hằng số cấu hình quan trọng từ từng Provider.
 * Mục đích: Cho phép các service (như CooldownService) truy cập
 * giá trị cấu hình mà không cần biết đường dẫn cụ thể của từng provider,
 * đồng thời giảm thiểu coupling trực tiếp giữa Service và Provider Folder.
 * ------------------------------------------------------------------
 */

import { REQUEST_COOLDOWN_MS as KIMI_CD } from './kimi/kimi.constant';
import { REQUEST_COOLDOWN_MS as QWEN_CD } from './qwen/qwen.constant';
import { REQUEST_COOLDOWN_MS as MISTRAL_CD } from './mistral/mistral.constant';
import { REQUEST_COOLDOWN_MS as CLINE_CD } from './cline/cline.constant';
import { REQUEST_COOLDOWN_MS as DEEPSEEK_CD } from './deepseek/deepseek.constant';
import { REQUEST_COOLDOWN_MS as CLAUDE_CD } from './claude/claude.constant';
import { REQUEST_COOLDOWN_MS as GROK_BUILD_CLI_CD } from './grok-build-cli/grok-build-cli.constant';
import { REQUEST_COOLDOWN_MS as OPENCODE_CD } from './opencode/opencode.constant';

export const PROVIDER_CONSTANTS = {
  kimi: Number(KIMI_CD),
  qwen: Number(QWEN_CD),
  mistral: Number(MISTRAL_CD),
  cline: Number(CLINE_CD),
  deepseek: Number(DEEPSEEK_CD),
  claude: Number(CLAUDE_CD),
  'grok-build-cli': Number(GROK_BUILD_CLI_CD),
  opencode: Number(OPENCODE_CD),
} as const;

export type ProviderCooldownKey = keyof typeof PROVIDER_CONSTANTS;
