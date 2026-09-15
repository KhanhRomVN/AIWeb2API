(base) khanhromvn@UbuntuLTS:~/Documents/Coding/AIWeb2API & Zen/AIWeb2API$ npm run start

> AIWeb2API@1.2.5 start
> ts-node --transpile-only -r tsconfig-paths/register -r dotenv/config src/index.ts

(node:32018) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
[INFO] [src/provider/qwen/qwen.upload.ts:113] [Qwen Upload] Requesting STS token {"filename":"image.png","filesize":325617,"filetype":"image"}
[INFO] [src/provider/qwen/qwen.upload.ts:151] [Qwen Upload] STS token received {"file_id":"6d919d9a-1a41-4d12-bbfa-2772a029a4c2","file_path":"5b51329c-3691-4101-8f2c-4e5c2edeb21f/6d919d9a-1a41-4d12-bbfa-2772a029a4c2_image.png","endpoint":"oss-accelerate.aliyuncs.com"}
[INFO] [src/provider/qwen/qwen.upload.ts:159] [Qwen Upload] Uploading to OSS with SDK {"bucket":"qwen-webui-prod","file_path":"5b51329c-3691-4101-8f2c-4e5c2edeb21f/6d919d9a-1a41-4d12-bbfa-2772a029a4c2_image.png","endpoint":"oss-accelerate.aliyuncs.com","region":"oss-ap-southeast-1"}
It's recommended to set 'refreshSTSToken' and 'refreshSTSTokenInterval' to refresh stsToken、accessKeyId、accessKeySecret automatically when sts token has expired
[INFO] [src/provider/qwen/qwen.upload.ts:181] [Qwen Upload] Upload to OSS successful {"file_id":"6d919d9a-1a41-4d12-bbfa-2772a029a4c2"}
[INFO] [src/provider/qwen/qwen.upload.ts:191] [Qwen Upload] Image file - no parsing needed {"file_id":"6d919d9a-1a41-4d12-bbfa-2772a029a4c2"}
[ERROR] [src/provider/qwen/qwen.provider.ts:1181] [Qwen] handleMessage error: [Qwen] ref_file_ids contains string "6d919d9a-1a41-4d12-bbfa-2772a029a4c2". Must send object { file_id, url, ... } to build valid file object.
[ERROR] [src/controllers/chat.controller.ts:317] [Transaction Error] provider_id=qwen model_id=qwen3.7-plus account_id=e1d8a9d1-2a67-4088-af64-606db6085a98 conversation_id=none input_token=10185 output_token=0 error=[Qwen] ref_file_ids contains string "6d919d9a-1a41-4d12-bbfa-2772a029a4c2". Must send object { file_id, url, ... } to build valid file object. {"stack":"Error: [Qwen] ref_file_ids contains string \"6d919d9a-1a41-4d12-bbfa-2772a029a4c2\". Must send object { file_id, url, ... } to build valid file object.\n    at /home/khanhromvn/Documents/Coding/AIWeb2API & Zen/AIWeb2API/src/provider/qwen/qwen.provider.ts:750:23\n    at Array.map (<anonymous>)\n    at QwenProvider.handleMessage (/home/khanhromvn/Documents/Coding/AIWeb2API & Zen/AIWeb2API/src/provider/qwen/qwen.provider.ts:748:71)\n    at processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async sendMessage (/home/khanhromvn/Documents/Coding/AIWeb2API & Zen/AIWeb2API/src/services/chat.service.ts:105:12)\n    at async sendMessage (/home/khanhromvn/Documents/Coding/AIWeb2API & Zen/AIWeb2API/src/controllers/chat.controller.ts:199:7)"}
[WARN] [src/services/metrics.service.ts:78] Recorded error metric for qwen/qwen3.7-plus: [Qwen] ref_file_ids contains string "6d919d9a-1a41-4d12-bbfa-2772a029a4c2". Must send object { file_id, url, ... } to build valid file object.


src/provider/qwen/qwen.upload.ts:
```
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

    logger.info('[Qwen Upload] Requesting STS token', {
      filename: file.originalname,
      filesize: file.buffer.length,
      filetype: fileType,
    });

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

    logger.info('[Qwen Upload] STS token received', {
      file_id,
      file_path,
      endpoint,
    });

    // Step 2: Upload file to OSS với SDK ali-oss
    // SDK tự xử lý SigV4 đúng theo chuẩn Alibaba OSS4
    logger.info('[Qwen Upload] Uploading to OSS with SDK', {
      bucket: bucketname,
      file_path,
      endpoint,
      region,
    });

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

      logger.info('[Qwen Upload] Upload to OSS successful', { file_id });
    } catch (error: any) {
      const errorText = error.message;
      logger.error(`[Qwen Upload] OSS upload failed | error=${errorText}`);
      throw new Error(`OSS upload failed: ${errorText}`);
    }

    // Step 3: Poll for file parse status (chỉ cần cho file document - PDF, DOC, etc.)
    // File ảnh thường không cần parse, trả về ngay
    if (fileType === 'image') {
      logger.info('[Qwen Upload] Image file - no parsing needed', { file_id });
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

          // Debug: log raw response
          logger.debug('[Qwen Upload] Parse status response', {
            success: statusData.success,
            hasData: !!statusData.data,
            dataLength: statusData.data?.length || 0,
            rawData: statusData.data,
            message: statusData.message,
          });

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
              logger.info('[Qwen Upload] File processing completed', {
                file_id,
                token_usage: fileStatus.token_usage,
              });
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

            // Status is still processing, continue polling
            logger.debug('[Qwen Upload] File still processing', {
              file_id,
              status,
              attempt: attempts,
            });
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

```

---

