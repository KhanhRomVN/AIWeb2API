/**
 * ------------------------------------------------------------------
 * Claude File Upload
 * ------------------------------------------------------------------
 * Upload file lên Claude AI thông qua endpoint `/wiggle/upload-file`.
 * Endpoint này yêu cầu `organizationId` và `conversationId` trên URL.
 *
 * Main functions:
 * - claudeUploadFile() : Upload file multipart/form-data, trả về file_uuid
 *
 * Credential format: JSON string `{ cookies, organizationId }`.
 *
 * NOTE: Dùng native https thay vì cycletls vì cycletls serialize body qua
 * WebSocket → Go subprocess bằng toString('utf8'), làm corrupt binary data
 * của file. Upload endpoint không bị Cloudflare JA3 challenge nên không
 * cần cycletls.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as https from 'https';
import * as zlib from 'zlib';
import FormData from 'form-data';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { ClaudeCredential, ClaudeUploadResponse } from './claude.types';

// ── Constants ──
import {
  BASE_URL,
  API_PATHS,
  USER_AGENT,
  HTTP_HEADER_NAMES,
  REFERER_PATHS,
  ANTHROPIC_HEADERS,
  CHROME_FINGERPRINT_HEADERS,
} from './claude.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeUpload');

const FORM_FIELD_NAME = 'file';
const UPLOAD_HOST = 'claude.ai';

// ─── Input / Output Types ──────────────────────────────────────────────

export interface ClaudeUploadFileInput {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Build headers cho request upload file. Bao gồm Cookie + các header
 * anthropic-client-* bắt buộc, Referer tới /new, và fingerprint Chrome.
 * Accept-Encoding chỉ dùng 'identity' để tránh cycletls không decompress.
 */
