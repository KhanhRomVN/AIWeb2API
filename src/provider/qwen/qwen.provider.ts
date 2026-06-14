import { Provider, SendMessageOptions } from '../../types';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import { loginService } from '../../services/login/login.service';
import { proxyEvents } from '../../services/proxy.service';
import { getDb } from '../../database';
import { updateAccountCredential } from '../../repositories/account.repository';
import { proxyHandler } from './qwen.proxy-handler';
import type { QwenCredential } from './qwen.types';

export { proxyHandler };

export const BASE_URL = 'https://chat.qwen.ai';

const logger = createLogger('QwenProvider');

export class QwenProvider implements Provider {
  name = 'Qwen';
  proxyHandler = proxyHandler;
  defaultModel = 'qwen3.7-plus';

  // ===========================================================================
  // TOKEN HELPERS
  // ===========================================================================

  private parseCredential(credential: string): QwenCredential {
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

  private extractToken(credential: string): string | null {
    return this.parseCredential(credential).token;
  }

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

  private isTokenExpiringSoon(
    jwt: string,
    thresholdSecs = 7 * 24 * 3600,
  ): boolean {
    const exp = this.getTokenExpiry(jwt);
    if (exp === null) return false;
    return Date.now() / 1000 >= exp - thresholdSecs;
  }

  async refreshToken(credential: string): Promise<string | null> {
    const token = this.extractToken(credential);
    if (!token) return null;

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

      const email: string | undefined = userData?.email;
      if (email) {
        try {
          const db = getDb();
          const accounts = db
            .prepare(
              "SELECT * FROM accounts WHERE LOWER(provider_id) = 'qwen' AND LOWER(email) = ?",
            )
            .all(email.toLowerCase()) as any[];
          for (const acc of accounts) {
            updateAccountCredential(acc.id, newToken);
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
        cookieEvent: 'qwen-login-token',
        infoEvent: 'qwen-login-email',
        extraEvents: ['qwen-headers', 'qwen-cookies'],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          const isRawToken = data.cookies.trim().startsWith('eyJ');

          if (!isRawToken) {
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

          const bxUa = capturedHeaders['bx-ua'];
          const isFallback =
            bxUa &&
            typeof bxUa === 'string' &&
            (bxUa.includes('defaultFY') ||
              bxUa.includes('_load_failed') ||
              bxUa.includes('not_initialized'));
          const isRealBxUa =
            bxUa &&
            typeof bxUa === 'string' &&
            bxUa.startsWith('231!') &&
            bxUa.length > 100;

          if (isFallback || !isRealBxUa) {
            logger.info('[Qwen] Detected fallback headers, triggering list chats...');
            try {
              await self.fetchListChats(data.cookies, capturedHeaders);
            } catch (e) {
              logger.warn('[Qwen] Failed to fetch list chats:', e);
            }
          }

          if (!email) {
            logger.info('[Qwen] Email not captured directly, fetching profile...');
            try {
              const profile = await this.getProfile(data.cookies, capturedHeaders);
              if (profile.email) {
                email = profile.email;
              }
            } catch (e) {}
          }

          return {
            isValid: true,
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

  private async fetchListChats(
    credential: string,
    headersRef: Record<string, string>,
  ): Promise<void> {
    try {
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
        'User-Agent':
          headersRef['User-Agent'] ||
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
      if (headersRef['bx-umidtoken'])
        headers['bx-umidtoken'] = headersRef['bx-umidtoken'];

      const response = await fetch(
        `${BASE_URL}/api/v2/chats/?page=1&exclude_project=true`,
        { headers },
      );

      if (response.ok) {
        logger.info('[Qwen] List chats fetched successfully');
      } else {
        logger.warn(`[Qwen] Failed to fetch list chats: ${response.status}`);
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

      const response = await fetch('https://chat.qwen.ai/api/v1/auths/', {
        headers,
      });

      if (response.ok) {
        const json: any = await response.json();
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

  private async createChat(
    credential: string,
    token: string | null,
    cookieValue: string,
    bxUa: string,
    bxUmidToken: string,
    userAgent: string,
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'User-Agent': userAgent,
      Cookie: cookieValue,
      source: 'web',
      version: '0.2.64',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (bxUa) headers['bx-ua'] = bxUa;
    if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

    const response = await fetch(`${BASE_URL}/api/v2/chats/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'New Chat', chat_type: 't2t' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create Qwen chat: ${response.status}`);
    }

    const json = await response.json();
    return json.id || json.chat_id;
  }

  private async getLastMessageId(
    conversationId: string,
    cookieValue: string,
    token: string | null,
    bxUa: string,
    bxUmidToken: string,
    userAgent: string,
  ): Promise<string | null> {
    const headers: Record<string, string> = {
      Cookie: cookieValue,
      'User-Agent': userAgent,
      accept: 'application/json',
      source: 'web',
      version: '0.2.64',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (bxUa) headers['bx-ua'] = bxUa;
    if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

    const response = await fetch(
      `${BASE_URL}/api/v2/chats/${conversationId}/messages/`,
      { headers },
    );
    if (!response.ok) return null;

    const json = await response.json();
    const messages = json.messages || json.data || [];
    if (messages.length > 0) {
      const lastAssistant = [...messages]
        .reverse()
        .find((m: any) => m.role === 'assistant');
      return lastAssistant?.id || null;
    }
    return null;
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { messages, onContent, onMetadata, onDone, onError } = options;
    const onSessionCreated = options.onSessionCreated;
    let { conversationId } = options;

    try {
      const credential = await this.getFreshCredential(options.credential);
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

      const lastMsg = messages[messages.length - 1];
      const msgFid = crypto.randomUUID();

      let parentId: string | null = options.parent_message_id ?? null;
      if (!parentId && conversationId && !isNewChat) {
        try {
          parentId = await this.getLastMessageId(
            conversationId,
            cookieValue,
            token,
            bxUa,
            bxUmidToken,
            userAgent,
          );
        } catch (e) {
          logger.warn('[Qwen] Failed to fetch last message ID');
        }
      }

      const modelToUse = options.model || this.defaultModel;

      const payload = {
        stream: true,
        version: '2.1',
        incremental_output: true,
        chat_id: conversationId,
        chat_mode: 'normal',
        model: modelToUse,
        parent_id: parentId as string | null,
        messages: [
          {
            fid: msgFid,
            parentId: parentId as string | null,
            childrenIds: [] as string[],
            role: lastMsg.role,
            content: lastMsg.content,
            user_action: 'chat',
            files: [],
            timestamp: nowSec,
            models: [modelToUse],
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
          },
        ],
        timestamp: nowSec,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'User-Agent': userAgent,
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
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (bxUa) headers['bx-ua'] = bxUa;
      if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

      const response = await fetch(
        `${BASE_URL}/api/v2/chat/completions?chat_id=${conversationId}`,
        { method: 'POST', headers, body: JSON.stringify(payload) },
      );

      const actualStatusCode = response.headers.get('x-actual-status-code');
      if (actualStatusCode && actualStatusCode !== '200') {
        const errText = await response.text();
        throw new Error(`Qwen API Error ${actualStatusCode}: ${errText.slice(0, 500)}`);
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Qwen API Error ${response.status}: ${errText.slice(0, 500)}`);
      }

      if (!response.body) throw new Error('No response body');

      let buffer = '';
      for await (const chunk of response.body as any) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === '[DONE]') {
            onDone();
            return;
          }
          try {
            const json = JSON.parse(jsonStr);
            if (json.choices?.[0]?.delta?.content)
              onContent(json.choices[0].delta.content);
          } catch (e) {}
        }
      }
      onDone();
    } catch (err: any) {
      onError(err);
    }
  }

  async getModels(credential: string): Promise<any[]> {
    const { token, cookieValue } = this.parseCredential(credential);
    const headers: Record<string, string> = {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'cookie': cookieValue,
      'origin': BASE_URL,
      'referer': `${BASE_URL}/`,
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'x-request-id': crypto.randomUUID(),
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

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('qwen') || m.startsWith('qwen-');
  }
}

export default new QwenProvider();
