import { Provider, SendMessageOptions } from './types';
import { Router } from 'express';
import { HttpClient } from '../utils/http-client';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { createLogger } from '../utils/logger';
import { loginService } from '../services/login.service';
import { ProxyHandler } from '../services/proxy.service';
import { proxyEvents } from '../services/proxy-events';
import { countTokens, countMessagesTokens } from '../utils/tokenizer';

const logger = createLogger('GeminiProvider');

// =============================================================================
// CONSTANTS
// =============================================================================

export const BASE_URL = 'https://gemini.google.com';

// Gemini Web build label (bl parameter) — may need periodic update
const GEMINI_BL = 'boq_assistant-bard-web-server_20260525.09_p0';

// Model mapping: MODE_CATEGORY enum from Gemini frontend JS source
// 1=FAST, 2=THINKING, 3=PRO, 4=AUTO, 5=FAST_DYNAMIC_THINKING, 6=FLASH_LITE
const MODEL_MAP: Record<string, { mode: number; think: number; desc: string }> =
  {
    'gemini-3.5-flash': {
      mode: 1,
      think: 4,
      desc: 'Fast general-purpose model',
    },
    'gemini-3.5-flash-thinking': {
      mode: 2,
      think: 0,
      desc: 'Deep thinking mode, longest output (~20k chars)',
    },
    'gemini-3.1-pro': {
      mode: 3,
      think: 4,
      desc: 'Pro model (requires cookie for real routing)',
    },
    'gemini-auto': { mode: 4, think: 4, desc: 'Auto model selection' },
    'gemini-3.5-flash-thinking-lite': {
      mode: 5,
      think: 0,
      desc: 'Dynamic thinking with adaptive depth',
    },
    'gemini-flash-lite': { mode: 6, think: 4, desc: 'Lightweight fast model' },
  };

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface GeminiCredential {
  cookie: string; // Full cookie string: "SID=xxx; HSID=xxx; ..."
  sapisid?: string; // SAPISID value for SAPISIDHASH auth header
  authUser?: string; // Google account index (e.g. "1" for /u/1/)
  xsrfToken?: string; // XSRF token from Gemini page source (SNlM0e)
  email?: string; // Account email
}

// =============================================================================
// PROXY HANDLER
// =============================================================================

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('gemini.google.com')) {
      logger.debug(`[Proxy] Gemini Request: ${url}`);

      // Capture cookies from authenticated requests
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies) {
        // Check if this looks like a valid authenticated session
        const hasSID = reqCookies.includes('SID=');
        const hasSecure1PSID = reqCookies.includes('__Secure-1PSID=');
        if (hasSID && hasSecure1PSID) {
          logger.info('[Proxy] Captured Gemini authenticated cookies');
          proxyEvents.emit('gemini-cookies', { cookies: reqCookies });

          // Extract SAPISID for auth header
          const sapisidMatch = reqCookies.match(/SAPISID=([^;]+)/);
          if (sapisidMatch) {
            proxyEvents.emit('gemini-sapisid', { sapisid: sapisidMatch[1] });
          }
        }
      }

      // Capture auth user from URL path
      const authUserMatch = url.match(/\/u\/(\d+)\//);
      if (authUserMatch) {
        proxyEvents.emit('gemini-auth-user', { authUser: authUserMatch[1] });
      }
    }

    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    // Capture email from Google account info (multiple sources)
    const emailMatch =
      body.match(
        /"email"\s*:\s*"([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})"/,
      ) || body.match(/"oPEP7c"\s*:\s*"([^"]+)"/);

    if (
      host &&
      host.includes('www.googleapis.com') &&
      url.includes('oauth2') &&
      url.includes('userinfo')
    ) {
      // GET /oauth2/v1/userinfo — cleanest JSON source
      if (emailMatch && emailMatch[1]) {
        logger.info(
          `[Proxy] Captured Gemini Google Email (userinfo): ${emailMatch[1]}`,
        );
        proxyEvents.emit('gemini-email', { email: emailMatch[1] });
      }
    } else if (
      host &&
      host.includes('accounts.google.com') &&
      (url.includes('signin/oauth') || url.includes('userinfo'))
    ) {
      if (emailMatch && emailMatch[1] && !emailMatch[1].includes('***')) {
        logger.info(
          `[Proxy] Captured Gemini Google Email (accounts): ${emailMatch[1]}`,
        );
        proxyEvents.emit('gemini-email', { email: emailMatch[1] });
      }
    } else if (
      host &&
      host.includes('gemini.google.com') &&
      url.includes('batchexecute') &&
      body.includes('o30O0e') &&
      body.includes('@')
    ) {
      // batchexecute rpcid=o30O0e — Gemini profile RPC contains email
      if (emailMatch && emailMatch[1]) {
        logger.info(
          `[Proxy] Captured Gemini Google Email (batchexecute): ${emailMatch[1]}`,
        );
        proxyEvents.emit('gemini-email', { email: emailMatch[1] });
      }
    }

    // Capture XSRF token from Gemini page source
    if (host && host.includes('gemini.google.com') && body.includes('SNlM0e')) {
      const xsrfMatch = body.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
      if (xsrfMatch && xsrfMatch[1]) {
        logger.info('[Proxy] Captured Gemini XSRF token');
        proxyEvents.emit('gemini-xsrf', { xsrfToken: xsrfMatch[1] });
      }
    }
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function makeSapisidHash(sapisid: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash('sha1')
    .update(`${ts} ${sapisid} https://gemini.google.com`)
    .digest('hex');
  return `SAPISIDHASH ${ts}_${hash}`;
}