function buildUploadHeaders(
  credential: ClaudeCredential,
): Record<string, string> {
  return {
    [HTTP_HEADER_NAMES.COOKIE]: credential.cookies,
    [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
    [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
    [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.NEW}`,
    [HTTP_HEADER_NAMES.SEC_CH_UA]: CHROME_FINGERPRINT_HEADERS.SEC_CH_UA,
    [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]:
      CHROME_FINGERPRINT_HEADERS.SEC_CH_UA_MOBILE,
    [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]:
      CHROME_FINGERPRINT_HEADERS.SEC_CH_UA_PLATFORM,
    [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]:
      CHROME_FINGERPRINT_HEADERS.ACCEPT_LANGUAGE,
    // identity = không compress → response luôn là plain text, không cần decompress
    'accept-encoding': 'identity',
    [HTTP_HEADER_NAMES.SEC_FETCH_DEST]:
      CHROME_FINGERPRINT_HEADERS.SEC_FETCH_DEST,
    [HTTP_HEADER_NAMES.SEC_FETCH_MODE]:
      CHROME_FINGERPRINT_HEADERS.SEC_FETCH_MODE,
    [HTTP_HEADER_NAMES.SEC_FETCH_SITE]:
      CHROME_FINGERPRINT_HEADERS.SEC_FETCH_SITE,
    [HTTP_HEADER_NAMES.PRIORITY]: CHROME_FINGERPRINT_HEADERS.PRIORITY,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_PLATFORM]:
      ANTHROPIC_HEADERS.CLIENT_PLATFORM,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_VERSION]:
      ANTHROPIC_HEADERS.CLIENT_VERSION,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_BUILD]: ANTHROPIC_HEADERS.CLIENT_BUILD,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_SHA]: ANTHROPIC_HEADERS.CLIENT_SHA,
    [HTTP_HEADER_NAMES.ANTHROPIC_CLIENT_CAPABILITIES]:
      ANTHROPIC_HEADERS.CLIENT_CAPABILITIES,
  };
}

/**
 * Gửi multipart/form-data POST request bằng native https module.
 * Trả về response body dạng Buffer (không bị encoding corruption).
 */
function httpsPost(
  path: string,
  headers: Record<string, string>,
  bodyBuffer: Buffer,
): Promise<{ status: number; body: Buffer; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: UPLOAD_HOST,
        path,
        method: 'POST',
        headers: {
          ...headers,
          'content-length': bodyBuffer.length,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const resHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) {
              resHeaders[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
            }
          }
          resolve({ status: res.statusCode ?? 0, body, headers: resHeaders });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

/**
 * Decompress response body nếu server vẫn gzip/brotli dù đã gửi
 * Accept-Encoding: identity. Fallback an toàn.
 */
async function decompressBody(
  body: Buffer,
  contentEncoding: string | undefined,
): Promise<Buffer> {
  if (!contentEncoding || contentEncoding === 'identity') return body;

  return new Promise((resolve, reject) => {
    if (contentEncoding === 'gzip') {
      zlib.gunzip(body, (err, result) => (err ? reject(err) : resolve(result)));
    } else if (contentEncoding === 'br') {
      zlib.brotliDecompress(body, (err, result) =>
        err ? reject(err) : resolve(result),
      );
    } else if (contentEncoding === 'deflate') {
      zlib.inflate(body, (err, result) =>
        err ? reject(err) : resolve(result),
      );
    } else {
      // Unknown encoding — trả nguyên, để JSON.parse tự fail với message rõ ràng
      resolve(body);
    }
  });
}

// ─── Main Function ─────────────────────────────────────────────────────

/**
 * Upload 1 file lên Claude AI.
 *
 * @param credential     Credential đã parse `{ cookies, organizationId }`.
 * @param conversationId UUID conversation (client-generated, dùng làm path).
 * @param file           Buffer + metadata của file cần upload.
 * @returns Response từ Claude bao gồm `file_uuid` để gắn vào completion request.
 * @throws Nếu `organizationId` thiếu, hoặc HTTP không phải 2xx.
 */
export async function claudeUploadFile(
  credential: ClaudeCredential,
  conversationId: string,
  file: ClaudeUploadFileInput,
): Promise<ClaudeUploadResponse> {
  if (!credential.organizationId) {
    throw new Error(
      'Claude upload requires organizationId in credential. Re-login or update credential.',
    );
  }

  // Build FormData và serialize thành Buffer để giữ nguyên binary
  const form = new FormData();
  form.append(FORM_FIELD_NAME, file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
    knownLength: file.buffer.length,
  });

  const formHeaders = form.getHeaders(); // bao gồm content-type với boundary
  const bodyBuffer: Buffer = await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    form.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    form.on('end', () => resolve(Buffer.concat(chunks)));
    form.on('error', reject);
    form.resume();
  });

  const urlPath = API_PATHS.UPLOAD_FILE(
    credential.organizationId,
    conversationId,
  );
  const headers: Record<string, string> = {
    ...buildUploadHeaders(credential),
    ...formHeaders,
  };

  try {
    const {
      status,
      body,
      headers: resHeaders,
    } = await httpsPost(urlPath, headers, bodyBuffer);

    const decompressed = await decompressBody(
      body,
      resHeaders['content-encoding'],
    );
    const text = decompressed.toString('utf8');

    if (status < 200 || status >= 300) {
      logger.error(
        `[Claude Upload] Failed | status=${status} | body=${text.slice(0, 300)}`,
      );
      throw new Error(`Claude upload failed ${status}: ${text}`);
    }

    let json: ClaudeUploadResponse;
    try {
      json = JSON.parse(text) as ClaudeUploadResponse;
    } catch (parseErr) {
      logger.error(
        `[Claude Upload] JSON parse failed | status=${status} | body_hex=${body.slice(0, 32).toString('hex')} | text=${text.slice(0, 200)}`,
      );
      throw parseErr;
    }

    if (!json.file_uuid) {
      logger.error(
        `[Claude Upload] Response missing file_uuid | full response=${JSON.stringify(json).slice(0, 500)}`,
      );
      throw new Error(
        `Claude upload response missing file_uuid: ${JSON.stringify(json).slice(0, 300)}`,
      );
    }

    return json;
  } catch (e) {
    logger.error('[Claude Upload] Unhandled error:', e);
    throw e;
  }
}
