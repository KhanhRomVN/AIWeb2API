import { Provider, SendMessageOptions } from './types';
import { Router } from 'express';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { loginService } from '../services/login.service';
import { ProxyHandler } from '../services/proxy.service';
import { proxyEvents } from '../services/proxy-events';
import { getDB } from '../utils/database';

const logger = createLogger('QwenProvider');

export const BASE_URL = 'https://chat.qwen.ai';

// =============================================================================
// API UTILS
// =============================================================================

// (Moved into class)

// =============================================================================
// PROXY HANDLER
// =============================================================================

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;

    if (host && host.includes('chat.qwen.ai')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('csrfToken')) {
        proxyEvents.emit('qwen-cookies', reqCookies);
      }

      const bxUa = ctx.clientToProxyRequest.headers['bx-ua'];
      const xCsrfToken = ctx.clientToProxyRequest.headers['x-csrf-token'];
      const userAgent = ctx.clientToProxyRequest.headers['user-agent'];
      const bxUmidToken = ctx.clientToProxyRequest.headers['bx-umidtoken'];

      if (bxUa || xCsrfToken || bxUmidToken) {
        const headers: Record<string, string> = {};
        if (bxUa) headers['bx-ua'] = bxUa;
        if (xCsrfToken) headers['x-csrf-token'] = xCsrfToken;
        if (userAgent) headers['User-Agent'] = userAgent;
        if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;
        proxyEvents.emit('qwen-headers', headers);
      }
    }
    callback();
  },

  onRequestData: (
    ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('chat.qwen.ai') &&
      url.includes('/api/v2/auths/signin')
    ) {
      const bodyStr = chunk.toString();
      try {
        const json = JSON.parse(bodyStr);
        if (json.email) {
          logger.info(
            `[Proxy] Captured Qwen Login Email (JSON): ${json.email}`,
          );
          (ctx as any).capturedQwenEmail = json.email;
          proxyEvents.emit('qwen-login-email', { email: json.email });
        }
      } catch (e) {
        // Try regex extraction for non-JSON body
        const emailMatch = bodyStr.match(
          /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
        );
        if (emailMatch && emailMatch[0]) {
          const email = `${emailMatch[1]}@${emailMatch[2]}`.replace(/\\/g, '');
          if (!email.includes('***')) {
            logger.info(`[Proxy] Captured Qwen Login Email (Regex): ${email}`);
            (ctx as any).capturedQwenEmail = email;
            proxyEvents.emit('qwen-login-email', { email });
          }
        }
      }
    }
    callback(null, chunk);
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    // POST /api/v2/auths/signin → { success, data: { email, token, id, name, ... } }
    if (
      host &&
      host.includes('chat.qwen.ai') &&
      url.includes('/api/v2/auths/signin')
    ) {
      try {
        const json = JSON.parse(body);
        const userData = json.data;
        if (userData) {
          const capturedEmail = (ctx as any).capturedQwenEmail;

          // Capture email — prefer the unmasked email we got from request body
          let email = capturedEmail || userData.email;
          if (email && email.includes('***') && capturedEmail) {
            email = capturedEmail;
          }
          if (email && !email.includes('***')) {
            logger.info(
              `[Proxy] Captured Qwen Login Email from Signin Response: ${email}`,
            );
            proxyEvents.emit('qwen-login-email', { email });
          }

          // Capture token — emit a dedicated event just like DeepSeek does
          if (userData.token) {
            logger.info(
              '[Proxy] Captured Qwen Login Token from Signin Response',
            );
            const eventPayload: any = { cookies: userData.token };
            if (email && !email.includes('***')) {
              eventPayload.email = email;
            }
            proxyEvents.emit('qwen-login-token', eventPayload);
            delete (ctx as any).capturedQwenEmail;
          }
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Qwen Signin Response:', e);
      }
    }

    // GET /api/v1/auths/ → flat object: { id, email, name, token, token_type, ... }
    // (no "data" wrapper — this is the profile/session-refresh endpoint)
    if (
      host &&
      host.includes('chat.qwen.ai') &&
      url.includes('/api/v1/auths/')
    ) {
      try {
        const json = JSON.parse(body);

        // Response can be flat or wrapped under "data"
        const userData = json.data ?? json;

        if (userData && userData.token) {
          logger.info('[Proxy] Captured Qwen Token from Auth Session Response');
          const capturedEmail = (ctx as any).capturedQwenEmail;
          let email = capturedEmail || userData.email;
          if (email && email.includes('***') && capturedEmail) {
            email = capturedEmail;
          }

          const eventPayload: any = { cookies: userData.token };
          if (email && !email.includes('***')) {
            logger.info(
              `[Proxy] Captured Qwen Email from Auth Session Response: ${email}`,
            );
            eventPayload.email = email;
            proxyEvents.emit('qwen-login-email', { email });
          }
          proxyEvents.emit('qwen-login-token', eventPayload);
        } else if (
          userData &&
          userData.email &&
          !userData.email.includes('***')
        ) {
          // Fallback: only email, no token
          logger.info(
            `[Proxy] Captured Qwen Email (no token) from Auth Response: ${userData.email}`,
          );
          proxyEvents.emit('qwen-login-email', { email: userData.email });
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse Qwen Auth Session Response:', e);
      }
    }
  },
};

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class QwenProvider implements Provider {
  name = 'Qwen';
  proxyHandler = proxyHandler;
  defaultModel = 'qwen3.7-plus';

  // ===========================================================================
  // TOKEN HELPERS
  // ===========================================================================

  /**
   * Parse credential — supports both legacy bare JWT and new JSON format:
   * {"token":"eyJ...","bxUa":"231!...","bxUmidToken":"...","userAgent":"..."}
   */
  private parseCredential(credential: string): {
    token: string | null;
    cookieValue: string;
    bxUa: string;
    bxUmidToken: string;
    userAgent: string;
  } {
    // Try JSON format first
    if (credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential);
        const token = parsed.token || null;
        return {
          token,
          cookieValue: token ? `token=${token}` : '',
          bxUa: parsed.bxUa || '',
          bxUmidToken: parsed.bxUmidToken || '',
          userAgent:
            parsed.userAgent ||
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        };
      } catch {
        // fall through
      }
    }

    // Legacy: bare JWT or "token=eyJ..." cookie string
    let token: string | null = null;
    let cookieValue = credential;
    if (credential.trim().startsWith('eyJ')) {
      token = credential.trim();
      cookieValue = `token=${token}`;
    } else {
      const m = credential.match(/(?:^|;\s*)token=(eyJ[^;]+)/);
      token = m ? m[1] : null;
    }

    return {
      token,
      cookieValue,
      bxUa: '',
      bxUmidToken: '',
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    };
  }

  /**
   * Extract the raw JWT string from a credential (which may be a full cookie
   * string like "token=eyJ...;  other=x" or a bare JWT or JSON).
   */
  private extractToken(credential: string): string | null {
    return this.parseCredential(credential).token;
  }

  /**
   * Decode the `exp` claim from a JWT without verifying the signature.
   * Returns the expiry Unix timestamp in seconds, or null if unreadable.
   */
  private getTokenExpiry(jwt: string): number | null {
    try {
      const parts = jwt.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      );
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Returns true if the token is already expired or expires within `thresholdSecs`
   * (default 7 days = 604800 s).
   */
  private isTokenExpiringSoon(
    jwt: string,
    thresholdSecs = 7 * 24 * 3600,
  ): boolean {
    const exp = this.getTokenExpiry(jwt);
    if (exp === null) return false; // can't tell — don't force a refresh
    return Date.now() / 1000 >= exp - thresholdSecs;
  }

  /**
   * Call /api/v1/auths/ with the current token to get a refreshed JWT.
   * On success, persists the new credential to the DB (keyed by account email)
   * and returns the new token string.
   * Returns null if the refresh fails (caller should proceed with existing cred).
   */
  async refreshToken(credential: string): Promise<string | null> {
    const token = this.extractToken(credential);
    if (!token) return null;

    // Build cookie value (some endpoints need the full cookie string)
    const cookieValue = credential.includes('token=')
      ? credential
      : `token=${token}`;

    try {
      logger.info('[Qwen] Attempting token refresh via /api/v1/auths/');
      const response = await fetch('https://chat.qwen.ai/api/v1/auths/', {
        method: 'GET',
        headers: {
          Cookie: cookieValue,
          Authorization: `Bearer ${token}`,
          accept: 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          source: 'web',
          version: '0.2.64',
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        logger.warn(`[Qwen] Token refresh failed: HTTP ${response.status}`);
        return null;
      }

      const json: any = await response.json();
      const userData = json.data ?? json;
      const newToken: string | undefined = userData?.token;

      if (!newToken) {
        logger.warn('[Qwen] Token refresh response had no token field');
        return null;
      }

      if (newToken === token) {
        logger.debug('[Qwen] Token refresh returned same token — still valid');
        return newToken;
      }

      logger.info('[Qwen] Token refreshed successfully');

      // Persist the updated credential to DB so future requests use the new token
      const email: string | undefined = userData?.email;
      if (email) {
        try {
          const db = getDB();
          const accounts = db
            .getAll()
            .filter(
              (a) =>
                a.provider_id.toLowerCase() === 'qwen' &&
                a.email.toLowerCase() === email.toLowerCase(),
            );
          for (const acc of accounts) {
            db.upsert({ ...acc, credential: newToken });
          }
        } catch (e) {
          logger.error('[Qwen] Failed to persist refreshed token to DB:', e);
        }
      }

      return newToken;
    } catch (e) {
      logger.error('[Qwen] Token refresh error:', e);
      return null;
    }
  }

  /**
   * Returns a fresh credential string, refreshing the token if it is expiring
   * soon. Falls back to the original credential on any error.
   */
  private async getFreshCredential(credential: string): Promise<string> {
    const token = this.extractToken(credential);
    if (!token) return credential;

    if (!this.isTokenExpiringSoon(token)) return credential;

    const exp = this.getTokenExpiry(token);
    const daysLeft = exp ? Math.round((exp - Date.now() / 1000) / 86400) : null;
    logger.info(
      `[Qwen] Token expiring soon (${daysLeft !== null ? daysLeft + ' days left' : 'already expired'}), refreshing...`,
    );

    const newToken = await this.refreshToken(credential);
    if (!newToken) {
      logger.warn('[Qwen] Refresh failed, proceeding with existing credential');
      return credential;
    }
    return newToken;
  }

  async login() {
    logger.info('Starting Qwen login...');

    let capturedHeaders: Record<string, string> = {};
    
    // Store reference to this for use in validate function
    const self = this;

    const onHeaders = (headers: Record<string, string>) => {
      capturedHeaders = { ...capturedHeaders, ...headers };
      logger.debug('[Qwen] Captured headers:', headers);
    };

    proxyEvents.on('qwen-headers', onHeaders);

    try {
      return await loginService.login({
        providerId: 'qwen',
        loginUrl: 'https://chat.qwen.ai/auth',
        partition: `qwen-${Date.now()}`,
        // Primary: token captured from signin/auths response body (like DeepSeek)
        cookieEvent: 'qwen-login-token',
        // Secondary: email info event
        infoEvent: 'qwen-login-email',
        // qwen-cookies (raw cookie string) and qwen-headers are handled via extraEvents
        extraEvents: ['qwen-headers', 'qwen-cookies'],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          // If credential looks like a raw JWT (token-only), it's valid immediately
          const isRawToken = data.cookies.trim().startsWith('eyJ');

          if (!isRawToken) {
            // For cookie-string credentials we still need bx-ua before proceeding
            const hasBxUa = capturedHeaders['bx-ua'];
            if (!hasBxUa) {
              logger.debug('[Qwen] Waiting for bx-ua header...');
              return { isValid: false };
            }

            if (!capturedHeaders['x-csrf-token']) {
              const csrfMatch = data.cookies.match(/csrfToken=([^;]+)/);
              if (csrfMatch) {
                capturedHeaders['x-csrf-token'] = csrfMatch[1];
              }
            }
          }

          let email = data.email || null;

          // If headers are fallback values, trigger a real request to get real headers
          const bxUa = capturedHeaders['bx-ua'];
          // Check for any fallback pattern (defaultFY2_, defaultFY3_, etc.)
          const isFallback = bxUa && typeof bxUa === 'string' && 
            (bxUa.includes('defaultFY') || bxUa.includes('_load_failed') || bxUa.includes('not_initialized'));
          const isRealBxUa = bxUa && typeof bxUa === 'string' && bxUa.startsWith('231!') && bxUa.length > 100;
          
          logger.debug(`[Qwen] Header check - bxUa exists: ${!!bxUa}, isFallback: ${isFallback}, isReal: ${isRealBxUa}, value preview: ${bxUa?.substring(0, 50)}`);
          
          if (isFallback || !isRealBxUa) {
            logger.info('[Qwen] 🔄 Detected fallback or invalid headers, triggering list chats request to get real headers...');
            logger.debug(`[Qwen] Current headers before fetchListChats:`, JSON.stringify(capturedHeaders, null, 2));
            
            try {
              await self.fetchListChats(data.cookies, capturedHeaders);
              // After this call, capturedHeaders should be updated with real values
              const newBxUa = capturedHeaders['bx-ua'];
              const newBxUmidToken = capturedHeaders['bx-umidtoken'];
              const isReal = newBxUa && !newBxUa.includes('defaultFY2_load_failed');
              
              logger.info(`[Qwen] 📡 After fetchListChats - has real bxUa: ${isReal}`);
              logger.debug('[Qwen] Real headers after list chats:', {
                bxUa: newBxUa?.substring(0, 80) + '...',
                bxUmidToken: newBxUmidToken?.substring(0, 40) + '...',
                fullBxUaLength: newBxUa?.length,
                fullBxUmidTokenLength: newBxUmidToken?.length,
              });
            } catch (e) {
              logger.warn('[Qwen] ❌ Failed to fetch list chats:', e);
            }
          } else if (isRealBxUa) {
            logger.info(`[Qwen] ✅ Already have real headers (starts with 231!), skipping fetchListChats. bxUa length: ${bxUa.length}`);
          }

          if (!email) {
            logger.info(
              '[Qwen] Email not captured directly, fetching profile...',
            );
            try {
              const profile = await this.getProfile(
                data.cookies,
                capturedHeaders,
              );
              if (profile.email) {
                email = profile.email;
              }
            } catch (e) {}
          }

          logger.info(`[Qwen] 📝 Final credential prepared - bxUa length: ${capturedHeaders['bx-ua']?.length || 0}, bxUmidToken length: ${capturedHeaders['bx-umidtoken']?.length || 0}`);
          logger.debug(`[Qwen] Final headers being saved:`, {
            bxUa_preview: capturedHeaders['bx-ua']?.substring(0, 50) + '...',
            bxUmidToken_preview: capturedHeaders['bx-umidtoken']?.substring(0, 30) + '...',
            hasUserAgent: !!capturedHeaders['User-Agent'],
          });
          
          return {
            isValid: true,
            // Store as JSON so bx-ua and bx-umidtoken are persisted with the token
            cookies: JSON.stringify({
              token: data.cookies.trim().startsWith('eyJ')
                ? data.cookies.trim()
                : (data.cookies.match(/token=(eyJ[^;]+)/) || [])[1] ||
                  data.cookies,
              bxUa: capturedHeaders['bx-ua'] || '',
              bxUmidToken: capturedHeaders['bx-umidtoken'] || '',
              userAgent: capturedHeaders['User-Agent'] || '',
            }),
            email,
            headers: capturedHeaders,
          };
        },
      });
    } finally {
      proxyEvents.off('qwen-headers', onHeaders);
    }
  }

  /**
   * Fetch list of chats to trigger real bxUa and bxUmidToken headers
   * This method is called when fallback headers are detected
   */
  private async fetchListChats(
    credential: string,
    headersRef: Record<string, string>
  ): Promise<void> {
    try {
      // Extract token from credential
      let token: string | null = null;
      let cookieValue = credential;

      if (credential.trim().startsWith('eyJ')) {
        token = credential.trim();
        if (!credential.includes('token=')) cookieValue = `token=${token}`;
      } else {
        const tokenMatch = credential.match(/token=([^;]+)/);
        token = tokenMatch ? tokenMatch[1] : null;
      }

      if (!token) {
        logger.warn('[Qwen] Cannot fetch list chats: no token found');
        return;
      }

      const headers: Record<string, string> = {
        Cookie: cookieValue,
        'User-Agent': headersRef['User-Agent'] || 
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        source: 'web',
        version: '0.2.64',
        'bx-v': '2.5.36',
        'x-request-id': crypto.randomUUID(),
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (headersRef['bx-ua']) headers['bx-ua'] = headersRef['bx-ua'];
      if (headersRef['bx-umidtoken']) headers['bx-umidtoken'] = headersRef['bx-umidtoken'];

      logger.info('[Qwen] 🌐 Fetching list chats to trigger real headers...');
      logger.debug(`[Qwen] Request headers for list chats:`, {
        Cookie: cookieValue?.substring(0, 50) + '...',
        Authorization: token ? `Bearer ${token?.substring(0, 30)}...` : 'none',
        'bx-ua': headersRef['bx-ua']?.substring(0, 50) + '...',
        'bx-umidtoken': headersRef['bx-umidtoken']?.substring(0, 30) + '...',
      });
      
      const response = await fetch(
        `${BASE_URL}/api/v2/chats/?page=1&exclude_project=true`,
        { headers }
      );

      if (response.ok) {
        logger.info('[Qwen] ✅ List chats fetched successfully, real headers should be captured');
        logger.debug(`[Qwen] Response status: ${response.status}`);
      } else {
        logger.warn(`[Qwen] ❌ Failed to fetch list chats: ${response.status}`);
        const text = await response.text();
        logger.debug(`[Qwen] Response body: ${text?.substring(0, 200)}`);
      }
    } catch (error) {
      logger.error('[Qwen] Error fetching list chats:', error);
      throw error;
    }
  }

  async getProfile(
    credential: string,
    extraHeaders?: any,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      // Extract token from cookie string if needed
      let token: string | null = null;
      let cookieValue = credential;

      if (credential.trim().startsWith('eyJ')) {
        token = credential.trim();
        if (!credential.includes('token=')) cookieValue = `token=${token}`;
      } else {
        const tokenMatch = credential.match(/token=([^;]+)/);
        token = tokenMatch ? tokenMatch[1] : null;
      }

      const headers: Record<string, string> = {
        Cookie: cookieValue,
        'User-Agent':
          extraHeaders?.['User-Agent'] ||
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        accept: 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        source: 'web',
        version: '0.2.64',
      };
      if (extraHeaders?.['bx-ua']) headers['bx-ua'] = extraHeaders['bx-ua'];
      if (extraHeaders?.['x-csrf-token'])
        headers['x-csrf-token'] = extraHeaders['x-csrf-token'];
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // /api/v1/auths/ returns a flat object: { id, email, name, token, token_type, ... }
      const response = await fetch('https://chat.qwen.ai/api/v1/auths/', {
        headers,
      });

      if (response.ok) {
        const json: any = await response.json();
        // Response can be flat or wrapped in "data"
        const userData = json.data ?? json;
        return {
          email: userData?.email || null,
          name: userData?.name,
          id: userData?.id,
        };
      }
      return { email: null };
    } catch (e) {
      logger.error('[Qwen] Get Profile Error:', e);
      return { email: null };
    }
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { messages, onContent, onMetadata, onDone, onError } = options;
    const onSessionCreated = options.onSessionCreated;
    let { conversationId } = options;

    try {
      // Refresh token if expiring within 7 days
      const credential = await this.getFreshCredential(options.credential);

      // Resolve token + cookie value + bot-detection headers
      const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
        this.parseCredential(credential);

      const isNewChat = !conversationId;
      if (isNewChat) {
        conversationId = await this.createChat(
          credential,
          token,
          cookieValue,
          bxUa,
          bxUmidToken,
          userAgent,
        );
        // Notify chat service of the real Qwen conversation ID
        if (onSessionCreated) onSessionCreated(conversationId);
        if (onMetadata)
          onMetadata({
            conversation_id: conversationId,
            conversation_title: 'New Chat',
          });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const requestId = crypto.randomUUID();
      const timezone = `${new Date().toDateString()} ${new Date().toTimeString().split(' ')[0]} GMT+0700`;

      // Build message array matching exact browser format.
      // Only the last user message is sent — Qwen keeps history server-side.
      // parent_id in top-level payload = last assistant message id (unknown here → null).
      const lastMsg = messages[messages.length - 1];
      const msgFid = crypto.randomUUID();

      const msgPayload = {
        fid: msgFid,
        parentId: null as string | null,
        childrenIds: [] as string[],
        role: lastMsg.role,
        content: lastMsg.content,
        user_action: 'chat',
        files: [],
        timestamp: nowSec,
        models: [this.defaultModel],
        chat_type: 't2t',
        feature_config: {
          thinking_enabled: false,
          output_schema: 'phase',
          research_mode: 'normal',
          auto_thinking: false,
          thinking_mode: 'Fast',
          auto_search: true,
        },
        extra: { meta: { subChatType: 't2t' } },
        sub_chat_type: 't2t',
      };

      // Use model from options or default
      const modelToUse = options.model || this.defaultModel;
      
      const payload = {
        stream: true,
        version: '2.1',
        incremental_output: true,
        chat_id: conversationId,
        chat_mode: 'normal',
        model: modelToUse,
        parent_id: null as string | null,
        messages: [msgPayload],
        timestamp: nowSec,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'User-Agent':
          userAgent ||
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/c/${conversationId}`,
        'x-accel-buffering': 'no',
        'x-request-id': requestId,
        Cookie: cookieValue,
        source: 'web',
        version: '0.2.64',
        'bx-v': '2.5.36',
        timezone,
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'sec-ch-ua':
          '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (bxUa) headers['bx-ua'] = bxUa;
      if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

      logger.info(`[Qwen] Sending chat request to: ${BASE_URL}/api/v2/chat/completions?chat_id=${conversationId}`);
      logger.debug(`[Qwen] Request headers:`, {
        ...headers,
        Authorization: headers.Authorization ? `${headers.Authorization.substring(0, 30)}...` : 'none',
        Cookie: headers.Cookie ? `${headers.Cookie.substring(0, 50)}...` : 'none',
        'bx-ua': headers['bx-ua'] ? `${headers['bx-ua'].substring(0, 50)}...` : 'none',
      });
      logger.debug(`[Qwen] Request payload:`, JSON.stringify(payload, null, 2));
      
      const response = await fetch(
        `${BASE_URL}/api/v2/chat/completions?chat_id=${conversationId}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        },
      );

      logger.info(`[Qwen] Chat response status: ${response.status} ${response.statusText}`);
      logger.debug(`[Qwen] Response headers:`, Object.fromEntries(response.headers.entries()));

      // Check for actual status code in header (Qwen may return 404 in header even with 200 status)
      const actualStatusCode = response.headers.get('x-actual-status-code');
      if (actualStatusCode && actualStatusCode !== '200') {
        const errText = await response.text();
        logger.error(`[Qwen] API returned actual error status ${actualStatusCode}: ${errText}`);
        throw new Error(
          `Qwen API Error ${actualStatusCode}: ${errText.slice(0, 500)}`,
        );
      }

      if (!response.ok) {
        const errText = await response.text();
        logger.error(`[Qwen] API Error Response Body: ${errText}`);
        throw new Error(
          `Qwen API Error ${response.status}: ${errText.slice(0, 500)}`,
        );
      }

      // For debugging, log response body preview if content-type is JSON and not stream
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
        const responseText = await response.text();
        logger.debug(`[Qwen] Response body preview: ${responseText.substring(0, 500)}`);
        // Need to recreate response since we consumed the body
        // For now, throw error to investigate
        throw new Error(`Unexpected JSON response instead of stream: ${responseText.substring(0, 200)}`);
      }

      logger.info(
        `[Qwen] Chat completions response: status=${response.status}, content-type=${response.headers.get('content-type')}, has-body=${!!response.body}`,
      );

      if (response.body) {
        let buffer = '';

        const processLine = (line: string): boolean => {
          if (!line.startsWith('data: ')) return false;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') return false;

          try {
            const json = JSON.parse(jsonStr);

            if (json['response.created']) {
              if (onMetadata) {
                onMetadata({
                  response_id: json['response.created'].response_id,
                  parent_id: json['response.created'].parent_id,
                });
              }
              return false;
            }

            if (json.choices && json.choices.length > 0) {
              const delta = json.choices[0].delta;
              if (delta?.content && delta.phase !== 'thinking') {
                onContent(delta.content);
              }
              if (json.usage && onMetadata) {
                onMetadata({ total_token: json.usage.total_tokens });
              }
              if (delta?.status === 'finished') return true;
            }
          } catch (e) {}
          return false;
        };

        try {
          for await (const chunk of response.body as any) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            let done = false;
            for (const line of lines) {
              if (processLine(line)) {
                done = true;
                break;
              }
            }
            if (done) break;
          }

          // Flush remaining
          if (buffer.trim()) processLine(buffer.trim());
        } catch (streamErr) {
          onError(streamErr);
          return;
        }

        onDone();
      } else {
        throw new Error('No response body for stream');
      }
    } catch (error) {
      onError(error);
    }
  }

  private async createChat(
    credential: string,
    token?: string | null,
    cookieValue?: string,
    bxUa?: string,
    bxUmidToken?: string,
    userAgent?: string,
  ): Promise<string> {
    // Allow calling with just credential (legacy)
    if (!token || !cookieValue) {
      const parsed = this.parseCredential(credential);
      token = parsed.token;
      cookieValue = parsed.cookieValue;
      bxUa = bxUa || parsed.bxUa;
      bxUmidToken = bxUmidToken || parsed.bxUmidToken;
      userAgent = userAgent || parsed.userAgent;
    }

    const requestId = crypto.randomUUID();
    const timezone = `${new Date().toDateString()} ${new Date().toTimeString().split(' ')[0]} GMT+0700`;

    const payload = {
      title: 'New Chat',
      models: [this.defaultModel],
      chat_mode: 'normal',
      chat_type: 't2t',
      timestamp: Math.floor(Date.now() / 1000),
      project_id: '',
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      accept: 'application/json, text/plain, */*',
      'User-Agent':
        userAgent ||
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      Cookie: cookieValue!,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      'x-request-id': requestId,
      source: 'web',
      version: '0.2.64',
      'bx-v': '2.5.36',
      timezone,
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua':
        '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (bxUa) headers['bx-ua'] = bxUa;
    if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

    const response = await fetch(`${BASE_URL}/api/v2/chats/new`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok)
      throw new Error(`Failed to create Qwen chat: ${response.status}`);
    const data: any = await response.json();
    if (data?.data?.id) return data.data.id;
    throw new Error('Failed to create Qwen chat: No ID returned');
  }

  async getModels(credential: string): Promise<any[]> {
    const tokenMatch = credential.match(/token=([^;]+)/);
    let token = tokenMatch ? tokenMatch[1] : null;
    let cookieValue = credential;

    if (credential.trim().startsWith('eyJ')) {
      token = credential.trim();
      if (!credential.includes('token=')) cookieValue = `token=${token}`;
    }

    const headers: any = {
      authority: 'chat.qwen.ai',
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      cookie: cookieValue,
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'x-request-id': crypto.randomUUID
        ? crypto.randomUUID()
        : 'fb129784-3e36-43fd-aa59-3ded6805d420',
    };

    if (token) headers['authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(`${BASE_URL}/api/models`, { headers });
      if (!response.ok) return [];
      const json: any = await response.json();
      if (json && Array.isArray(json.data)) {
        return json.data.map((model: any) => ({
          id: model.id,
          name: model.name,
          is_thinking: model.info?.meta?.capabilities?.thinking || false,
          context_length: model.info?.meta?.max_context_length,
        }));
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  registerRoutes(router: Router) {}

  isModelSupported(model: string): boolean {
    return model.toLowerCase().includes('qwen');
  }
}

export default new QwenProvider();
