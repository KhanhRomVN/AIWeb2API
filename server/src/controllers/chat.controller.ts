import { Request, Response } from 'express';
import { getDb } from '../services/db';
import { sendMessage } from '../services/chat.service';
import { createLogger } from '../utils/logger';
import crypto from 'crypto';
import { recordRequest } from '../services/stats.service';

import { getAllProviders } from '../services/provider.service';
import { providerRegistry } from '../provider/registry';
import { getAccountSelector } from '../services/account-selector';
import { countTokens, countMessagesTokens } from '../utils/tokenizer';

const logger = createLogger('ChatController');
const unescapeHtml = (str: string): string => {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
};

// POST /v1/accounts/:accountId/messages
export const sendMessageController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const accountIdFromParams = req.params.accountId;
    const {
      accountId: accountIdFromBody,
      providerId,
      modelId,
      messages,
      conversationId,
      stream,
      is_search,
      search,
      temperature,
      thinking,
      ref_file_ids,
    } = req.body;

    if (messages && messages.length > 1 && providerId !== 'kiro-cli') {
      if (!conversationId || conversationId.trim() === '') {
        const msg =
          'Missing Conversation ID: For multi-turn conversations, a valid conversationId must be provided.';
        logger.error(`[Chat] Validation Error: ${msg}`);
        res.status(400).json({
          success: false,
          message: msg,
          error: {
            code: 'BAD_REQUEST',
            details: 'conversationId is required for messages > 1',
          },
        });
        return;
      }
    }

    let accountId = accountIdFromParams || accountIdFromBody;
    const useSearch = is_search === true || search === true;

    const db = getDb();
    let account: any | undefined;

    if (accountId) {
      account = db
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get(accountId) as any;

      if (account && providerId) {
        // Kiểm tra tính nhất quán giữa accountId và providerId
        if (account.provider_id.toLowerCase() !== providerId.toLowerCase()) {
          res.status(400).json({
            success: false,
            message: `Account Conflict: The provided accountId belongs to provider '${account.provider_id}', but providerId is '${providerId}'.`,
            error: { code: 'BAD_REQUEST' },
          });
          return;
        }
      }
    } else if (providerId) {
      // Tự tìm account khi chỉ có providerId
      account = getAccountSelector().selectAccount(providerId);
    } else if (modelId) {
      if (modelId === 'auto') {
        // Find provider with highest priority sequence
        const bestSequence = db
          .prepare(
            'SELECT provider_id FROM model_sequences ORDER BY sequence ASC LIMIT 1',
          )
          .get() as { provider_id: string } | undefined;

        if (bestSequence) {
          // Use provider from sequence
          account = getAccountSelector().selectAccount(
            bestSequence.provider_id,
          );
        } else {
          // Fallback to random/default
          account = getAccountSelector().selectAccount();
        }
      } else {
        // Tự tìm account dựa trên modelId cụ thể
        const inferredProvider = providerRegistry.getProviderForModel(modelId);
        if (inferredProvider) {
          account = getAccountSelector().selectAccount(inferredProvider.name);
        }
      }
    }

    if (!account) {
      logger.warn(`[Chat] Unauthorized: No active account found. Params - accountId: ${accountId}, providerId: ${providerId}, modelId: ${modelId}`);
      res.status(401).json({
        success: false,
        message:
          'No valid account found for this request. Please provide a valid accountId, providerId, or modelId.',
        error: { code: 'UNAUTHORIZED' },
      });
      return;
    }

    // Resolve "auto" model
    let finalModel = modelId;
    if (modelId === 'auto') {
      const bestModel = db
        .prepare(
          'SELECT model_id FROM model_sequences WHERE provider_id = ? ORDER BY sequence ASC LIMIT 1',
        )
        .get(account.provider_id) as { model_id: string } | undefined;

      if (bestModel) {
        finalModel = bestModel.model_id;
        console.log(
          `[Chat] Auto-selected model for ${account.provider_id}: ${finalModel}`,
        );
      } else {
        console.warn(
          `[Chat] "auto" model requested but no sequence found for ${account.provider_id}`,
        );
        // Fallback: try to get default model from provider registry or let it fail
        const provider = providerRegistry.getProvider(account.provider_id);
        if (provider?.defaultModel) {
          finalModel = provider.defaultModel;
        }
      }
    }

    const model = finalModel;

    const providers = await getAllProviders();
    const providerConfig = providers.find(
      (p) => p.provider_id.toLowerCase() === account.provider_id.toLowerCase(),
    );
    const websiteUrl = providerConfig?.website;

    // Validate search capability
    if (useSearch) {
      if (!providerConfig?.is_search) {
        res.status(400).json({
          error: `Provider ${account.provider_id} does not support search`,
        });
        return;
      }
    }

    const initialMeta: any = {
      accountId: account.id,
      providerId: account.provider_id,
      modelId: model,
      email: account.email,
    };
    if (websiteUrl) {
      initialMeta.websiteUrl = websiteUrl;
    }

    // Set up SSE headers if streaming (default true)
    if (stream !== false) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const responseData = { meta: initialMeta };
      console.log(
        '[Debug] SendMessage Initial Meta:',
        JSON.stringify(responseData),
      );
      res.write(`data: ${JSON.stringify(responseData)}\n\n`);
    }

    let accumulatedContent = '';
    let accumulatedMetadata: any = { ...initialMeta };
    let activeConversationId = conversationId;

    try {
      // captureFirstResponse check removed

      recordRequest(account.id, account.provider_id, model, conversationId);

      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model,
        messages,
        conversationId,
        search: useSearch,
        temperature,
        thinking,
        ref_file_ids,
        onContent: (content) => {
          if (stream !== false) {
            const responseData = { content: unescapeHtml(content) };
            console.log(
              '[Debug] SendMessage Content:',
              JSON.stringify(responseData),
            );
            res.write(`data: ${JSON.stringify(responseData)}\n\n`);
          } else {
            accumulatedContent += content;
          }
        },
        onMetadata: (meta) => {
          if (stream !== false) {
            const responseData = { meta };
            console.log(
              '[Debug] SendMessage Metadata:',
              JSON.stringify(responseData),
            );
            res.write(`data: ${JSON.stringify(responseData)}\n\n`);
          } else {
            accumulatedMetadata = { ...accumulatedMetadata, ...meta };
          }
        },
        onThinking: (content) => {
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ thinking: content })}\n\n`);
          }
          // Note: added thinking handling for consistency if needed
        },
        onDone: () => {
          // Updated: Logic tính toán token và ghi metrics đã được chuyển về Client
          // Backend chỉ đóng vai trò forward stream và lưu session

          if (stream !== false) {
            res.write('data: [DONE]\n\n');
            res.end();
          } else {
            if (!res.headersSent) {
              const responseData = {
                success: true,
                message: {
                  role: 'assistant',
                  content: unescapeHtml(accumulatedContent),
                },
                metadata: accumulatedMetadata,
              };
              console.log(
                '[Debug] SendMessage Final Response:',
                JSON.stringify(responseData),
              );
              res.status(200).json(responseData);
            }
          }
        },
        onSessionCreated: (sessionId) => {
          activeConversationId = sessionId;

          if (stream !== false) {
            res.write(`event: session_created\ndata: ${sessionId}\n\n`);
          } else {
            accumulatedMetadata.conversation_id = sessionId;
          }
        },
        onError: (error) => {
          logger.error('Stream error', error);
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
          } else {
            if (!res.headersSent) {
              res.status(500).json({ error: error.message });
            }
          }
        },
      });
    } catch (error: any) {
      logger.error('Error in sendMessage service call', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  } catch (error) {
    logger.error('Error in sendMessageController', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// POST /v1/chat/messages (Anthropic)
export const claudeMessagesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { model, messages, stream, max_tokens, temperature } = req.body;

    // Resolve Provider and Model
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

    // Fallback if no specific provider/account found
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

    // Convert Anthropic messages to Elara format
    const elaraMessages = messages.map((m: any) => ({
      role: m.role,
      content: Array.isArray(m.content)
        ? m.content
            .map((c: any) => (c.type === 'text' ? c.text : ''))
            .join('\n')
        : m.content,
    }));

    // Token calculation
    const inputTokens = countMessagesTokens(elaraMessages);
    let outputTokens = 0;
    let accumulatedContent = '';

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Anthropic format: message_start
      const messageId = `msg_${crypto.randomUUID()}`;
      const messageStartData = {
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
      };
      console.log(
        '[Debug] Claude Message Start:',
        JSON.stringify(messageStartData),
      );
      res.write(`data: ${JSON.stringify(messageStartData)}\n\n`);

      recordRequest(account.id, account.provider_id, finalModel, undefined);
      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: finalModel,
        messages: elaraMessages,
        temperature,
        stream: true,
        onContent: (content) => {
          accumulatedContent += content;
          outputTokens += countTokens(content);
          const responseData = {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: unescapeHtml(content) },
          };
          console.log(
            '[Debug] Claude Content Block:',
            JSON.stringify(responseData),
          );
          res.write(`data: ${JSON.stringify(responseData)}\n\n`);
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
        onError: (err) => {
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
      recordRequest(account.id, account.provider_id, finalModel, undefined);
      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: finalModel,
        messages: elaraMessages,
        temperature,
        stream: false,
        onContent: (content) => {
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
        onError: (err) => {
          res
            .status(500)
            .json({ error: { type: 'api_error', message: err.message } });
        },
      });
    }
  } catch (error: any) {
    logger.error('Error in claudeMessagesController', error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: { type: 'api_error', message: error.message } });
    }
  }
};

// POST /v1/chat/completions (OpenAI)
export const completionController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      model,
      messages,
      thinking,
      search,
      conversation_id,
      ref_file_ids,
      temperature,
    } = req.body;

    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;
    const providerQuery = req.query.provider as string;

    const selector = getAccountSelector();
    const accounts = selector.getActiveAccounts();
    let account: any | undefined;

    // Strategy 1: Find by Token (ID)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    // Strategy 2: Find by explicit Provider + Email
    if (!account && providerQuery && emailQuery) {
      account = accounts.find(
        (a) =>
          a.email.toLowerCase() === emailQuery.toLowerCase() &&
          a.provider_id.toLowerCase() === providerQuery.toLowerCase(),
      );
    }

    // Strategy 3: Dynamic Inference via Registry
    if (!account) {
      let targetProviderId = providerQuery;

      // Try to infer from model if no specific provider requested
      if (!targetProviderId && model) {
        const provider = providerRegistry.getProviderForModel(model);
        if (provider) {
          targetProviderId = provider.name;
        }
      }

      if (targetProviderId) {
        // Find account for this provider
        account = accounts.find(
          (a) =>
            a.provider_id.toLowerCase() === targetProviderId!.toLowerCase(),
        );

        // If explicit email provided, refine search
        if (account && emailQuery) {
          const strictAccount = accounts.find(
            (a) =>
              a.provider_id.toLowerCase() === targetProviderId!.toLowerCase() &&
              a.email.toLowerCase() === emailQuery.toLowerCase(),
          );
          if (strictAccount) account = strictAccount;
        }
      }
    }

    if (!account) {
      logger.warn(`[Completion] Unauthorized: No active account found. model: ${model}, provider: ${providerQuery}`);
      res
        .status(401)
        .json({ error: 'No valid account found for this request' });
      return;
    }

    // Record request start
    recordRequest(
      account.id,
      account.provider_id,
      model || 'unknown',
      conversation_id,
    );

    let activeConversationId = conversation_id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let accumulatedMetadata: any = {};

    await sendMessage({
      credential: account.credential,
      provider_id: account.provider_id,
      model:
        model ||
        providerRegistry.getProvider(account.provider_id)?.defaultModel,
      messages,
      stream: true,
      thinking,
      search,
      conversationId: conversation_id,
      ref_file_ids,
      temperature,
      onContent: (content) => {
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: unescapeHtml(content) } }] })}\n\n`,
        );
      },
      onMetadata: (metadata) => {
        accumulatedMetadata = { ...accumulatedMetadata, ...metadata };
        const responseData = { choices: [{ delta: metadata }] };
        console.log(
          '[Debug] Completion Metadata:',
          JSON.stringify(responseData),
        );
        res.write(`data: ${JSON.stringify(responseData)}\n\n`);
      },
      onThinking: (content) => {
        res.write(`data: ${JSON.stringify({ thinking: content })}\n\n`);
      },
      onSessionCreated: (sessionId) => {
        activeConversationId = sessionId;
        res.write(`event: session_created\ndata: ${sessionId}\n\n`);
      },
      onDone: () => {
        // Updated: Logic tính toán token và ghi metrics đã được chuyển về Client
        // Backend chỉ đóng vai trò forward stream và lưu session

        res.write('data: [DONE]\n\n');
        res.end();
      },
      onError: (err) => {
        if (!res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ error: { message: err.message } })}\n\n`,
          );
          res.end();
        }
      },
    });
  } catch (error: any) {
    logger.error('Error in completionController', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};
