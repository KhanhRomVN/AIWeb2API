import { Request, Response } from 'express';
import { providerRegistry } from '../../provider/registry';
import { SendMessageOptions } from '../../types';
import { countTokens, countMessagesTokens } from '../../utils/tokenizer';
import { createLogger } from '../../utils/logger';
import { getDb } from '../../database';
import { findFirstSequenceGlobal } from '../../repositories/model-sequence.repository';
import {
  sessionStore,
  requestQueue,
  generateId,
  getSessionKey,
  generateSessionFingerprint,
  isResetCommand,
  isProbeRequest,
  createWarmupResponse,
  resolveClaudeModelMapping,
} from '../../services/chat/chat-session.service';

const logger = createLogger('messages');

export const messagesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const apiKey = getSessionKey(req);
  const { model, messages, stream } = req.body;

  // Fast path: intercept probe requests before session logic
  if (isProbeRequest(messages)) {
    logger.debug(`Intercepted Probe request from key: ${apiKey.substring(0, 10)}...`);
    createWarmupResponse(res, stream, model);
    return;
  }

  const sessionKey = generateSessionFingerprint(apiKey, messages, req.body);
  const currentQueue = requestQueue.get(sessionKey) || Promise.resolve();

  const newRequestPromise = currentQueue.then(async () => {
    try {
      const { model, messages, system, stream } = req.body;
      let currentSessionId = sessionStore.get(sessionKey) || null;

      logger.debug(
        `Request | session: ${sessionKey.substring(0, 10)}... | stored: ${currentSessionId}`,
      );

      // Handle reset command
      if (isResetCommand(messages)) {
        sessionStore.delete(sessionKey);
        currentSessionId = null;
        logger.debug(`Session reset for key: ${sessionKey}`);

        if (stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.write(
            `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: generateId(), type: 'message', role: 'assistant', content: [], usage: { input_tokens: 0, output_tokens: 0 } } })}\n\n`,
          );
          res.write(
            `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`,
          );
          res.write(
            `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Conversation history has been reset for this terminal.' } })}\n\n`,
          );
          res.write(
            `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`,
          );
          res.write(
            `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
          );
          res.end();
        } else {
          res.json({ content: [{ type: 'text', text: 'Conversation history reset.' }] });
        }
        return;
      }

      // Secondary probe check (inside queue)
      if (isProbeRequest(messages)) {
        logger.debug(`Intercepted Probe request from key: ${sessionKey.substring(0, 10)}...`);
        createWarmupResponse(res, stream, model);
        return;
      }

      // Account selection
      const db = getDb();
      const accounts = db.prepare('SELECT * FROM accounts').all() as any[];
      let account: any | undefined;

      let targetProviderId: string | undefined;
      let targetModelId: string | undefined = model;

      // Model mapping (Claude Code CLI → configured model)
      const mapped = resolveClaudeModelMapping(model || '');
      if (mapped) {
        if (mapped.providerId) targetProviderId = mapped.providerId;
        if (mapped.modelId) targetModelId = mapped.modelId;
        logger.debug(
          `Model mapping: ${model} -> ${targetProviderId ? targetProviderId + '/' : ''}${targetModelId}`,
        );
      }

      // Handle "auto" or "provider/model" format
      if (!mapped && model === 'auto') {
        const bestSequence = findFirstSequenceGlobal();
        if (bestSequence) {
          targetProviderId = bestSequence.provider_id;
          // model_id is resolved later via provider default
          logger.debug(`Auto-selected provider: ${targetProviderId}`);
        }
      } else if (!targetProviderId && model && model.includes('/')) {
        const parts = model.split('/');
        targetProviderId = parts[0];
        targetModelId = parts.slice(1).join('/');
      } else if (!targetProviderId && model) {
        const inferredProvider = providerRegistry.getProviderForModel(model);
        if (inferredProvider) {
          targetProviderId = inferredProvider.name;
        }
      }

      if (targetProviderId) {
        const tid = targetProviderId.trim().toLowerCase();
        account = accounts.find(
          (a) => (a.provider_id || '').trim().toLowerCase() === tid,
        );

        if (!account) {
          const availableProviders = [
            ...new Set(accounts.map((a) => a.provider_id)),
          ];
          logger.debug(
            `Account not found for "${tid}". Available: ${availableProviders.join(', ')}`,
          );
        }
      }

      if (!account) {
        res.status(401).json({
          error: {
            type: 'authentication_error',
            message: 'No active account found for this request',
          },
        });
        return;
      }

      const finalModel = targetModelId || model;

      // Adapt request: merge system prompt + messages
      const providerMessages: any[] = [];
      if (system) {
        let systemContent = '';
        if (Array.isArray(system)) {
          systemContent = system.map((block: any) => block.text || '').join('\n');
        } else {
          systemContent = system;
        }
        providerMessages.push({ role: 'system', content: systemContent });
      }

      if (Array.isArray(messages)) {
        const formattedMessages = messages.map((msg: any) => {
          let content = msg.content;
          if (Array.isArray(content)) {
            content = content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n');
          }
          return { role: msg.role, content };
        });

        if (currentSessionId) {
          if (formattedMessages.length > 0) {
            const lastMsg = formattedMessages[formattedMessages.length - 1];
            providerMessages.push(lastMsg);
            logger.debug(`Reusing session ${currentSessionId}. Sending only last message.`);
          }
        } else {
          providerMessages.push(...formattedMessages);
          logger.debug(`New session. Sending full history (${formattedMessages.length} msgs).`);
        }
      }

      const msgId = generateId();
      const sendEvent = (event: string, data: any) => {
        if (stream) {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      };

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        sendEvent('message_start', {
          type: 'message_start',
          message: {
            id: msgId,
            type: 'message',
            role: 'assistant',
            model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        });
        sendEvent('content_block_start', {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        });
        sendEvent('ping', { type: 'ping' });
      }

      const provider = providerRegistry.getProvider(account.provider_id);
      if (!provider) {
        throw new Error(`Provider ${account.provider_id} not loaded`);
      }

      const inputTokens = countMessagesTokens(providerMessages);
      let outputTokens = 0;
      let accumulatedContent = '';

      const options: SendMessageOptions = {
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: finalModel || provider.defaultModel || 'default',
        thinking: false,
        messages: providerMessages,
        stream: true,
        conversationId: currentSessionId || undefined,

        onContent: (content: string) => {
          accumulatedContent += content;
          outputTokens += countTokens(content);
          sendEvent('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: content },
          });
        },
        onSessionCreated: (sessionId: string) => {
          if (!currentSessionId) {
            sessionStore.set(sessionKey, sessionId);
            logger.debug(`Captured new session ID: ${sessionId} for key: ${sessionKey}`);
          }
        },
        onDone: () => {
          if (stream) {
            sendEvent('content_block_stop', { type: 'content_block_stop', index: 0 });
            sendEvent('message_delta', {
              type: 'message_delta',
              delta: { stop_reason: 'end_turn', stop_sequence: null },
              usage: { output_tokens: outputTokens },
            });
            sendEvent('message_stop', { type: 'message_stop' });
            res.end();
          } else {
            res.status(200).json({
              id: msgId,
              type: 'message',
              role: 'assistant',
              content: [{ type: 'text', text: accumulatedContent }],
              model: finalModel || model,
              stop_reason: 'end_turn',
              stop_sequence: null,
              usage: { input_tokens: inputTokens, output_tokens: outputTokens },
            });
          }
        },
        onError: (err: Error) => {
          logger.error('Provider Error:', err);
          if (
            err.message &&
            (err.message.includes('404') || err.message.includes('session'))
          ) {
            logger.warn(
              `Session error for key ${sessionKey}, clearing session ID.`,
            );
            sessionStore.delete(sessionKey);
          }

          if (stream) {
            sendEvent('error', {
              type: 'error',
              error: { type: 'api_error', message: err.message },
            });
            res.end();
          } else {
            if (!res.headersSent) {
              res.status(500).json({ error: { type: 'api_error', message: err.message } });
            }
          }
        },
      };

      await provider.handleMessage(options);
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: { type: 'api_error', message: error.message } });
      }
    }
  });

  requestQueue.set(sessionKey, newRequestPromise.catch(() => {}));
};