function getAccountPrefix(authUser?: string): string {
  if (!authUser || authUser === '') return '';
  return `/u/${authUser}`;
}

/**
 * Build the StreamGenerate request payload in Gemini's internal format.
 * This mirrors the protobuf-like array structure used by the Gemini web app.
 */
function buildPayload(
  prompt: string,
  modelId: number,
  thinkMode: number,
): string {
  const inner: any[] = new Array(102).fill(null);
  inner[0] = [prompt, 0, null, null, null, null, 0];
  inner[1] = ['en'];
  inner[2] = ['', '', '', null, null, null, null, null, null, ''];
  inner[6] = [0];
  inner[7] = 1;
  inner[10] = 1;
  inner[11] = 0;
  inner[17] = [[thinkMode]];
  inner[18] = 0;
  inner[27] = 1;
  inner[30] = [4];
  inner[41] = [2];
  inner[53] = 0;
  inner[59] = crypto.randomUUID();
  inner[61] = [];
  inner[68] = 1;
  inner[79] = modelId;

  return JSON.stringify([null, JSON.stringify(inner)]);
}

/**
 * Build the URL-encoded form body for StreamGenerate POST.
 */
function buildRequestBody(
  prompt: string,
  modelId: number,
  thinkMode: number,
  xsrfToken?: string,
): string {
  const fReq = buildPayload(prompt, modelId, thinkMode);
  const params = new URLSearchParams();
  params.set('f.req', fReq);
  if (xsrfToken) {
    params.set('at', xsrfToken);
  }
  return params.toString();
}

/**
 * Get the StreamGenerate URL with proper request ID and build label.
 */
function getStreamGenerateUrl(authUser?: string): string {
  const reqid = Math.floor(Date.now() / 1000) % 1000000;
  const prefix = getAccountPrefix(authUser);
  return (
    `https://gemini.google.com${prefix}/_/BardChatUi/data/` +
    `assistant.lamda.BardFrontendService/StreamGenerate` +
    `?bl=${GEMINI_BL}&hl=en&_reqid=${reqid}&rt=c`
  );
}

/**
 * Extract text chunks from a single JSON line of StreamGenerate response.
 * Gemini sends response in format: [null, "<escaped JSON string>"]
 * The inner JSON contains text in index [4] as an array of message parts.
 */
