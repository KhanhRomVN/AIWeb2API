import { Provider, SendMessageOptions, Message as ChatMessage } from '../../types';
import { createLogger } from '../../utils/logger';
import { cdpLoginService } from '../../services/login/cdp-login.service';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import { StringDecoder } from 'string_decoder';

const logger = createLogger('MoonshotAIProvider');

interface MoonshotAICredential {
  ctoken?: string;
  sessionId?: string;
  cookies?: string;
}

function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieStr) return cookies;
  const parts = cookieStr.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!cookies[key]) {
      cookies[key] = val;
    }
  }
  return cookies;
}

function getCleanPrompt(prompt: string): string {
  // Priority 1: extract content inside <zen-user-content> (used by Zen for first message)
  const userContentMatch = prompt.match(/<zen-user-content>([\s\S]*?)<\/zen-user-content>/);
  if (userContentMatch && userContentMatch[1]) {
    return userContentMatch[1].trim();
  }

  // Priority 2: strip ALL known Zen XML wrapper tags (used in round 2+ messages)
  // These tags appear in subsequent messages: <persistent-rules>, <permission-mode>,
  // <zen-context>, <zen-rules>, <zen-info>, <system>, <thinking>, etc.
  let cleaned = prompt;
  const zenTagPatterns = [
    /<persistent-rules>[\s\S]*?<\/persistent-rules>/g,
    /<permission-mode>[\s\S]*?<\/permission-mode>/g,
    /<zen-context>[\s\S]*?<\/zen-context>/g,
    /<zen-rules>[\s\S]*?<\/zen-rules>/g,
    /<zen-info>[\s\S]*?<\/zen-info>/g,
    /<system>[\s\S]*?<\/system>/g,
    /<thinking>[\s\S]*?<\/thinking>/g,
    /<zen-[^>]*>[\s\S]*?<\/zen-[^>]*>/g,
  ];
  for (const pattern of zenTagPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.trim();
  if (cleaned) {
    return cleaned.substring(0, 500); // cap at 500 chars for the question field
  }

  return prompt.trim().substring(0, 500);
}

class MoonshotAIProvider implements Provider {
  name = 'moonshotai';
  defaultModel = 'kimi-k2.7-code';

  async handleMessage(options: SendMessageOptions): Promise<void> {
    return this.sendMessage({
      credential: options.credential,
      model: options.model,
      messages: options.messages as ChatMessage[],
      conversationId: options.conversationId,
      parent_message_id: options.parent_message_id,
      search: options.search,
      temperature: options.temperature,
      thinking: options.thinking,
      ref_file_ids: options.ref_file_ids,
      onContent: options.onContent,
      onMetadata: options.onMetadata,
      onThinking: options.onThinking,
      onDone: options.onDone,
      onError: options.onError,
      onSessionCreated: options.onSessionCreated
    });
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('kimi') || m.includes('moonshot');
  }

  async login(options: { method?: string }): Promise<{ email: string; cookies: string; headers?: any }> {
    logger.info(`Moonshot AI login with method: ${options.method || 'basic'}`);
    
    const loginUrl = 'https://zenmux.ai/';
    
    const result = await cdpLoginService.login({
      providerId: 'moonshotai',
      loginUrl,
      validate: async (data: { cookies: string; email?: string }) => {
        if (data.cookies) {
          const parsed = parseCookies(data.cookies);
          const ctoken = parsed['ctoken'];
          const sessionId = parsed['sessionId'];
          
          if (ctoken && sessionId) {
            logger.info(`[MoonshotAI] Attempting validation. ctoken: ${ctoken.substring(0, 15)}..., sessionId: ${sessionId.substring(0, 15)}...`);
            try {
              const res = await fetch(`https://zenmux.ai/api/user/info?ctoken=${ctoken}`, {
                headers: {
                  'Cookie': data.cookies,
                  'x-api-version': '2026-04-20',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                },
                timeout: 5000
              });
              
              logger.info(`[MoonshotAI] Fetch user info status: ${res.status} ${res.statusText}`);
              if (res.ok) {
                const bodyText = await res.text();
                logger.info(`[MoonshotAI] Response body: ${bodyText}`);
                try {
                  const json = JSON.parse(bodyText);
                  if (json.success && json.data?.email) {
                    logger.info(`[MoonshotAI] Validation success for email: ${json.data.email}`);
                    return {
                      isValid: true,
                      email: json.data.email,
                      cookies: data.cookies
                    };
                  } else {
                    logger.warn(`[MoonshotAI] Validation response success is false or email missing`);
                  }
                } catch (parseErr: any) {
                  logger.error(`[MoonshotAI] Failed to parse validation response JSON: ${parseErr.message}`);
                }
              } else {
                const errText = await res.text().catch(() => '');
                logger.error(`[MoonshotAI] Fetch user info non-ok response: ${errText}`);
              }
            } catch (e: any) {
              logger.error('[MoonshotAI] Validation error:', e.message);
            }
          } else {
            logger.info(`[MoonshotAI] ctoken or sessionId missing. ctoken: ${!!ctoken}, sessionId: ${!!sessionId}`);
          }
        }
        return { isValid: false };
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }

    return {
      email: result.email || '',
      cookies: result.cookies || '',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
    };
  }

  async sendMessage(params: {
    credential: string;
    model: string;
    messages: ChatMessage[];
    conversationId?: string;
    parent_message_id?: string;
    search?: boolean;
    temperature?: number;
    thinking?: boolean;
    ref_file_ids?: string[];
    onContent: (content: string) => void;
    onMetadata?: (meta: any) => void;
    onThinking?: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    onSessionCreated?: (sessionId: string) => void;
  }): Promise<void> {
    try {
      let cred: MoonshotAICredential;
      try {
        cred = JSON.parse(params.credential);
      } catch {
        cred = { cookies: params.credential };
      }

      const cookieStr = cred.cookies || params.credential;
      const cookies = parseCookies(cookieStr);
      const ctoken = cookies['ctoken'];
      if (!ctoken) {
        throw new Error('ctoken is missing in credentials/cookies');
      }

      // Determine chat room status (New vs Existing)
      let chatId: string | undefined = undefined;
      if (params.conversationId && !params.conversationId.startsWith('moonshotai_') && !params.conversationId.startsWith('msg_')) {
        chatId = params.conversationId;
      }

      // Generate credentials/IDs
      const chatRequestId = crypto.randomUUID().replace(/-/g, '');
      const subChatId = crypto.randomBytes(16).toString('hex');

      // Get last user question text and clean it
      const lastUserMessage = [...params.messages].reverse().find((msg) => msg.role === 'user');
      const rawQuestionText = lastUserMessage ? lastUserMessage.content : '';
      const questionText = getCleanPrompt(rawQuestionText);
      const chatRoomName = questionText.substring(0, 100) || 'New Chat';

      let returnedChatId = chatId || '';
      let returnedChatRoundId: string;

      if (chatId) {
        // Appending to an existing chat room
        const addRoundBody = {
          chatId,
          question: questionText,
          answer: ' ',
          chatRequestId,
          extra: JSON.stringify({
            subChatId,
            modelInfo: {
              slug: 'moonshotai/kimi-k2.7-code-free'
            },
            endpointProviderName: 'MoonshotAI',
            chatRequestId,
            status: 'sending'
          })
        };

        logger.info(`[MoonshotAI] Appending round to existing chat room: ${chatId}`);
        logger.info(`[MoonshotAI] Request URL parameters: ctoken=${ctoken}`);
        logger.info(`[MoonshotAI] Request Body: ${JSON.stringify(addRoundBody, null, 2)}`);

        const addResponse = await fetch(`https://zenmux.ai/api/frontend/chat/addRound?ctoken=${encodeURIComponent(ctoken)}`, {
          method: 'POST',
          headers: {
            'x-api-version': '2026-04-20',
            'Content-Type': 'application/json',
            'Cookie': cookieStr,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          },
          body: JSON.stringify(addRoundBody),
          timeout: 10000
        });

        if (!addResponse.ok) {
          const errText = await addResponse.text();
          throw new Error(`Failed to append round on ZenMux: ${addResponse.status} ${errText}`);
        }

        const addResult = await addResponse.json() as any;
        returnedChatRoundId = addResult.id;
        if (!returnedChatRoundId) {
          throw new Error(`ZenMux addRound API returned invalid data: ${JSON.stringify(addResult)}`);
        }
      } else {
        // Creating a new chat room
        const addBody: any = {
          name: chatRoomName,
          extra: JSON.stringify({
            subChats: [
              {
                subChatId,
                chatModel: {
                  modelInfo: {
                    slug: 'moonshotai/kimi-k2.7-code-free'
                  }
                },
                selectedProtocolId: 'anthropic',
                billing: {
                  mode: 'payg'
                },
                imageConfig: {
                  aspectRatio: '1:1',
                  imageSize: '1K',
                  quality: ''
                }
              }
            ]
          }),
          chatRequestId: [chatRequestId],
          question: questionText,
          answer: '',
          roundExtra: [
            JSON.stringify({
              subChatId,
              modelInfo: {
                slug: 'moonshotai/kimi-k2.7-code-free'
              },
              endpointProviderName: 'MoonshotAI',
              chatRequestId,
              status: 'sending'
            })
          ]
        };

        logger.info(`[MoonshotAI] Registering new chat room/round...`);
        logger.info(`[MoonshotAI] Request URL parameters: ctoken=${ctoken}`);
        logger.info(`[MoonshotAI] Request Body: ${JSON.stringify(addBody, null, 2)}`);

        const addResponse = await fetch(`https://zenmux.ai/api/frontend/chat/add?ctoken=${encodeURIComponent(ctoken)}`, {
          method: 'POST',
          headers: {
            'x-api-version': '2026-04-20',
            'Content-Type': 'application/json',
            'Cookie': cookieStr,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          },
          body: JSON.stringify(addBody),
          timeout: 10000
        });

        if (!addResponse.ok) {
          const errText = await addResponse.text();
          throw new Error(`Failed to register chat room on ZenMux: ${addResponse.status} ${errText}`);
        }

        const addResult = await addResponse.json() as any;
        returnedChatId = addResult.chatId;
        returnedChatRoundId = addResult.chatRoundId;

        if (!returnedChatId || !returnedChatRoundId) {
          throw new Error(`ZenMux add room API returned invalid data: ${JSON.stringify(addResult)}`);
        }
      }

      logger.info(`[MoonshotAI] Registered chat room/round success. chatId: ${returnedChatId}, roundId: ${returnedChatRoundId}`);

      if (params.onSessionCreated) {
        params.onSessionCreated(returnedChatId);
      }

      const formattedMessages = params.messages.map((msg) => {
        const role = msg.role === 'system' ? 'user' : msg.role;
        return {
          role: role,
          content: [
            {
              type: 'text',
              text: msg.content
            }
          ]
        };
      });

      if (formattedMessages.length > 0) {
        const lastMsg = formattedMessages[formattedMessages.length - 1];
        if (lastMsg.role === 'user' && lastMsg.content.length > 0) {
          (lastMsg.content[0] as any).cache_control = { type: 'ephemeral' };
        }
      }

      const headers: Record<string, string> = {
        'x-zenmux-apikey-source': 'payg',
        'chat-request-id': chatRequestId,
        'anthropic-version': '2023-06-01',
        'x-zenmux-accept-processing': 'true, true',
        'x-api-version': '2026-04-20',
        'Content-Type': 'application/json',
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      };

      const body: any = {
        model: 'moonshotai/kimi-k2.7-code-free:moonshotai',
        max_tokens: 262144,
        messages: formattedMessages,
        stream: true
      };

      if (params.thinking) {
        body.thinking = {
          type: 'enabled',
          budget_tokens: 10240
        };
      }

      const startTime = Date.now();
      let firstTokenTime = 0;
      let firstTokenLatency = 0;
      let firstTextTime = 0;
      let totalTokenTime = 0;
      let fullAnswer = '';
      let fullThinking = '';
      let inputTokens = 0;
      let outputTokens = 0;

      const response = await fetch('https://zenmux.ai/api/anthropic/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        timeout: 60000
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ZenMux API Error ${response.status}: ${errText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const decoder = new StringDecoder('utf8');
      let buffer = '';
      let isDone = false;
      for await (const chunk of response.body) {
        if (isDone) break;
        const chunkStr = decoder.write(chunk as Buffer);
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') {
              isDone = true;
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'content_block_delta' && data.delta) {
                if (data.delta.type === 'text_delta' && data.delta.text) {
                  params.onContent(data.delta.text);
                  fullAnswer += data.delta.text;
                  if (firstTextTime === 0) {
                    firstTextTime = Date.now();
                  }
                  if (firstTokenTime === 0) {
                    firstTokenTime = Date.now();
                    firstTokenLatency = firstTokenTime - startTime;
                  }
                } else if (data.delta.type === 'thinking_delta' && data.delta.thinking) {
                  if (params.onThinking) params.onThinking(data.delta.thinking);
                  fullThinking += data.delta.thinking;
                  if (firstTokenTime === 0) {
                    firstTokenTime = Date.now();
                    firstTokenLatency = firstTokenTime - startTime;
                  }
                }
              } else if (data.type === 'message_delta' && data.usage) {
                if (typeof data.usage.input_tokens === 'number') inputTokens = data.usage.input_tokens;
                if (typeof data.usage.output_tokens === 'number') outputTokens = data.usage.output_tokens;
              } else if (data.type === 'message_start' && data.message && data.message.usage) {
                if (typeof data.message.usage.input_tokens === 'number') inputTokens = data.message.usage.input_tokens;
                if (typeof data.message.usage.output_tokens === 'number') outputTokens = data.message.usage.output_tokens;
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }

      // Process any remaining buffer after stream end
      const remaining = decoder.end();
      if (remaining) {
        buffer += remaining;
      }
      if (buffer.trim()) {
        const line = buffer.trim();
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (dataStr !== '[DONE]') {
            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'content_block_delta' && data.delta) {
                if (data.delta.type === 'text_delta' && data.delta.text) {
                  params.onContent(data.delta.text);
                  fullAnswer += data.delta.text;
                } else if (data.delta.type === 'thinking_delta' && data.delta.thinking) {
                  if (params.onThinking) params.onThinking(data.delta.thinking);
                  fullThinking += data.delta.thinking;
                }
              } else if (data.type === 'message_delta' && data.usage) {
                if (typeof data.usage.input_tokens === 'number') inputTokens = data.usage.input_tokens;
                if (typeof data.usage.output_tokens === 'number') outputTokens = data.usage.output_tokens;
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }

      // Calculate latency metrics
      totalTokenTime = Date.now() - startTime;
      if (firstTokenLatency === 0) {
        firstTokenLatency = totalTokenTime;
      }
      
      const reasoningTime = firstTextTime > 0 && firstTokenTime > 0 ? (firstTextTime - firstTokenTime) / 1000 : 0;

      // Update & Save Round
      try {
        const extraObj: any = {
          subChatId,
          chatRequestId,
          status: 'success',
          modelInfo: {
            slug: 'moonshotai/kimi-k2.7-code-free'
          },
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens
          },
          firstTokenLatency,
          totalTokenTime,
          requestId: chatRequestId,
          chatRequestTime: new Date(startTime).toISOString(),
          zenmuxRequestId: chatRequestId,
          endpointProviderName: 'MoonshotAI'
        };

        if (fullThinking) {
          extraObj.reasoning = fullThinking;
          extraObj.reasoningTime = reasoningTime;
        }

        const updateRoundBody = {
          chatId: returnedChatId,
          chatRoundId: returnedChatRoundId,
          question: questionText,
          answer: fullAnswer,
          extra: JSON.stringify(extraObj),
          chatRequestId,
          status: 'success',
          finishReason: 'success'
        };

        logger.info(`[MoonshotAI] Synchronizing round to ZenMux... chatId: ${returnedChatId}, roundId: ${returnedChatRoundId}`);
        logger.info(`[MoonshotAI] updateRoundBody: ${JSON.stringify(updateRoundBody, null, 2)}`);
        const updateResponse = await fetch(`https://zenmux.ai/api/frontend/chat/updateRound?ctoken=${ctoken}`, {
          method: 'POST',
          headers: {
            'x-api-version': '2026-04-20',
            'Content-Type': 'application/json',
            'Cookie': cookieStr,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          },
          body: JSON.stringify(updateRoundBody),
          timeout: 10000
        });

        if (!updateResponse.ok) {
          const errText = await updateResponse.text();
          logger.error(`[MoonshotAI] Failed to updateRound: ${updateResponse.status} ${errText}`);
        } else {
          logger.info(`[MoonshotAI] Successfully synchronized round to ZenMux.`);
        }
      } catch (updateErr: any) {
        logger.error(`[MoonshotAI] Error calling updateRound API: ${updateErr.message}`);
      }

      params.onDone();
    } catch (error: any) {
      logger.error('Moonshot AI sendMessage error', error);
      params.onError(error);
    }
  }

  async getModels(credential: string, accountId?: string): Promise<Array<{ id: string; name: string; is_thinking?: boolean; max_context_length?: number | null; is_image_upload?: boolean; is_video_upload?: boolean }>> {
    return [
      { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', is_thinking: true, max_context_length: 262144, is_image_upload: false, is_video_upload: false },
    ];
  }
}

export default new MoonshotAIProvider();