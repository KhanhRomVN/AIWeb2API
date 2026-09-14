/**
 * ------------------------------------------------------------------
 * Codex CLI Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Codex CLI (OpenAI GPT-5 coding agent).
 * Hỗ trợ login qua terminal CLI, refresh token, và chat completion
 * với streaming response.
 *
 * Main features:
 * - login()          : Đăng nhập qua Codex CLI với terminal
 * - refreshToken()   : Refresh access token
 * - handleMessage()  : Gửi tin nhắn với streaming response
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

// ── Codex Constants ──
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  MODELS,
  IS_PAUSABLE,
  CODEX_CLI_EVENTS,
  CHATGPT_USAGE_URL,
  CODEX_RESPONSES_URL,
  AUTH_TOKEN_URL,
  USER_AGENT,
  ORIGINATOR,
  DEFAULT_INSTRUCTIONS,
  API_FIELDS,
  AUTH_CONFIG,
  CONTENT_TYPES,
  HTTP_HEADER_NAMES,
  HTTP_HEADERS,
  LOGIN_CONFIG,
  MESSAGE_TYPES,
  PAYLOAD_DEFAULTS,
  REGEX_PATTERNS,
  SSE_PROTOCOL,
  TERMINALS,
} from './codex-cli.constant';

// ── Codex Types ──
import {
  CodexCapturedTokens,
  CodexJwtPayload,
  CodexRequestPayload,
  CodexSSEChunk,
  CodexTokenResponse,
  CodexTokens,
  CodexUsageResponse,
  CodexUserInfo,
} from './codex-cli.types';

// ── Codex Internal ──
import { proxyHandler } from './codex-cli.proxy-handler';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('CodexCLIProvider');

// Lazy load zstd
let compress: any;
try {
  compress = require('@mongodb-js/zstd').compress;
} catch (e) {}

// ─── Provider Class ────────────────────────────────────────────────────

export class CodexCLIProvider implements Provider {
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
    models: MODELS,
    is_pausable: IS_PAUSABLE,
  };

  // ─── Get Profile ────────────────────────────────────────────────────

  async getUserProfile(accessToken: string): Promise<CodexUserInfo> {
    try {
      const response = await fetch(CHATGPT_USAGE_URL, {
        headers: {
          [HTTP_HEADER_NAMES.AUTHORIZATION]:
            `${HTTP_HEADERS.BEARER_PREFIX}${accessToken}`,
          [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
          [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        },
      });
      if (response.ok) {
        const data = (await response.json()) as CodexUsageResponse;
        if (!data.email) {
          logger.warn('[CodexCLI] Get Profile response missing email field');
        }
        return {
          email: data.email || null,
          userId: data.user_id,
          accountId: data.account_id,
        };
      }
      logger.warn(`[CodexCLI] Get Profile returned status ${response.status}`);
    } catch (e) {
      logger.error('[CodexCLI] Get Profile Error:', e);
    }
    return { email: null };
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    const tempHome = path.join(
      os.homedir(),
      LOGIN_CONFIG.TEMP_DIR_NAME,
      `${LOGIN_CONFIG.HOME_PREFIX}${Date.now()}`,
    );
    if (fs.existsSync(tempHome))
      fs.rmSync(tempHome, { recursive: true, force: true });
    fs.mkdirSync(tempHome, { recursive: true });

    await proxyService.start();
    const { port } = proxyService.getServerInfo();
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
        '[CodexCLI] No supported terminal emulator found, falling back to bash',
      );
    }

    const proxyUrl = `http://127.0.0.1:${port}`;
    const caCertPath = path.join(
      os.homedir(),
      LOGIN_CONFIG.TEMP_DIR_NAME,
      'certs',
      'certs',
      'ca.pem',
    );
    const env = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      SSL_CERT_FILE: caCertPath,
      REQUESTS_CA_BUNDLE: caCertPath,
      CURL_CA_BUNDLE: caCertPath,
    };
    const envStr = `export http_proxy=${proxyUrl} https_proxy=${proxyUrl} HOME=${tempHome} NODE_TLS_REJECT_UNAUTHORIZED=0 SSL_CERT_FILE=${caCertPath};`;
    const commandStr = `${envStr} codex login 2>&1 | tee ${logFile}`;

    let terminalSpawn: any;
    if (terminal === 'gnome-terminal') {
      terminalSpawn = spawn(
        terminal,
        ['--', 'bash', '-c', `${commandStr}; read`],
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
                partition: PROVIDER_ID,
                skipProxy: true,
                extraEvents: [
                  CODEX_CLI_EVENTS.TOKENS,
                  CODEX_CLI_EVENTS.USER_INFO,
                ],
                validate: async (captured) => {
                  if (captured.cookies) {
                    try {
                      const tokenData = JSON.parse(
                        captured.cookies,
                      ) as CodexCapturedTokens;
                      if (tokenData.accessToken) {
                        const profile = await this.getUserProfile(
                          tokenData.accessToken,
                        );
                        if (profile && profile.email)
                          return { isValid: true, email: profile.email };
                      }
                    } catch (e) {
                      logger.warn(
                        '[CodexCLI] Failed to parse captured tokens:',
                        e,
                      );
                    }
                  }
                  return captured.cookies && captured.email
                    ? { isValid: true }
                    : { isValid: false };
                },
              })
              .then(resolve)
              .catch(reject);
          }
        }
      }, LOGIN_CONFIG.POLL_INTERVAL_MS);
      terminalSpawn.on('error', reject);
      setTimeout(() => {
        if (!capturedUrl) {
          clearInterval(checkInterval);
          reject(new Error('Timed out'));
        }
      }, LOGIN_CONFIG.TIMEOUT_MS);
    });
  }

  // ─── Refresh Token ──────────────────────────────────────────────────

  async refreshToken(refreshTokenStr: string): Promise<CodexTokenResponse> {
    const response = await fetch(AUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.FORM_URLENCODED,
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_JSON,
      },
      body: new URLSearchParams({
        grant_type: AUTH_CONFIG.GRANT_TYPE_REFRESH,
        client_id: AUTH_CONFIG.CLIENT_ID,
        refresh_token: refreshTokenStr,
      }),
    });
    if (!response.ok) {
      logger.error(
        `[CodexCLI] Token refresh failed with status ${response.status}`,
      );
      throw new Error('Failed to refresh Codex token');
    }
    return (await response.json()) as CodexTokenResponse;
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
      conversationId,
    } = options;

    let tokens: CodexTokens;
    try {
      tokens = JSON.parse(credential) as CodexTokens;
    } catch (e) {
      logger.warn(
        '[CodexCLI] Credential is not valid JSON, treating as raw access token',
      );
      tokens = { accessToken: credential, refreshToken: '', expiresIn: 0 };
    }

    const url = CODEX_RESPONSES_URL;

    const sendRequest = async (token: string) => {
      let chatgptAccountId = '';
      try {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString(),
        ) as CodexJwtPayload;
        chatgptAccountId =
          payload[API_FIELDS.JWT_AUTH_CLAIM]?.[
            API_FIELDS.JWT_CHATGPT_ACCOUNT_ID
          ] || '';
      } catch (e) {
        logger.warn('[CodexCLI] Failed to decode JWT payload:', e);
      }

      const bodyObj: CodexRequestPayload = {
        model: model,
        instructions: DEFAULT_INSTRUCTIONS,
        input: messages.map((m) => ({
          type: MESSAGE_TYPES.MESSAGE,
          role: m.role,
          content: [
            {
              type:
                m.role === 'assistant'
                  ? MESSAGE_TYPES.OUTPUT_TEXT
                  : MESSAGE_TYPES.INPUT_TEXT,
              text: m.content,
            },
          ],
        })),
        store: PAYLOAD_DEFAULTS.STORE,
        stream: stream !== false,
        include: [PAYLOAD_DEFAULTS.INCLUDE_REASONING_ENCRYPTED],
        reasoning: { effort: PAYLOAD_DEFAULTS.REASONING_EFFORT },
      };

      // Gửi conversation_id để ChatGPT phân biệt các phiên hội thoại khác nhau
      // từ cùng một account, tránh bị gộp request.
      if (conversationId) {
        bodyObj.conversation_id = conversationId;
      }

      const jsonBody = JSON.stringify(bodyObj);
      let finalBody: string | Buffer = jsonBody;
      const headers: Record<string, string> = {
        [HTTP_HEADER_NAMES.ACCEPT]: HTTP_HEADERS.ACCEPT_SSE,
        [HTTP_HEADER_NAMES.AUTHORIZATION]:
          `${HTTP_HEADERS.BEARER_PREFIX}${token}`,
        [HTTP_HEADER_NAMES.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        [HTTP_HEADER_NAMES.USER_AGENT]: USER_AGENT,
        [HTTP_HEADER_NAMES.ORIGINATOR]: ORIGINATOR,
      };
      if (chatgptAccountId)
        headers[HTTP_HEADER_NAMES.CHATGPT_ACCOUNT_ID] = chatgptAccountId;

      if (compress) {
        try {
          const compressed = await compress(Buffer.from(jsonBody));
          finalBody = compressed;
          headers[HTTP_HEADER_NAMES.CONTENT_ENCODING] =
            HTTP_HEADERS.CONTENT_ENCODING_ZSTD;
        } catch (e) {
          logger.warn(
            '[CodexCLI] Failed to compress request body with zstd:',
            e,
          );
        }
      }

      return await fetch(url, { method: 'POST', headers, body: finalBody });
    };

    try {
      let response = await sendRequest(tokens.accessToken);

      if (response.status === 401 && tokens.refreshToken) {
        try {
          const newTokens = await this.refreshToken(tokens.refreshToken);
          tokens.accessToken = newTokens.access_token;
          tokens.refreshToken = newTokens.refresh_token || tokens.refreshToken;
          if (accountId) {
            try {
              getDb()
                .prepare('UPDATE accounts SET credential = ? WHERE id = ?')
                .run(JSON.stringify(tokens), accountId);
            } catch (e) {
              logger.error(
                '[CodexCLI] Failed to persist refreshed token to DB:',
                e,
              );
            }
          }
          response = await sendRequest(tokens.accessToken);
        } catch (e) {}
      }

      if (!response.ok) throw new Error(`Codex API Error ${response.status}`);

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
              const json = JSON.parse(jsonStr) as CodexSSEChunk;
              const content =
                json.delta ||
                json.choices?.[0]?.delta?.content ||
                json.message?.content?.parts?.[0];
              if (content)
                onContent(
                  typeof content === 'string'
                    ? content
                    : JSON.stringify(content),
                );
            } catch (e) {
              logger.warn('[CodexCLI] Failed to parse SSE line:', e);
            }
          }
        }
        onDone();
      } else {
        const json = (await response.json()) as CodexSSEChunk;
        const content = json.choices?.[0]?.message?.content || '';
        onContent(content);
        onDone();
      }
    } catch (err: any) {
      logger.error('[CodexCLI] Error in handleMessage:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────
  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }
}
export default new CodexCLIProvider();