function extractTextsFromLine(line: string): string[] {
  if (!line.includes('"wrb.fr"') || line.length < 200) return [];
  try {
    const arr = JSON.parse(line);
    const innerStr = arr[0]?.[2];
    if (!innerStr || typeof innerStr !== 'string' || innerStr.length < 50)
      return [];
    const inner = JSON.parse(innerStr);
    if (!Array.isArray(inner) || inner.length <= 4 || !inner[4]) return [];
    const texts: string[] = [];
    for (const part of inner[4]) {
      if (
        Array.isArray(part) &&
        part.length > 1 &&
        part[1] &&
        Array.isArray(part[1])
      ) {
        for (const t of part[1]) {
          if (typeof t === 'string' && t) {
            texts.push(t);
          }
        }
      }
    }
    return texts;
  } catch {
    return [];
  }
}

/**
 * Clean Gemini response text: remove code reference artifacts and card content URLs.
 */
function cleanText(text: string): string {
  return text
    .replace(
      /```(?:python|javascript|text)\?code_(?:reference|stdout)&code_event_index=\d+\n.*?```\n?/gs,
      '',
    )
    .replace(/http:\/\/googleusercontent\.com\/card_content\/\d+\n?/g, '')
    .trim();
}

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class GeminiProvider implements Provider {
  name = 'gemini';
  proxyHandler = proxyHandler;
  defaultModel = 'gemini-3.5-flash';

  // ===========================================================================
  // PROFILE
  // ===========================================================================

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const cred = this.parseCredential(credential);
      // Try to get user info by fetching the Gemini app page and parsing the embedded data
      const prefix = getAccountPrefix(cred.authUser);
      const url = `https://gemini.google.com${prefix}/app`;
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      };
      if (cred.cookie) {
        headers['Cookie'] = cred.cookie;
      }
      if (cred.sapisid) {
        headers['Authorization'] = makeSapisidHash(cred.sapisid);
      }
      if (cred.authUser) {
        headers['X-Goog-AuthUser'] = cred.authUser;
      }

      const response = await fetch(url, { method: 'GET', headers });

      if (response.ok) {
        const html = await response.text();
        // Try to extract email from embedded data in the page
        const emailMatch =
          html.match(/"email"\s*:\s*"([^"]+@[^"]+)"/) ||
          html.match(/userEmail["']?\s*:\s*["']([^"']+)["']/);
        if (emailMatch && emailMatch[1]) {
          return { email: emailMatch[1] };
        }
      }

      // If we already have an email in the credential, use it
      if (cred.email) {
        return { email: cred.email };
      }

      return { email: null };
    } catch (e) {
      logger.error('[Gemini] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ===========================================================================
  // LOGIN
  // ===========================================================================

  async login(options?: { method?: 'google' | 'basic' }) {
    const method = options?.method || 'google';
    const loginUrl = 'https://gemini.google.com/app';

    logger.info(`Starting Gemini login with method: ${method}`);

    // Guard to prevent concurrent validate calls
    let validating = false;
    // Shared state updated by direct proxyEvent listeners (runs before validate snapshot)
    const captured = { xsrfToken: '', authUser: '' };
    const onXsrf = (data: any) => {
      if (data?.xsrfToken) captured.xsrfToken = data.xsrfToken;
    };
    const onAuthUser = (data: any) => {
      if (data?.authUser) captured.authUser = data.authUser;
    };
    proxyEvents.on('gemini-xsrf', onXsrf);
    proxyEvents.on('gemini-auth-user', onAuthUser);

    return await loginService
      .login({
        providerId: 'gemini',
        loginUrl,
        partition: `gemini-${Date.now()}`,
        cookieEvent: 'gemini-cookies',
        infoEvent: 'gemini-email',
        extraEvents: ['gemini-sapisid', 'gemini-auth-user', 'gemini-xsrf'],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          // Skip if another validate is already in progress
          if (validating) return { isValid: false };
          validating = true;

          try {
            logger.info('[Gemini] Validating captured cookies');
            const cookie = data.cookies;
            let email = data.email;

            const sapisidMatch = cookie.match(/SAPISID=([^;]+)/);
            const sapisid = sapisidMatch ? sapisidMatch[1] : '';

            // Try to fetch email once, but don't block login if unavailable
            if (!email) {
              logger.info(
                '[Gemini] Email not captured directly, fetching profile...',
              );
              try {
                const credStr = JSON.stringify({ cookie, sapisid });
                const profile = await this.getProfile(credStr);
                email = profile.email || undefined;
              } catch {
                // Profile fetch failed — proceed without email
              }
            }

            // If xsrf still missing after email fetch, wait a bit more
            if (!captured.xsrfToken) {
              logger.debug(
                '[Gemini] XSRF missing, waiting 1.5s for xsrf event...',
              );
              await new Promise((r) => setTimeout(r, 1500));
            }

            const hasSID =
              cookie.includes('SID=') && cookie.includes('__Secure-1PSID=');
            if (hasSID) {
              const credential = JSON.stringify({
                cookie,
                sapisid,
                xsrfToken: captured.xsrfToken,
                authUser: captured.authUser,
                email: email || '',
              });
              logger.info(
                `[Gemini] Login accepted${email ? ` | email=${email}` : ' | email=unknown'}${captured.xsrfToken ? ' | xsrf=yes' : ' | xsrf=missing'}`,
              );
              return {
                isValid: true,
                cookies: credential,
                email: email || null,
              };
            }

            return { isValid: false };
          } finally {
            validating = false;
          }
        },
      })
      .finally(() => {
        proxyEvents.off('gemini-xsrf', onXsrf);
        proxyEvents.off('gemini-auth-user', onAuthUser);
      });
  }

  // ===========================================================================
  // HANDLE MESSAGE
  // ===========================================================================

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
    } = options;

    const cred = this.parseCredential(credential);
    const modelConfig = this.resolveModel(model);

    try {
      // Build prompt from full message history (system + all turns)
      const promptParts: string[] = [];
      for (const msg of messages) {
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? (msg.content as any[])
                  .filter(
                    (c: any) => c.type === 'text' || c.type === 'input_text',
                  )
                  .map((c: any) => c.text || '')
                  .join(' ')
              : '';

        if (msg.role === 'system') {
          promptParts.push(`[System Instructions:] ${content}`);
        } else if (msg.role === 'assistant') {
          promptParts.push(`[Assistant]: ${content}`);
        } else if (msg.role === 'user') {
          promptParts.push(content);
        }
      }
      const prompt = promptParts.filter(Boolean).join('\n\n');
      if (!prompt.trim()) {
        throw new Error('No messages to send');
      }

      const buildHeaders = (c: typeof cred): Record<string, string> => {
        const h: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://gemini.google.com',
          Referer: `https://gemini.google.com${getAccountPrefix(c.authUser)}/app`,
          'X-Same-Domain': '1',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        };
        if (c.authUser) h['X-Goog-AuthUser'] = c.authUser;
        if (c.cookie) h['Cookie'] = c.cookie;
        if (c.sapisid) h['Authorization'] = makeSapisidHash(c.sapisid);
        return h;
      };

      // Allow one XSRF retry: if Gemini returns 400 with an xsrf token,
      // extract it and retry the request once with the correct token.
      let currentCred = cred;
      let attempt = 0;

      while (attempt < 2) {
        attempt++;
        const url = getStreamGenerateUrl(currentCred.authUser);
        const body = buildRequestBody(
          prompt,
          modelConfig.mode,
          modelConfig.think,
          currentCred.xsrfToken,
        );
        const headers = buildHeaders(currentCred);

        logger.info(
          `[Gemini] Sending request | attempt=${attempt} | model=${model} | mode=${modelConfig.mode} | think=${modelConfig.think} | xsrf=${currentCred.xsrfToken ? 'yes' : 'no'} | promptLen=${prompt.length}`,
        );

        const response = await fetch(url, { method: 'POST', headers, body });

        if (!response.ok) {
          const errorText = await response.text();

          // Check if Gemini is giving us the correct XSRF token in the error
          const xsrfFromError = errorText.match(/"xsrf","([^"]+)"/)?.[1];
          if (xsrfFromError && attempt === 1) {
            logger.info(
              `[Gemini] Got XSRF from error response, retrying | xsrf=${xsrfFromError.slice(0, 20)}...`,
            );
            currentCred = { ...currentCred, xsrfToken: xsrfFromError };
            continue;
          }

          throw new Error(
            `Gemini API returned ${response.status}: ${errorText.slice(0, 500)}`,
          );
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // ── Parse StreamGenerate response ──────────────────────────────────
        const promptTokens = countMessagesTokens(messages);
        const completionTokensRef = { value: 0 };
        let prevText = '';
        let buffer = '';
        let totalBytes = 0;

        for await (const chunk of response.body as NodeJS.ReadableStream) {
          const chunkStr = chunk.toString();
          totalBytes += chunkStr.length;
          if (onRaw) onRaw(chunkStr);
          buffer += chunkStr;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const texts = extractTextsFromLine(line);
            for (const t of texts) {
              if (t.length > prevText.length) {
                const delta = cleanText(t.slice(prevText.length));
                if (delta) {
                  completionTokensRef.value += countTokens(delta);
                  onContent(delta);
                  if (onMetadata) {
                    onMetadata({
                      total_token: promptTokens + completionTokensRef.value,
                    });
                  }
                }
                prevText = t;
              }
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const texts = extractTextsFromLine(buffer);
          for (const t of texts) {
            if (t.length > prevText.length) {
              const delta = cleanText(t.slice(prevText.length));
              if (delta) {
                completionTokensRef.value += countTokens(delta);
                onContent(delta);
              }
              prevText = t;
            }
          }
        }

        logger.debug(
          `[Gemini] Stream complete | model=${model} | totalBytes=${totalBytes} | completionTokens=${completionTokensRef.value}`,
        );

        onDone();
        return; // success — exit loop
      }
    } catch (err: any) {
      logger.error('[Gemini] handleMessage error:', err);
      onError(err);
    }
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Parse credential string into structured GeminiCredential.
   * Supports both JSON format and raw cookie string.
   */
  private parseCredential(credential: string): GeminiCredential {
    try {
      const parsed = JSON.parse(credential);
      return {
        cookie: parsed.cookie || parsed.cookies || credential,
        sapisid: parsed.sapisid || '',
        authUser: parsed.authUser || parsed.auth_user || '',
        xsrfToken: parsed.xsrfToken || parsed.xsrf_token || '',
        email: parsed.email || '',
      };
    } catch {
      // Plain cookie string
      const sapisidMatch = credential.match(/SAPISID=([^;]+)/);
      return {
        cookie: credential,
        sapisid: sapisidMatch ? sapisidMatch[1] : '',
      };
    }
  }

  /**
   * Resolve model name to mode/think config.
   * Also supports @think=N suffix for thinking depth control.
   */
  private resolveModel(modelName: string): { mode: number; think: number } {
    let name = modelName.trim().toLowerCase();
    let thinkOverride: number | null = null;

    // Check for @think=N suffix
    const thinkMatch = name.match(/@think=(\d+)$/);
    if (thinkMatch) {
      thinkOverride = parseInt(thinkMatch[1], 10);
      name = name.replace(/@think=\d+$/, '').trim();
    }

    const config = MODEL_MAP[name];
    if (!config) {
      logger.warn(
        `[Gemini] Unknown model "${modelName}", falling back to flash`,
      );
      return { mode: 1, think: 4 }; // Default: gemini-3.5-flash
    }

    return {
      mode: config.mode,
      think: thinkOverride !== null ? thinkOverride : config.think,
    };
  }

  async stopStream(_credential: string, _chatId: string, _messageId: string) {
    // Gemini Web StreamGenerate doesn't have a stop endpoint
    // The stream will naturally stop if the client disconnects
    logger.debug('[Gemini] stopStream called (no-op for Gemini Web)');
  }

  registerRoutes(router: Router) {
    router.post('/files', async (_req, res) => {
      // Gemini Web doesn't support file upload via this API
      res.json({ error: 'File upload not supported for Gemini Web provider' });
    });
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('gemini') || m.startsWith('gemini-');
  }
}

export default new GeminiProvider();
