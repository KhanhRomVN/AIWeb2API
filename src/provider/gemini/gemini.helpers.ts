/**
 * ------------------------------------------------------------------
 * Gemini Helpers
 * ------------------------------------------------------------------
 * Helper functions cho Gemini Web API.
 *
 * Main functions:
 * - makeSapisidHash()      : Tạo SAPISIDHASH header
 * - getAccountPrefix()     : Lấy prefix cho /u/ path
 * - buildPayload()         : Build request payload
 * - buildRequestBody()     : Build URL-encoded form body
 * - getStreamGenerateUrl() : Build StreamGenerate URL
 * - extractTextsFromLine() : Extract text từ SSE line
 * - cleanText()            : Clean Gemini response text
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';

// ── Constants ──
import {
  BASE_URL,
  GEMINI_BL,
  SAPISID_HASH_PREFIX,
  FORM_FIELDS,
  STREAM_GENERATE_PATH,
  PAYLOAD_ARRAY_SIZE,
  MIN_LINE_LENGTH_FOR_PARSE,
  MIN_INNER_STR_LENGTH,
  WRB_FR_MARKER,
  REGEX_PATTERNS,
} from './gemini.constant';

// ─── Functions ──────────────────────────────────────────────────────────

export function makeSapisidHash(sapisid: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash('sha1')
    .update(`${ts} ${sapisid} ${BASE_URL}`)
    .digest('hex');
  return `${SAPISID_HASH_PREFIX}${ts}_${hash}`;
}

export function getAccountPrefix(authUser?: string): string {
  if (!authUser || authUser === '') return '';
  return `/u/${authUser}`;
}

export function buildPayload(
  prompt: string,
  modelId: number,
  thinkMode: number,
): string {
  const inner: any[] = new Array(PAYLOAD_ARRAY_SIZE).fill(null);
  inner[0] = [prompt, 0, null, null, null, null, 0];
  inner[1] = ['en'];
  inner[2] = ['', '', '', null, null, null, null, null, null, ''];
  inner[6] = [0];
  inner[7] = 1;
  inner[10] = 1;
  inner[11] = 0;
  inner[17] = [[thinkMode]];
  inner[18] = 0;
  inner[27] = 1;
  inner[30] = [4];
  inner[41] = [2];
  inner[53] = 0;
  inner[59] = crypto.randomUUID();
  inner[61] = [];
  inner[68] = 1;
  inner[79] = modelId;

  return JSON.stringify([null, JSON.stringify(inner)]);
}

export function buildRequestBody(
  prompt: string,
  modelId: number,
  thinkMode: number,
  xsrfToken?: string,
): string {
  const fReq = buildPayload(prompt, modelId, thinkMode);
  const params = new URLSearchParams();
  params.set(FORM_FIELDS.F_REQ, fReq);
  if (xsrfToken) {
    params.set(FORM_FIELDS.AT, xsrfToken);
  }
  return params.toString();
}

export function getStreamGenerateUrl(authUser?: string): string {
  const reqid = Math.floor(Date.now() / 1000) % 1000000;
  const prefix = getAccountPrefix(authUser);
  return (
    `${BASE_URL}${prefix}/_/BardChatUi/data/` +
    `${STREAM_GENERATE_PATH}` +
    `?bl=${GEMINI_BL}&hl=en&_reqid=${reqid}&rt=c`
  );
}

export function extractTextsFromLine(line: string): string[] {
  if (!line.includes(WRB_FR_MARKER) || line.length < MIN_LINE_LENGTH_FOR_PARSE)
    return [];
  try {
    const arr = JSON.parse(line);
    const innerStr = arr[0]?.[2];
    if (
      !innerStr ||
      typeof innerStr !== 'string' ||
      innerStr.length < MIN_INNER_STR_LENGTH
    )
      return [];
    const inner = JSON.parse(innerStr);
    if (!Array.isArray(inner) || inner.length <= 4 || !inner[4]) return [];
    const texts: string[] = [];
    for (const part of inner[4]) {
      if (
        Array.isArray(part) &&
        part.length > 1 &&
        part[1] &&
        Array.isArray(part[1])
      ) {
        for (const t of part[1]) {
          if (typeof t === 'string' && t) {
            texts.push(t);
          }
        }
      }
    }
    return texts;
  } catch {
    return [];
  }
}

export function cleanText(text: string): string {
  return text
    .replace(REGEX_PATTERNS.CODE_BLOCK, '')
    .replace(REGEX_PATTERNS.CARD_CONTENT, '')
    .trim();
}