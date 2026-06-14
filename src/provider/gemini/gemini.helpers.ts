import * as crypto from 'crypto';
import { GEMINI_BL } from './gemini.constants';

// =============================================================================
// HELPER FUNCTIONS — Gemini
// =============================================================================

export function makeSapisidHash(sapisid: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash('sha1')
    .update(`${ts} ${sapisid} https://gemini.google.com`)
    .digest('hex');
  return `SAPISIDHASH ${ts}_${hash}`;
}

export function getAccountPrefix(authUser?: string): string {
  if (!authUser || authUser === '') return '';
  return `/u/${authUser}`;
}

/**
 * Build the StreamGenerate request payload in Gemini's internal format.
 * This mirrors the protobuf-like array structure used by the Gemini web app.
 */
export function buildPayload(
  prompt: string,
  modelId: number,
  thinkMode: number,
): string {
  const inner: any[] = new Array(102).fill(null);
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

/**
 * Build the URL-encoded form body for StreamGenerate POST.
 */
export function buildRequestBody(
  prompt: string,
  modelId: number,
  thinkMode: number,
  xsrfToken?: string,
): string {
  const fReq = buildPayload(prompt, modelId, thinkMode);
  const params = new URLSearchParams();
  params.set('f.req', fReq);
  if (xsrfToken) {
    params.set('at', xsrfToken);
  }
  return params.toString();
}

/**
 * Get the StreamGenerate URL with proper request ID and build label.
 */
export function getStreamGenerateUrl(authUser?: string): string {
  const reqid = Math.floor(Date.now() / 1000) % 1000000;
  const prefix = getAccountPrefix(authUser);
  return (
    `https://gemini.google.com${prefix}/_/BardChatUi/data/` +
    `assistant.lamda.BardFrontendService/StreamGenerate` +
    `?bl=${GEMINI_BL}&hl=en&_reqid=${reqid}&rt=c`
  );
}

/**
 * Extract text chunks from a single JSON line of StreamGenerate response.
 * Gemini sends response in format: [null, "<escaped JSON string>"]
 * The inner JSON contains text in index [4] as an array of message parts.
 */
export function extractTextsFromLine(line: string): string[] {
  if (!line.includes('"wrb.fr"') || line.length < 200) return [];
  try {
    const arr = JSON.parse(line);
    const innerStr = arr[0]?.[2];
    if (!innerStr || typeof innerStr !== 'string' || innerStr.length < 50)
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

/**
 * Clean Gemini response text: remove code reference artifacts and card content URLs.
 */
export function cleanText(text: string): string {
  return text
    .replace(
      /```(?:python|javascript|text)\?code_(?:reference|stdout)&code_event_index=\d+\n.*?```\n?/gs,
      '',
    )
    .replace(/http:\/\/googleusercontent\.com\/card_content\/\d+\n?/g, '')
    .trim();
}