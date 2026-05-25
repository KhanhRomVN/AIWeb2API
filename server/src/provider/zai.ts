import { Provider, SendMessageOptions } from './types';
import { Router } from 'express';
import { createLogger } from '../utils/logger';
import { loginService } from '../services/login.service';
import { ProxyHandler } from '../services/proxy.service';
import { proxyEvents } from '../services/proxy-events';
import { getDB } from '../utils/database';
import fetch from 'node-fetch';
import * as crypto from 'crypto';

const logger = createLogger('ZAIProvider');

const BASE_URL = 'https://chat.z.ai';
const SALT = 'key-@@@@)))()((9))-xxxx&&&%%%%%';

// =============================================================================
// TYPES
// =============================================================================

interface ZAIAuthData {
  token: string;
  userId: string;
  email?: string;
  cookies?: string;
  userAgent?: string;
}

interface SignatureResult {
  signature: string;
  timestamp: string;
  requestId: string;
  queryParams: string;
}

// =============================================================================
// AUTH UTILS
// =============================================================================

function getAuthDataFromCredential(credential: string): ZAIAuthData | null {
  if (!credential) return null;

  try {
    const credParts = credential.split('|||');
    const jwtToken = credParts[0];
    const cookies = credParts[1] || '';
    const userAgent = credParts[2] || '';

    const parts = jwtToken.split('.');
    if (parts.length >= 2) {
      const payloadB64 = parts[1];
      const padding = '='.repeat((4 - (payloadB64.length % 4)) % 4);
      const payloadJson = Buffer.from(payloadB64 + padding, 'base64').toString(
        'utf-8',
      );
      const payload = JSON.parse(payloadJson);
      const userId = payload.id;
      return {
        token: jwtToken,
        userId: userId || '',
        email: payload.email,
        cookies,
        userAgent,
      };
    }
    return { token: jwtToken, userId: '', cookies, userAgent };
  } catch (e) {
    logger.error('Failed to parse credential:', e);
    return null;
  }
}

function parseUserAgentDetails(userAgent: string) {
  let osName = 'Windows';
  let secChUaPlatform = '"Windows"';

  if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS X')) {
    osName = 'Mac';
    secChUaPlatform = '"macOS"';
  } else if (userAgent.includes('Linux') || userAgent.includes('X11')) {
    osName = 'Linux';
    secChUaPlatform = '"Linux"';
  }

  // Extract Chrome version
  let chromeVersion = '124'; // fallback default
  const match = userAgent.match(/Chrome\/([0-9]+)\./);
  if (match) {
    chromeVersion = match[1];
  }

  const secChUa = `"Chromium";v="${chromeVersion}", "Not-A.Brand";v="24", "Google Chrome";v="${chromeVersion}"`;

  return { osName, secChUaPlatform, secChUa };
}

function generateSignatureAndParams(
  prompt: string,
  token: string,
  userId: string,
  chatId?: string,
  timestampMs?: string,
  userAgent?: string,
): SignatureResult {
  const timestamp = timestampMs || String(Date.now());
  const requestId = crypto.randomUUID();

  const currentUrl = chatId
    ? `https://chat.z.ai/c/${chatId}`
    : 'https://chat.z.ai/';
  const pathname = chatId ? `/c/${chatId}` : '/';

  const defaultUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const activeUa = userAgent || defaultUa;
  const uaDetails = parseUserAgentDetails(activeUa);

  const metadata: Record<string, string> = {
    timestamp,
    requestId,
    user_id: userId,
    version: '0.0.1',
    platform: 'web',
    token,
    user_agent: activeUa,
    language: 'vi',
    languages: 'vi,en-US,en',
    timezone: 'Asia/Saigon',
    cookie_enabled: 'true',
    screen_width: '1920',
    screen_height: '1080',
    screen_resolution: '1920x1080',
    viewport_height: '1080',
    viewport_width: '1920',
    viewport_size: '1920x1080',
    color_depth: '24',
    pixel_ratio: '1',
    current_url: currentUrl,
    pathname: pathname,
    search: '',
    hash: '',
    host: 'chat.z.ai',
    hostname: 'chat.z.ai',
    protocol: 'https:',
    referrer: '',
    title: 'Z.ai - Free AI Chatbot',
    timezone_offset: '-420',
    local_time: new Date().toISOString(),
    utc_time: new Date().toUTCString(),
    is_mobile: 'false',
    is_touch: 'false',
    max_touch_points: '0',
    browser_name: 'Chrome',
    os_name: uaDetails.osName,
    signature_timestamp: timestamp,
  };

  const sigPayload = {
    requestId,
    timestamp,
    user_id: userId,
  };
  const sortedKeys = Object.keys(sigPayload).sort();
  const sortedItems: string[] = [];
  for (const k of sortedKeys) {
    sortedItems.push(k);
    sortedItems.push(String(sigPayload[k as keyof typeof sigPayload]));
  }
  const sortedPayload = sortedItems.join(',');

  const b64Prompt = Buffer.from(prompt, 'utf-8').toString('base64');
  const dataString = `${sortedPayload}|${b64Prompt}|${timestamp}`;

  const timeChunk = String(Math.floor(Number(timestamp) / 300000));
  const k1 = crypto.createHmac('sha256', SALT).update(timeChunk).digest('hex');
  const signature = crypto
    .createHmac('sha256', k1)
    .update(dataString)
    .digest('hex');

  const queryParams = new URLSearchParams(metadata).toString();

  return {
    signature,
    timestamp,
    requestId,
    queryParams,
  };
}

