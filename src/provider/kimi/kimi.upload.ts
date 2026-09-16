/**
 * ------------------------------------------------------------------
 * Kimi File Upload
 * ------------------------------------------------------------------
 * Upload file lên Kimi AI API.
 * Hỗ trợ multipart/form-data upload và polling để chờ file parse xong.
 *
 * Main functions:
 * - kimiUploadFile() : Upload file và trả về id + previewUrl
 *
 * Flow:
 * 1. POST /apiv2-files/file/upload (multipart) → nhận file.id
 * 2. Poll GetFileParseProgress cho đến khi PROCESS_STATUS_SUCCESS
 *
 * Note: Function nhận token (string) đã parse từ credential.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Types ──
import {
  KimiUploadResponse,
  KimiFileParseProgressResponse,
  KimiUploadResult,
} from './kimi.types';

// ── Constants ──
import {
  KIMI_BASE_URL,
  FILE_UPLOAD_URL,
  GET_FILE_PARSE_PROGRESS_URL,
  USER_AGENT,
  MSH_HEADERS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  REFERER_PATHS,
  AUTH_PREFIXES,
  DEFAULT_TIMEZONE,
  UPLOAD_CONFIG,
  FILE_PROCESS_STATUS,
} from './kimi.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('KimiUpload');

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Build common headers dùng cho mọi Kimi API call.
 */
function buildBaseHeaders(token: string): Record<string, string> {
  return {
    [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${token}`,
    [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
    [HTTP_HEADER_NAMES.ORIGIN]: KIMI_BASE_URL,
    [HTTP_HEADER_NAMES.REFERER]: `${KIMI_BASE_URL}${REFERER_PATHS.ROOT}`,
    [HTTP_HEADER_NAMES.R_TIMEZONE]: DEFAULT_TIMEZONE,
    ...MSH_HEADERS,
  };
}

// ─── Main Function ─────────────────────────────────────────────────────

export async function kimiUploadFile(
  token: string,
  file: Express.Multer.File,
): Promise<KimiUploadResult> {
  // ── Step 1: Upload file ──────────────────────────────────────────────
  const boundary =
    UPLOAD_CONFIG.FORM_BOUNDARY_PREFIX +
    crypto.randomBytes(UPLOAD_CONFIG.BOUNDARY_RANDOM_BYTES).toString('hex');
  const crlf = UPLOAD_CONFIG.CRLF;

  // Build multipart body thủ công (giống Kimi browser client)
  const header =
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="${UPLOAD_CONFIG.FORM_FIELD_NAME}"; filename="${file.originalname}"${crlf}` +
    `Content-Type: ${file.mimetype}${crlf}${crlf}`;
  const footer = `${crlf}--${boundary}--${crlf}`;
  const body = Buffer.concat([
    Buffer.from(header),
    file.buffer,
    Buffer.from(footer),
  ]);

  const uploadHeaders: Record<string, string> = {
    ...buildBaseHeaders(token),
    [HTTP_HEADER_NAMES.CONTENT_TYPE]: `multipart/form-data; boundary=${boundary}`,
    // X-Language riêng cho files API
    'X-Language': 'en-US',
    // X-Traffic-Id required by Kimi files API
    'x-traffic-id': 'zen-upload',
  };

  const uploadRes = await fetch(FILE_UPLOAD_URL, {
    method: 'POST',
    headers: uploadHeaders,
    body,
    timeout: 30000,
  } as any);

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    logger.error(
      `[Kimi Upload] Upload failed | status=${uploadRes.status} | body=${errText.slice(0, 300)}`,
    );
    throw new Error(
      `Kimi Upload ${uploadRes.status}: ${errText.slice(0, 200)}`,
    );
  }

  const uploadJson = (await uploadRes.json()) as KimiUploadResponse;
  const fileId = uploadJson.file?.id;

  if (!fileId) {
    logger.error('[Kimi Upload] No file id in response', { uploadJson });
    throw new Error('Kimi Upload: no file id returned');
  }

  // ── Step 2: Poll parse progress ──────────────────────────────────────
  const pollHeaders: Record<string, string> = {
    ...buildBaseHeaders(token),
    [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
    'connect-protocol-version': '1',
  };

  for (
    let attempt = 1;
    attempt <= UPLOAD_CONFIG.POLLING_MAX_ATTEMPTS;
    attempt++
  ) {
    await new Promise((resolve) =>
      setTimeout(resolve, UPLOAD_CONFIG.POLLING_INTERVAL_MS),
    );

    try {
      const progressRes = await fetch(GET_FILE_PARSE_PROGRESS_URL, {
        method: 'POST',
        headers: pollHeaders,
        body: JSON.stringify({ file_ids: [fileId] }),
        timeout: 10000,
      } as any);

      if (!progressRes.ok) {
        logger.warn(
          `[Kimi Upload] Poll failed | status=${progressRes.status} | attempt=${attempt}`,
        );
        continue;
      }

      const progressJson =
        (await progressRes.json()) as KimiFileParseProgressResponse;
      const progress = progressJson.progresses?.find(
        (p) => p.fileId === fileId,
      );
      const status = progress?.status;

      if (status === FILE_PROCESS_STATUS.SUCCESS) {
        const previewUrl =
          uploadJson.file?.parseResult?.thumbnail?.previewUrl ||
          uploadJson.file?.blob?.signUrl ||
          undefined;

        return { id: fileId, url: previewUrl };
      }

      if (status === FILE_PROCESS_STATUS.FAIL) {
        throw new Error(`Kimi file processing failed: ${fileId}`);
      }

      // PROCESS_STATUS_PROCESSING → tiếp tục poll
    } catch (err: any) {
      if (err.message?.includes('processing failed')) throw err;
      logger.warn(
        `[Kimi Upload] Poll error | attempt=${attempt} | error=${err.message}`,
      );
    }
  }

  // Hết attempts nhưng upload thành công — trả về id (file có thể dùng được)
  logger.warn(
    `[Kimi Upload] Max poll attempts reached, returning id anyway | fileId=${fileId}`,
  );
  return { id: fileId };
}
