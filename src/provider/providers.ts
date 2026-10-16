/**
 * ------------------------------------------------------------------
 * Static Provider Manifest
 * ------------------------------------------------------------------
 * Import tĩnh (static) tất cả provider instances.
 * File này được dùng thay cho dynamic fs.readdirSync() trong registry
 * để đảm bảo hoạt động đúng khi bundle bằng tsup + đóng gói pkg binary.
 *
 * Khi thêm provider mới, import default export của provider đó vào đây.
 * ------------------------------------------------------------------
 */

// ── Providers ──
import claude from './claude';
import cline from './cline';
import codex from './codex';
import deepseek from './deepseek';
import freebuff from './freebuff';
import gemini from './gemini';
import grokBuildCli from './grok-build-cli';
import kimi from './kimi';
import kiro from './kiro';
import mistral from './mistral';
import qwen from './qwen';
import zaiBrowser from './zai-browser';

// ─── Exports ────────────────────────────────────────────────────────────

/**
 * Danh sách tất cả provider instances.
 * Registry sẽ dùng list này để register thay vì scan filesystem.
 */
export const ALL_PROVIDERS = [
  claude,
  cline,
  codex,
  deepseek,
  freebuff,
  gemini,
  grokBuildCli,
  kimi,
  kiro,
  mistral,
  qwen,
  zaiBrowser,
] as const;
