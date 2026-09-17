/**
 * ------------------------------------------------------------------
 * ChatGPT PoW (Proof of Work)
 * ------------------------------------------------------------------
 * Port từ chatgpt2api/utils/pow.py. Xây dựng sentinel requirements token
 * (legacy) và giải proof-of-work challenge để lấy proof token.
 *
 * Node >= 15 có sẵn SHA3-512 trong crypto — không cần WASM.
 *
 * Main functions:
 * - parsePowResources()           : Trích script sources + data-build từ HTML
 * - buildPowConfig()              : Sinh config array (giả lập browser fingerprint)
 * - buildLegacyRequirementsToken(): Token `gAAAAAC...` cho prepare step
 * - buildProofToken()             : Token `gAAAAAB...` cho finalize step
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { createHash, randomUUID } from 'crypto';

// ── Constants ──
import {
  DEFAULT_POW_SCRIPT,
  POW_CORES,
  POW_DOCUMENT_KEYS,
  POW_FALLBACK_PREFIX,
  POW_LIMIT,
  POW_NAVIGATOR_KEYS,
  POW_SCREEN_RESOLUTIONS,
  POW_SCRIPT_SRC_REGEX,
  POW_DATA_BUILD_REGEX,
  POW_WINDOW_KEYS,
  SENTINEL_TOKEN_PREFIX,
} from './chatgpt.constant';

// ─── Helpers ────────────────────────────────────────────────────────────

/** Chọn ngẫu nhiên 1 phần tử từ mảng readonly. */
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Tạo timestamp theo định dạng cũ mà ChatGPT sentinel sdk.js mong đợi.
 * Ví dụ: `Wed Sep 17 2026 10:23:45 GMT-0500 (Eastern Standard Time)`.
 */
