/**
 * ------------------------------------------------------------------
 * OpenCode SSE Parser
 * ------------------------------------------------------------------
 * Thu response của assistant từ backend OpenCode theo 2 cách:
 * - collectFromEvents()          : subscribe event stream của backend, lọc theo sessionID
 * - pollForAssistantResponse()   : poll session.messages (fallback / non-stream)
 *
 * collectFromEvents xử lý:
 * - message.part.updated (có `delta` ở bản cũ) và message.part.delta (bản mới)
 * - Tra partID -> type để phân biệt reasoning / text
 * - Giữ stream mở khi tool nội bộ của OpenCode còn pending/running
 * - Timer first-delta và idle: resolve với cờ để caller fallback sang polling
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { createLogger } from '../../utils/logger';

import {
  EVENT_TYPES,
  FINISH_REASONS,
  PART_TYPES,
  POLL_INTERVAL_MS,
  TOOL_STATUS,
} from './opencode.constant';
import {
  OpenCodeAssistantResult,
  OpenCodeClientLike,
  OpenCodeCollectOptions,
  OpenCodeMessageEntry,
  OpenCodeMessagePart,
} from './opencode.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('OpenCodeSSE');

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Helpers ────────────────────────────────────────────────────────────

export function extractFromParts(parts: OpenCodeMessagePart[] | undefined): {
  content: string;
  reasoning: string;
  toolParts: OpenCodeMessagePart[];
} {
  if (!Array.isArray(parts)) return { content: '', reasoning: '', toolParts: [] };
  return {
    content: parts
      .filter((p) => p.type === PART_TYPES.TEXT)
      .map((p) => p.text ?? '')
      .join(''),
    reasoning: parts
      .filter((p) => p.type === PART_TYPES.REASONING)
      .map((p) => p.text ?? '')
      .join(''),
    toolParts: parts.filter((p) => p.type === PART_TYPES.TOOL),
  };
}

function isToolActive(status: string | undefined): boolean {
  return status === TOOL_STATUS.PENDING || status === TOOL_STATUS.RUNNING;
}

function isToolSettled(status: string | undefined): boolean {
  return status === TOOL_STATUS.COMPLETED || status === TOOL_STATUS.ERROR;
}

// ─── Polling ────────────────────────────────────────────────────────────

/**
 * Poll `session.messages` mỗi `intervalMs` cho tới khi assistant message cuối hoàn tất.
 * Hết giờ mà còn bản nháp → trả bản nháp; không có gì → throw timeout.
 */
export async function pollForAssistantResponse(
  client: OpenCodeClientLike,
  sessionId: string,
  timeoutMs: number,
  intervalMs: number = POLL_INTERVAL_MS,
): Promise<OpenCodeAssistantResult> {
  const startedAt = Date.now();
  let lastPartial: OpenCodeAssistantResult | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const res = await client.session.messages({ path: { id: sessionId } });
    const messages: OpenCodeMessageEntry[] = res?.data || res || [];

    if (Array.isArray(messages) && messages.length) {
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const entry = messages[i];
        const info = entry?.info;
        if (info?.role !== 'assistant') continue;

        const { content, reasoning } = extractFromParts(entry?.parts);
        const error = info.error || null;
        const finished = Boolean(info.finish && info.finish !== FINISH_REASONS.TOOL);
        const done = Boolean(finished || info.time?.completed || error);

        if (done) {
          if (error) logger.warn('[OpenCode] Assistant error:', error);
          return { content, reasoning, error };
        }
        if (content || reasoning) {
          lastPartial = { content, reasoning, error: null };
        }
        break;
      }
    }
    await sleep(intervalMs);
  }

  if (lastPartial) return lastPartial;
  throw new Error(`Request timeout after ${timeoutMs}ms`);
}

// ─── Event Collection ───────────────────────────────────────────────────

/**
 * Thu delta qua event stream của backend. Caller PHẢI bắn `session.prompt`
 * song song (không await) sau khi hàm này bắt đầu subscribe.
 */
