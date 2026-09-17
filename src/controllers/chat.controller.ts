/**
 * ------------------------------------------------------------------
 * Send Message Controller
 * ------------------------------------------------------------------
 * Xử lý request gửi tin nhắn tới model AI qua provider tương ứng.
 * Hỗ trợ cả streaming và non-streaming, tích hợp search, token counting,
 * và ghi nhận metrics.
 *
 * Main functions:
 * - sendMessage() : Gửi tin nhắn và xử lý response (stream/non-stream)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import { sendMessage as sendMessageService } from '../services/chat.service';
import { recordRequest, recordError } from '../services/metrics.service';
import { getAllProviders } from '../services/provider.service';
import { getAccountById } from '../services/account.service';

// ── Utils ──
import { createLogger } from '../utils/logger';
import { countMessagesTokens, countTokens } from '../utils/tokenizer';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('SendMessageController');

// ─── Helper Functions ─────────────────────────────────────────────────
const unescapeHtml = (str: string): string => {
  return str
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&apos;/g, "'");
};

// ─── Controller ─────────────────────────────────────────────────────────

// ─── POST /v1/accounts/:accountId/messages ──────────────────────────
export const sendMessage = async (
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
      parent_message_id,
      stream,
      is_search,
      search,
      thinking,
      ref_file_ids,
    } = req.body;
    if (messages && messages.length > 1) {
      if (!conversationId || conversationId.trim() === '') {
        if (!parent_message_id) {
          // Auto-generate UUID v4 fallback conversationId for multi-turn tool executions to prevent session disconnect
          const fallbackConvId = crypto.randomUUID();
          req.body.conversationId = fallbackConvId;
        }
      }
    }

    const accountId = accountIdFromParams || accountIdFromBody;
    const useSearch = is_search === true || search === true;

    // Lấy provider config sớm để check auth_method
    const providers = await getAllProviders();
    const targetProviderId = (providerId as string | undefined)?.toLowerCase();
    const providerConfig = targetProviderId
      ? providers.find((p) => p.provider_id.toLowerCase() === targetProviderId)
      : undefined;

    // Kiểm tra provider có cần auth không (auth_method rỗng = anonymous provider)
    const rawAuthMethod = (providerConfig as any)?.auth_method;
    const noAuthRequired =
      providerConfig !== undefined &&
      Array.isArray(rawAuthMethod) &&
      rawAuthMethod.filter((m: any) => typeof m === 'string' && m.length > 0)
        .length === 0;

    if (!accountId && !noAuthRequired) {
      res.status(400).json({
        success: false,
        message:
          'Missing accountId. Please provide a valid accountId in params or body.',
        error: { code: 'BAD_REQUEST' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // Với provider cần auth: lấy account từ DB như cũ
    // Với anonymous provider: dùng virtual account (không cần credential)
    let account: {
      id: string;
      provider_id: string;
      email?: string | null;
      credential: string;
    } | null = null;

    if (accountId) {
      const dbAccount = getAccountById(accountId);
      if (!dbAccount) {
        res.status(404).json({
          success: false,
          message: `Account not found with id: ${accountId}`,
          error: { code: 'NOT_FOUND' },
          meta: { timestamp: new Date().toISOString() },
        });
        return;
      }
      if (
        providerId &&
        dbAccount.provider_id.toLowerCase() !== providerId.toLowerCase()
      ) {
        res.status(400).json({
          success: false,
          message: `Account Conflict: The provided accountId belongs to provider '${dbAccount.provider_id}', but providerId is '${providerId}'.`,
          error: { code: 'BAD_REQUEST' },
        });
        return;
      }
      account = { ...dbAccount, credential: dbAccount.credential ?? '' };
    } else {
      // noAuthRequired = true, accountId vắng mặt → virtual account
      account = {
        id: `anon-${providerId}`,
        provider_id: providerId as string,
        email: null,
        credential: '',
      };
      logger.debug(
        `[SendMessage] Anonymous provider "${providerId}" — using virtual account`,
      );
    }

    // account luôn được set tại đây (null guards đã xử lý ở trên)
    const resolvedAccount = account;

    const model = modelId;

    // Validate credential — bỏ qua với anonymous provider
    if (
      !noAuthRequired &&
      (!resolvedAccount.credential || resolvedAccount.credential.trim() === '')
    ) {
      if (stream !== false) {
        res.writeHead(400, { 'Content-Type': 'text/event-stream' });
        res.write(
          `data: ${JSON.stringify({ error: 'Account credential is missing or empty' })}\n\n`,
        );
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

    const websiteUrl = providerConfig?.website;

    // Search capability is now determined at model level, not provider level
    // The actual search support will be checked by the provider implementation

    const initialMeta: any = {
      accountId: resolvedAccount.id,
      providerId: resolvedAccount.provider_id,
      modelId: model,
      email: resolvedAccount.email,
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
    let finalOutputMessage = '';
    let finalError: Error | null = null;

    try {
      recordRequest(resolvedAccount.provider_id, model);

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

      await sendMessageService({
        credential: resolvedAccount.credential,
        provider_id: resolvedAccount.provider_id,
        accountId: resolvedAccount.id,
        model,
        messages,
        conversationId,
        parent_message_id,
        search: useSearch,
        thinking,
        ref_file_ids,
        onContent: (content: string) => {
          accumulatedResponse += content;
          finalOutputMessage = accumulatedResponse;

          if (stream !== false) {
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              if (streamTimeoutId) clearTimeout(streamTimeoutId);
            }
            if (res.writableEnded) return;
            const payload = { content: unescapeHtml(content) };
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
          } else {
            accumulatedContent += content;
            finalOutputMessage = accumulatedContent;
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

          // Log transaction details
          const MAX_PREVIEW_LENGTH = 200;
          const truncate = (str: string) => {
            if (str.length <= MAX_PREVIEW_LENGTH) return str;
            return str.slice(0, MAX_PREVIEW_LENGTH) + '...';
          };

          if (stream !== false) {
            if (!accumulatedResponse || accumulatedResponse.trim() === '') {
              logger.warn(
                `[Response] Provider ${resolvedAccount.provider_id} returned empty content for model=${model}`,
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
          if (stream !== false) {
            res.write(`event: session_created\ndata: ${sessionId}\n\n`);
            res.write(
              `data: ${JSON.stringify({ meta: { conversation_id: sessionId } })}\n\n`,
            );
          } else {
            accumulatedMetadata.conversation_id = sessionId;
          }
        },
        onError: (error: Error) => {
          if (streamTimeoutId) clearTimeout(streamTimeoutId);

          // Log transaction details with error
          const MAX_PREVIEW_LENGTH = 200;
          const truncate = (str: string) => {
            if (str.length <= MAX_PREVIEW_LENGTH) return str;
            return str.slice(0, MAX_PREVIEW_LENGTH) + '...';
          };

          const outputPreview = finalOutputMessage
            ? truncate(finalOutputMessage)
            : '';

          // Calculate tokens
          const inputToken = messages ? countMessagesTokens(messages) : 0;
          const outputToken = finalOutputMessage
            ? countTokens(finalOutputMessage)
            : 0;

          logger.error(
            `[Transaction Error] provider_id=${resolvedAccount.provider_id} model_id=${model} account_id=${resolvedAccount.id} conversation_id=${conversationId || 'none'} input_token=${inputToken} output_token=${outputToken} error=${error.message}`,
            { stack: error.stack, code: (error as any).code },
          );
          // Record error metric so success_rate reflects failures
          recordError(
            resolvedAccount.id,
            resolvedAccount.provider_id,
            model,
            error.message,
          );

          if (stream !== false) {
            if (!res.writableEnded) {
              const errPayload: any = { error: error.message };
              if ((error as any).code)
                errPayload.error_code = (error as any).code;
              res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
              res.end();
            }
          } else {
            if (!res.headersSent) {
              res.status(500).json({
                error: error.message,
                ...((error as any).code
                  ? { error_code: (error as any).code }
                  : {}),
              });
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
    logger.error('Error in sendMessage', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