src/provider/qwen/qwen.provider.ts:
```
/**
 * ------------------------------------------------------------------
 * Qwen Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Qwen AI (Alibaba Cloud).
 * Hỗ trợ login qua browser, chat completion với streaming,
 * thinking mode, search, và token auto-refresh.
 *
 * Main features:
 * - login()                : Đăng nhập qua browser
 * - handleMessage()        : Gửi tin nhắn với streaming response
 * - refreshToken()         : Tự động refresh token khi hết hạn
 * - getModels()            : Lấy danh sách models từ API hoặc fallback
 * - getUserProfile()           : Lấy thông tin user profile
 * - Session locking        : Ngăn concurrent requests trên cùng session
 * - Parent ID caching      : Cache parent_id để tránh lỗi sibling
 *
 * Credential format (JSON string hoặc raw JWT):
 * - accessToken         : JWT access token (tự động refresh qua API)
 *
 * Note: Qwen CHỈ dùng accessToken qua Authorization header.
 *       KHÔNG dùng Cookie hay User-Agent.
 *       Token được refresh bằng cách gửi accessToken hiện tại lên /api/v1/auths/
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Database ──
import { getDb } from '../../database';
import { updateAccountCredential } from '../../repositories/account.repository';

// ── Utils ──
import { createLogger } from '../../utils/logger';
import {
  getJwtExpiry,
  isJwtExpired,
  isJwtExpiringSoon,
  coordinateTokenRefresh,
  DEFAULT_REFRESH_THRESHOLD_SEC,
} from '../../utils/jwt-helper';

// ── Qwen Imports ──
import { proxyHandler } from './qwen.proxy-handler';
import { qwenUploadFile } from './qwen.upload';

import { QwenStreamingThinkingParser } from './qwen.sse-parser';
import { createQwenThinkingParser } from './qwen.thinking-parser';
import type { QwenCredential } from './qwen.types';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  IS_MEMORY,
  BASE_URL,
  QWEN_EVENTS,
  API_VERSION,
  BX_VERSION,
  USER_AGENT,
  API_PATHS,
  REFERER_PATHS,
  HTTP_HEADER_NAMES,
  HTTP_HEADER_NAMES_LOWERCASE,
  CONTENT_TYPES,
  ACCEPT_VALUES,
  ACCEPT_LANGUAGES,
  SEC_CH_UA,
  AUTH_PREFIXES,
  TOKEN_COOKIE_KEY,
  REGEX_PATTERNS,
  SSE_PROTOCOL,
  AUTH_FIELDS,
  CREATE_CHAT_FIELDS,
  CHAT_PAYLOAD_FIELDS,
  SSE_EVENT_FIELDS,
  RESPONSE_FIELDS,
  MODEL_FIELDS,
  CHAT_PAYLOAD_CONSTANTS,
  SSE_PHASE_TYPES,
  DEFAULT_MAX_CONTEXT_LENGTH,
  DEFAULT_TIMEOUT_MS,
  TIMEZONE_OFFSET,
  DB_PROVIDER_ID,
  MODEL_PREFIX_QWEN_DASH,
  MODEL_PREFIX_QWEN_3,
  CHATS_LIST_QUERY,
  PROVIDER_DESCRIPTION,
  PROVIDER_COLOR,
} from './qwen.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenProvider');

// ─── Session Lock ──────────────────────────────────────────────────────

const sessionLocks = new Map<string, Promise<void>>();

function acquireLock(key: string): {
  promise: Promise<void>;
  release: () => void;
} {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = sessionLocks.get(key) ?? Promise.resolve();
  sessionLocks.set(
    key,
    previous.then(() => next),
  );
  return { promise: previous, release };
}

// ─── Parent ID Cache ───────────────────────────────────────────────────

const lastParentIdCache = new Map<string, string>();

// ─── Provider Class ────────────────────────────────────────────────────

export class QwenProvider implements Provider {
  name = PROVIDER_NAME;
  proxyHandler = proxyHandler;

  // ─── Provider Configuration ────────────────────────────────────────
  static config = {
    provider_id: PROVIDER_ID,
    provider_name: PROVIDER_NAME,
    is_enabled: IS_ENABLED,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
    description: PROVIDER_DESCRIPTION,
    color: PROVIDER_COLOR,
  };

  // ─── Token Helpers ─────────────────────────────────────────────────

  private parseCredential(credential: string): {
    token: string | null;
    cookieValue: string;
    bxUa: string;
    bxUmidToken: string;
    userAgent: string;
  } {
    // Try parsing as JSON first
    if (credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential);

        // New format: {accessToken, ...} or old format: {token, bxUa, ...}
        const token =
          parsed[AUTH_FIELDS.ACCESS_TOKEN] ||
          parsed[AUTH_FIELDS.ACCESS_TOKEN_SNAKE] ||
          parsed[AUTH_FIELDS.TOKEN] ||
          null;

        return {
          token,
          cookieValue: token ? `${TOKEN_COOKIE_KEY}=${token}` : '',
          bxUa: parsed[AUTH_FIELDS.BX_UA] || '',
          bxUmidToken: parsed[AUTH_FIELDS.BX_UMIDTOKEN] || '',
          userAgent: parsed[AUTH_FIELDS.USER_AGENT] || USER_AGENT,
        };
      } catch {
        logger.warn(
          '[Qwen] Credential is not valid JSON, treating as raw token',
        );
      }
    }

    // Check if raw JWT token
    if (credential.trim().startsWith(AUTH_PREFIXES.JWT)) {
      const token = credential.trim();
      return {
        token,
        cookieValue: `${TOKEN_COOKIE_KEY}=${token}`,
        bxUa: '',
        bxUmidToken: '',
        userAgent: USER_AGENT,
      };
    }

    // Try extracting from cookie format: token=eyJ...
    const m = credential.match(REGEX_PATTERNS.COOKIE_TOKEN);
    if (m && m[1]) {
      return {
        token: m[1],
        cookieValue: credential,
        bxUa: '',
        bxUmidToken: '',
        userAgent: USER_AGENT,
      };
    }

    // Fallback: treat as raw token
    return {
      token: credential,
      cookieValue: `${TOKEN_COOKIE_KEY}=${credential}`,
      bxUa: '',
      bxUmidToken: '',
      userAgent: USER_AGENT,
    };
  }

  private extractToken(credential: string): string | null {
    return this.parseCredential(credential).token;
  }

  // JWT helpers are now in shared utils/jwt-helper.ts

  private async performTokenRefresh(
    credential: string,
  ): Promise<string | null> {
    const accessToken = this.extractToken(credential);
    if (!accessToken) return null;

    try {
      const response = await fetch(`${BASE_URL}${API_PATHS.AUTH_SESSION}`, {
        method: 'GET',
        headers: {
          [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${accessToken}`,
          [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT]: ACCEPT_VALUES.JSON,
          [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT_LANGUAGE]:
            ACCEPT_LANGUAGES.EN_US_Q09,
          [HTTP_HEADER_NAMES_LOWERCASE.SOURCE]: 'web',
          [HTTP_HEADER_NAMES_LOWERCASE.VERSION]: API_VERSION,
        },
      });

      if (!response.ok) {
        logger.warn(`[Qwen] Token refresh failed: HTTP ${response.status}`);
        return null;
      }

      const json: any = await response.json();
      const userData = json.data ?? json;
      const newAccessToken: string | undefined = userData?.token;

      if (!newAccessToken) {
        logger.warn('[Qwen] Token refresh response had no token field');
        return null;
      }

      if (newAccessToken === accessToken) {
        return JSON.stringify({ accessToken: newAccessToken });
      }

      const email: string | undefined = userData?.email;
      if (email) {
        try {
          const db = getDb();
          const accounts = db
            .prepare(
              'SELECT * FROM accounts WHERE LOWER(provider_id) = ? AND LOWER(email) = ?',
            )
            .all(DB_PROVIDER_ID, email.toLowerCase()) as any[];
          for (const acc of accounts) {
            updateAccountCredential(
              acc.id,
              JSON.stringify({ accessToken: newAccessToken }),
            );
          }
        } catch (e) {
          logger.error('[Qwen] Failed to persist refreshed token to DB:', e);
        }
      }

      return JSON.stringify({ accessToken: newAccessToken });
    } catch (e) {
      logger.error('[Qwen] Token refresh error:', e);
      return null;
    }
  }

  async refreshToken(credential: string): Promise<string | null> {
    const accessToken = this.extractToken(credential);
    if (!accessToken) return null;

    // Use coordinated refresh to prevent duplicate refresh operations
    return coordinateTokenRefresh('qwen', accessToken, () =>
      this.performTokenRefresh(credential),
    );
  }

  private async getFreshCredential(credential: string): Promise<string> {
    const accessToken = this.extractToken(credential);
    if (!accessToken) return credential;

    // Check if token is already expired
    if (isJwtExpired(accessToken)) {
      logger.error('[Qwen] Token has already expired. Please login again.');
      throw new Error('Token has expired. Please login again to Qwen.');
    }

    // Check if token is expiring soon (within 5 minutes by default)
    if (!isJwtExpiringSoon(accessToken, DEFAULT_REFRESH_THRESHOLD_SEC)) {
      return credential;
    }

    const newAccessToken = await this.refreshToken(credential);
    if (!newAccessToken) {
      logger.error(
        '[Qwen] Token refresh failed - token may be expired. Please login again.',
      );
      throw new Error('Token refresh failed. Please login again to Qwen.');
    }

    return newAccessToken;
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    let capturedHeaders: Record<string, string> = {};
    const self = this;

    const onHeaders = (headers: Record<string, string>) => {
      capturedHeaders = { ...capturedHeaders, ...headers };
    };

    proxyEvents.on(QWEN_EVENTS.HEADERS, onHeaders);

    try {
      return await loginService.captureCredentialsViaCDP({
        providerId: PROVIDER_ID,
        loginUrl: `${BASE_URL}${API_PATHS.AUTH_LOGIN}`,
        partition: `${PROVIDER_ID}-${Date.now()}`,
        cookieEvent: QWEN_EVENTS.LOGIN_TOKEN,
        infoEvent: QWEN_EVENTS.LOGIN_EMAIL,
        extraEvents: [QWEN_EVENTS.HEADERS, QWEN_EVENTS.COOKIES],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          // Extract access token
          const accessToken = data.cookies.trim().startsWith(AUTH_PREFIXES.JWT)
            ? data.cookies.trim()
            : (data.cookies.match(REGEX_PATTERNS.RAW_TOKEN) || [])[1] ||
              data.cookies;

          if (!accessToken || !accessToken.startsWith(AUTH_PREFIXES.JWT)) {
            logger.warn('[Qwen] Login validation failed: invalid token format');
            return { isValid: false };
          }

          let email = data.email || null;

          // Try fetching profile to get email
          if (!email) {
            try {
              const profile = await this.getUserProfile(
                accessToken,
                capturedHeaders,
              );
              if (profile.email) {
                email = profile.email;
              }
            } catch (e) {
              logger.warn('[Qwen] Login profile fetch failed:', e);
            }
          }

          return {
            isValid: true,
            cookies: JSON.stringify({ accessToken }), // Return JSON format
            email,
            headers: capturedHeaders,
          };
        },
      });
    } finally {
      proxyEvents.off(QWEN_EVENTS.HEADERS, onHeaders);
    }
  }

  // ─── List Chats ─────────────────────────────────────────────────────

  private async fetchListChats(credential: string): Promise<void> {
    try {
      const accessToken = this.extractToken(credential);

      if (!accessToken) {
        logger.warn('[Qwen] Cannot fetch list chats: no token found');
        return;
      }

      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${accessToken}`,
        [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT]: ACCEPT_VALUES.JSON_TEXT_PLAIN_ANY,
        [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT_LANGUAGE]:
          ACCEPT_LANGUAGES.EN_US_Q09,
        [HTTP_HEADER_NAMES_LOWERCASE.SOURCE]: 'web',
        [HTTP_HEADER_NAMES_LOWERCASE.VERSION]: API_VERSION,
        [HTTP_HEADER_NAMES_LOWERCASE.BX_V]: BX_VERSION,
        [HTTP_HEADER_NAMES_LOWERCASE.X_REQUEST_ID]: crypto.randomUUID(),
        [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]: SEC_CH_UA.PLATFORM,
        [HTTP_HEADER_NAMES.SEC_CH_UA]: SEC_CH_UA.VALUE,
        [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]: SEC_CH_UA.MOBILE,
      };

      const response = await fetch(
        `${BASE_URL}${API_PATHS.CHATS}${CHATS_LIST_QUERY}`,
        { headers },
      );

      if (response.ok) {
      } else {
        logger.warn(`[Qwen] Failed to fetch list chats: ${response.status}`);
      }
    } catch (error) {
      logger.error('[Qwen] Error fetching list chats:', error);
      throw error;
    }
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
    extraHeaders?: any,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const accessToken = this.extractToken(credential);

      if (!accessToken) {
        logger.warn('[Qwen] Cannot get profile: no token found');
        return { email: null };
      }

      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${accessToken}`,
        [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT]: ACCEPT_VALUES.JSON,
        [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT_LANGUAGE]:
          ACCEPT_LANGUAGES.EN_US_Q09,
        [HTTP_HEADER_NAMES_LOWERCASE.SOURCE]: 'web',
        [HTTP_HEADER_NAMES_LOWERCASE.VERSION]: API_VERSION,
      };

      const response = await fetch(`${BASE_URL}${API_PATHS.AUTH_SESSION}`, {
        headers,
      });

      if (response.ok) {
        const json: any = await response.json();
        const userData = json[AUTH_FIELDS.DATA] ?? json;
        if (!userData?.[AUTH_FIELDS.EMAIL]) {
          logger.warn('[Qwen] Get Profile response missing email field');
        }
        return {
          email: userData?.[AUTH_FIELDS.EMAIL] || null,
          name: userData?.[AUTH_FIELDS.NAME],
          id: userData?.[AUTH_FIELDS.ID],
        };
      }
      logger.warn(`[Qwen] Get Profile returned status ${response.status}`);
      return { email: null };
    } catch (e) {
      logger.error('[Qwen] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Create Chat ────────────────────────────────────────────────────

  private async createChat(credential: string, model: string): Promise<string> {
    const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
      this.parseCredential(credential);

    if (!token) {
      throw new Error('[Qwen] Cannot create chat: no token found');
    }

    const headers: Record<string, string> = {
      [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT]: ACCEPT_VALUES.JSON_TEXT_PLAIN_ANY,
      [HTTP_HEADER_NAMES.USER_AGENT]: userAgent || USER_AGENT,
      [HTTP_HEADER_NAMES.COOKIE]: cookieValue || `${TOKEN_COOKIE_KEY}=${token}`,
      [HTTP_HEADER_NAMES_LOWERCASE.SOURCE]: 'web',
      [HTTP_HEADER_NAMES_LOWERCASE.VERSION]: API_VERSION,
      [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.NEW_CHAT}`,
      [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
      [HTTP_HEADER_NAMES.X_REQUEST_ID]: crypto.randomUUID(),
      [HTTP_HEADER_NAMES.SEC_CH_UA]: SEC_CH_UA.VALUE,
      [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]: SEC_CH_UA.MOBILE,
      [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]: SEC_CH_UA.PLATFORM,
      [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]: ACCEPT_LANGUAGES.EN_US_Q09,
      [HTTP_HEADER_NAMES.TIMEZONE]:
        new Date().toDateString() +
        ' ' +
        new Date().toTimeString().split(' ')[0] +
        ' ' +
        TIMEZONE_OFFSET,
      [HTTP_HEADER_NAMES_LOWERCASE.BX_V]: BX_VERSION,
    };

    if (token)
      headers[HTTP_HEADER_NAMES.AUTHORIZATION] =
        `${AUTH_PREFIXES.BEARER}${token}`;
    if (bxUa) headers[HTTP_HEADER_NAMES.BX_UA] = bxUa;
    if (bxUmidToken) headers[HTTP_HEADER_NAMES.BX_UMIDTOKEN] = bxUmidToken;

    const response = await fetch(`${BASE_URL}${API_PATHS.CHATS_NEW}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        [CREATE_CHAT_FIELDS.CHAT_ID]: '',
        [CREATE_CHAT_FIELDS.MODELS]: [model],
        [CREATE_CHAT_FIELDS.PROJECT_ID]: '',
        [CREATE_CHAT_FIELDS.TIMESTAMP]: Date.now(),
        [CREATE_CHAT_FIELDS.CHAT_TYPE]: CHAT_PAYLOAD_CONSTANTS.CHAT_TYPE_T2T,
        [CREATE_CHAT_FIELDS.CHAT_MODE]: CHAT_PAYLOAD_CONSTANTS.CHAT_MODE_NORMAL,
      }),
    });

    const actualStatusCode = response.headers.get(
      HTTP_HEADER_NAMES.X_ACTUAL_STATUS_CODE,
    );
    if (actualStatusCode && actualStatusCode !== '200') {
      const errorText = await response.text();
      throw new Error(`Create chat failed: ${actualStatusCode} - ${errorText}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Create chat failed: ${response.status} - ${errorText}`);
    }

    const json = await response.json();

    // Check if response indicates error (even with 200 status)
    if (json[CREATE_CHAT_FIELDS.SUCCESS] === false) {
      const errorCode =
        json[CREATE_CHAT_FIELDS.DATA]?.[CREATE_CHAT_FIELDS.CODE] || 'unknown';
      const errorDetails =
        json[CREATE_CHAT_FIELDS.DATA]?.[CREATE_CHAT_FIELDS.DETAILS] ||
        JSON.stringify(json);
      throw new Error(`Create chat failed: ${errorCode} - ${errorDetails}`);
    }

    const chatId =
      json[CREATE_CHAT_FIELDS.DATA]?.[CREATE_CHAT_FIELDS.ID] ||
      json[CREATE_CHAT_FIELDS.ID];

    if (!chatId) {
      throw new Error(`No chat_id in response: ${JSON.stringify(json)}`);
    }

    return chatId;
  }

  // ─── Get Last Message ID ────────────────────────────────────────────

  private async getLastMessageId(
    conversationId: string,
    credential: string,
  ): Promise<string | null> {
    const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
      this.parseCredential(credential);

    const headers: Record<string, string> = {
      [HTTP_HEADER_NAMES.COOKIE]: cookieValue || `${TOKEN_COOKIE_KEY}=${token}`,
      [HTTP_HEADER_NAMES.USER_AGENT]: userAgent || USER_AGENT,
      [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT]: ACCEPT_VALUES.JSON,
      [HTTP_HEADER_NAMES_LOWERCASE.SOURCE]: 'web',
      [HTTP_HEADER_NAMES_LOWERCASE.VERSION]: API_VERSION,
      [HTTP_HEADER_NAMES_LOWERCASE.X_REQUEST_ID]: crypto.randomUUID(),
      [HTTP_HEADER_NAMES.X_REQUEST_ID]: crypto.randomUUID(),
      [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]: SEC_CH_UA.PLATFORM,
      [HTTP_HEADER_NAMES_LOWERCASE.BX_V]: BX_VERSION,
      [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.CHAT_PREFIX}${conversationId}`,
      [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]: ACCEPT_LANGUAGES.EN_US_Q09,
      [HTTP_HEADER_NAMES.TIMEZONE]:
        new Date().toDateString() +
        ' ' +
        new Date().toTimeString().split(' ')[0] +
        ' ' +
        TIMEZONE_OFFSET,
      [HTTP_HEADER_NAMES.SEC_CH_UA]: SEC_CH_UA.VALUE,
      [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]: SEC_CH_UA.MOBILE,
    };

    if (token)
      headers[HTTP_HEADER_NAMES.AUTHORIZATION] =
        `${AUTH_PREFIXES.BEARER}${token}`;
    if (bxUa) headers[HTTP_HEADER_NAMES.BX_UA] = bxUa;
    if (bxUmidToken) headers[HTTP_HEADER_NAMES.BX_UMIDTOKEN] = bxUmidToken;

    const response = await fetch(
      `${BASE_URL}${API_PATHS.CHATS}${conversationId}/messages/`,
      { headers },
    );
    if (!response.ok) {
      logger.warn(
        `[Qwen] Failed to fetch last message ID: HTTP ${response.status}`,
      );
      return null;
    }

    const json = await response.json();
    const messages =
      json[RESPONSE_FIELDS.MESSAGES] || json[RESPONSE_FIELDS.DATA] || [];
    if (messages.length > 0) {
      const lastAssistant = [...messages]
        .reverse()
        .find(
          (m: any) =>
            m[CHAT_PAYLOAD_FIELDS.ROLE] ===
            CHAT_PAYLOAD_CONSTANTS.ROLE_ASSISTANT,
        );
      return lastAssistant?.[CHAT_PAYLOAD_FIELDS.ID] || null;
    }
    return null;
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { messages, onContent, onThinking, onMetadata, onDone, onError } =
      options;
    const onSessionCreated = options.onSessionCreated;
    let { conversationId } = options;

    let modelToUse = options.model;
    if (modelToUse.includes('/')) {
      modelToUse = modelToUse.split('/').pop() || modelToUse;
    }
    modelToUse = modelToUse.trim();

    if (modelToUse.startsWith(MODEL_PREFIX_QWEN_3)) {
      modelToUse = modelToUse.replace(
        MODEL_PREFIX_QWEN_DASH,
        MODEL_PREFIX_QWEN_DASH.slice(0, -1),
      );
    }

    const lockKey = conversationId || options.accountId || 'qwen_default';
    const { promise: previousLock, release } = acquireLock(lockKey);

    try {
      await previousLock;

      const credential = await this.getFreshCredential(options.credential);
      const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
        this.parseCredential(credential);

      if (!token) {
        throw new Error('[Qwen] No access token found');
      }

      const isNewChat = !conversationId;

      if (isNewChat) {
        conversationId = await this.createChat(credential, modelToUse);
        if (onSessionCreated) onSessionCreated(conversationId);
        if (onMetadata) onMetadata({ conversation_id: conversationId });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const requestId = crypto.randomUUID();
      const timezone = `${new Date().toDateString()} ${new Date().toTimeString().split(' ')[0]} GMT+0700`;

      const lastMsg = messages[messages.length - 1];
      const msgFid = options.edit_message_id || crypto.randomUUID();
      const userAction =
        options.user_action || CHAT_PAYLOAD_CONSTANTS.USER_ACTION_CHAT;

      // Khi edit message, cần lấy childrenIds từ message cũ
      let childrenIds: string[] = [];
      if (
        userAction === CHAT_PAYLOAD_CONSTANTS.USER_ACTION_EDIT &&
        conversationId &&
        msgFid
      ) {
        try {
          const response = await fetch(
            `${BASE_URL}${API_PATHS.CHATS}${conversationId}/messages/`,
            {
              headers: {
                [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${token}`,
                [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT]: ACCEPT_VALUES.JSON,
                [HTTP_HEADER_NAMES_LOWERCASE.SOURCE]: 'web',
                [HTTP_HEADER_NAMES_LOWERCASE.VERSION]: API_VERSION,
              },
            },
          );
          if (response.ok) {
            const json = await response.json();
            const messages =
              json[RESPONSE_FIELDS.MESSAGES] ||
              json[RESPONSE_FIELDS.DATA] ||
              [];
            const oldMessage = messages.find(
              (m: any) => m[CHAT_PAYLOAD_FIELDS.FID] === msgFid,
            );
            if (oldMessage && oldMessage[CHAT_PAYLOAD_FIELDS.CHILDREN_IDS]) {
              childrenIds = oldMessage[CHAT_PAYLOAD_FIELDS.CHILDREN_IDS];
            }
          }
        } catch (e) {
          logger.warn(
            '[Qwen] Failed to fetch childrenIds for edit message:',
            e,
          );
        }
      }

      let parentId: string | null = options.parent_message_id ?? null;

      if (!parentId && conversationId && !isNewChat) {
        const cached = lastParentIdCache.get(conversationId);
        if (cached) {
          parentId = cached;
        } else {
          try {
            parentId = await this.getLastMessageId(conversationId, credential);
          } catch (e) {
            logger.warn('[Qwen] Failed to fetch last message ID');
          }
        }
      }

      const payload = {
        [CHAT_PAYLOAD_FIELDS.STREAM]: true,
        [CHAT_PAYLOAD_FIELDS.VERSION]: CHAT_PAYLOAD_CONSTANTS.STREAM_VERSION,
        [CHAT_PAYLOAD_FIELDS.INCREMENTAL_OUTPUT]: true,
        [CHAT_PAYLOAD_FIELDS.CHAT_ID]: conversationId || '',
        [CHAT_PAYLOAD_FIELDS.PARENT_ID]: parentId || '',
        ...(conversationId && {
          [CHAT_PAYLOAD_FIELDS.CHAT_ID_SNAKE]: conversationId,
        }),
        [CHAT_PAYLOAD_FIELDS.CHAT_MODE]:
          CHAT_PAYLOAD_CONSTANTS.CHAT_MODE_NORMAL,
        [CHAT_PAYLOAD_FIELDS.MODEL]: modelToUse,
        [CHAT_PAYLOAD_FIELDS.PARENT_ID_SNAKE]: parentId as string | null,
        [CHAT_PAYLOAD_FIELDS.MESSAGES]: [
          {
            [CHAT_PAYLOAD_FIELDS.ID]: null,
            [CHAT_PAYLOAD_FIELDS.FID]: msgFid,
            [CHAT_PAYLOAD_FIELDS.PARENT_ID]: parentId as string | null,
            [CHAT_PAYLOAD_FIELDS.CHILDREN_IDS]: childrenIds,
            [CHAT_PAYLOAD_FIELDS.ROLE]: lastMsg.role,
            [CHAT_PAYLOAD_FIELDS.CONTENT]: lastMsg.content,
            [CHAT_PAYLOAD_FIELDS.USER_ACTION]: userAction,
            [CHAT_PAYLOAD_FIELDS.FILES]: (options.ref_file_ids || []).map(
              (item: any) => {
                if (typeof item === 'string') {
                  throw new Error(
                    `[Qwen] ref_file_ids contains string "${item}". ` +
                      `Must send object { file_id, url, ... } to build valid file object.`,
                  );
                }
                if (!item.file_id) {
                  throw new Error(`[Qwen] ref_file_ids[].file_id is required.`);
                }
                if (!item.url) {
                  throw new Error(
                    `[Qwen] ref_file_ids[].url is missing (file_id=${item.file_id}). ` +
                      `Check if upload API response includes "url" field.`,
                  );
                }
                return {
                  type: item.type || 'image',
                  id: item.file_id,
                  url: item.url,
                  name: item.name || 'file',
                  status: 'uploaded',
                  file_type: item.file_type || 'image/png',
                  showType: item.showType || 'image',
                  file_class: item.file_class || 'vision',
                };
              },
            ),
            [CHAT_PAYLOAD_FIELDS.TIMESTAMP]: nowSec,
            [CHAT_PAYLOAD_FIELDS.MODELS]: [modelToUse],
            [CHAT_PAYLOAD_FIELDS.MODEL]: '',
            [CHAT_PAYLOAD_FIELDS.CHAT_TYPE]:
              CHAT_PAYLOAD_CONSTANTS.CHAT_TYPE_T2T,
            [CHAT_PAYLOAD_FIELDS.FEATURE_CONFIG]: {
              [CHAT_PAYLOAD_FIELDS.THINKING_ENABLED]: options.thinking ?? false,
              [CHAT_PAYLOAD_FIELDS.OUTPUT_SCHEMA]:
                CHAT_PAYLOAD_CONSTANTS.OUTPUT_SCHEMA_PHASE,
              [CHAT_PAYLOAD_FIELDS.RESEARCH_MODE]:
                CHAT_PAYLOAD_CONSTANTS.RESEARCH_MODE_NORMAL,
              [CHAT_PAYLOAD_FIELDS.AUTO_THINKING]: false,
              [CHAT_PAYLOAD_FIELDS.THINKING_MODE]: options.thinking
                ? CHAT_PAYLOAD_CONSTANTS.THINKING_MODE_THINKING
                : CHAT_PAYLOAD_CONSTANTS.THINKING_MODE_FAST,
              ...(options.thinking && {
                [CHAT_PAYLOAD_FIELDS.THINKING_FORMAT]:
                  CHAT_PAYLOAD_CONSTANTS.THINKING_FORMAT_SUMMARY,
              }),
              [CHAT_PAYLOAD_FIELDS.AUTO_SEARCH]: true,
            },
            [CHAT_PAYLOAD_FIELDS.EXTRA]: {
              [CHAT_PAYLOAD_FIELDS.META]: {
                [CHAT_PAYLOAD_FIELDS.SUB_CHAT_TYPE]:
                  CHAT_PAYLOAD_CONSTANTS.SUB_CHAT_TYPE,
              },
            },
            [CHAT_PAYLOAD_FIELDS.SUB_CHAT_TYPE_SNAKE]:
              CHAT_PAYLOAD_CONSTANTS.SUB_CHAT_TYPE,
            [CHAT_PAYLOAD_FIELDS.PARENT_ID_SNAKE]: parentId as string | null,
          },
        ],
        [CHAT_PAYLOAD_FIELDS.TIMESTAMP]: nowSec,
      };

      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT]: ACCEPT_VALUES.JSON,
        [HTTP_HEADER_NAMES.USER_AGENT]: userAgent || USER_AGENT,
        [HTTP_HEADER_NAMES.COOKIE]:
          cookieValue || `${TOKEN_COOKIE_KEY}=${token}`,
        [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
        [HTTP_HEADER_NAMES.REFERER]: conversationId
          ? `${BASE_URL}${REFERER_PATHS.CHAT_PREFIX}${conversationId}`
          : BASE_URL,
        [HTTP_HEADER_NAMES.X_ACCEL_BUFFERING]: 'no',
        [HTTP_HEADER_NAMES_LOWERCASE.X_REQUEST_ID]: requestId,
        [HTTP_HEADER_NAMES.X_REQUEST_ID]: requestId,
        [HTTP_HEADER_NAMES_LOWERCASE.SOURCE]: 'web',
        [HTTP_HEADER_NAMES_LOWERCASE.VERSION]: API_VERSION,
        [HTTP_HEADER_NAMES_LOWERCASE.BX_V]: BX_VERSION,
        [HTTP_HEADER_NAMES_LOWERCASE.TIMEZONE]: timezone,
        [HTTP_HEADER_NAMES.TIMEZONE]: timezone,
        [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT_LANGUAGE]:
          ACCEPT_LANGUAGES.EN_US_Q09,
        [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]: ACCEPT_LANGUAGES.EN_US_Q09,
        [HTTP_HEADER_NAMES.SEC_CH_UA]: SEC_CH_UA.VALUE,
        [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]: SEC_CH_UA.MOBILE,
        [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]: SEC_CH_UA.PLATFORM,
      };

      if (token)
        headers[HTTP_HEADER_NAMES.AUTHORIZATION] =
          `${AUTH_PREFIXES.BEARER}${token}`;
      if (bxUa) headers[HTTP_HEADER_NAMES.BX_UA] = bxUa;
      if (bxUmidToken) headers[HTTP_HEADER_NAMES.BX_UMIDTOKEN] = bxUmidToken;

      const url = conversationId
        ? `${BASE_URL}${API_PATHS.CHAT_COMPLETIONS}?chat_id=${conversationId}`
        : `${BASE_URL}${API_PATHS.CHAT_COMPLETIONS}`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const actualStatusCode = response.headers.get(
        HTTP_HEADER_NAMES.X_ACTUAL_STATUS_CODE,
      );
      if (actualStatusCode && actualStatusCode !== '200') {
        const errText = await response.text();
        logger.error(
          `[Qwen] API returned error via x-actual-status-code=${actualStatusCode}:`,
          errText.slice(0, 500),
        );
        throw new Error(
          `Qwen API Error ${actualStatusCode}: ${errText.slice(0, 500)}`,
        );
      }

      if (!response.ok) {
        const errText = await response.text();
        logger.error(
          `[Qwen] API returned HTTP error ${response.status}:`,
          errText.slice(0, 500),
        );
        throw new Error(
          `Qwen API Error ${response.status}: ${errText.slice(0, 500)}`,
        );
      }

      if (!response.body) {
        logger.error('[Qwen] Response body is null/undefined');
        throw new Error('No response body');
      }

      let buffer = '';
      let conversationIdCaptured = false;
      let parentIdCaptured = false;
      let capturedParentId: string | null = null;
      const thinkingParser = new QwenStreamingThinkingParser(
        onContent,
        onThinking,
      );
      const normalizedThinkingParser = createQwenThinkingParser();
      let totalContentReceived = 0;
      let totalChunksProcessed = 0;
      let chunkCounter = 0;
      let seenResponseIds = new Set<string>();
      let currentResponseId: string | null = null;
      let firstResponseId: string | null = null; // Response đầu tiên để select
      let isInThinkingPhase = false;

      for await (const chunk of response.body as any) {
        chunkCounter++;
        const chunkStr = chunk.toString();

        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let jsonStr = trimmed;
          if (trimmed.startsWith(SSE_PROTOCOL.DATA_PREFIX)) {
            jsonStr = trimmed.slice(SSE_PROTOCOL.DATA_PREFIX_LENGTH).trim();
          } else if (trimmed.startsWith(SSE_PROTOCOL.DATA_PREFIX_SHORT)) {
            jsonStr = trimmed
              .slice(SSE_PROTOCOL.DATA_PREFIX_SHORT_LENGTH)
              .trim();
          } else {
            continue;
          }

          if (jsonStr === SSE_PROTOCOL.DONE) {
            thinkingParser.flush();
            onDone();
            return;
          }

          try {
            const json = JSON.parse(jsonStr);
            totalChunksProcessed++;

            let responseCreated = null;
            if (json[SSE_EVENT_FIELDS.RESPONSE_CREATED_KEY]) {
              responseCreated = json[SSE_EVENT_FIELDS.RESPONSE_CREATED_KEY];
            } else if (
              json[SSE_EVENT_FIELDS.RESPONSE] &&
              json[SSE_EVENT_FIELDS.RESPONSE][SSE_EVENT_FIELDS.CREATED]
            ) {
              responseCreated =
                json[SSE_EVENT_FIELDS.RESPONSE][SSE_EVENT_FIELDS.CREATED];
            }

            if (responseCreated) {
              // Track response_id to detect multiple responses
              const responseId = responseCreated[SSE_EVENT_FIELDS.RESPONSE_ID];
              if (responseId) {
                if (!seenResponseIds.has(responseId)) {
                  seenResponseIds.add(responseId);

                  // Lưu response đầu tiên để select sau
                  if (!firstResponseId) {
                    firstResponseId = responseId;
                    currentResponseId = responseId;
                  }

                  // Nếu có nhiều response, chỉ stream response đầu tiên
                  if (seenResponseIds.size > 1) {
                  }
                }
              }

              if (
                isNewChat &&
                !conversationIdCaptured &&
                responseCreated[SSE_EVENT_FIELDS.CHAT_ID]
              ) {
                conversationIdCaptured = true;
                if (onSessionCreated)
                  onSessionCreated(responseCreated[SSE_EVENT_FIELDS.CHAT_ID]);
                if (onMetadata)
                  onMetadata({
                    conversation_id: responseCreated[SSE_EVENT_FIELDS.CHAT_ID],
                  });
              }

              if (
                !parentIdCaptured &&
                responseCreated[SSE_EVENT_FIELDS.RESPONSE_ID]
              ) {
                parentIdCaptured = true;
                capturedParentId =
                  responseCreated[SSE_EVENT_FIELDS.RESPONSE_ID];
                const chatIdForCache =
                  responseCreated[SSE_EVENT_FIELDS.CHAT_ID] || conversationId;
                if (chatIdForCache && capturedParentId) {
                  lastParentIdCache.set(chatIdForCache, capturedParentId);
                }
                if (onMetadata)
                  onMetadata({ parent_message_id: capturedParentId });
              }
            }

            const delta =
              json[SSE_EVENT_FIELDS.CHOICES]?.[0]?.[SSE_EVENT_FIELDS.DELTA];

            // Check if this content belongs to current response
            const eventResponseId = json[SSE_EVENT_FIELDS.RESPONSE_ID];
            if (
              eventResponseId &&
              currentResponseId &&
              eventResponseId !== currentResponseId
            ) {
              continue;
            }

            if (delta) {
              const phase = delta[SSE_EVENT_FIELDS.PHASE];
              const content = delta[SSE_EVENT_FIELDS.CONTENT];
              const extra = delta[SSE_EVENT_FIELDS.EXTRA];
              const status = delta[SSE_EVENT_FIELDS.STATUS];
              const reasoningContent =
                delta[SSE_EVENT_FIELDS.REASONING_CONTENT];

              // Handle thinking summary phase (when phase = "thinking_summary")
              if (phase === SSE_PHASE_TYPES.THINKING_SUMMARY) {
                isInThinkingPhase = true;

                if (extra) {
                  const summaryTitle = extra[SSE_EVENT_FIELDS.SUMMARY_TITLE];
                  const summaryThought =
                    extra[SSE_EVENT_FIELDS.SUMMARY_THOUGHT];

                  // Feed to normalized parser
                  const normalizedThinking =
                    normalizedThinkingParser.feedSummary({
                      title: summaryTitle?.content,
                      thought: summaryThought?.content,
                    });

                  if (normalizedThinking && onThinking) {
                    onThinking(normalizedThinking);
                  }
                }

                // End thinking phase when status is "finished"
                if (status === 'finished') {
                  const closingTag = normalizedThinkingParser.end();
                  if (closingTag && onThinking) {
                    onThinking(closingTag);
                  }
                  isInThinkingPhase = false;
                }
              }

              // Handle reasoning_content field (backward compatibility)
              if (reasoningContent && onThinking) {
                if (!isInThinkingPhase) {
                  isInThinkingPhase = true;
                }
                const normalizedThinking =
                  normalizedThinkingParser.feed(reasoningContent);
                if (normalizedThinking) {
                  onThinking(normalizedThinking);
                }
              }

              // Handle regular content (answer phase)
              if (content) {
                // End thinking phase if we were in it and now in answer phase
                if (isInThinkingPhase && phase === SSE_PHASE_TYPES.ANSWER) {
                  const closingTag = normalizedThinkingParser.end();
                  if (closingTag && onThinking) {
                    onThinking(closingTag);
                  }
                  isInThinkingPhase = false;
                }

                totalContentReceived += content.length;
                thinkingParser.feed(content);
              }
            }
          } catch (e) {
            logger.warn(
              '[Qwen] Failed to parse SSE line:',
              e,
              'Line:',
              trimmed.substring(0, 100),
            );
          }
        }
      }

      // If we have remaining buffer content and no chunks were processed, it might be an error response
      if (buffer.length > 0 && totalChunksProcessed === 0) {
        logger.error(
          `[Qwen] Received non-streaming response (possible error):`,
          buffer,
        );
        try {
          const errorJson = JSON.parse(buffer);
          const errorMessage =
            errorJson.message ||
            errorJson.error ||
            errorJson.data?.message ||
            JSON.stringify(errorJson);
          throw new Error(`Qwen API returned error: ${errorMessage}`);
        } catch (parseErr) {
          // If not JSON, log raw content
          logger.error(`[Qwen] Raw response content:`, buffer.slice(0, 1000));
          throw new Error(
            `Qwen API returned non-streaming response: ${buffer.slice(0, 200)}`,
          );
        }
      }

      if (seenResponseIds.size > 1) {
        logger.warn(
          `[Qwen] MULTIPLE RESPONSES DETECTED: ${seenResponseIds.size} responses for ${isNewChat ? 'new chat' : 'existing chat'}. Response IDs: ${Array.from(seenResponseIds).join(', ')}`,
        );
      }

      thinkingParser.flush();

      // Log summary before completing
      if (totalContentReceived === 0) {
        logger.warn(
          `[Qwen] No content received from API for model=${modelToUse}, conversationId=${conversationId}`,
        );
      }

      // Nếu có nhiều response, tự động gọi select API để chọn response đầu tiên
      if (seenResponseIds.size > 1 && firstResponseId && conversationId) {
        try {
          const selectHeaders: Record<string, string> = {
            [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
            [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT]:
              ACCEPT_VALUES.JSON_TEXT_PLAIN_ANY,
            [HTTP_HEADER_NAMES.USER_AGENT]: userAgent || USER_AGENT,
            [HTTP_HEADER_NAMES.ORIGIN]: BASE_URL,
            [HTTP_HEADER_NAMES.REFERER]: `${BASE_URL}${REFERER_PATHS.CHAT_PREFIX}${conversationId}`,
            [HTTP_HEADER_NAMES_LOWERCASE.SOURCE]: 'web',
            [HTTP_HEADER_NAMES_LOWERCASE.VERSION]: API_VERSION,
            [HTTP_HEADER_NAMES_LOWERCASE.BX_V]: BX_VERSION,
            [HTTP_HEADER_NAMES_LOWERCASE.X_REQUEST_ID]: crypto.randomUUID(),
            [HTTP_HEADER_NAMES.X_REQUEST_ID]: crypto.randomUUID(),
            [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]: SEC_CH_UA.PLATFORM,
            [HTTP_HEADER_NAMES.SEC_CH_UA]: SEC_CH_UA.VALUE,
            [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]: SEC_CH_UA.MOBILE,
            [HTTP_HEADER_NAMES.ACCEPT_LANGUAGE]: ACCEPT_LANGUAGES.EN_US_Q09,
            [HTTP_HEADER_NAMES.TIMEZONE]:
              new Date().toDateString() +
              ' ' +
              new Date().toTimeString().split(' ')[0] +
              ' ' +
              TIMEZONE_OFFSET,
          };

          if (token)
            selectHeaders[HTTP_HEADER_NAMES.AUTHORIZATION] =
              `${AUTH_PREFIXES.BEARER}${token}`;
          if (bxUa) selectHeaders[HTTP_HEADER_NAMES.BX_UA] = bxUa;
          if (bxUmidToken)
            selectHeaders[HTTP_HEADER_NAMES.BX_UMIDTOKEN] = bxUmidToken;

          const selectResponse = await fetch(
            `${BASE_URL}${API_PATHS.CHATS}${conversationId}/messages/select`,
            {
              method: 'POST',
              headers: selectHeaders,
              body: JSON.stringify({ ids: [firstResponseId] }),
            },
          );

          if (selectResponse.ok) {
            const selectJson: any = await selectResponse.json();
            if (selectJson.success) {
            } else {
              logger.warn(`[Qwen] Select response API returned success=false`);
            }
          } else {
            logger.warn(
              `[Qwen] Failed to select response: HTTP ${selectResponse.status}`,
            );
          }
        } catch (selectErr: any) {
          logger.warn(`[Qwen] Error calling select API:`, selectErr.message);
        }
      }

      if (capturedParentId && onMetadata) {
        onMetadata({ last_parent_id: capturedParentId });
      }
      onDone();
    } catch (err: any) {
      logger.error('[Qwen] handleMessage error:', err);
      onError(err);
    } finally {
      release();
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Upload File ────────────────────────────────────────────────────

  async uploadFile(
    credential: string,
    file: Express.Multer.File,
  ): Promise<{ id: string; url: string; token_usage: number }> {
    const parsedCred = this.parseCredential(credential);

    const uploadInput = {
      originalname: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer,
    };

    return await qwenUploadFile(
      {
        token: parsedCred.token,
        bxUa: parsedCred.bxUa,
        bxUmidToken: parsedCred.bxUmidToken,
        userAgent: parsedCred.userAgent,
      },
      uploadInput,
    );
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string): Promise<any[]> {
    const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
      this.parseCredential(credential);

    const headers: Record<string, string> = {
      [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT]: ACCEPT_VALUES.JSON_TEXT_PLAIN_ANY,
      [HTTP_HEADER_NAMES_LOWERCASE.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HTTP_HEADER_NAMES_LOWERCASE.COOKIE]: cookieValue
        ? cookieValue
        : token
          ? `${TOKEN_COOKIE_KEY}=${token}`
          : '',
      [HTTP_HEADER_NAMES_LOWERCASE.ORIGIN]: BASE_URL,
      [HTTP_HEADER_NAMES_LOWERCASE.REFERER]: `${BASE_URL}${REFERER_PATHS.ROOT}`,
      [HTTP_HEADER_NAMES_LOWERCASE.USER_AGENT]: userAgent || USER_AGENT,
      [HTTP_HEADER_NAMES_LOWERCASE.X_REQUEST_ID]: crypto.randomUUID(),
      [HTTP_HEADER_NAMES.SEC_CH_UA_PLATFORM]: SEC_CH_UA.PLATFORM,
      [HTTP_HEADER_NAMES.SEC_CH_UA]: SEC_CH_UA.VALUE,
      [HTTP_HEADER_NAMES.SEC_CH_UA_MOBILE]: SEC_CH_UA.MOBILE,
      [HTTP_HEADER_NAMES_LOWERCASE.SOURCE]: 'web',
      [HTTP_HEADER_NAMES_LOWERCASE.VERSION]: API_VERSION,
      [HTTP_HEADER_NAMES_LOWERCASE.BX_V]: BX_VERSION,
      [HTTP_HEADER_NAMES_LOWERCASE.TIMEZONE]:
        new Date().toDateString() +
        ' ' +
        new Date().toTimeString().split(' ')[0] +
        ' ' +
        TIMEZONE_OFFSET,
      [HTTP_HEADER_NAMES_LOWERCASE.ACCEPT_LANGUAGE]: ACCEPT_LANGUAGES.EN_US,
    };

    if (token)
      headers[HTTP_HEADER_NAMES_LOWERCASE.AUTHORIZATION] =
        `${AUTH_PREFIXES.BEARER}${token}`;
    if (bxUa) headers[HTTP_HEADER_NAMES.BX_UA] = bxUa;
    if (bxUmidToken) headers[HTTP_HEADER_NAMES.BX_UMIDTOKEN] = bxUmidToken;

    try {
      const response = await fetch(`${BASE_URL}${API_PATHS.MODELS}`, {
        headers,
        timeout: DEFAULT_TIMEOUT_MS,
      } as any);

      if (response.ok) {
        const json: any = await response.json();

        // Parse structure: {"success": true, "data": {"data": [...]}}
        const modelList =
          json?.[AUTH_FIELDS.DATA]?.[AUTH_FIELDS.DATA] ||
          json?.[AUTH_FIELDS.DATA] ||
          (Array.isArray(json) ? json : null);

        if (modelList && Array.isArray(modelList) && modelList.length > 0) {
          return modelList
            .filter((model: any) => {
              // Filter active models only
              const info = model[MODEL_FIELDS.INFO] || {};
              return info[MODEL_FIELDS.IS_ACTIVE] === true;
            })
            .map((model: any) => {
              const info = model[MODEL_FIELDS.INFO] || {};
              const meta = info[MODEL_FIELDS.META] || {};
              const capabilities = meta[MODEL_FIELDS.CAPABILITIES] || {};
              const chatType = meta[MODEL_FIELDS.CHAT_TYPE] || [];

              // Check chat_type array for generator capabilities
              const isImageGenerator =
                Array.isArray(chatType) &&
                chatType.includes(CHAT_PAYLOAD_CONSTANTS.CHAT_TYPE_T2I);
              const isVideoGenerator =
                Array.isArray(chatType) &&
                chatType.includes(CHAT_PAYLOAD_CONSTANTS.CHAT_TYPE_T2V);
              const isDeepResearch =
                Array.isArray(chatType) &&
                chatType.includes(
                  CHAT_PAYLOAD_CONSTANTS.CHAT_TYPE_DEEP_RESEARCH,
                );

              return {
                id: model[MODEL_FIELDS.ID] || info[MODEL_FIELDS.ID],
                name:
                  model[MODEL_FIELDS.NAME] ||
                  info[MODEL_FIELDS.NAME] ||
                  model[MODEL_FIELDS.ID],
                is_thinking: capabilities[MODEL_FIELDS.THINKING] === true,
                max_context_length:
                  meta[MODEL_FIELDS.MAX_CONTEXT_LENGTH] ||
                  DEFAULT_MAX_CONTEXT_LENGTH,
                is_search: capabilities[MODEL_FIELDS.SEARCH] === true,
                is_image_upload: capabilities[MODEL_FIELDS.VISION] === true,
                is_image_generator: isImageGenerator,
                is_video_generator: isVideoGenerator,
                is_deep_research: isDeepResearch,
                description:
                  meta[MODEL_FIELDS.SHORT_DESCRIPTION] ||
                  meta[MODEL_FIELDS.DESCRIPTION] ||
                  undefined,
              };
            });
        }
      } else {
        logger.warn(
          `[Qwen] Failed to fetch models from API: HTTP ${response.status}`,
        );
      }
    } catch (e) {
      logger.warn('[Qwen] Failed to fetch models from API:', e);
    }

    // Return empty array if API fetch fails - no hardcoded fallback
    logger.warn('[Qwen] No models available from API');
    return [];
  }
}