export async function collectFromEvents(
  client: OpenCodeClientLike,
  sessionId: string,
  opts: OpenCodeCollectOptions,
  onSubscribed?: () => void,
): Promise<OpenCodeAssistantResult> {
  const { timeoutMs, firstDeltaTimeoutMs, idleTimeoutMs, onDelta } = opts;

  const controller = new AbortController();
  const { stream } = await client.event.subscribe({ signal: controller.signal });
  if (onSubscribed) onSubscribed();

  let finished = false;
  let content = '';
  let reasoning = '';
  let receivedDelta = false;
  const activeToolCallIds = new Set<string>();
  const partTypeById = new Map<string, string>();

  const timers: {
    timeout?: NodeJS.Timeout;
    firstDelta?: NodeJS.Timeout;
    idle?: NodeJS.Timeout;
  } = {};

  const clearTimers = () => {
    if (timers.timeout) clearTimeout(timers.timeout);
    if (timers.firstDelta) clearTimeout(timers.firstDelta);
    if (timers.idle) clearTimeout(timers.idle);
  };

  const finishPromise = new Promise<OpenCodeAssistantResult>(
    (resolve, reject) => {
      const settle = (result: OpenCodeAssistantResult) => {
        if (finished) return;
        finished = true;
        clearTimers();
        controller.abort();
        resolve(result);
      };

      timers.timeout = setTimeout(() => {
        if (finished) return;
        finished = true;
        clearTimers();
        controller.abort();
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      if (firstDeltaTimeoutMs) {
        timers.firstDelta = setTimeout(() => {
          if (finished || receivedDelta) return;
          settle({ content: '', reasoning: '', noData: true });
        }, firstDeltaTimeoutMs);
      }

      const scheduleIdleTimer = () => {
        if (!idleTimeoutMs) return;
        if (timers.idle) clearTimeout(timers.idle);
        timers.idle = setTimeout(() => {
          if (finished) return;
          if (activeToolCallIds.size > 0) {
            scheduleIdleTimer();
            return;
          }
          settle({ content, reasoning, idleTimeout: true, receivedDelta });
        }, idleTimeoutMs);
      };

      const markProgress = () => {
        receivedDelta = true;
        if (timers.firstDelta) clearTimeout(timers.firstDelta);
        scheduleIdleTimer();
      };

      const rememberPartType = (part?: OpenCodeMessagePart) => {
        if (part?.id && typeof part.type === 'string') {
          partTypeById.set(part.id, part.type);
        }
      };

      const trackToolActivity = (part?: OpenCodeMessagePart) => {
        if (!part || part.type !== PART_TYPES.TOOL) return;
        const status = part.state?.status;
        if (part.id) {
          if (isToolActive(status)) activeToolCallIds.add(part.id);
          else if (isToolSettled(status)) activeToolCallIds.delete(part.id);
        }
        markProgress();
      };

      const applyTextDelta = (partType: string | undefined, delta: string) => {
        markProgress();
        if (partType === PART_TYPES.REASONING) {
          reasoning += delta;
          if (onDelta) onDelta(delta, true);
        } else {
          content += delta;
          if (onDelta) onDelta(delta, false);
        }
      };

      (async () => {
        try {
          for await (const event of stream) {
            const props = event.properties;

            if (
              event.type === EVENT_TYPES.PART_UPDATED &&
              props?.part?.sessionID === sessionId
            ) {
              const { part, delta } = props;
              rememberPartType(part);
              trackToolActivity(part);
              if (delta && part) applyTextDelta(part.type, delta);
              continue;
            }

            if (
              event.type === EVENT_TYPES.PART_DELTA &&
              props?.sessionID === sessionId
            ) {
              if (typeof props.delta === 'string' && props.field === 'text') {
                const partType = props.partID
                  ? partTypeById.get(props.partID)
                  : undefined;
                if (
                  partType === PART_TYPES.REASONING ||
                  partType === PART_TYPES.TEXT
                ) {
                  applyTextDelta(partType, props.delta);
                }
              }
              continue;
            }

            if (
              event.type === EVENT_TYPES.MESSAGE_UPDATED &&
              props?.info?.sessionID === sessionId
            ) {
              const info = props.info;

              if (info.error) {
                settle({ content, reasoning, error: info.error });
                break;
              }

              if (Array.isArray(info.parts)) {
                for (const part of info.parts) {
                  rememberPartType(part);
                  if (part?.type === PART_TYPES.TOOL && part.id) {
                    const status = part.state?.status;
                    if (isToolActive(status)) activeToolCallIds.add(part.id);
                    else if (isToolSettled(status)) activeToolCallIds.delete(part.id);
                  }
                }
              }

              if (info.finish === FINISH_REASONS.TOOL) {
                if (timers.firstDelta) clearTimeout(timers.firstDelta);
                scheduleIdleTimer();
                continue;
              }

              if (info.finish === FINISH_REASONS.STOP) {
                if (activeToolCallIds.size > 0) continue;
                settle({ content, reasoning });
                break;
              }
            }
          }
        } catch (e) {
          if (!finished) {
            finished = true;
            clearTimers();
            reject(e);
          }
        }
      })();
    },
  );

  try {
    return await finishPromise;
  } finally {
    clearTimers();
    controller.abort();
  }
}