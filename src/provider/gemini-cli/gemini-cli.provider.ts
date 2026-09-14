/**
 * ------------------------------------------------------------------
 * Gemini CLI Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Gemini CLI (Google Cloud Gemini).
 * Hỗ trợ login qua terminal OAuth flow, refresh token,
 * và chat completion với streaming response.
 *
 * Main features:
 * - login()          : Đăng nhập qua terminal OAuth
 * - refreshToken()   : Refresh access token
 * - fetchProjectId() : Lấy project ID từ API
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getModels()      : Lấy danh sách models từ quota API
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';
import { proxyService } from '../../services/proxy.service';

// ── Database ──
import { getDb } from '../../database';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Gemini CLI Constants ──
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  IS_MEMORY,
  GEMINI_CLI_EVENTS,
  CLOUDCODE_LOAD_CODE_ASSIST_URL,
  CLOUDCODE_STREAM_GENERATE_URL,
  CLOUDCODE_RETRIEVE_QUOTA_URL,
  USER_AGENT,
  X_GOOG_API_CLIENT,
  CLIENT_METADATA,
  DEFAULT_PROJECT_ID,
  API_FIELDS,
  CONTENT_TYPES,
  HTTP_HEADER_NAMES,
  HTTP_HEADERS,
  LOGIN_CONFIG,
  MESSAGE_ROLES,
  OAUTH_CONFIG,
  OAUTH_SCOPES,
  OAUTH_URLS,
  PAYLOAD_DEFAULTS,
  REGEX_PATTERNS,
  SSE_PROTOCOL,
  TERMINALS,
  TOKEN_FIELDS,
} from './gemini-cli.constant';

// ── Gemini CLI Types ──
import {
  GeminiCapturedTokens,
  GeminiLoadCodeAssistResponse,
  GeminiModelOutput,
  GeminiQuotaResponse,
  GeminiRequestPayload,
  GeminiSSEChunk,
  GeminiTokenResponse,
  GeminiTokens,
} from './gemini-cli.types';

// ── Gemini CLI Internal ──
import { proxyHandler } from './gemini-cli.proxy-handler';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('GeminiCLIProvider');

/**
 * Runtime OAuth config cho Gemini CLI.
 * Đọc từ env + URL/scopes được định nghĩa trong constant.
 */
export const GEMINI_CONFIG = {
  clientId: process.env[OAUTH_CONFIG.CLIENT_ID_ENV_KEY] || '',
  clientSecret: process.env[OAUTH_CONFIG.CLIENT_SECRET_ENV_KEY] || '',
  authorizeUrl: OAUTH_URLS.AUTHORIZE,
  tokenUrl: OAUTH_URLS.TOKEN,
  scopes: [...OAUTH_SCOPES],
};

// ─── Provider Class ────────────────────────────────────────────────────

