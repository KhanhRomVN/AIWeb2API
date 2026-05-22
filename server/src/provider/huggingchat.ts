import { Provider, SendMessageOptions } from './types';
import { Router } from 'express';
import fetch from 'node-fetch';
import { HttpClient } from '../utils/http-client';
import * as crypto from 'crypto';
import { findAccount } from '../services/account-selector';
import { createLogger } from '../utils/logger';
import { countTokens, countMessagesTokens } from '../utils/tokenizer';
import { loginService } from '../services/login.service';
import { ProxyHandler } from '../services/proxy.service';
import { proxyEvents } from '../services/proxy-events';

const logger = createLogger('HuggingChatProvider');

const BASE_URL = 'https://huggingface.co';

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
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('huggingface.co')) {
      const reqCookies = ctx.clientToProxyRequest.headers.cookie;
      if (reqCookies && reqCookies.includes('token')) {
        proxyEvents.emit('hugging-chat-cookies', reqCookies);
      }
    }
    callback();
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('huggingface.co') &&
      url.includes('/chat/login')
    ) {
      try {
        const json = JSON.parse(body);
        if (json.email) proxyEvents.emit('hugging-chat-login-data', json.email);
      } catch (e) {
        const emailMatch = body.match(/"email":"([^"]+)"/);
        if (emailMatch && emailMatch[1]) {
          proxyEvents.emit('hugging-chat-login-data', emailMatch[1]);
        }
      }
    }
  },
};

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class HuggingChatProvider implements Provider {
  name = 'HuggingChat';
  proxyHandler = proxyHandler;
  defaultModel = 'omni';

  async login() {
    logger.info('Starting HuggingChat login...');

    let capturedEmail = '';

    const onLoginData = (email: string) => {
      logger.info(`[HuggingChat] Captured email from form: ${email}`);
      capturedEmail = email;
    };

    proxyEvents.on('hugging-chat-login-data', onLoginData);

    try {
      return await loginService.login({
        providerId: 'huggingchat',
        loginUrl: 'https://huggingface.co/chat/login',
        partition: `huggingchat-${Date.now()}`,
        cookieEvent: 'hugging-chat-cookies',
        infoEvent: 'hugging-chat-login-data',
        extraEvents: ['hugging-chat-login-data'],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          logger.debug('[HuggingChat] Validating session...');
          let identityEmail = '';
          let apiEmail = '';

          try {
            const profile = await this.getProfile(data.cookies);
            if (profile.email) {
              apiEmail = profile.email;
            }
          } catch (e) {
            logger.warn('[HuggingChat] Chat API verify failed:', e);
          }

          if (capturedEmail) {
            identityEmail = capturedEmail;
          } else if (apiEmail) {
            identityEmail = apiEmail;
          }

          if (identityEmail) {
            return {
              isValid: true,
              cookies: data.cookies,
              email: identityEmail,
            };
          }
          return { isValid: false };
        },
      });
    } finally {
      proxyEvents.off('hugging-chat-login-data', onLoginData);
    }
  }

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const response = await fetch('https://huggingface.co/chat/api/v2/user', {
        headers: {
          Cookie: credential,
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          accept: 'application/json',
        },
      });

      if (response.ok) {
        const chatUser = await response.json();
        return {
          email:
            chatUser.email ||
            (chatUser.username ? `${chatUser.username}@hf.co` : null),
          name: chatUser.username || chatUser.name,
          id: chatUser.id || chatUser._id,
        };
      }
      return { email: null };
    } catch (e) {
      logger.error('[HuggingChat] Get Profile Error:', e);
      return { email: null };
    }
  }

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
    } = options;

    const cookieHeader = credential;
    const client = this.createClient(cookieHeader);

    try {
      let conversationId = options.conversationId;
      if (!conversationId) {
        const createRes = await client.post('/chat/conversation', {
          model: model || this.defaultModel,
          preprompt: '',
        });
        const createData = await createRes.json();
        conversationId = createData.conversationId;
      }

      if (!conversationId) throw new Error('Failed to obtain conversation ID');

      const detailRes = await client.get(
        `/chat/api/v2/conversations/${conversationId}`,
      );
      const detail = await detailRes.json();
      const details = detail.json || detail;

      let parentMessageId = '';
      if (details.messages && details.messages.length > 0) {
        parentMessageId = details.messages[details.messages.length - 1].id;
      } else if (details.rootMessageId) {
        parentMessageId = details.rootMessageId;
      } else {
        parentMessageId = crypto.randomUUID();
      }

      const lastMessage = messages[messages.length - 1];
      const boundary =
        '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');

      const payload = {
        inputs: lastMessage.content,
        id: parentMessageId,
        is_retry: false,
        is_continue: false,
        selectedMcpServerNames: [],
        selectedMcpServers: [],
      };

      const formData = `--${boundary}\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--\r\n`;
      const formBuffer = Buffer.from(formData, 'utf-8');

      const response = await fetch(
        `${BASE_URL}/chat/conversation/${conversationId}`,
        {
          method: 'POST',
          headers: {
            Cookie: cookieHeader,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            Origin: BASE_URL,
            Referer: `${BASE_URL}/chat/conversation/${conversationId}`,
          },
          body: formBuffer,
        },
      );

      if (!response.ok)
        throw new Error(`HuggingChat API Error ${response.status}`);

      const promptTokens = countMessagesTokens(messages);
      let completionTokens = 0;

      if (onMetadata)
        onMetadata({
          conversation_id: conversationId,
          total_token: promptTokens,
        });

      if (!response.body) throw new Error('No response body');

      let buffer = '';
      let isThinking = false;
      let fullContentBuffer = '';

      for await (const chunk of response.body as any) {
        const chunkStr = chunk.toString().replace(/\\u0000/g, '');
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.type === 'stream' && json.token) {
              const token = json.token;
              completionTokens += countTokens(token);
              fullContentBuffer += token;

              if (token.includes('<think>')) {
                isThinking = true;
                const [before, after] = token.split('<think>');
                if (before) onContent(before);
                if (after && onThinking) onThinking(after);
                else if (after) onContent(after);
              } else if (token.includes('</think>')) {
                isThinking = false;
                const [before, after] = token.split('</think>');
                if (before && onThinking) onThinking(before);
                else if (before) onContent(before);
                if (after) onContent(after);
              } else {
                if (isThinking && onThinking) onThinking(token);
                else onContent(token);
              }

              if (onMetadata)
                onMetadata({ total_token: promptTokens + completionTokens });
            } else if (json.type === 'title' && json.title && onMetadata) {
              onMetadata({ conversation_title: json.title });
            }
          } catch (e) {}
        }
      }
      onDone();
    } catch (err: any) {
      onError(err);
    }
  }

  async getModels(credential: string): Promise<any[]> {
    try {
      const client = this.createClient(credential);
      const res = await client.get('/chat/api/v2/models');
      const data = await res.json();
      const modelsList = data.json || data.models || data || [];

      return modelsList.map((model: any) => {
        let contextLength: number | null = null;
        if (model.providers && Array.isArray(model.providers)) {
          for (const provider of model.providers) {
            if (provider.context_length) {
              contextLength = provider.context_length;
              break;
            }
          }
        }
        return {
          id: model.id,
          name: model.displayName || model.name || model.id,
          is_thinking: false,
          context_length: contextLength,
        };
      });
    } catch (error) {
      logger.error('Error fetching models from HuggingChat API:', error);
      return [];
    }
  }

  private createClient(cookie: string) {
    return new HttpClient({
      baseURL: BASE_URL,
      headers: {
        Cookie: cookie,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
  }

  registerRoutes(router: Router) {
    // Routes removed as getConversations is no longer needed
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return (m.includes('/') && !m.includes(':free')) || m === 'omni';
  }
}

export default new HuggingChatProvider();