function sanitizeCookies(cookieString: string, token: string): string {
  if (!cookieString) return '';
  const regex = /token=[^;]+/g;
  if (regex.test(cookieString)) {
    return cookieString.replace(regex, `token=${token}`);
  } else {
    return cookieString.trim().endsWith(';')
      ? `${cookieString} token=${token};`
      : `${cookieString}; token=${token};`;
  }
}

function getHeaders(
  token: string,
  signature: string,
  chatId?: string,
  cookies?: string,
  userAgent?: string,
): Record<string, string> {
  const defaultUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const activeUa = userAgent || defaultUa;
  const uaDetails = parseUserAgentDetails(activeUa);
  const referer = chatId
    ? `https://chat.z.ai/c/${chatId}`
    : 'https://chat.z.ai/';
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Signature': signature,
    'X-Fe-Version': 'prod-fe-1.1.35',
    'User-Agent': activeUa,
    Origin: 'https://chat.z.ai',
    Referer: referer,
    'sec-ch-ua': uaDetails.secChUa,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': uaDetails.secChUaPlatform,
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'accept-language': 'vi,en-US,en',
  };
  if (cookies) {
    headers['Cookie'] = sanitizeCookies(cookies, token);
  }
  return headers;
}

// =============================================================================
// PROXY HANDLER
// =============================================================================

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    if (host && host.includes('chat.z.ai')) {
      const cookieHeader = ctx.clientToProxyRequest.headers['cookie'];
      const userAgentHeader = ctx.clientToProxyRequest.headers['user-agent'];
      if (cookieHeader) {
        ctx.capturedZaiCookie = cookieHeader;
      }
      if (userAgentHeader) {
        ctx.capturedZaiUserAgent = userAgentHeader;
      }

      const auth = ctx.clientToProxyRequest.headers['authorization'];
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.replace('Bearer ', '').trim();
        let cookiesVal = token;
        if (cookieHeader) {
          cookiesVal += `|||${cookieHeader}`;
          if (userAgentHeader) {
            cookiesVal += `|||${userAgentHeader}`;
          }
        }
        logger.info(
          '[Proxy] Captured Z.AI token, cookies and user-agent from request headers',
        );
        proxyEvents.emit('zai-token', { cookies: cookiesVal });
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('chat.z.ai')) {
      if (url?.includes('/api/v1/auths')) {
        try {
          const json = JSON.parse(body);
          if (json.token) {
            logger.info(
              '[Proxy] Captured Z.AI Login Token, cookies and user-agent from auths API response',
            );
            let cookiesVal = json.token;
            if (ctx.capturedZaiCookie) {
              cookiesVal += `|||${ctx.capturedZaiCookie}`;
              if (ctx.capturedZaiUserAgent) {
                cookiesVal += `|||${ctx.capturedZaiUserAgent}`;
              }
            }
            proxyEvents.emit('zai-token', {
              cookies: cookiesVal,
              email: json.email,
            });
          }
        } catch (e) {
          logger.error('[Proxy] Failed to parse Z.AI auths response:', e);
        }
      }
    }
  },
};

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class ZAIProvider implements Provider {
  name = 'Z.AI';
  proxyHandler = proxyHandler;
  defaultModel = 'GLM-5.1';

  async getModels(credential: string): Promise<any[]> {
    return [
      {
        id: 'GLM-5.1',
        name: 'GLM-5.1',
        is_thinking: false,
        context_length: null,
      },
      {
        id: 'GLM-5',
        name: 'GLM-5',
        is_thinking: false,
        context_length: null,
      },
    ];
  }

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const jwtToken = credential.split('|||')[0];
      const parts = jwtToken.split('.');
      if (parts.length >= 2) {
        const payloadB64 = parts[1];
        const padding = '='.repeat((4 - (payloadB64.length % 4)) % 4);
        const payloadJson = Buffer.from(
          payloadB64 + padding,
          'base64',
        ).toString('utf-8');
        const payload = JSON.parse(payloadJson);
        return {
          email: payload.email || null,
          id: payload.id,
          name: payload.name,
        };
      }
      return { email: null };
    } catch (e) {
      logger.error('[Z.AI] Get Profile Error:', e);
      return { email: null };
    }
  }

  async login() {
    logger.info('Starting Z.AI login...');

    return await loginService.login({
      providerId: 'z',
      loginUrl: 'https://chat.z.ai/',
      partition: `z-${Date.now()}`,
      cookieEvent: 'zai-token',
      infoEvent: 'zai-login-email',
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies) {
          const profile = await this.getProfile(data.cookies);
          const emailOrId = profile.email || profile.id;
          const isGuest = emailOrId
            ? emailOrId.toLowerCase().includes('guest')
            : true;
          if (emailOrId && !isGuest) {
            logger.info(`[Z.AI] Validation success for email: ${emailOrId}`);
            return {
              isValid: true,
              email: emailOrId,
              cookies: data.cookies,
            };
          } else {
            logger.info(`[Z.AI] Ignored guest session token: ${emailOrId}`);
          }
        }
        return { isValid: false };
      },
    });
  }

  // User-Agent rotation pool
  private userAgents: string[] = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  ];
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestWindowStart: number = Date.now();

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset window every 60 seconds
    if (now - this.requestWindowStart > 60000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    // Max 8 requests per minute (保守)
    if (this.requestCount >= 8) {
      const waitTime = 60000 - (now - this.requestWindowStart);
      if (waitTime > 0) {
        logger.warn(`[Z.AI] Rate limit reached, waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.requestWindowStart = Date.now();
      }
    }

    // Random delay between 0.5-2.5 seconds between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (this.lastRequestTime > 0 && timeSinceLastRequest < 500) {
      const delay = Math.random() * 2000 + 500; // 500-2500ms
      logger.debug(`[Z.AI] Adding random delay ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
      onSessionCreated,
      conversationId,
    } = options;

    // Enforce rate limiting before making request
    await this.enforceRateLimit();

    const authData = getAuthDataFromCredential(credential);
    if (!authData) {
      onError(
        new Error('Z.AI authentication data not found. Please login first.'),
      );
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage.content;

    const rawModel = options.model || 'GLM-5.1';
    const modelName = rawModel === 'GLM-5' ? 'GLM-5-Turbo' : rawModel;

    try {
      let chatId = conversationId;
      const userMessageId = crypto.randomUUID();

      if (!chatId) {
        // 1. Call POST https://chat.z.ai/api/v1/chats/new to create a new chat session
        const createChatUrl = `${BASE_URL}/api/v1/chats/new`;
        const createChatPayload = {
          chat: {
            id: '',
            title: prompt.substring(0, 50) || 'New Chat',
            models: [modelName],
            params: {},
            history: {
              messages: {
                [userMessageId]: {
                  id: userMessageId,
                  parentId: null,
                  childrenIds: [],
                  role: 'user',
                  content: prompt,
                  timestamp: Math.floor(Date.now() / 1000),
                  models: [modelName],
                },
              },
              currentId: userMessageId,
            },
            tags: [],
            flags: [],
            features: [
              {
                server: 'tool_selector_h',
                status: 'hidden',
                type: 'tool_selector',
              },
            ],
            mcp_servers: [],
            enable_thinking: !!options.thinking,
            auto_web_search: false,
            message_version: 1,
            extra: {},
            timestamp: Date.now(),
            type: 'default',
          },
        };

        const userAgent = authData.userAgent || this.getRandomUserAgent();
        const uaDetails = parseUserAgentDetails(userAgent);
        const createHeaders: Record<string, string> = {
          Authorization: `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': userAgent,
          Origin: 'https://chat.z.ai',
          Referer: 'https://chat.z.ai/',
          'sec-ch-ua': uaDetails.secChUa,
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': uaDetails.secChUaPlatform,
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'accept-language': 'vi,en-US,en',
        };
        if (authData.cookies) {
          createHeaders['Cookie'] = sanitizeCookies(
            authData.cookies,
            authData.token,
          );
        }

        const createResponse = await fetch(createChatUrl, {
          method: 'POST',
          headers: createHeaders,
          body: JSON.stringify(createChatPayload),
        });

        if (!createResponse.ok) {
          const errText = await createResponse.text();
          throw new Error(
            `Failed to create chat session: ${createResponse.status} - ${errText}`,
          );
        }

        const createJson = await createResponse.json();
        chatId = createJson.id;
        if (!chatId) {
          throw new Error(
            'Response from chats/new did not return a valid chat ID',
          );
        }

        logger.info(`[Z.AI] Created new chat session: ${chatId}`);
        if (onSessionCreated) {
          onSessionCreated(chatId);
        }
        if (onMetadata) {
          onMetadata({
            conversation_id: chatId,
            conversation_title: prompt.substring(0, 50) || 'New Chat',
          });
        }
      }

      const completionId = crypto.randomUUID();
      const userAgent = authData.userAgent || this.getRandomUserAgent();

      const sigRes = generateSignatureAndParams(
        prompt,
        authData.token,
        authData.userId,
        chatId,
        undefined,
        userAgent,
      );
      const url = `${BASE_URL}/api/v2/chat/completions?${sigRes.queryParams}`;
      const headers = getHeaders(
        authData.token,
        sigRes.signature,
        chatId,
        authData.cookies,
        userAgent,
      );

      headers['User-Agent'] = userAgent;

      const vnTime = new Date(Date.now() + 7 * 3600000);
      const vnTimeStr = vnTime.toISOString().slice(0, 19).replace('T', ' ');
      const localDateStr = vnTimeStr.substring(0, 10);
      const localTimeOnlyStr = vnTimeStr.substring(11);
      const weekdays = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const weekdayStr = weekdays[vnTime.getUTCDay()];

      const payload = {
        stream: true,
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        signature_prompt: prompt,
        params: {},
        extra: {},
        features: {
          image_generation: false,
          web_search: false,
          auto_web_search: false,
          preview_mode: true,
          flags: [],
          vlm_tools_enable: false,
          vlm_web_search_enable: false,
          vlm_website_mode: false,
          enable_thinking: !!options.thinking,
        },
        variables: {
          '{{USER_NAME}}': authData.email?.split('@')[0] || 'User',
          '{{USER_LOCATION}}': 'Unknown',
          '{{CURRENT_DATETIME}}': vnTimeStr,
          '{{CURRENT_DATE}}': localDateStr,
          '{{CURRENT_TIME}}': localTimeOnlyStr,
          '{{CURRENT_WEEKDAY}}': weekdayStr,
          '{{CURRENT_TIMEZONE}}': 'Asia/Saigon',
          '{{USER_LANGUAGE}}': 'en-US',
        },
        chat_id: chatId,
        id: completionId,
        current_user_message_id: userMessageId,
        current_user_message_parent_id: null,
        background_tasks: {
          title_generation: true,
          tags_generation: true,
        },
        requestId: sigRes.requestId,
        timestamp: Number(sigRes.timestamp),
      };

      logger.info(`[Z.AI] Sending completions POST: ${url}`);
      logger.info(`[Z.AI] Headers: ${JSON.stringify(headers)}`);
      logger.info(`[Z.AI] Payload: ${JSON.stringify(payload)}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Z.AI API Error ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      logger.info('[Z.AI] Starting response stream reading...');
      let buffer = '';
      let currentPhase: 'thinking' | 'response' = 'response';

      for await (const chunk of response.body) {
        const chunkStr = chunk.toString();
        logger.debug(`[Z.AI] Received chunk of length ${chunkStr.length}`);
        if (onRaw) onRaw(chunkStr);
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          logger.debug(`[Z.AI] Parsing line data: ${dataStr}`);
          if (dataStr === '[DONE]') {
            logger.info('[Z.AI] Received [DONE] signal');
            onDone();
            return;
          }

          try {
            const dataJson = JSON.parse(dataStr);
            const inner = dataJson.data;
            if (inner && typeof inner === 'object') {
              const phase = inner.phase;
              const content = inner.delta_content || '';
              logger.info(
                `[Z.AI] Stream phase: ${phase}, Content length: ${content.length}`,
              );

              if (phase === 'thinking') {
                currentPhase = 'thinking';
                if (content && onThinking) {
                  onThinking(content);
                }
              } else {
                currentPhase = 'response';
                if (content) {
                  onContent(content);
                }
              }

              if (inner.done) {
                logger.info('[Z.AI] Received inner.done signal');
                onDone();
                return;
              }
            }
          } catch (e) {
            logger.error(`[Z.AI] Failed to parse line data: ${e}`);
          }
        }
      }

      onDone();
    } catch (err: any) {
      logger.error('[Z.AI] Error:', err);
      onError(err);
    }
  }

  registerRoutes(router: Router) {
    router.get('/auth/status', (req, res) => {
      const db = getDB();
      const accounts = db.getAll();
      const zaiAccount = accounts.find(
        (a) => a.provider_id === 'z' || a.provider_id === 'zai',
      );
      res.json({ authenticated: !!zaiAccount });
    });
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('glm') || m.includes('z.ai') || m.includes('glm-5');
  }
}

export default new ZAIProvider();
