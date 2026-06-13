import { Provider, SendMessageOptions } from '../../types';
import { Router } from 'express';
import { HttpClient } from '../../utils/http-client';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { createLogger } from '../../utils/logger';
import { countTokens, countMessagesTokens } from '../../utils/tokenizer';
import { loginService } from '../../services/login.service';
import { proxyHandler } from './claude.proxy-handler';

export { proxyHandler };

export const BASE_URL = 'https://claude.ai';

const logger = createLogger('ClaudeProvider');

export class ClaudeProvider implements Provider {
  name = 'Claude';
  proxyHandler = proxyHandler;
  defaultModel = 'claude-3-5-sonnet-20241022';

  async login() {
    logger.info('Starting Claude login...');

    return await loginService.login({
      providerId: 'claude',
      loginUrl: 'https://claude.ai/login',
      partition: `claude-${Date.now()}`,
      cookieEvent: 'claude-cookies',
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies) {
          logger.info('[Claude] Validating with captured cookies');

          let email = data.email;
          if (!email) {
            logger.info('[Claude] Email not captured, fetching profile...');
            const profile = await this.getProfile(data.cookies);
            email = profile.email || undefined;
          }

          if (email) {
            logger.info(`[Claude] Validation success for email: ${email}`);
            return { isValid: true, cookies: data.cookies, email };
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
      const client = this.createClient(credential);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await client.get('/api/organizations', {
          signal: controller.signal as any,
        });

        clearTimeout(timeoutId);

        if (response.status === 200 || response.ok) {
          const json = await response.json();
          if (Array.isArray(json) && json.length > 0) {
            const org = json[0];
            return {
              email: org.created_by_user?.email || null,
              name: org.name,
              id: org.uuid,
            };
          }
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          logger.warn('[Claude] Get Profile Timeout (15s)');
        } else {
          throw e;
        }
      }
      return { email: null };
    } catch (e) {
      logger.error('[Claude] Get Profile Error:', e);
      return { email: null };
    }
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onMetadata,
      onDone,
      onError,
    } = options;
    const client = this.createClient(credential);

    try {
      const orgsRes = await client.get('/api/organizations');
      const orgs = await orgsRes.json();
      if (!orgs || !orgs.length) throw new Error('No organizations found');
      const orgId = orgs[0].uuid;

      const convUuid = options.conversationId || crypto.randomUUID();
      let parentMessageUuid = '00000000-0000-4000-8000-000000000000';

      if (!options.conversationId) {
        await client.post(`/api/organizations/${orgId}/chat_conversations`, {
          uuid: convUuid,
          name: '',
        });
      } else {
        const lastId = await this.getLastMessageId(client, orgId, convUuid);
        if (lastId) parentMessageUuid = lastId;
      }

      const lastMessage = messages[messages.length - 1];
      const messagePayload = {
        prompt: lastMessage.content,
        timezone: 'Asia/Saigon',
        model: model || 'claude-3-5-sonnet-20241022',
        attachments: [],
        files: options.ref_file_ids || [],
        rendering_mode: 'messages',
        parent_message_uuid: parentMessageUuid,
        locale: 'en-US',
        tools: [
          { type: 'web_search_v0', name: 'web_search' },
          { type: 'artifacts_v0', name: 'artifacts' },
          { type: 'repl_v0', name: 'repl' },
        ],
        personalized_styles: [
          {
            type: 'default',
            key: 'Default',
            name: 'Normal',
            nameKey: 'normal_style_name',
            prompt: 'Normal\n',
            summary: 'Default responses from Claude',
            summaryKey: 'normal_style_summary',
            isDefault: true,
          },
        ],
      };

      const response = await client.post(
        `/api/organizations/${orgId}/chat_conversations/${convUuid}/completion`,
        messagePayload,
      );
      if (!response.ok) {
        const txt = await response.text();
        logger.error(`Claude API Error ${response.status}: ${txt}`);
        throw new Error(`Claude API Error ${response.status}: ${txt}`);
      }

      const promptTokens = countMessagesTokens(messages);
      let completionTokens = 0;

      if (onMetadata)
        onMetadata({
          conversation_id: convUuid,
          conversation_title: 'New Chat',
          total_token: promptTokens,
        });
      if (!response.body) throw new Error('No response body');

      let buffer = '';
      for await (const chunk of response.body) {
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') {
              onDone();
              return;
            }
            try {
              const json = JSON.parse(jsonStr);
              if (json.completion) onContent(json.completion);

              if (json.type === 'content_block_delta' && json.delta?.text) {
                const deltaText = json.delta.text;
                completionTokens += countTokens(deltaText);
                onContent(deltaText);
                if (onMetadata) {
                  onMetadata({ total_token: promptTokens + completionTokens });
                }
              }

              if (json.stop_reason || json.type === 'message_stop') {
                onDone();
                return;
              }
            } catch (e) {}
          }
        }
      }
      onDone();
    } catch (err: any) {
      onError(err);
    }
  }

  private async getLastMessageId(
    client: HttpClient,
    orgId: string,
    convUuid: string,
  ): Promise<string | null> {
    try {
      const res = await client.get(
        `/api/organizations/${orgId}/chat_conversations/${convUuid}?tree=True&rendering_mode=messages`,
      );
      if (res.ok) {
        const data = await res.json();
        const messages = data?.chat_messages || [];
        if (messages.length > 0) {
          return messages[messages.length - 1].uuid;
        }
      }
    } catch (e) {
      logger.warn(`Failed to get last message ID for ${convUuid}:`, e);
    }
    return null;
  }

  async uploadFile(credential: string, file: any): Promise<any> {
    const client = this.createClient(credential);

    const orgs = await (await client.get('/api/organizations')).json();
    if (!orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid;

    const boundary =
      '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    const headers = {
      Cookie: `sessionKey=${credential}`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      Accept: 'application/json',
      'anthropic-client-platform': 'web_claude_ai',
      'anthropic-client-version': '1.0.0',
      'anthropic-device-id': crypto.randomUUID(),
      'anthropic-anonymous-id': `claudeai.v1.${crypto.randomUUID()}`,
    };

    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.originalname}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`,
      ),
      file.buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${BASE_URL}/api/${orgId}/upload`, {
      method: 'POST',
      headers,
      body: body as any,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Claude Upload Failed: ${res.status} ${txt}`);
    }

    const result = await res.json();
    if (result.file_uuid) {
      return result.file_uuid;
    }
    return result;
  }

  private createClient(credential: string) {
    const deviceIdMatch = credential.match(/anthropic-device-id=([^;]+)/);
    const anonIdMatch = credential.match(/ajs_anonymous_id=([^;]+)/);

    const deviceId = deviceIdMatch ? deviceIdMatch[1] : crypto.randomUUID();
    const anonId = anonIdMatch
      ? anonIdMatch[1]
      : `claudeai.v1.${crypto.randomUUID()}`;

    const cookieHeader = credential.includes('=')
      ? credential
      : `sessionKey=${credential}`;

    return new HttpClient({
      baseURL: BASE_URL,
      headers: {
        Cookie: cookieHeader,
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
        'anthropic-client-platform': 'web_claude_ai',
        'anthropic-client-version': '1.0.0',
        'anthropic-client-sha': '4fabd311078f35ab38da1e82e1633defc25bb267',
        'anthropic-device-id': deviceId,
        'anthropic-anonymous-id': anonId,
      },
    });
  }

  registerRoutes(_router: Router) {}

  isModelSupported(model: string): boolean {
    return model.toLowerCase().startsWith('claude-');
  }
}

export default new ClaudeProvider();
