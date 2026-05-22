import { Provider, SendMessageOptions } from './types';
import { Router } from 'express';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { loginService } from '../services/login.service';
import { ProxyHandler } from '../services/proxy.service';
import { proxyEvents } from '../services/proxy-events';

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

      if (bxUa || xCsrfToken) {
        const headers: Record<string, string> = {};
        if (bxUa) headers['bx-ua'] = bxUa;
        if (xCsrfToken) headers['x-csrf-token'] = xCsrfToken;
        if (userAgent) headers['User-Agent'] = userAgent;
        proxyEvents.emit('qwen-headers', headers);
      }
    }
    callback();
  },
};

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class QwenProvider implements Provider {
  name = 'Qwen';
  proxyHandler = proxyHandler;
  defaultModel = 'qwen-max-latest';

  async login() {
    logger.info('Starting Qwen login...');

    let capturedHeaders: Record<string, string> = {};

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
        cookieEvent: 'qwen-cookies',
        extraEvents: ['qwen-headers'],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

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

          let email = data.email || null;
          try {
            const profile = await this.getProfile(
              data.cookies,
              capturedHeaders,
            );
            if (profile.email) {
              email = profile.email;
            }
          } catch (e) {}

          return {
            isValid: true,
            cookies: data.cookies,
            email,
            headers: capturedHeaders,
          };
        },
      });
    } finally {
      proxyEvents.off('qwen-headers', onHeaders);
    }
  }

  async getProfile(
    credential: string,
    extraHeaders?: any,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const headers = {
        Cookie: credential,
        'User-Agent':
          extraHeaders?.['User-Agent'] ||
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'bx-ua': extraHeaders?.['bx-ua'] || '',
        'x-csrf-token': extraHeaders?.['x-csrf-token'] || '',
        accept: 'application/json',
      };

      const response = await fetch('https://chat.qwen.ai/api/v1/account', {
        headers,
      });

      if (response.ok) {
        const json = await response.json();
        return {
          email: json.data?.email || null,
          name: json.data?.nickname,
          id: json.data?.s_id,
        };
      }
      return { email: null };
    } catch (e) {
      logger.error('[Qwen] Get Profile Error:', e);
      return { email: null };
    }
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { credential, messages, onContent, onMetadata, onDone, onError } =
      options;
    let { conversationId } = options;

    try {
      if (!conversationId) {
        conversationId = await this.createChat(credential);
        if (onMetadata)
          onMetadata({
            conversation_id: conversationId,
            conversation_title: 'New Chat',
          });
      }

      let token: string | null = null;
      let cookieValue = credential;

      if (credential.trim().startsWith('eyJ')) {
        token = credential.trim();
        if (!credential.includes('token=')) cookieValue = `token=${token}`;
      } else {
        const tokenMatch = credential.match(/token=([^;]+)/);
        token = tokenMatch ? tokenMatch[1] : null;
      }

      const payload = {
        stream: true,
        version: '2.1',
        incremental_output: true,
        chat_id: conversationId,
        chat_mode: 'normal',
        model: this.defaultModel,
        parent_id: null,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          models: [this.defaultModel],
          chat_type: 't2t',
          feature_config: {
            thinking_enabled: false,
            output_schema: 'phase',
            research_mode: 'normal',
          },
          extra: { meta: { subChatType: 't2t' } },
          sub_chat_type: 't2t',
          parent_id: null,
          files: [],
        })),
        timestamp: Date.now(),
      };

      const response = await fetch(
        `${BASE_URL}/api/v2/chat/completions?chat_id=${conversationId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Origin: BASE_URL,
            Referer: `${BASE_URL}/c/${conversationId}`,
            'x-accel-buffering': 'no',
            Cookie: cookieValue,
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok)
        throw new Error(
          `Qwen API Error ${response.status}: ${await response.text()}`,
        );

      if (response.body) {
        const body = response.body as any;
        body.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const json = JSON.parse(jsonStr);
                if (json.choices && json.choices.length > 0) {
                  const delta = json.choices[0].delta;
                  if (delta && delta.content) onContent(delta.content);
                }
              } catch (e) {}
            }
          }
        });
        body.on('end', () => onDone());
        body.on('error', onError);
      } else {
        throw new Error('No response body for stream');
      }
    } catch (error) {
      onError(error);
    }
  }

  private async createChat(credential: string): Promise<string> {
    const tokenMatch = credential.match(/token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    const payload = {
      title: 'New Chat',
      models: [this.defaultModel],
      chat_mode: 'normal',
      chat_type: 't2t',
      timestamp: Date.now(),
      project_id: '',
    };

    const response = await fetch(`${BASE_URL}/api/v2/chats/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Cookie: credential,
        Authorization: token ? `Bearer ${token}` : '',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/c/new-chat`,
      },
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
