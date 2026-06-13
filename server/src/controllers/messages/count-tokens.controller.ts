import { Request, Response } from 'express';
import { countMessagesTokens } from '../../utils/tokenizer';

// POST /v1/messages/count_tokens
export const countTokensController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { messages } = req.body;
    const tokensCount = countMessagesTokens(messages || []);

    // Return a small buffer to prevent Claude Code from unexpectedly hitting limits
    res.json({
      input_tokens: tokensCount + 100,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