export default new QwenProvider();

```

---

src/services/upload.service.ts:
```
/**
 * ------------------------------------------------------------------
 * Upload Service
 * ------------------------------------------------------------------
 * Business logic upload file lên provider AI.
 *
 * Main functions:
 * - uploadFileToProvider() : Upload file qua provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('UploadService');

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface UploadResult {
  file_id?: string;
  url?: string;
  token_usage?: number;
  raw?: any;
}

// ─── Service Functions ──────────────────────────────────────────────────

/**
 * Upload file qua provider
 */
export async function uploadFileToProvider(
  providerId: string,
  credential: string,
  file: Express.Multer.File,
): Promise<UploadResult> {
  const provider = providerRegistry.getProvider(providerId);

  if (!provider) {
    logger.error(
      `[UploadService] Provider not found | providerId=${providerId}`,
    );
    throw new Error(`Provider ${providerId} not supported`);
  }

  if (!provider.uploadFile) {
    logger.error(
      `[UploadService] Provider does not support upload | providerId=${providerId}`,
    );
    throw new Error(`Provider ${providerId} does not support file upload`);
  }

  try {
    const result = await provider.uploadFile(credential, file);

    // Normalize result format
    if (typeof result === 'string') {
      return { file_id: result };
    } else if (result && typeof result === 'object' && 'id' in result) {
      return {
        file_id: result.id,
        url: (result as any).url,
        token_usage: (result as any).token_usage,
      };
    } else {
      logger.warn(
        `[UploadService] Result format unexpected | providerId=${providerId} | resultType=${typeof result}`,
      );
      return { raw: result };
    }
  } catch (error: any) {
    logger.error(
      `[UploadService] Upload failed | providerId=${providerId} | filename=${file.originalname}`,
      {
        error: error.message,
        stack: error.stack,
        code: error.code,
      },
    );
    throw error;
  }
}

```
<-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=->

sao vẫn lỗi