/**
 * ------------------------------------------------------------------
 * DeepSeek File Upload
 * ------------------------------------------------------------------
 * Upload file lên DeepSeek API. Hỗ trợ giải PoW challenge,
 * multipart/form-data upload, và polling để chờ file được xử lý.
 *
 * Main functions:
 * - deepseekUploadFile() : Upload file và trả về file_id + token_usage
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// ── Utils ──
import { HttpClient } from '../../utils/http-client';
import { createLogger } from '../../utils/logger';

// ── Types ──
import {
  DeepSeekApiEnvelope,
  DeepSeekFileItem,
  UploadFileInput,
  UploadResult,
  PoWChallenge,
} from './deepseek.types';

// ── DeepSeek Imports ──
import { DeepSeekHash, solvePoW } from './deepseek.pow';
import {
  BASE_URL,
  API_PATHS,
  USER_AGENTS,
  COOKIE_CONFIG,
  HTTP_HEADERS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  CONTENT_DISPOSITION,
  REFERER_PATHS,
  API_FIELDS,
  SUCCESS_CODE,
  FILE_STATUS,
  UPLOAD_CONFIG,
} from './deepseek.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DeepSeekUpload');

// ─── Helpers ────────────────────────────────────────────────────────────

function createUploadClient(credential: string): HttpClient {
  return new HttpClient({
    baseURL: BASE_URL,
    headers: {
      [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${credential}`,
      [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.LINUX_CHROME,
      [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
      [HTTP_HEADER_NAMES.X_CLIENT_LOCALE]: HTTP_HEADERS.X_CLIENT_LOCALE,
      [HTTP_HEADER_NAMES.X_CLIENT_VERSION]:
        HTTP_HEADERS.X_CLIENT_VERSION_UPLOAD,
      [HTTP_HEADER_NAMES.X_CLIENT_PLATFORM]: HTTP_HEADERS.X_CLIENT_PLATFORM,
      [HTTP_HEADER_NAMES.X_CLIENT_BUNDLE_ID]: HTTP_HEADERS.X_CLIENT_BUNDLE_ID,
      [HTTP_HEADER_NAMES.X_CLIENT_TIMEZONE_OFFSET]:
        HTTP_HEADERS.X_CLIENT_TIMEZONE_OFFSET,
      [HTTP_HEADER_NAMES.X_MODEL_TYPE]: HTTP_HEADERS.X_MODEL_TYPE_DEFAULT,
      [HTTP_HEADER_NAMES.X_THINKING_ENABLED]: HTTP_HEADERS.X_THINKING_ENABLED_OFF,
    },
  });
}

// ─── Main Function ─────────────────────────────────────────────────────

export async function deepseekUploadFile(
  credential: string,
  file: UploadFileInput,
  getDsHash: () => Promise<DeepSeekHash>,
): Promise<UploadResult> {
  const baseHeaders = {
    [HTTP_HEADER_NAMES.AUTHORIZATION]: `${COOKIE_CONFIG.BEARER_PREFIX}${credential}`,
    [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENTS.LINUX_CHROME,
    [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
  };

  const client = createUploadClient(credential);

  try {
    const challengeRes = await client.post(
      API_PATHS.CHAT_CREATE_POW_CHALLENGE,
      { target_path: API_PATHS.FILE_UPLOAD },
    );

    let powResponseBase64 = '';
    if (challengeRes.ok) {
      try {
        const challengeJson =
          (await challengeRes.json()) as DeepSeekApiEnvelope<{
            challenge: PoWChallenge;
          }>;
        const challengeData =
          challengeJson?.[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[
            API_FIELDS.CHALLENGE
          ];

        if (challengeData) {
          const dsHash = await getDsHash();
          const powAnswer = await solvePoW(dsHash, challengeData);
          powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
            'base64',
          );
        } else {
          logger.warn('[DeepSeek Upload] No challenge data in response');
        }
      } catch (e) {
        logger.error(
          '[DeepSeek Upload] Failed to parse PoW challenge response',
          {
            error: e,
          },
        );
      }
    } else {
      logger.warn(
        `[DeepSeek Upload] PoW challenge request failed | status=${challengeRes.status}`,
      );
    }

    const boundary =
      UPLOAD_CONFIG.FORM_BOUNDARY_PREFIX +
      crypto.randomBytes(UPLOAD_CONFIG.BOUNDARY_RANDOM_BYTES).toString('hex');
    const crlf = UPLOAD_CONFIG.CRLF;
    const header = `--${boundary}${crlf}${CONTENT_DISPOSITION.FORM_DATA} name="${UPLOAD_CONFIG.FORM_FIELD_NAME}"; filename="${file.originalname}"${crlf}${HTTP_HEADER_NAMES.CONTENT_TYPE}: ${file.mimetype}${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;
    const payloadBuffer = Buffer.concat([
      Buffer.from(header),
      file.buffer,
      Buffer.from(footer),
    ]);

    const headers: Record<string, string> = {
      ...baseHeaders,
      [HTTP_HEADER_NAMES.CONTENT_TYPE]: `${CONTENT_TYPES.MULTIPART_PREFIX}${boundary}`,
      [HTTP_HEADER_NAMES.X_CLIENT_LOCALE]: HTTP_HEADERS.X_CLIENT_LOCALE,
      [HTTP_HEADER_NAMES.X_CLIENT_VERSION]:
        HTTP_HEADERS.X_CLIENT_VERSION_UPLOAD,
      [HTTP_HEADER_NAMES.X_CLIENT_PLATFORM]: HTTP_HEADERS.X_CLIENT_PLATFORM,
      [HTTP_HEADER_NAMES.X_CLIENT_BUNDLE_ID]: HTTP_HEADERS.X_CLIENT_BUNDLE_ID,
      [HTTP_HEADER_NAMES.X_FILE_SIZE]: file.buffer.length.toString(),
      [HTTP_HEADER_NAMES.X_MODEL_TYPE]: HTTP_HEADERS.X_MODEL_TYPE_DEFAULT,
      [HTTP_HEADER_NAMES.X_THINKING_ENABLED]: HTTP_HEADERS.X_THINKING_ENABLED_OFF,
      [HTTP_HEADER_NAMES.X_CLIENT_TIMEZONE_OFFSET]:
        HTTP_HEADERS.X_CLIENT_TIMEZONE_OFFSET,
    };

    if (powResponseBase64) {
      headers[HTTP_HEADER_NAMES.X_DS_POW_RESPONSE] = powResponseBase64;
    }

    const uploadRes = await fetch(`${BASE_URL}${API_PATHS.FILE_UPLOAD}`, {
      method: 'POST',
      headers,
      body: payloadBuffer,
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      logger.error(
        `[DeepSeek Upload] Upload request failed | status=${uploadRes.status} | error=${errorText}`,
      );
      throw new Error(
        `DeepSeek Upload Failed ${uploadRes.status}: ${errorText}`,
      );
    }

    const result =
      (await uploadRes.json()) as DeepSeekApiEnvelope<{ id: string }>;
    const fileId = result[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[
      API_FIELDS.ID
    ];
    if (result[API_FIELDS.CODE] === SUCCESS_CODE && fileId) {

      let attempts = 0;
      const maxAttempts = UPLOAD_CONFIG.POLLING_MAX_ATTEMPTS;

      while (attempts < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, UPLOAD_CONFIG.POLLING_INTERVAL_MS),
        );
        attempts++;

        try {
          const listRes = await client.get(
            `${API_PATHS.FILE_FETCH_FILES}?${API_FIELDS.FILE_IDS}=${fileId}`,
          );

          if (listRes.ok) {
            const listData =
              (await listRes.json()) as DeepSeekApiEnvelope<{
                files: DeepSeekFileItem[];
              }>;
            const files: DeepSeekFileItem[] =
              listData?.[API_FIELDS.DATA]?.[API_FIELDS.BIZ_DATA]?.[
                API_FIELDS.FILES
              ] || [];
            const targetFile = files.find(
              (f) => f[API_FIELDS.ID] === fileId,
            );

            if (targetFile) {
              const status = targetFile[API_FIELDS.STATUS];
              if (
                status === FILE_STATUS.SUCCESS ||
                status === FILE_STATUS.READY
              ) {
                return {
                  id: fileId,
                  token_usage: targetFile[API_FIELDS.TOKEN_USAGE] || 0,
                };
              }
              if (
                status === FILE_STATUS.FAIL ||
                status === FILE_STATUS.ERROR
              ) {
                logger.error(
                  `[DeepSeek Upload] File processing failed | fileId=${fileId} | status=${status}`,
                );
                throw new Error(`File processing failed: ${status}`);
              }
            } else {
              logger.warn(
                `[DeepSeek Upload] File not found in response | fileId=${fileId} | attempt=${attempts}`,
              );
            }
          } else {
            logger.warn(
              `[DeepSeek Upload] Failed to fetch file status | status=${listRes.status} | attempt=${attempts}`,
            );
          }
        } catch (e) {
          const err = e as Error;
          logger.error(
            `[DeepSeek Upload] Failed to check file status | fileId=${fileId} | attempt=${attempts}`,
            {
              error: err.message,
              stack: err.stack,
              fileId,
              attempt: attempts,
            },
          );
        }
      }

      logger.warn(
        `[DeepSeek Upload] Max polling attempts reached | fileId=${fileId} | attempts=${attempts}`,
      );
      return { id: fileId, token_usage: 0 };
    } else {
      const errorMsg = result[API_FIELDS.MSG] || 'Unknown error';
      logger.error(
        `[DeepSeek Upload] Upload failed | code=${result[API_FIELDS.CODE]} | msg=${errorMsg}`,
      );
      throw new Error(`Upload failed: ${errorMsg}`);
    }
  } catch (error) {
    const err = error as Error;
    logger.error('[DeepSeek Upload] Unhandled error', {
      error: err.message,
      stack: err.stack,
      filename: file.originalname,
    });
    throw error;
  }
}