function legacyParseTime(): string {
  // EST = UTC-5 (không theo DST, giống Python timedelta(hours=-5))
  const now = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${days[now.getUTCDay()]} ${months[now.getUTCMonth()]} ` +
    `${pad(now.getUTCDate())} ${now.getUTCFullYear()} ` +
    `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(
      now.getUTCSeconds(),
    )} GMT-0500 (Eastern Standard Time)`
  );
}

// ─── HTML Parsing ───────────────────────────────────────────────────────

export interface PowResources {
  scriptSources: string[];
  dataBuild: string;
}

/**
 * Trích danh sách script sources và data-build từ HTML của trang chủ chatgpt.com.
 * Fallback về DEFAULT_POW_SCRIPT nếu không tìm thấy script nào.
 */
export function parsePowResources(htmlContent: string): PowResources {
  const scriptSources: string[] = [];
  const scriptRe = /<script[^>]*\ssrc="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(htmlContent)) !== null) {
    scriptSources.push(match[1]);
  }

  let dataBuild = '';
  for (const src of scriptSources) {
    const buildMatch = src.match(POW_SCRIPT_SRC_REGEX);
    if (buildMatch) {
      dataBuild = buildMatch[0];
      break;
    }
  }

  if (!dataBuild) {
    const htmlMatch = htmlContent.match(POW_DATA_BUILD_REGEX);
    if (htmlMatch) dataBuild = htmlMatch[1];
  }

  return {
    scriptSources: scriptSources.length > 0 ? scriptSources : [DEFAULT_POW_SCRIPT],
    dataBuild,
  };
}

// ─── PoW Config ─────────────────────────────────────────────────────────

/**
 * Sinh config array 27 phần tử giả lập browser fingerprint của ChatGPT web.
 * Đây là đầu vào của thuật toán PoW.
 */
export function buildPowConfig(
  userAgent: string,
  scriptSources: readonly string[] | null = null,
  dataBuild = '',
): unknown[] {
  const navigatorKey = pick(POW_NAVIGATOR_KEYS);
  const windowKey = pick(POW_WINDOW_KEYS);
  const scriptSource =
    scriptSources && scriptSources.length > 0
      ? pick(scriptSources)
      : DEFAULT_POW_SCRIPT;
  const resolution = pick(POW_SCREEN_RESOLUTIONS);
  const perfNow = performance.now();

  return [
    resolution[0] + resolution[1],
    legacyParseTime(),
    4294705152,
    1,
    userAgent,
    scriptSource,
    dataBuild,
    'en-US',
    'en-US,es-US,en,es',
    Math.random(),
    navigatorKey,
    pick(POW_DOCUMENT_KEYS),
    windowKey,
    perfNow,
    randomUUID(),
    '',
    pick(POW_CORES),
    Date.now() - perfNow,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0, // 0 = edge/chrome, 1 = firefox
  ];
}

// ─── Token Builders ────────────────────────────────────────────────────

/** Chuỗi base64 của JSON config (không padding escape ký tự đặc biệt). */
function encodeBase64(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

/** So sánh 2 buffer theo thứ tự byte (lexicographic). */
function bufferLessOrEqual(a: Buffer, b: Buffer): boolean {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return a.length <= b.length;
}

/**
 * Brute-force tìm nonce i sao cho `sha3_512(seed + base64(config_with_i))`
 * có `diffLen` byte đầu <= target.
 */
function powGenerate(
  seed: string,
  difficulty: string,
  config: unknown[],
  limit: number = POW_LIMIT,
): { answer: string; solved: boolean } {
  const target = Buffer.from(difficulty, 'hex');
  const diffLen = Math.floor(difficulty.length / 2);
  const seedBytes = Buffer.from(seed, 'utf-8');

  // Tách config thành 3 phần tĩnh để tăng tốc vòng lặp
  const static1 =
    JSON.stringify(config.slice(0, 3)).slice(0, -1) + ',';
  const static2 =
    ',' + JSON.stringify(config.slice(4, 9)).slice(1, -1) + ',';
  const static3 =
    ',' + JSON.stringify(config.slice(10)).slice(1);

  for (let i = 0; i < limit; i++) {
    const finalJson =
      static1 + String(i) + static2 + String(i >> 1) + static3;
    const encoded = encodeBase64(finalJson);
    const digest = createHash('sha3-512')
      .update(seedBytes)
      .update(Buffer.from(encoded, 'utf-8'))
      .digest();
    if (bufferLessOrEqual(digest.subarray(0, diffLen), target)) {
      return { answer: encoded, solved: true };
    }
  }

  const fallback =
    POW_FALLBACK_PREFIX + encodeBase64(`"${seed}"`);
  return { answer: fallback, solved: false };
}

/**
 * Xây token cho bước `prepare` của sentinel chat-requirements.
 * Prefix `gAAAAAC` + base64(JSON config).
 */
export function buildLegacyRequirementsToken(
  userAgent: string,
  scriptSources: readonly string[] | null = null,
  dataBuild = '',
): string {
  const config = buildPowConfig(userAgent, scriptSources, dataBuild);
  return (
    SENTINEL_TOKEN_PREFIX.LEGACY_REQUIREMENTS +
    encodeBase64(JSON.stringify(config))
  );
}

/**
 * Giải proof-of-work challenge và trả proof token.
 * Prefix `gAAAAAB` + base64 kết quả.
 *
 * @throws Error nếu không tìm được nonce thỏa mãn trong `POW_LIMIT` vòng lặp.
 */
export function buildProofToken(
  seed: string,
  difficulty: string,
  userAgent: string,
  scriptSources: readonly string[] | null = null,
  dataBuild = '',
): string {
  const config = buildPowConfig(userAgent, scriptSources, dataBuild);
  const { answer, solved } = powGenerate(seed, difficulty, config);
  if (!solved) {
    throw new Error(
      `chatgpt_pow_failed: difficulty=${difficulty} (exceeded ${POW_LIMIT} iterations)`,
    );
  }
  return SENTINEL_TOKEN_PREFIX.PROOF + answer;
}