export class GeminiCLIProvider implements Provider {
  name = PROVIDER_ID;
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
  };

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    const tempHome = path.join(
      os.tmpdir(),
      `${LOGIN_CONFIG.TEMP_DIR_PREFIX}${Date.now()}`,
    );
    fs.mkdirSync(tempHome, { recursive: true });

    await proxyService.start();
    const { port } = proxyService.getServerInfo();
    const proxyUrl = `http://127.0.0.1:${port}`;
    const logFile = path.join(tempHome, LOGIN_CONFIG.LOG_FILE_NAME);

    let terminal = '';
    for (const t of TERMINALS) {
      try {
        execSync(`which ${t}`, { stdio: 'ignore' });
        terminal = t;
        break;
      } catch (e) {}
    }

    if (!terminal) {
      logger.warn(
        '[GeminiCLI] No supported terminal emulator found, falling back to bash',
      );
    }

    const envStr = `export http_proxy=${proxyUrl} https_proxy=${proxyUrl} HTTP_PROXY=${proxyUrl} HTTPS_PROXY=${proxyUrl} all_proxy=${proxyUrl} ALL_PROXY=${proxyUrl} no_proxy='localhost,127.0.0.1' NO_PROXY='localhost,127.0.0.1' HOME=${tempHome} USERPROFILE=${tempHome} NODE_TLS_REJECT_UNAUTHORIZED=0 GOOGLE_GENAI_USE_GCA=true NO_BROWSER=true;`;
    const commandStr = `${envStr} gemini 2>&1 | tee ${logFile}`;

    const env = {
      ...process.env,
      HOME: tempHome,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      GOOGLE_GENAI_USE_GCA: 'true',
      NO_BROWSER: 'true',
    };

    let terminalSpawn: any;
    if (terminal === 'gnome-terminal') {
      terminalSpawn = spawn(
        terminal,
        [
          '--',
          'bash',
          '-c',
          `${commandStr}; echo ''; echo 'Press enter to close...'; read`,
        ],
        { detached: true, env, stdio: 'ignore' },
      );
    } else if (terminal) {
      terminalSpawn = spawn(terminal, ['-e', `bash -c "${commandStr}; read"`], {
        detached: true,
        env,
        stdio: 'ignore',
      });
    } else {
      terminalSpawn = spawn('bash', ['-c', commandStr], {
        env,
        detached: true,
        stdio: 'ignore',
      });
    }

    return new Promise((resolve, reject) => {
      let capturedUrl = '';
      const checkInterval = setInterval(() => {
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');
          const urlMatch = content.match(REGEX_PATTERNS.OAUTH_AUTHORIZE_URL);
          if (urlMatch && !capturedUrl) {
            capturedUrl = urlMatch[0];
            clearInterval(checkInterval);

            loginService
              .captureCredentialsViaCDP({
                providerId: PROVIDER_ID,
                loginUrl: capturedUrl,
                partition: `${LOGIN_CONFIG.PARTITION_PREFIX}${Date.now()}`,
                skipProxy: true,
                extraEvents: [
                  GEMINI_CLI_EVENTS.TOKENS,
                  GEMINI_CLI_EVENTS.USER_INFO,
                ],
                validate: async (captured) => {
                  if (captured.cookies || captured.headers) {
                    try {
                      const tokens: GeminiCapturedTokens = captured.cookies
                        ? JSON.parse(captured.cookies)
                        : {};
                      const projectId = captured.headers?.projectId || '';
                      const email =
                        captured.email || captured.headers?.email || null;

                      if (tokens.access_token && projectId) {
                        return {
                          isValid: true,
                          cookies: JSON.stringify({
                            [TOKEN_FIELDS.ACCESS_TOKEN]: tokens.access_token,
                            [TOKEN_FIELDS.REFRESH_TOKEN]: tokens.refresh_token,
                            [TOKEN_FIELDS.EXPIRES_IN]: tokens.expires_in,
                            [TOKEN_FIELDS.PROJECT_ID]: projectId,
                          }),
                          email: email,
                        };
                      }
                    } catch (e) {
                      logger.warn(
                        '[GeminiCLI] Failed to parse captured tokens:',
                        e,
                      );
                    }
                  }
                  return { isValid: false };
                },
              })
              .then((result) => {
                try {
                  fs.rmSync(tempHome, { recursive: true, force: true });
                } catch (e) {
                  logger.warn('[GeminiCLI] Failed to clean up temp home:', e);
                }
                resolve(result);
              })
              .catch(reject);
          }
        }
      }, LOGIN_CONFIG.POLL_INTERVAL_MS);

      terminalSpawn.on('error', (err: Error) => {
        clearInterval(checkInterval);
        reject(err);
      });

      setTimeout(() => {
        if (!capturedUrl) {
          clearInterval(checkInterval);
          logger.error('[GeminiCLI] Login timed out waiting for OAuth URL');
          reject(new Error('Timed out waiting for Gemini CLI login URL'));
        }
      }, LOGIN_CONFIG.TIMEOUT_MS);
    });
  }

  // ─── Refresh Token ──────────────────────────────────────────────────

  async refreshToken(refreshTokenStr: string): Promise<GeminiTokenResponse> {
    const response = await fetch(GEMINI_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.FORM_URLENCODED,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
      },
      body: new URLSearchParams({
        grant_type: OAUTH_CONFIG.GRANT_TYPE_REFRESH,
        client_id: GEMINI_CONFIG.clientId,
        client_secret: GEMINI_CONFIG.clientSecret,
        refresh_token: refreshTokenStr,
      }),
    });
    if (!response.ok) {
      logger.error(
        `[GeminiCLI] Token refresh failed with status ${response.status}`,
      );
      throw new Error('Failed to refresh Gemini CLI token');
    }
    return (await response.json()) as GeminiTokenResponse;
  }

  // ─── Fetch Project ID ──────────────────────────────────────────────

  async fetchProjectId(accessToken: string): Promise<string> {
    const response = await fetch(CLOUDCODE_LOAD_CODE_ASSIST_URL, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.AUTHORIZATION]:
          `${HTTP_HEADERS.BEARER_PREFIX}${accessToken}`,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        [HTTP_HEADER_NAMES.X_GOOG_API_CLIENT]: X_GOOG_API_CLIENT,
      },
      body: JSON.stringify({ metadata: CLIENT_METADATA, mode: PAYLOAD_DEFAULTS.MODE }),
    });
    if (!response.ok) {
      logger.warn(
        `[GeminiCLI] fetchProjectId returned status ${response.status}`,
      );
      return '';
    }
    const data = (await response.json()) as GeminiLoadCodeAssistResponse;
    const rawProject = data[API_FIELDS.PROJECT_ID];
    if (rawProject) {
      return typeof rawProject === 'string'
        ? rawProject.trim()
        : rawProject[API_FIELDS.PROJECT_ID_NESTED]?.trim() || '';
    }
    logger.warn(
      '[GeminiCLI] fetchProjectId response missing cloudaicompanionProject',
    );
    return '';
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      stream,
      onContent,
      onDone,
      onError,
      accountId,
    } = options;

    let tokens: GeminiTokens;
    try {
      tokens = JSON.parse(credential) as GeminiTokens;
    } catch (e) {
      logger.warn(
        '[GeminiCLI] Credential is not valid JSON, treating as raw access token',
      );
      tokens = { accessToken: credential };
    }

    if (!tokens.projectId && tokens.accessToken) {
      try {
        tokens.projectId = await this.fetchProjectId(tokens.accessToken);
      } catch (e) {
        logger.warn('[GeminiCLI] Failed to fetch project ID:', e);
      }
    }

    const url = CLOUDCODE_STREAM_GENERATE_URL;

    const sendRequest = async (token: string, projectId?: string) => {
      const sessionId = Math.random().toString(36).substring(2, 15);
      const userPromptId = `${sessionId}########1`;
      const body: GeminiRequestPayload = {
        model: model,
        project: projectId || DEFAULT_PROJECT_ID,
        user_prompt_id: userPromptId,
        request: {
          contents: messages.map((m) => ({
            role:
              m.role === MESSAGE_ROLES.ASSISTANT
                ? MESSAGE_ROLES.MODEL
                : m.role,
            parts: [{ text: m.content }],
          })),
        },
      };

      return await fetch(url, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
          [HTTP_HEADER_NAMES.AUTHORIZATION]:
            `${HTTP_HEADERS.BEARER_PREFIX}${token}`,
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
          [HTTP_HEADER_NAMES.X_GOOG_API_CLIENT]: X_GOOG_API_CLIENT,
        },
        body: JSON.stringify(body),
      });
    };

    try {
      let response = await sendRequest(tokens.accessToken, tokens.projectId);

      if (response.status === 401 && tokens.refreshToken) {
        try {
          const newTokens = await this.refreshToken(tokens.refreshToken);
          tokens.accessToken = newTokens.access_token;
          tokens.refreshToken = newTokens.refresh_token || tokens.refreshToken;

          if (!tokens.projectId)
            tokens.projectId = await this.fetchProjectId(tokens.accessToken);

          if (accountId) {
            try {
              const db = getDb();
              db.prepare('UPDATE accounts SET credential = ? WHERE id = ?').run(
                JSON.stringify(tokens),
                accountId,
              );
            } catch (dbError) {
              logger.error(
                '[GeminiCLI] Failed to persist refreshed token to DB:',
                dbError,
              );
            }
          }
          response = await sendRequest(tokens.accessToken, tokens.projectId);
        } catch (refreshError) {
          logger.error('[GeminiCLI] Token refresh failed:', refreshError);
        }
      }

      if (!response.ok)
        throw new Error(
          `Gemini CLI API Error ${response.status}: ${await response.text()}`,
        );

      if (stream !== false) {
        if (!response.body) throw new Error('No response body');
        let buffer = '';
        for await (const chunk of response.body as any) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith(SSE_PROTOCOL.DATA_PREFIX))
              continue;
            const jsonStr = trimmed
              .slice(SSE_PROTOCOL.DATA_PREFIX.length)
              .trim();
            if (jsonStr === SSE_PROTOCOL.DONE) {
              onDone();
              return;
            }
            try {
              const json = JSON.parse(jsonStr) as GeminiSSEChunk;
              const responseObj = json.response || json;
              const content =
                responseObj[API_FIELDS.CANDIDATES]?.[0]?.[
                  API_FIELDS.CONTENT
                ]?.[API_FIELDS.PARTS]?.[0]?.[API_FIELDS.TEXT];
              if (content) onContent(content);
            } catch (e) {
              logger.warn('[GeminiCLI] Failed to parse SSE line:', e);
            }
          }
        }
        onDone();
      } else {
        const json = (await response.json()) as GeminiSSEChunk;
        const responseObj = json.response || json;
        const content =
          responseObj[API_FIELDS.CANDIDATES]?.[0]?.[API_FIELDS.CONTENT]?.[
            API_FIELDS.PARTS
          ]?.[0]?.[API_FIELDS.TEXT] || '';
        onContent(content);
        onDone();
      }
    } catch (err: any) {
      logger.error('[GeminiCLI] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string): Promise<GeminiModelOutput[]> {
    let tokens: GeminiTokens;
    try {
      tokens = JSON.parse(credential) as GeminiTokens;
    } catch (e) {
      logger.warn('[GeminiCLI] getModels: credential is not valid JSON');
      tokens = { accessToken: credential };
    }
    if (!tokens.accessToken) {
      logger.warn('[GeminiCLI] getModels: no access token available');
      return [];
    }
    let projectId =
      tokens.projectId || (await this.fetchProjectId(tokens.accessToken));
    if (!projectId) projectId = DEFAULT_PROJECT_ID;

    const response = await fetch(CLOUDCODE_RETRIEVE_QUOTA_URL, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.AUTHORIZATION]:
          `${HTTP_HEADERS.BEARER_PREFIX}${tokens.accessToken}`,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        [HTTP_HEADER_NAMES.X_GOOG_API_CLIENT]: X_GOOG_API_CLIENT,
      },
      body: JSON.stringify({ project: projectId }),
    });
    if (!response.ok) {
      logger.warn(
        `[GeminiCLI] getModels: quota API returned status ${response.status}`,
      );
      return [];
    }
    const data = (await response.json()) as GeminiQuotaResponse;
    const buckets = data[API_FIELDS.BUCKETS];
    if (!buckets) {
      logger.warn('[GeminiCLI] getModels: quota API response missing buckets');
      return [];
    }
    return buckets.map((bucket) => ({
      id: bucket[API_FIELDS.MODEL_ID] || '',
      name: bucket[API_FIELDS.MODEL_ID] || '',
    }));
  }
}

export default new GeminiCLIProvider();