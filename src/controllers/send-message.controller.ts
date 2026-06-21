import { Request, Response } from 'express';
import { sendMessage } from '../services/chat';
import { createLogger } from '../utils/logger';
import { recordRequest } from '../services/metrics.service';
import { getAllProviders } from '../services/provider.service';
import { providerRegistry } from '../provider/registry';

import { findAccountById } from '../repositories/account.repository';


const logger = createLogger('SendMessageController');

const unescapeHtml = (str: string): string => {
  return str
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
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
      conversationId: rawConversationId,
      parent_message_id,
      stream,
      is_search,
      search,
      temperature,
      thinking,
      ref_file_ids,
    } = req.body;

    let accountId = accountIdFromParams || accountIdFromBody;
    let finalModel = modelId;
    let conversationId: string | undefined = undefined;
    let restoredFromCompoundId = false;

    if (rawConversationId && typeof rawConversationId === 'string') {
      if (rawConversationId.includes('@')) {
        const parts = rawConversationId.split('@');
        const realChatId = parts[0];
        const accountIdOfChat = parts[1];
        const modelIdOfChat = parts[2];

        // Detect model/account switch: if the request body explicitly specifies a different
        // model or account than what is embedded in the compound conversationId, the user
        // has switched mid-session. We must NOT restore the old model/account from the
        // compound ID — doing so would silently use the wrong model (root cause of the race).
        const requestedModel = modelId; // model from request body (new selection)
        const requestedAccount = accountIdFromBody || accountIdFromParams;
        const modelSwitched = requestedModel && modelIdOfChat && requestedModel !== modelIdOfChat;
        const accountSwitched = requestedAccount && accountIdOfChat && requestedAccount !== accountIdOfChat;

        // Check if the chat's account still exists in our database to restore it
        const chatAccount = findAccountById(accountIdOfChat);
        if (chatAccount && !modelSwitched && !accountSwitched) {
          accountId = accountIdOfChat;
          finalModel = modelIdOfChat;
          conversationId = realChatId;
          restoredFromCompoundId = true;
          logger.info(`[Controller] Restored accountId: ${accountId}, modelId: ${finalModel} from conversationId: ${rawConversationId}`);
        } else if (modelSwitched || accountSwitched) {
          // Model/account switched — use request body values and start a NEW session (no conversationId)
          logger.info(`[Controller] Model/account switched detected. Old: model=${modelIdOfChat} acc=${accountIdOfChat} → New: model=${requestedModel} acc=${requestedAccount}. Starting new session.`);
          conversationId = undefined; // force new backend session
        } else {
          logger.warn(`[Controller] Account from conversationId not found: ${accountIdOfChat}. Falling back to request parameters.`);
        }
      } else {
        conversationId = rawConversationId;
      }
    }

    /*
    if (messages && messages.length > 1) {
      if (!conversationId || conversationId.trim() === '') {
        if (!parent_message_id) {
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
    }
    */

    const useSearch = is_search === true || search === true;

    if (!accountId) {
      res.status(400).json({
        success: false,
        message: 'Missing accountId. Please provide a valid accountId in params or body.',
        error: { code: 'BAD_REQUEST' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const account = findAccountById(accountId);

    if (!account) {
      res.status(404).json({
        success: false,
        message: `Account not found with id: ${accountId}`,
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // Skip providerId conflict check if account was restored from compound conversationId —
    // in that case, the account is authoritative and the request body's providerId may
    // reflect the newly selected provider (not the one associated with this compound session).
    if (!restoredFromCompoundId && providerId && account.provider_id.toLowerCase() !== providerId.toLowerCase()) {
      res.status(400).json({
        success: false,
        message: `Account Conflict: The provided accountId belongs to provider '${account.provider_id}', but providerId is '${providerId}'.`,
        error: { code: 'BAD_REQUEST' },
      });
      return;
    }

    // Resolve "auto" model - use provider's default model
    if (finalModel === 'auto') {
      const provider = providerRegistry.getProvider(account.provider_id);
      if (provider?.defaultModel) {
        finalModel = provider.defaultModel;
        logger.info(`"auto" model resolved to ${finalModel} for provider ${account.provider_id}`);
      } else {
        logger.warn(`"auto" model requested but no default model for ${account.provider_id}`);
      }
    }

    const model = finalModel;

    // Validate credential before proceeding
    if (!account.credential || account.credential.trim() === '') {
      if (stream !== false) {
        res.writeHead(400, { 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify({ error: 'Account credential is missing or empty' })}\n\n`);
        res.end();
      } else {
        res.status(400).json({
          success: false,
          message: 'Account credential is missing or empty',
          error: { code: 'MISSING_CREDENTIAL' },
        });
      }
      return;
    }

    const providers = await getAllProviders();
    const providerConfig = providers.find(
      (p) => p.provider_id.toLowerCase() === account.provider_id.toLowerCase(),
    );
    const websiteUrl = providerConfig?.website;

    // Search capability is now determined at model level, not provider level
    // The actual search support will be checked by the provider implementation

    const initialMeta: any = {
      accountId: account.id,
      providerId: account.provider_id,
      modelId: model,
      email: account.email,
    };
    if (websiteUrl) {
      initialMeta.websiteUrl = websiteUrl;
    }

    if (stream !== false) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const responseData = { meta: initialMeta };
      res.write(`data: ${JSON.stringify(responseData)}\n\n`);
    }

    let accumulatedContent = '';
    let accumulatedMetadata: any = { ...initialMeta };

    try {
      recordRequest(account.provider_id, model);

      const lastMsg = messages?.[messages.length - 1];
      const lastMsgSnippet =
        typeof lastMsg?.content === 'string'
          ? lastMsg.content.slice(0, 120).replace(/\n/g, ' ')
          : '';
      const roleBreakdown = messages?.reduce(
        (acc: Record<string, number>, m: any) => {
          acc[m.role] = (acc[m.role] || 0) + 1;
          return acc;
        },
        {},
      );
      logger.info(
        `[Request] provider=${account.provider_id} model=${model} msgs=${messages?.length} (${Object.entries(roleBreakdown || {}).map(([r, c]) => `${r}:${c}`).join(',')}) convId=${conversationId || 'none'} | "${lastMsgSnippet}"`,
      );

      let accumulatedResponse = '';

      let firstChunkReceived = false;
      let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;
      if (stream !== false) {
        streamTimeoutId = setTimeout(() => {
          if (!firstChunkReceived && !res.writableEnded) {
            res.write(
              `data: ${JSON.stringify({ error: 'Stream timeout: no response received within 5 minutes' })}\n\n`,
            );
            res.end();
          }
        }, 300000);
      }

      let hasRetried = false;

      const executeSend = async (convId: string | undefined): Promise<void> => {
        logger.info(`[Controller] executeSend conversationId: ${convId}, modelId: ${finalModel}`);
        await sendMessage({
          credential: account.credential!,
          provider_id: account.provider_id,
          accountId: account.id,
          model,
          messages,
          conversationId: convId,
          parent_message_id,
          search: useSearch,
          temperature,
          thinking,
          ref_file_ids,
          onContent: (content: string) => {
            accumulatedResponse += content;
            if (stream !== false) {
              if (!firstChunkReceived) {
                firstChunkReceived = true;
                if (streamTimeoutId) clearTimeout(streamTimeoutId);
              }
              if (res.writableEnded) return;
              res.write(`data: ${JSON.stringify({ content: unescapeHtml(content) })}\n\n`);
            } else {
              accumulatedContent += content;
            }
          },
          onMetadata: (meta: any) => {
            if (stream !== false) {
              res.write(`data: ${JSON.stringify({ meta })}\n\n`);
            } else {
              accumulatedMetadata = { ...accumulatedMetadata, ...meta };
            }
          },
          onThinking: (content: string) => {
            if (stream !== false) {
              res.write(`data: ${JSON.stringify({ thinking: content })}\n\n`);
            }
          },
          onDone: () => {
            if (streamTimeoutId) clearTimeout(streamTimeoutId);
            if (stream !== false && res.writableEnded) return;

            const responseSnippet = accumulatedResponse.slice(0, 120).replace(/\n/g, ' ');
            logger.info(`[Response] len=${accumulatedResponse.length} | "${responseSnippet}"`);

            if (stream !== false) {
              if (!accumulatedResponse || accumulatedResponse.trim() === '') {
                logger.warn(
                  `[Response] Provider ${account.provider_id} returned empty content for model=${model}`,
                );
                res.write(
                  `data: ${JSON.stringify({ error: 'Provider returned empty response', code: 'EMPTY_RESPONSE' })}\n\n`,
                );
              }
              res.write('data: [DONE]\n\n');
              res.end();
            } else {
              if (!res.headersSent) {
                if (!accumulatedContent || accumulatedContent.trim() === '') {
                  res.status(502).json({
                    success: false,
                    message: 'Provider returned empty response',
                    error: { code: 'EMPTY_RESPONSE' },
                  });
                  return;
                }

                res.status(200).json({
                  success: true,
                  message: {
                    role: 'assistant',
                    content: unescapeHtml(accumulatedContent),
                  },
                  metadata: accumulatedMetadata,
                });
              }
            }
          },
          onSessionCreated: (sessionId: string) => {
            // Always embed accountId and modelId into the conversationId so that
            // the frontend can restore the correct account/model for any provider
            // when the user continues the conversation in a later session.
            const compoundId = `${sessionId}@${account.id}@${finalModel}`;

            if (stream !== false) {
              res.write(`event: session_created\ndata: ${compoundId}\n\n`);
              res.write(
                `data: ${JSON.stringify({ meta: { conversation_id: compoundId } })}\n\n`,
              );
            } else {
              accumulatedMetadata.conversation_id = compoundId;
            }
          },
          onError: async (error: Error) => {
            const errorMsg = error.message || '';
            if (convId && !hasRetried && (errorMsg.includes('session not exist') || errorMsg.includes('Failed to append round'))) {
              logger.warn(`[Controller] Session mismatch/not found for conversationId: ${convId}. Retrying with conversationId = undefined.`);
              hasRetried = true;
              try {
                await executeSend(undefined);
                return;
              } catch (retryError: any) {
                error = retryError;
              }
            }

            if (streamTimeoutId) clearTimeout(streamTimeoutId);
            logger.error('Stream error', error);
            if (stream !== false) {
              if (!res.writableEnded) {
                const errPayload: any = { error: error.message };
                if ((error as any).code) errPayload.error_code = (error as any).code;
                res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
                res.end();
              }
            } else {
              if (!res.headersSent) {
                res.status(500).json({
                  error: error.message,
                  ...((error as any).code ? { error_code: (error as any).code } : {}),
                });
              }
            }
          },
        });
      };

      try {
        await executeSend(conversationId);
      } catch (error: any) {
        const errorMsg = error.message || '';
        if (conversationId && !hasRetried && (errorMsg.includes('session not exist') || errorMsg.includes('Failed to append round'))) {
          logger.warn(`[Controller] Caught error in outer catch. Session mismatch/not found for conversationId: ${conversationId}. Retrying with conversationId = undefined.`);
          hasRetried = true;
          try {
            await executeSend(undefined);
          } catch (retryError: any) {
            logger.error('Retry failed in outer catch', retryError);
            if (streamTimeoutId) clearTimeout(streamTimeoutId);
            if (stream !== false && !res.writableEnded) {
              res.write(`data: ${JSON.stringify({ error: retryError.message })}\n\n`);
              res.end();
            } else if (!res.headersSent) {
              res.status(500).json({ error: retryError.message });
            }
          }
        } else {
          logger.error('Error in sendMessage service call', error);
          if (streamTimeoutId) clearTimeout(streamTimeoutId);
          if (stream !== false && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
          } else if (!res.headersSent) {
            res.status(500).json({ error: error.message });
          }
        }
      }
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