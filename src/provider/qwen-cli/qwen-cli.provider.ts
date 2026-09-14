/**
 * ------------------------------------------------------------------
 * Qwen CLI Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Qwen CLI (Qwen Code CLI).
 * Hỗ trợ login qua terminal OAuth flow, refresh token,
 * và chat completion với streaming response.
 *
 * Main features:
 * - login()          : Đăng nhập qua terminal OAuth
 * - refreshToken()   : Refresh access token
 * - handleMessage()  : Gửi tin nhắn với streaming response
 * - getUserProfile() : Lấy thông tin user profile
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
import { proxyEvents } from '../../services/proxy.service';

// ── Database ──
import { getDb } from '../../database';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Qwen CLI Imports ──
import { proxyHandler } from './qwen-cli.proxy-handler';
import { parseSSEStream } from './qwen-cli.sse-parser';
import {
  QwenChatPayload,
  QwenSSEEvent,
  QwenTokenResponse,
  QwenTokens,
  QwenUserProfile,
} from './qwen-cli.types';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  MODELS,
  IS_PAUSABLE,
  IS_MEMORY,
  QWEN_CLI_EVENTS,
  USER_INFO_URL,
  CHAT_COMPLETIONS_URL,
  QWEN_CONFIG,
  OAUTH_PATHS,
  HTTP_HEADER_NAMES,
  CONTENT_TYPES,
  API_FIELDS,
  GRANT_TYPES,
  CONTENT_BLOCK_TYPES,
  DASHSCOPE_AUTH_TYPE,
  AUTH_PREFIXES,
  QWEN_CLI_VERSION,
  QWEN_CODE_USER_AGENT_PREFIX,
  QWEN_CHAT_USER_AGENT,
  LOGIN_PARTITION,
  LOGIN_TEMP_HOME_PREFIX,
  LOGIN_TIMEOUT_MS,
  LOGIN_POLL_INTERVAL_MS,
  QWEN_CLI_RELATIVE_PATH,
  TERMINAL_EMULATORS,
  AUTHORIZE_URL_REGEX,
  DEFAULT_EXPIRES_IN_PROVIDER,
} from './qwen-cli.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenCLIProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class QwenCoderCLIProvider implements Provider {
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
    models: MODELS,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
  };

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    const tempHome = path.join(os.tmpdir(), LOGIN_TEMP_HOME_PREFIX);
    if (fs.existsSync(tempHome))
      fs.rmSync(tempHome, { recursive: true, force: true });
    fs.mkdirSync(tempHome, { recursive: true });

    const cliPath = path.resolve(__dirname, QWEN_CLI_RELATIVE_PATH);
    await proxyService.start();
    const { port } = proxyService.getServerInfo();
    const logFile = path.join(tempHome, 'qwen-cli.log');

    let terminal = '';
    for (const t of TERMINAL_EMULATORS) {
      try {
        execSync(`which ${t}`, { stdio: 'ignore' });
        terminal = t;
        break;
      } catch (e) {}
    }

    if (!terminal) {
      logger.warn(
        '[QwenCLI] No supported terminal emulator found, falling back to direct node spawn',
      );
    }

    const nodePath = process.execPath;
    const proxyUrl = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
    };
    const envStr = `export http_proxy=${proxyUrl} https_proxy=${proxyUrl} HOME=${tempHome} NODE_TLS_REJECT_UNAUTHORIZED=0;`;
    const commandStr = `${envStr} (sleep 2; echo "qwen"; sleep 1; echo "") | ${nodePath} ${cliPath} --auth-type qwen-oauth 2>&1 | tee ${logFile}`;

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
      terminalSpawn = spawn(nodePath, [cliPath, 'chat', '--empty'], {
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
          const urlMatch = content.match(AUTHORIZE_URL_REGEX);
          if (urlMatch && !capturedUrl) {
            capturedUrl = urlMatch[0];
            clearInterval(checkInterval);
            loginService
              .captureCredentialsViaCDP({
                providerId: PROVIDER_ID,
                loginUrl: capturedUrl,
                partition: LOGIN_PARTITION,
                skipProxy: true,
                extraEvents: [
                  QWEN_CLI_EVENTS.TOKENS,
                  QWEN_CLI_EVENTS.USER_INFO,
                ],
                validate: async (captured) => {
                  if (captured.cookies && captured.email)
                    return { isValid: true };
                  return { isValid: false };
                },
              })
              .then((result) => {
                try {
                  fs.rmSync(tempHome, { recursive: true, force: true });
                } catch (e) {
                  logger.warn('[QwenCLI] Failed to clean up temp home:', e);
                }
                resolve(result);
              })
              .catch(reject);
          }
        }
      }, LOGIN_POLL_INTERVAL_MS);
      terminalSpawn.on('error', reject);
      setTimeout(() => {
        if (!capturedUrl) {
          clearInterval(checkInterval);
          logger.error('[QwenCLI] Login timed out waiting for OAuth URL');
          reject(new Error('Timed out'));
        }
      }, LOGIN_TIMEOUT_MS);
    });
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getUserProfile(accessToken: string) {
    try {
      const userAgent = `${QWEN_CODE_USER_AGENT_PREFIX}${QWEN_CLI_VERSION} (${process.platform}; ${process.arch})`;
      const response = await fetch(USER_INFO_URL, {
        headers: {
          [HTTP_HEADER_NAMES.USER_AGENT]: userAgent,
          [HTTP_HEADER_NAMES.X_DASHSCOPE_AUTHTYPE]: DASHSCOPE_AUTH_TYPE,
          [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${accessToken}`,
        },
      });
      if (response.ok) {
        const data = (await response.json()) as QwenUserProfile;
        if (!data[API_FIELDS.EMAIL] && !data[API_FIELDS.USERNAME]) {
          logger.warn('[QwenCLI] Get Profile response missing email/username');
        }
        return {
          email:
            data[API_FIELDS.EMAIL] || data[API_FIELDS.USERNAME] || null,
        };
      }
      logger.warn(`[QwenCLI] Get Profile returned status ${response.status}`);
    } catch (e) {
      logger.error('[QwenCLI] Get Profile Error:', e);
    }
    return { email: null };
  }

  // ─── Refresh Token ──────────────────────────────────────────────────

  async refreshToken(refreshTokenStr: string) {
    const response = await fetch(QWEN_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.FORM_URLENCODED,
        [HTTP_HEADER_NAMES.ACCEPT]: CONTENT_TYPES.JSON,
      },
      body: new URLSearchParams({
        [API_FIELDS.GRANT_TYPE]: GRANT_TYPES.REFRESH_TOKEN,
        [API_FIELDS.CLIENT_ID]: QWEN_CONFIG.clientId,
        [API_FIELDS.REFRESH_TOKEN]: refreshTokenStr,
      }),
    });
    if (!response.ok) {
      logger.error(
        `[QwenCLI] Token refresh failed with status ${response.status}`,
      );
      throw new Error('Failed to refresh Qwen token');
    }
    const json = (await response.json()) as QwenTokenResponse;
    let data: QwenTokenResponse = json;
    const rawResponse = json[API_FIELDS.RESPONSE];
    if (
      rawResponse &&
      typeof rawResponse === 'string' &&
      rawResponse.startsWith('{')
    ) {
      try {
        data = JSON.parse(rawResponse) as QwenTokenResponse;
      } catch (e) {
        logger.warn('[QwenCLI] Failed to parse nested token response:', e);
      }
    }
    return data;
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

    let tokens: QwenTokens;
    try {
      tokens = JSON.parse(credential) as QwenTokens;
    } catch (e) {
      logger.warn(
        '[QwenCLI] Credential is not valid JSON, treating as raw access token',
      );
      tokens = { accessToken: credential };
    }

    const url = CHAT_COMPLETIONS_URL;

    const sendRequest = async (token: string) => {
      const body: QwenChatPayload = {
        model: model,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: [{ type: CONTENT_BLOCK_TYPES.TEXT, text: m.content }],
        })),
        stream: stream !== false,
        stream_options:
          stream !== false ? { include_usage: true } : undefined,
      };
      return await fetch(url, {
        method: 'POST',
        headers: {
          [HTTP_HEADER_NAMES.AUTHORIZATION]: `${AUTH_PREFIXES.BEARER}${token}`,
          [HTTP_HEADER_NAMES.USER_AGENT]: QWEN_CHAT_USER_AGENT,
          [HTTP_HEADER_NAMES.X_DASHSCOPE_AUTHTYPE]: DASHSCOPE_AUTH_TYPE,
          [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        },
        body: JSON.stringify(body),
      });
    };

    try {
      let response = await sendRequest(tokens.accessToken);

      if (response.status === 401 && tokens.refreshToken) {
        try {
          const newTokens = await this.refreshToken(tokens.refreshToken);
          tokens.accessToken = newTokens[API_FIELDS.ACCESS_TOKEN]!;
          tokens.refreshToken =
            newTokens[API_FIELDS.REFRESH_TOKEN] || tokens.refreshToken;

          if (accountId) {
            try {
              const db = getDb();
              const newCredential = JSON.stringify({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn:
                  newTokens[API_FIELDS.EXPIRES_IN] ||
                  DEFAULT_EXPIRES_IN_PROVIDER,
              });
              db.prepare('UPDATE accounts SET credential = ? WHERE id = ?').run(
                newCredential,
                accountId,
              );
            } catch (e) {
              logger.error(
                '[QwenCLI] Failed to persist refreshed token to DB:',
                e,
              );
            }
          }
          response = await sendRequest(tokens.accessToken);
        } catch (e) {
          logger.error('[QwenCLI] Token refresh failed:', e);
        }
      }

      if (!response.ok)
        throw new Error(`Qwen CLI API Error ${response.status}`);

      if (stream !== false) {
        if (!response.body) throw new Error('No response body');
        await parseSSEStream(response.body as NodeJS.ReadableStream, {
          onContent,
        });
        onDone();
      } else {
        const json = (await response.json()) as QwenSSEEvent;
        onContent(
          json[API_FIELDS.CHOICES]?.[0]?.[API_FIELDS.MESSAGE]?.[
            API_FIELDS.CONTENT
          ] || '',
        );
        onDone();
      }
    } catch (err: any) {
      logger.error('[QwenCLI] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }
}

export default new QwenCoderCLIProvider();