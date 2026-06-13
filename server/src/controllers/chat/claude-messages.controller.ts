import { Request, Response } from 'express';
import { sendMessage } from '../../services/chat';
import { createLogger } from '../../utils/logger';
import { recordRequest } from '../../services/stats.service';
import { providerRegistry } from '../../provider/registry';
import { getAccountSelector } from '../../services/account-selector';
import { countTokens, countMessagesTokens } from '../../utils/tokenizer';
import crypto from 'crypto';

const logger = createLogger('ClaudeMessagesController');

const unescapeHtml = (str: string): string => {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
};

// POST /v1/chat/messages (Anthropic-compatible)
export const claudeMessagesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { model, messages, stream, temperature } = req.body;

    let targetProviderId: string | undefined;
    let targetModelId: string | undefined = model;

    if (model && model.includes('/')) {
      const parts = model.split('/');
      targetProviderId = parts[0];
      targetModelId = parts.slice(1).join('/');
    } else if (model) {
      const inferredProvider = providerRegistry.getProviderForModel(model);
      if (inferredProvider) {
        targetProviderId = inferredProvider.name;
      }
    }

    const selector = getAccountSelector();
    const accounts = selector.getActiveAccounts();
    let account: any | undefined;

    if (targetProviderId) {
      account = accounts.find(
        (a) => a.provider_id.toLowerCase() === targetProviderId!.toLowerCase(),
      );
    }

    if (!account && accounts.length > 0) {
      account = accounts[0];
    }

    if (!account) {
      logger.warn(`[Claude] Unauthorized: No active account found for model ${model}`);
      res.status(401).json({
        error: {
          type: 'not_found_error',
          message: 'No active account found in Elara for this request.',
        },
      });
      return;
    }

    const finalModel = targetModelId || model;

    // Convert Anthropic messages to internal format
    const elaraMessages = messages.map((m: any) => ({
      role: m.role,
      content: Array.isArray(m.content)
        ? m.content
            .map((c: any) => (c.type === 'text' ? c.text : ''))
            .join('\n')
        : m.content,
    }));

    const inputTokens = countMessagesTokens(elaraMessages);
    let outputTokens = 0;
    let accumulatedContent = '';

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const messageId = `msg_${crypto.randomUUID()}`;
      res.write(
        `data: ${JSON.stringify({
          type: 'message_start',
          message: {
            id: messageId,
            type: 'message',
            role: 'assistant',
            content: [],
            model: finalModel,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: inputTokens, output_tokens: 0 },
          },
        })}\n\n`,
      );

      recordRequest(account.provider_id, finalModel);
      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: finalModel,
        messages: elaraMessages,
        temperature,
        stream: true,
        onContent: (content: string) => {
          accumulatedContent += content;
          outputTokens += countTokens(content);
          res.write(
            `data: ${JSON.stringify({
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: unescapeHtml(content) },
            })}\n\n`,
          );
        },
        onDone: () => {
          res.write(
            `data: ${JSON.stringify({
              type: 'message_delta',
              delta: { stop_reason: 'end_turn', stop_sequence: null },
              usage: { output_tokens: outputTokens },
            })}\n\n`,
          );
          res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
          res.end();
        },
        onError: (err: Error) => {
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              error: { type: 'api_error', message: err.message },
            })}\n\n`,
          );
          res.end();
        },
      });
    } else {
      recordRequest(account.provider_id, finalModel);
      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: finalModel,
        messages: elaraMessages,
        temperature,
        stream: false,
        onContent: (content: string) => {
          accumulatedContent += content;
        },
        onDone: () => {
          outputTokens = countTokens(accumulatedContent);
          res.status(200).json({
            id: `msg_${crypto.randomUUID()}`,
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: unescapeHtml(accumulatedContent) }],
            model: finalModel,
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
            },
          });
        },
        onError: (err: Error) => {
          res.status(500).json({ error: { type: 'api_error', message: err.message } });
        },
      });
    }
  } catch (error: any) {
    logger.error('Error in claudeMessagesController', error);
    if (!res.headersSent) {
      res.status(500).json({ error: { type: 'api_error', message: error.message } });
    }
  }
};
