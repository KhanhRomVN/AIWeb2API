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

// ── DeepSeek Imports ──
import { DeepSeekHash, solvePoW } from './deepseek.pow';
import { BASE_URL } from './deepseek.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('DeepSeekUpload');

// ─── Helpers ────────────────────────────────────────────────────────────

function createUploadClient(credential: string): HttpClient {
  return new HttpClient({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${credential}`,
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      Referer: `${BASE_URL}/`,
      'x-client-locale': 'en_US',
      'x-client-version': '2.4.0',
      'x-client-platform': 'web',
      'x-client-bundle-id': 'com.deepseek.chat',
      'x-client-timezone-offset': '25200',
      'x-model-type': 'default',
      'x-thinking-enabled': '0',
    },
  });
}

// ─── Main Function ─────────────────────────────────────────────────────

export async function deepseekUploadFile(
  credential: string,
  file: any,
  getDsHash: () => Promise<DeepSeekHash>,
): Promise<{ id: string; token_usage: number }> {
  logger.info(`[DeepSeek Upload] Starting upload | filename=${file.originalname} | size=${file.size} | mimetype=${file.mimetype}`);

  const baseHeaders = {
    Authorization: `Bearer ${credential}`,
    'User-Agent':
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    Referer: `${BASE_URL}/`,
  };

  const client = createUploadClient(credential);

  try {
    logger.info('[DeepSeek Upload] Requesting PoW challenge');
    const challengeRes = await client.post(
      '/api/v0/chat/create_pow_challenge',
      { target_path: '/api/v0/file/upload_file' },
    );

    logger.info(`[DeepSeek Upload] PoW challenge response | status=${challengeRes.status} | ok=${challengeRes.ok}`);

    let powResponseBase64 = '';
    if (challengeRes.ok) {
      try {
        const challengeJson = await challengeRes.json();
        logger.debug(`[DeepSeek Upload] Challenge JSON | data=${JSON.stringify(challengeJson)}`);
        const challengeData = challengeJson?.data?.biz_data?.challenge;

        if (challengeData) {
          logger.info('[DeepSeek Upload] Solving PoW challenge');
          const dsHash = await getDsHash();
          const powAnswer = await solvePoW(dsHash, challengeData);
          powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
            'base64',
          );
          logger.info('[DeepSeek Upload] PoW challenge solved');
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
      logger.warn(`[DeepSeek Upload] PoW challenge request failed | status=${challengeRes.status}`);
    }

    logger.info('[DeepSeek Upload] Building multipart payload');
    const boundary =
      '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    const crlf = '\r\n';
    const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${file.originalname}"${crlf}Content-Type: ${file.mimetype}${crlf}${crlf}`;
    const footer = `${crlf}--${boundary}--${crlf}`;
    const payloadBuffer = Buffer.concat([
      Buffer.from(header),
      file.buffer,
      Buffer.from(footer),
    ]);

    logger.info(`[DeepSeek Upload] Payload prepared | payloadSize=${payloadBuffer.length} | boundary=${boundary}`);

    const headers: any = {
      ...baseHeaders,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'x-client-locale': 'en_US',
      'x-client-version': '2.4.0',
      'x-client-platform': 'web',
      'x-client-bundle-id': 'com.deepseek.chat',
      'x-file-size': file.buffer.length.toString(),
      'x-model-type': 'default',
      'x-thinking-enabled': '0',
      'x-client-timezone-offset': '25200',
    };

    if (powResponseBase64) {
      headers['X-Ds-Pow-Response'] = powResponseBase64;
      logger.info('[DeepSeek Upload] PoW response added to headers');
    }

    logger.info(`[DeepSeek Upload] Sending upload request | url=${BASE_URL}/api/v0/file/upload_file`);
    logger.debug(`[DeepSeek Upload] Headers | ${JSON.stringify({ ...headers, Authorization: '[REDACTED]' })}`);

    const uploadRes = await fetch(`${BASE_URL}/api/v0/file/upload_file`, {
      method: 'POST',
      headers,
      body: payloadBuffer,
    });

    logger.info(`[DeepSeek Upload] Upload response received | status=${uploadRes.status} | ok=${uploadRes.ok}`);

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      logger.error(`[DeepSeek Upload] Upload request failed | status=${uploadRes.status} | error=${errorText}`);
      throw new Error(
        `DeepSeek Upload Failed ${uploadRes.status}: ${errorText}`,
      );
    }

    const result: any = await uploadRes.json();
    logger.info(`[DeepSeek Upload] Response parsed | code=${result.code}`);
    logger.debug(`[DeepSeek Upload] Full response | ${JSON.stringify(result)}`);

    if (result.code === 0 && result.data?.biz_data?.id) {
      const fileId = result.data.biz_data.id;
      logger.info(`[DeepSeek Upload] File uploaded, waiting for processing | fileId=${fileId}`);
      
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
        
        try {
          logger.debug(`[DeepSeek Upload] Checking file status | fileId=${fileId} | attempt=${attempts}/${maxAttempts}`);
          const listRes = await client.get(
            `/api/v0/file/fetch_files?file_ids=${fileId}`,
          );
          
          logger.debug(`[DeepSeek Upload] Status check response | status=${listRes.status} | ok=${listRes.ok}`);
          
          if (listRes.ok) {
            const listData = await listRes.json();
            const files = listData?.data?.biz_data?.files || [];
            const targetFile = files.find((f: any) => f.id === fileId);

            if (targetFile) {
              logger.info(`[DeepSeek Upload] File status | fileId=${fileId} | status=${targetFile.status} | attempt=${attempts}`);
              
              if (
                targetFile.status === 'SUCCESS' ||
                targetFile.status === 'READY'
              ) {
                logger.info(`[DeepSeek Upload] Upload completed successfully | fileId=${fileId} | token_usage=${targetFile.token_usage || 0}`);
                return {
                  id: fileId,
                  token_usage: targetFile.token_usage || 0,
                };
              }
              if (
                targetFile.status === 'FAIL' ||
                targetFile.status === 'ERROR'
              ) {
                logger.error(`[DeepSeek Upload] File processing failed | fileId=${fileId} | status=${targetFile.status}`);
                throw new Error(`File processing failed: ${targetFile.status}`);
              }
            } else {
              logger.warn(`[DeepSeek Upload] File not found in response | fileId=${fileId} | attempt=${attempts}`);
            }
          } else {
            logger.warn(`[DeepSeek Upload] Failed to fetch file status | status=${listRes.status} | attempt=${attempts}`);
          }
        } catch (e: any) {
          logger.error(
            `[DeepSeek Upload] Failed to check file status | fileId=${fileId} | attempt=${attempts}`,
            {
              error: e.message,
              stack: e.stack,
              fileId,
              attempt: attempts,
            },
          );
        }
      }
      
      logger.warn(`[DeepSeek Upload] Max polling attempts reached | fileId=${fileId} | attempts=${attempts}`);
      return { id: fileId, token_usage: 0 };
    } else {
      const errorMsg = result.msg || 'Unknown error';
      logger.error(`[DeepSeek Upload] Upload failed | code=${result.code} | msg=${errorMsg}`);
      throw new Error(`Upload failed: ${errorMsg}`);
    }
  } catch (error: any) {
    logger.error('[DeepSeek Upload] Unhandled error', {
      error: error.message,
      stack: error.stack,
      filename: file.originalname,
    });
    throw error;
  }
}
