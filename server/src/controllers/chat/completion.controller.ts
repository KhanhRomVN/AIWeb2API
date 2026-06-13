import { Request, Response } from 'express';
import { sendMessage } from '../../services/chat';
import { createLogger } from '../../utils/logger';
import { recordRequest } from '../../services/stats.service';
import { providerRegistry } from '../../provider/registry';
import { getAccountSelector } from '../../services/account-selector';

const logger = createLogger('CompletionController');

const unescapeHtml = (str: string): string => {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
};

// POST /v1/chat/completions (OpenAI-compatible)
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

    // Strategy 1: Find by Token (account ID)
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

    // Strategy 3: Dynamic inference via registry
    if (!account) {
      let targetProviderId = providerQuery;

      if (!targetProviderId && model) {
        const provider = providerRegistry.getProviderForModel(model);
        if (provider) {
          targetProviderId = provider.name;
        }
      }

      if (targetProviderId) {
        account = accounts.find(
          (a) =>
            a.provider_id.toLowerCase() === targetProviderId!.toLowerCase(),
        );

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
      logger.warn(
        `[Completion] Unauthorized: No active account found. model: ${model}, provider: ${providerQuery}`,
      );
      res.status(401).json({ error: 'No valid account found for this request' });
      return;
    }

    recordRequest(account.provider_id, model || 'unknown');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let accumulatedMetadata: any = {};

    await sendMessage({
      credential: account.credential,
      provider_id: account.provider_id,
      model:
        model || providerRegistry.getProvider(account.provider_id)?.defaultModel,
      messages,
      stream: true,
      thinking,
      search,
      conversationId: conversation_id,
      ref_file_ids,
      temperature,
      onContent: (content: string) => {
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: unescapeHtml(content) } }] })}\n\n`,
        );
      },
      onMetadata: (metadata: any) => {
        accumulatedMetadata = { ...accumulatedMetadata, ...metadata };
        res.write(`data: ${JSON.stringify({ choices: [{ delta: metadata }] })}\n\n`);
      },
      onThinking: (content: string) => {
        res.write(`data: ${JSON.stringify({ thinking: content })}\n\n`);
      },
      onSessionCreated: (sessionId: string) => {
        res.write(`event: session_created\ndata: ${sessionId}\n\n`);
      },
      onDone: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
      onError: (err: Error) => {
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
