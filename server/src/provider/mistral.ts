import { Provider, SendMessageOptions } from './types';
import { Router } from 'express';
import fetch from 'node-fetch';
import * as https from 'https';
import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { loginService } from '../services/login.service';
import { ProxyHandler } from '../services/proxy.service';
import { proxyEvents } from '../services/proxy-events';

const logger = createLogger('MistralProvider');

export const BASE_URL = 'https://console.mistral.ai';

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

    if (
      host &&
      (host.includes('auth.mistral.ai') || host.includes('console.mistral.ai'))
    ) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.length > 0) {
        logger.debug('[Proxy] Captured Mistral cookies');
        proxyEvents.emit('mistral-cookies', reqCookies);
      }
    }
    callback();
  },
};

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class MistralProvider implements Provider {
  name = 'Mistral';
  proxyHandler = proxyHandler;
  defaultModel = 'mistral-large-latest';

  async login() {
    logger.info('Starting Mistral login...');

    return await loginService.login({
      providerId: 'mistral',
      loginUrl: 'https://auth.mistral.ai/ui/login',
      partition: `mistral-${Date.now()}`,
      cookieEvent: 'mistral-cookies',
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies && data.cookies.length > 0) {
          const profile = await this.getProfile(data.cookies);
          if (profile.email) {
            logger.info(
              `[Mistral] Validation success for email: ${profile.email}`,
            );
            return {
              isValid: true,
              email: profile.email,
              cookies: data.cookies,
            };
          }
        }
        return { isValid: false };
      },
    });
  }

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const response = await fetch('https://console.mistral.ai/api/users/me', {
        method: 'GET',
        headers: {
          Cookie: credential,
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          accept: 'application/json',
        },
      });

      if (response.status === 200) {
        const json = await response.json();
        return {
          email: json.email || null,
          name: json.name || json.full_name,
          id: json.id,
        };
      }
      return { email: null };
    } catch (e) {
      logger.error('[Mistral] Get Profile Error:', e);
      return { email: null };
    }
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      onContent,
      onMetadata,
      onDone,
      onError,
      conversationId,
    } = options;

    try {
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage.content;

      if (!conversationId) {
        await this.streamMistral(
          credential,
          conversationId!,
          'start',
          null,
          onContent,
          onDone,
          onError,
        );
      } else {
        await this.streamMistral(
          credential,
          conversationId!,
          'append',
          content,
          onContent,
          onDone,
          onError,
        );
      }
    } catch (error) {
      logger.error('Error sending Mistral message', error);
      onError(error);
    }
  }

  private async streamMistral(
    credential: string,
    chatId: string,
    mode: 'start' | 'append',
    content: string | null,
    onContent: (c: string) => void,
    onDone: () => void,
    onError: (e: any) => void,
  ) {
    const payload: any = {
      chatId: chatId,
      mode: mode,
      disabledFeatures: [],
      clientPromptData: {
        currentDate: new Date().toISOString().split('T')[0],
        userTimezone: 'Asia/Saigon',
      },
      stableAnonymousIdentifier: '79zqlm',
      shouldAwaitStreamBackgroundTasks: true,
      shouldUseMessagePatch: true,
      shouldUsePersistentStream: true,
    };

    if (mode === 'append' && content) {
      payload.messageInput = [{ type: 'text', text: content }];
      payload.messageFiles = [];
      payload.messageId = crypto.randomUUID();
      payload.features = [
        'beta-code-interpreter',
        'beta-imagegen',
        'beta-websearch',
        'beta-reasoning',
      ];
      payload.libraries = [];
      payload.integrations = [];
    }

    const response = await fetch('https://chat.mistral.ai/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Cookie: credential,
        Origin: 'https://chat.mistral.ai',
        Referer: `https://chat.mistral.ai/chat/${chatId}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok)
      throw new Error(`Mistral Stream Error ${response.status}`);

    if (response.body) {
      const body = response.body as any;
      body.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const colonIndex = line.indexOf(':');
          if (colonIndex === -1) continue;
          try {
            const jsonStr = line.slice(colonIndex + 1);
            const data = JSON.parse(jsonStr);
            if (data?.json?.patches) {
              for (const patch of data.json.patches) {
                if (
                  (patch.op === 'append' || patch.op === 'add') &&
                  patch.path.includes('/text') &&
                  patch.value
                ) {
                  onContent(patch.value);
                } else if (
                  patch.value &&
                  typeof patch.value === 'string' &&
                  patch.path.endsWith('/text')
                ) {
                  onContent(patch.value);
                }
              }
            }
          } catch (e) {}
        }
      });
      body.on('end', () => onDone());
      body.on('error', onError);
    } else {
      onDone();
    }
  }

  private makeHttpsRequest(
    url: string,
    options: https.RequestOptions,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300)
            resolve(data);
          else
            reject(
              new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`),
            );
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  registerRoutes() {}

  isModelSupported(model: string): boolean {
    return model.toLowerCase().includes('mistral');
  }
}

export default new MistralProvider();
