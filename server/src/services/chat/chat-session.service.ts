/**
 * Chat Session Service
 * Manages session store, request queue, probe detection, and session fingerprinting
 * for the Claude Code / Qwen Code CLI proxy endpoint.
 */
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { getConfigValue } from '../../repositories/config.repository';

// ---------------------------------------------------------------------------
// Session store: fingerprint → provider session ID
// ---------------------------------------------------------------------------
export const sessionStore = new Map<string, string>();

// ---------------------------------------------------------------------------
// Request queue: serialize concurrent requests per session fingerprint
// ---------------------------------------------------------------------------
export const requestQueue = new Map<string, Promise<void>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateId(prefix: string = 'msg_'): string {
  return `${prefix}${crypto.randomUUID()}`;
}

export function getSessionKey(req: Request): string {
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string') return apiKey;

  const auth = req.headers['authorization'];
  if (auth) return auth;

  return req.ip || 'default';
}

/**
 * Extracts explicit CLI Session ID from request body metadata.
 */
export function extractCliSessionId(body: any): string | null {
  const metadata = body.metadata;
  if (!metadata) return null;

  if (metadata.sessionId) return metadata.sessionId;

  if (metadata.user_id && typeof metadata.user_id === 'string') {
    const parts = metadata.user_id.split('__session_');
    if (parts.length > 1) return parts[1];

    const sessionMatch = metadata.user_id.match(/session_([a-f0-9-]+)/i);
    if (sessionMatch) return sessionMatch[1];
  }

  return null;
}

/**
 * Generates a unique session fingerprint based on CLI Session IDs
 * or falls back to API key + first message content.
 */
export function generateSessionFingerprint(
  apiKey: string,
  messages: any[],
  body: any,
): string {
  const cliSessionId = extractCliSessionId(body);

  const keyHash = crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex')
    .substring(0, 8);

  if (cliSessionId) {
    return `sess_${keyHash}_cli_${cliSessionId}`;
  }

  let firstUserMsg = '';
  if (messages && messages.length > 0) {
    for (const msg of messages.slice(0, 5)) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          firstUserMsg = msg.content;
        } else if (Array.isArray(msg.content)) {
          firstUserMsg = msg.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join(' ');
        }
        break;
      }
    }
  }

  const contentHash = crypto
    .createHash('sha256')
    .update(firstUserMsg.trim())
    .digest('hex')
    .substring(0, 16);

  return `sess_${keyHash}_${contentHash}`;
}

export function isResetCommand(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
    const cmd = lastMsg.content.trim().toLowerCase();
    return cmd === '/reset' || cmd === '!reset';
  }
  return false;
}

/**
 * Detects probe / warmup requests sent by Claude Code CLI.
 */
export function isProbeRequest(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];
  const content = lastMsg.content;

  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (
      (trimmed.startsWith('Warmup') && content.length < 100) ||
      trimmed === 'count' ||
      trimmed.includes('Files modified by user:') ||
      trimmed.includes('Please write a 5-10 word title for the following conversation')
    ) {
      return true;
    }
  } else if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'text') {
        const trimmed = (block.text || '').trim();
        if (
          trimmed === 'Warmup' ||
          trimmed.startsWith('Warmup\n') ||
          trimmed === 'count' ||
          trimmed.includes('Files modified by user:') ||
          trimmed.includes('Please write a 5-10 word title for the following conversation')
        ) {
          return true;
        }
      } else if (block.type === 'tool_result') {
        const contentStr =
          typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content || '');
        if (block.is_error && contentStr.trim().startsWith('Warmup')) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Sends a minimal mock response for probe/warmup requests.
 */
export function createWarmupResponse(res: Response, stream: boolean, model: string): void {
  const messageId = `msg_warmup_${Date.now()}`;

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Warmup-Intercepted', 'true');

    const events = [
      `event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 0 },
        },
      })}\n\n`,
      `event: content_block_start\ndata: ${JSON.stringify({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'OK' },
      })}\n\n`,
      `event: content_block_stop\ndata: ${JSON.stringify({
        type: 'content_block_stop',
        index: 0,
      })}\n\n`,
      `event: message_delta\ndata: ${JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 1 },
      })}\n\n`,
      `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
    ];

    res.write(events.join(''));
    res.end();
  } else {
    res
      .status(200)
      .set('X-Warmup-Intercepted', 'true')
      .json({
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'OK' }],
        model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      });
  }
}

/**
 * Resolves Claude Code CLI model names to user-configured preferred models.
 */
export function resolveClaudeModelMapping(originalModel: string): {
  providerId?: string;
  modelId?: string;
} | null {
  const getConfig = (key: string) => getConfigValue(key);

  let preferredModel: string | undefined;

  if (originalModel.includes('opus')) {
    preferredModel = getConfig('claudecode_opus_model') ?? undefined;
  } else if (originalModel.includes('sonnet')) {
    preferredModel = getConfig('claudecode_main_model') ?? undefined;
  } else if (originalModel.includes('haiku')) {
    preferredModel = getConfig('claudecode_haiku_model') ?? undefined;
  } else if (
    originalModel.startsWith('claude-3') ||
    originalModel.startsWith('claude-2')
  ) {
    preferredModel = getConfig('claudecode_main_model') ?? undefined;
  }

  if (preferredModel && preferredModel !== 'auto') {
    if (preferredModel.includes('/')) {
      const [p, m] = preferredModel.split('/');
      return { providerId: p, modelId: m };
    }
    return { modelId: preferredModel };
  }

  return null;
}
