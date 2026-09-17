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
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import { ClaudeCredential, ClaudeUploadResponse } from './claude.types';

// ── Claude ──
import { ClaudeHttpClient } from './claude.http-client';

// ── Constants ──
import {
  BASE_URL,
  API_PATHS,
  USER_AGENT,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REFERER_PATHS,
  ANTHROPIC_HEADERS,
  CHROME_FINGERPRINT_HEADERS,
} from './claude.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeUpload');

const BOUNDARY_PREFIX = '----WebKitFormBoundary';
const BOUNDARY_RANDOM_BYTES = 16;
const CRLF = '\r\n';
const FORM_FIELD_NAME = 'file';

// ─── Input / Output Types ──────────────────────────────────────────────

export interface ClaudeUploadFileInput {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Build headers cho request upload file. Bao gồm Cookie + các header
 * anthropic-client-* bắt buộc, Referer tới /new, và fingerprint Chrome
 * để qua Cloudflare.
 */
function buildUploadHeaders(credential: ClaudeCredential): Record<string, string> {
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
    [HTTP_HEADER_NAMES.ACCEPT_ENCODING]:
      CHROME_FINGERPRINT_HEADERS.ACCEPT_ENCODING,
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
 * Build multipart/form-data body thủ công (không dùng FormData của node-fetch
 * để giữ nguyên boundary behavior giống browser).
 */
function buildMultipartBody(
  file: ClaudeUploadFileInput,
  boundary: string,
): Buffer {
  const header =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="${FORM_FIELD_NAME}"; filename="${file.originalname}"${CRLF}` +
    `Content-Type: ${file.mimetype}${CRLF}${CRLF}`;
  const footer = `${CRLF}--${boundary}--${CRLF}`;
  return Buffer.concat([
    Buffer.from(header),
    file.buffer,
    Buffer.from(footer),
  ]);
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

  const boundary =
    BOUNDARY_PREFIX + crypto.randomBytes(BOUNDARY_RANDOM_BYTES).toString('hex');
  const body = buildMultipartBody(file, boundary);

  const url = `${BASE_URL}${API_PATHS.UPLOAD_FILE(credential.organizationId, conversationId)}`;
  const headers: Record<string, string> = {
    ...buildUploadHeaders(credential),
    [HTTP_HEADER_NAMES.CONTENT_TYPE]: `${CONTENT_TYPES.MULTIPART_PREFIX}${boundary}`,
  };

  try {
    const client = new ClaudeHttpClient({ baseURL: BASE_URL });
    const res = await client.request(url, {
      method: 'POST',
      headers,
      body: body.toString('binary'),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(
        `[Claude Upload] Failed | status=${res.status} | body=${errorText.slice(0, 300)}`,
      );
      throw new Error(`Claude upload failed ${res.status}: ${errorText}`);
    }

    const json = (await res.json()) as ClaudeUploadResponse;
    if (!json.file_uuid) {
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