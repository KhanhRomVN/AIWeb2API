/**
 * ------------------------------------------------------------------
 * Qwen File Upload
 * ------------------------------------------------------------------
 * Upload file lên Qwen API. Hỗ trợ:
 * - Lấy STS token từ Aliyun OSS
 * - Upload file lên OSS với multipart/form-data
 * - Polling để chờ file được parse
 *
 * Main functions:
 * - qwenUploadFile() : Upload file và trả về file_id + token_usage
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import OSS from 'ali-oss';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';

// ── Types ──
import {
  UploadFileInput,
  UploadResult,
  STSTokenResponse,
  FileParseStatusResponse,
} from './qwen.types';

// ── Qwen Imports ──
import {
  BASE_URL,
  API_PATHS,
  USER_AGENTS,
  COOKIE_CONFIG,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  ACCEPT_VALUES,
  SUCCESS_CODE,
  UPLOAD_CONFIG,
  FILE_STATUS,
  API_FIELDS,
} from './qwen.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenUpload');

// ─── Helpers ────────────────────────────────────────────────────────────

interface ParsedCredential {
  token: string | null;
  bxUa: string;
  bxUmidToken: string;
  userAgent: string;
}

function createUploadClient(cred: ParsedCredential): HttpClient {
  const headers: Record<string, string> = {
    [HTTP_HEADER_NAMES.USER_AGENT]: cred.userAgent || USER_AGENTS.LINUX_CHROME,
    [HTTP_HEADER_NAMES.REFERER]: BASE_URL,
    [HTTP_HEADER_NAMES.ACCEPT]: ACCEPT_VALUES.JSON_TEXT_PLAIN_ANY,
    [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    [HTTP_HEADER_NAMES.SOURCE]: 'web',
    [HTTP_HEADER_NAMES.VERSION]: '0.2.91',
    [HTTP_HEADER_NAMES.BX_V]: '2.5.37',
  };

  if (cred.token) {
    headers[HTTP_HEADER_NAMES.AUTHORIZATION] =
      `${COOKIE_CONFIG.BEARER_PREFIX}${cred.token}`;
  }
  if (cred.bxUa) {
    headers[HTTP_HEADER_NAMES.BX_UA] = cred.bxUa;
  }
  if (cred.bxUmidToken) {
    headers[HTTP_HEADER_NAMES.BX_UMIDTOKEN] = cred.bxUmidToken;
  }

  return new HttpClient({
    baseURL: BASE_URL,
    headers,
  });
}

/**
 * Xác định file type dựa trên mimetype
 */
function getFileType(mimetype: string): string {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'file';
}

// ─── Main Function ─────────────────────────────────────────────────────

export async function qwenUploadFile(
  credential: ParsedCredential,
  file: UploadFileInput,
): Promise<UploadResult> {
  const client = createUploadClient(credential);

  try {
    // Step 1: Get STS token
    const fileType = getFileType(file.mimetype);
    const stsPayload = {
      filename: file.originalname,
      filesize: file.buffer.length.toString(),
      filetype: fileType,
    };

    const stsRes = await client.post(API_PATHS.FILE_GET_STS_TOKEN, stsPayload);

    if (!stsRes.ok) {
      const errorText = await stsRes.text();
      logger.error(
        `[Qwen Upload] Failed to get STS token | status=${stsRes.status} | error=${errorText}`,
      );
      throw new Error(
        `Failed to get STS token: ${stsRes.status} - ${errorText}`,
      );
    }

    const stsResult = (await stsRes.json()) as STSTokenResponse;

    if (!stsResult.success || !stsResult.data) {
      const errorMsg = stsResult.message || 'Unknown error';
      logger.error(`[Qwen Upload] STS token request failed | msg=${errorMsg}`);
      throw new Error(`STS token request failed: ${errorMsg}`);
    }

    const {
      access_key_id,
      access_key_secret,
      security_token,
      file_url,
      file_id,
      file_path,
      bucketname,
      region,
      endpoint,
    } = stsResult.data;

    try {
      const ossClient = new OSS({
        region: region.replace(/^oss-/, ''), // Strip "oss-" prefix
        accessKeyId: access_key_id,
        accessKeySecret: access_key_secret,
        stsToken: security_token,
        bucket: bucketname,
        endpoint,
        secure: true,
      });

      await ossClient.put(file_path, file.buffer, {
        headers: { 'Content-Type': file.mimetype },
      });
    } catch (error: any) {
      const errorText = error.message;
      logger.error(`[Qwen Upload] OSS upload failed | error=${errorText}`);
      throw new Error(`OSS upload failed: ${errorText}`);
    }

    // Step 3: Poll for file parse status (chỉ cần cho file document - PDF, DOC, etc.)
    // File ảnh thường không cần parse, trả về ngay
    if (fileType === 'image') {
      return {
        id: file_id,
        url: file_url,
        token_usage: 0,
      };
    }

    // Poll parse status cho file document
    let attempts = 0;
    const maxAttempts = UPLOAD_CONFIG.POLLING_MAX_ATTEMPTS;

    while (attempts < maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, UPLOAD_CONFIG.POLLING_INTERVAL_MS),
      );
      attempts++;

      try {
        const statusRes = await client.post(API_PATHS.FILE_PARSE_STATUS, {
          [API_FIELDS.FILE_IDS]: [file_id],
        });

        if (statusRes.ok) {
          const statusData =
            (await statusRes.json()) as FileParseStatusResponse;

          if (
            statusData.success &&
            statusData.data &&
            statusData.data.length > 0
          ) {
            const fileStatus = statusData.data[0];
            const status = fileStatus.status;

            if (
              status === FILE_STATUS.SUCCESS ||
              status === FILE_STATUS.READY
            ) {
              return {
                id: file_id,
                url: file_url,
                token_usage: fileStatus.token_usage || 0,
              };
            }

            if (status === FILE_STATUS.FAIL || status === FILE_STATUS.ERROR) {
              logger.error(
                `[Qwen Upload] File processing failed | fileId=${file_id} | status=${status}`,
              );
              throw new Error(`File processing failed: ${status}`);
            }
          } else {
            logger.warn(
              `[Qwen Upload] No file status data in response | attempt=${attempts}`,
            );
          }
        } else {
          logger.warn(
            `[Qwen Upload] Failed to fetch file status | status=${statusRes.status} | attempt=${attempts}`,
          );
        }
      } catch (e) {
        const err = e as Error;
        logger.error(
          `[Qwen Upload] Failed to check file status | fileId=${file_id} | attempt=${attempts}`,
          {
            error: err.message,
            stack: err.stack,
            fileId: file_id,
            attempt: attempts,
          },
        );
      }
    }

    // Max attempts reached, return with 0 token usage
    logger.warn(
      `[Qwen Upload] Max polling attempts reached | fileId=${file_id} | attempts=${attempts}`,
    );
    return { id: file_id, url: file_url, token_usage: 0 };
  } catch (error) {
    const err = error as Error;
    logger.error('[Qwen Upload] Unhandled error', {
      error: err.message,
      stack: err.stack,
      filename: file.originalname,
    });
    throw error;
  }
}
