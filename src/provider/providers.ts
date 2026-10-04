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
import cerebrasCloud from './cerebras-cloud';
import claude from './claude';
import codexCli from './codex-cli';
import deepseek from './deepseek';
import duckduckgo from './duckduckgo';
import freebuff from './freebuff';
import gemini from './gemini';
import geminiCli from './gemini-cli';
import grokBuildCli from './grok-build-cli';
import groq from './groq';
import huggingchat from './huggingchat';
import kimi from './kimi';
import kiro from './kiro';
import mistral from './mistral';
import qwen from './qwen';
import qwenCli from './qwen-cli';
import zai from './zai';
import zaiBrowser from './zai-browser';

// ─── Exports ────────────────────────────────────────────────────────────

/**
 * Danh sách tất cả provider instances.
 * Registry sẽ dùng list này để register thay vì scan filesystem.
 */
export const ALL_PROVIDERS = [
  cerebrasCloud,
  claude,
  codexCli,
  deepseek,
  duckduckgo,
  freebuff,
  gemini,
  geminiCli,
  grokBuildCli,
  groq,
  huggingchat,
  kimi,
  kiro,
  mistral,
  qwen,
  qwenCli,
  zai,
  zaiBrowser,
] as const;
