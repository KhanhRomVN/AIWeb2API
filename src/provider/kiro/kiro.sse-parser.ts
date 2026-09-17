/**
 * ------------------------------------------------------------------
 * Kiro SSE Parser
 * ------------------------------------------------------------------
 * Parse AWS EventStream binary frames từ Kiro/CodeWhisperer API
 * và convert sang OpenAI SSE format.
 *
 * Sync với OmniRoute:
 * - open-sse/executors/kiro/eventstream.ts  → ByteQueue, parseEventFrame, crc32
 * - open-sse/executors/kiro.ts              → transformEventStreamToSSE, KiroStreamState
 * - open-sse/executors/kiroThinking.ts      → splitInlineThinking, flushPendingThinking
 *
 * Main exports:
 * - ByteQueue                 : Efficient byte buffer for streaming
 * - parseEventFrame           : Parse một AWS EventStream binary frame
 * - transformEventStreamToSSE : Transform binary stream → SSE ReadableStream
 * - splitInlineThinking       : Split inline <thinking>…</thinking> blocks
 * - flushPendingThinking      : Drain pending thinking tag at end-of-stream
 * ------------------------------------------------------------------
 */

// ─── Types ────────────────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

export type EventFrame = {
  headers: Record<string, string>;
  payload: JsonRecord | null;
};

// ─── ByteQueue ────────────────────────────────────────────────────────────

/**
 * Efficient byte queue for incremental binary stream parsing.
 * Avoids copying large arrays by tracking chunk offsets.
 */
export class ByteQueue {
  private chunks: Uint8Array[] = [];
  private headOffset = 0;
  length = 0;

  push(chunk: Uint8Array) {
    if (!(chunk instanceof Uint8Array) || chunk.length === 0) return;
    this.chunks.push(chunk);
    this.length += chunk.length;
  }

  peekUint32BE(offset = 0): number | null {
    if (this.length < offset + 4) return null;
    let value = 0;
    for (let i = 0; i < 4; i++) {
      value = (value << 8) | this.byteAt(offset + i);
    }
    return value >>> 0;
  }

  read(length: number): Uint8Array | null {
    if (length < 0 || this.length < length) return null;
    const output = new Uint8Array(length);
    let written = 0;
    while (written < length) {
      const head = this.chunks[0];
      const available = head.length - this.headOffset;
      const take = Math.min(available, length - written);
      output.set(head.subarray(this.headOffset, this.headOffset + take), written);
      written += take;
      this.headOffset += take;
      this.length -= take;
      if (this.headOffset >= head.length) {
        this.chunks.shift();
        this.headOffset = 0;
      }
    }
    return output;
  }

  private byteAt(offset: number): number {
    let remaining = offset;
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      const start = i === 0 ? this.headOffset : 0;
      const available = chunk.length - start;
      if (remaining < available) return chunk[start + remaining];
      remaining -= available;
    }
    return 0;
  }
}

// ─── CRC32 ────────────────────────────────────────────────────────────────

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Text codecs ──────────────────────────────────────────────────────────

export const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function encodeSse(data: string): Uint8Array {
  return TEXT_ENCODER.encode(data);
}

// ─── Frame Parser ─────────────────────────────────────────────────────────

/**
 * Parse one AWS EventStream binary frame.
 * Frame layout: [totalLength(4)] [headersLength(4)] [preludeCRC(4)]
 *               [headers(headersLength)] [payload] [messageCRC(4)]
 */
export function parseEventFrame(data: Uint8Array): EventFrame | null {
  try {
    const view = new DataView(data.buffer, data.byteOffset);
    const totalLength = view.getUint32(0, false);
    const headersLength = view.getUint32(4, false);

    // Validate prelude CRC (covers bytes [0..7])
    const preludeCRC = view.getUint32(8, false);
    const computedPreludeCRC = crc32(data.slice(0, 8));
    if (preludeCRC !== computedPreludeCRC) {
      console.warn(
        `[Kiro] Prelude CRC mismatch: expected ${preludeCRC}, got ${computedPreludeCRC}`,
      );
      return null;
    }

    // Parse headers
    const headers: Record<string, string> = {};
    let offset = 12;
    const headerEnd = 12 + headersLength;

    while (offset < headerEnd && offset < data.length) {
      const nameLen = data[offset];
      offset++;
      if (offset + nameLen > data.length) break;

      const name = TEXT_DECODER.decode(data.subarray(offset, offset + nameLen));
      offset += nameLen;

      const headerType = data[offset];
      offset++;

      if (headerType === 7) {
        // String type
        const valueLen = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        if (offset + valueLen > data.length) break;
        const value = TEXT_DECODER.decode(data.subarray(offset, offset + valueLen));
        offset += valueLen;
        headers[name] = value;
      } else {
        break;
      }
    }

    // Parse payload
    const payloadStart = 12 + headersLength;
    const payloadEnd = data.length - 4; // exclude message CRC
    let payload: JsonRecord | null = null;

    if (payloadEnd > payloadStart) {
      const payloadStr = TEXT_DECODER.decode(data.subarray(payloadStart, payloadEnd));
      if (payloadStr && payloadStr.trim()) {
        try {
          payload = JSON.parse(payloadStr);
        } catch {
          payload = { raw: payloadStr };
        }
      }
    }

    return { headers, payload };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn(`[Kiro] Frame parse error: ${error.message}`);
    return null;
  }
}

// ─── Inline Thinking Splitter ─────────────────────────────────────────────

/**
 * Mutable state cho splitInlineThinking.
 * Khởi tạo với { thinkingMode: false, pendingTag: '' }.
 */
export type KiroThinkingState = {
  thinkingMode: boolean;
  pendingTag: string;
};

/**
 * Stream-safe splitter cho inline <thinking>…</thinking> blocks.
 * Claude trên Kiro emit reasoning inline khi <thinking_mode>enabled</thinking_mode>
 * trong system prompt. Tách ra để route vào delta.reasoning_content channel.
 *
 * Sync với OmniRoute open-sse/executors/kiroThinking.ts.
 */
export function splitInlineThinking(
  state: KiroThinkingState,
  raw: string | null | undefined,
  onContent: (s: string) => void,
  onReasoning: (s: string) => void,
): void {
  let text = (state.pendingTag || '') + (raw || '');
  state.pendingTag = '';

  const PARTIAL_MAX = 11; // '</thinking>' là dài nhất (11 chars)

  while (text.length > 0) {
    const target = state.thinkingMode ? '</thinking>' : '<thinking>';
    const idx = text.indexOf(target);

    if (idx === -1) {
      // Không tìm thấy tag đầy đủ — giữ lại phần cuối có thể là partial tag
      let holdFrom = text.length;
      for (let i = Math.max(0, text.length - PARTIAL_MAX); i < text.length; i++) {
        const tail = text.slice(i);
        if (target.startsWith(tail) && tail.length > 0) {
          holdFrom = i;
          break;
        }
      }
      const flushable = text.slice(0, holdFrom);
      if (flushable) {
        if (state.thinkingMode) onReasoning(flushable);
        else onContent(flushable);
      }
      state.pendingTag = text.slice(holdFrom);
      return;
    }

    const before = text.slice(0, idx);
    if (before) {
      if (state.thinkingMode) onReasoning(before);
      else onContent(before);
    }
    state.thinkingMode = !state.thinkingMode;
    text = text.slice(idx + target.length);
  }
}

/**
 * Drain pendingTag at end-of-stream.
 * Sync với OmniRoute open-sse/executors/kiroThinking.ts → flushPendingThinking.
 */
export function flushPendingThinking(
  state: KiroThinkingState,
  onContent: (s: string) => void,
  onReasoning: (s: string) => void,
): void {
  if (!state.pendingTag) return;
  const leftover = state.pendingTag;
  state.pendingTag = '';
  if (state.thinkingMode) onReasoning(leftover);
  else onContent(leftover);
}

// ─── Stream State ─────────────────────────────────────────────────────────

type KiroStreamState = {
  startEmitted: boolean;
  finishEmitted: boolean;
  stopSeen: boolean;
  hasToolCalls: boolean;
  toolCallIndex: number;
  seenToolIds: Map<string, number>;
  toolArgsEmitted: Map<string, string>;
  /** Buffer cho object-form tool arguments (partial payloads grow over time) */
  toolArgsBuffered: Map<string, { toolIndex: number; canonical: string }>;
  generatedToolIdCounter: number;
  totalContentLength: number;
  contextUsagePercentage: number;
  hasReasoningContent: boolean;
  reasoningChunkCount: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  /** Inline thinking state — chỉ dùng khi thinkingExpected=true */
  thinking?: KiroThinkingState;
};

// ─── Tool Args Buffer Flush ───────────────────────────────────────────────

/**
 * Flush buffered object-form tool arguments tại finish boundary.
 *
 * Kiro streams toolUseEvent.input là PARTIAL OBJECTS tăng dần theo thời gian.
 * Re-stringify mỗi frame và emit ngay sẽ tạo overlapping JSON prefixes không parse được.
 * Fix: buffer payload mới nhất, emit 1 lần duy nhất tại finish boundary.
 */
function flushBufferedToolArgs(
  state: Pick<KiroStreamState, 'toolArgsBuffered' | 'toolArgsEmitted'>,
  controller: TransformStreamDefaultController<Uint8Array>,
  ctx: { responseId: string; created: number; model: string },
): void {
  if (!state.toolArgsBuffered || state.toolArgsBuffered.size === 0) return;
  const { responseId, created, model } = ctx;

  for (const [toolCallId, info] of state.toolArgsBuffered) {
    const alreadyEmitted = state.toolArgsEmitted.get(toolCallId) || '';
    if (info.canonical && info.canonical !== alreadyEmitted) {
      const argsChunk: JsonRecord = {
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                { index: info.toolIndex, function: { arguments: info.canonical } },
              ],
            },
            finish_reason: null,
          },
        ],
      };
      controller.enqueue(TEXT_ENCODER.encode(`data: ${JSON.stringify(argsChunk)}\n\n`));
      state.toolArgsEmitted.set(toolCallId, info.canonical);
    }
  }
  state.toolArgsBuffered.clear();
}

// ─── Usage Estimation ────────────────────────────────────────────────────

/**
 * Synthesize usage khi Kiro không gửi token counts.
 * contextUsagePercentage → estimated total; totalContentLength → estimated output.
 */
function ensureKiroUsage(state: KiroStreamState, model: string): void {
  if (state.usage?.total_tokens !== undefined) return;

  const estimatedOutput =
    state.totalContentLength > 0
      ? Math.max(1, Math.floor(state.totalContentLength / 4))
      : 0;

  const KIRO_DEFAULT_MAX_TOKENS = 200_000;
  const estimatedTotal =
    state.contextUsagePercentage > 0
      ? Math.floor((state.contextUsagePercentage * KIRO_DEFAULT_MAX_TOKENS) / 100)
      : 0;

  if (estimatedTotal <= 0 && estimatedOutput <= 0) return;

  if (estimatedTotal <= 0) {
    state.usage = {
      prompt_tokens: 0,
      completion_tokens: estimatedOutput,
      total_tokens: estimatedOutput,
    };
    return;
  }

  const promptTokens = Math.max(0, estimatedTotal - estimatedOutput);
  state.usage = {
    prompt_tokens: promptTokens,
    completion_tokens: estimatedOutput,
    total_tokens: promptTokens + estimatedOutput,
  };
}

// ─── SSE Transformer ──────────────────────────────────────────────────────

/**
 * Transform AWS EventStream binary response → OpenAI SSE text stream.
 *
 * @param response        Upstream fetch Response với binary EventStream body.
 * @param model           Model id để điền vào OpenAI chunks.
 * @param opts.thinkingExpected  Khi true: scan assistantResponseEvent.content
 *   tìm inline <thinking>…</thinking> và tách ra delta.reasoning_content.
 *
 * Event types được xử lý:
 * - assistantResponseEvent  : main content delta (+ inline thinking nếu thinkingExpected)
 * - codeEvent               : code content delta
 * - reasoningContentEvent   : native reasoning (không inline, từ adaptive thinking)
 * - toolUseEvent            : tool call
 * - messageStopEvent        : stream end marker
 * - metricsEvent / metadataEvent : token usage
 * - contextUsageEvent       : context usage percentage (dùng cho usage estimation)
 * - meteringEvent           : credit metering event (mark received)
 */
export function transformEventStreamToSSE(
  response: { body: ReadableStream<Uint8Array>; status: number; statusText: string },
  model: string,
  opts: { thinkingExpected?: boolean } = {},
): Response {
  const thinkingExpected = !!opts.thinkingExpected;
  const buffer = new ByteQueue();
  let chunkIndex = 0;
  const responseId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  const state: KiroStreamState = {
    startEmitted: false,
    finishEmitted: false,
    stopSeen: false,
    hasToolCalls: false,
    toolCallIndex: 0,
    seenToolIds: new Map(),
    toolArgsEmitted: new Map(),
    toolArgsBuffered: new Map(),
    generatedToolIdCounter: 0,
    totalContentLength: 0,
    contextUsagePercentage: 0,
    hasReasoningContent: false,
    reasoningChunkCount: 0,
    thinking: thinkingExpected ? { thinkingMode: false, pendingTag: '' } : undefined,
  };

  const flushCtx = { responseId, created, model };

  const mkChunk = (delta: JsonRecord, finishReason: string | null = null): JsonRecord => ({
    id: responseId,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });

  const emitContent = (
    controller: TransformStreamDefaultController<Uint8Array>,
    content: string,
  ) => {
    const delta = chunkIndex === 0 ? { role: 'assistant', content } : { content };
    controller.enqueue(encodeSse(`data: ${JSON.stringify(mkChunk(delta))}\n\n`));
    chunkIndex++;
  };

  const emitReasoning = (
    controller: TransformStreamDefaultController<Uint8Array>,
    reasoning: string,
  ) => {
    state.hasReasoningContent = true;
    const reasoningDelta: JsonRecord =
      state.reasoningChunkCount === 0 && chunkIndex === 0
        ? { role: 'assistant', reasoning_content: reasoning }
        : { reasoning_content: reasoning };
    controller.enqueue(encodeSse(`data: ${JSON.stringify(mkChunk(reasoningDelta))}\n\n`));
    chunkIndex++;
    state.reasoningChunkCount++;
  };

  const getToolCallId = (toolUse: JsonRecord): string => {
    if (typeof toolUse.toolUseId === 'string' && toolUse.toolUseId) {
      return toolUse.toolUseId;
    }
    state.generatedToolIdCounter++;
    return `call_${created}_${state.generatedToolIdCounter}`;
  };

  const transformStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer.push(chunk);

      let iterations = 0;
      while (buffer.length >= 16 && iterations < 1000) {
        iterations++;
        const totalLength = buffer.peekUint32BE(0);
        if (!totalLength || totalLength < 16 || totalLength > buffer.length) break;

        const eventData = buffer.read(totalLength);
        if (!eventData) break;

        const event = parseEventFrame(eventData);
        if (!event) continue;

        // ── Emit role-only start chunk on first frame ──
        // Satisfies stream-readiness gates (see OmniRoute comment).
        if (!state.startEmitted) {
          state.startEmitted = true;
          controller.enqueue(encodeSse(`data: ${JSON.stringify(mkChunk({ role: 'assistant' }))}\n\n`));
          chunkIndex++;
        }

        const eventType = event.headers[':event-type'] || '';

        // ── Native reasoning (reasoningContentEvent) ──
        // Kiro/CodeWhisperer với adaptive thinking bật: reasoning đến từ frame riêng.
        {
          const rp = event.payload as JsonRecord | undefined;
          const rt = rp?.reasoningText;
          if (eventType === 'reasoningContentEvent' || rt !== undefined) {
            let nativeReasoning = '';
            if (rt && typeof rt === 'object') {
              const rto = rt as { text?: unknown; Text?: unknown };
              nativeReasoning =
                typeof rto.text === 'string' ? rto.text
                  : typeof rto.Text === 'string' ? rto.Text : '';
            } else if (typeof rt === 'string') {
              nativeReasoning = rt;
            } else if (typeof rp?.text === 'string') {
              nativeReasoning = rp.text;
            }
            if (nativeReasoning) {
              emitReasoning(controller, nativeReasoning);
            }
            // Consume frame (kể cả signature-only)
            continue;
          }
        }

        // ── assistantResponseEvent ──
        if (eventType === 'assistantResponseEvent') {
          const content = typeof event.payload?.content === 'string' ? event.payload.content : '';
          if (!content) continue;
          state.totalContentLength += content.length;

          if (thinkingExpected && state.thinking) {
            // Claude trên Kiro emit reasoning inline khi thinking mode bật.
            splitInlineThinking(
              state.thinking,
              content,
              (text) => { if (text) emitContent(controller, text); },
              (reasoning) => { if (reasoning) emitReasoning(controller, reasoning); },
            );
          } else {
            emitContent(controller, content);
          }
          continue;
        }

        // ── codeEvent ──
        if (eventType === 'codeEvent' && event.payload?.content) {
          const content = event.payload.content as string;
          controller.enqueue(encodeSse(`data: ${JSON.stringify(mkChunk({ content }))}\n\n`));
          chunkIndex++;
          continue;
        }

        // ── toolUseEvent ──
        if (eventType === 'toolUseEvent' && event.payload) {
          state.hasToolCalls = true;
          const toolUses = Array.isArray(event.payload) ? event.payload : [event.payload];

          for (const raw of toolUses) {
            const toolUse = raw as JsonRecord;
            const toolName = typeof toolUse.name === 'string' ? toolUse.name : '';
            const toolCallId = getToolCallId(toolUse);
            const toolInput = toolUse.input;

            const isNew = !state.seenToolIds.has(toolCallId);
            let toolIndex: number;

            if (isNew) {
              toolIndex = state.toolCallIndex++;
              state.seenToolIds.set(toolCallId, toolIndex);
              // Emit tool call start với name
              const startDelta: JsonRecord = {
                ...(chunkIndex === 0 ? { role: 'assistant' } : {}),
                tool_calls: [{
                  index: toolIndex,
                  id: toolCallId,
                  type: 'function',
                  function: { name: toolName, arguments: '' },
                }],
              };
              controller.enqueue(encodeSse(`data: ${JSON.stringify(mkChunk(startDelta))}\n\n`));
              chunkIndex++;
            } else {
              toolIndex = state.seenToolIds.get(toolCallId) as number;
            }

            if (toolInput !== undefined) {
              if (typeof toolInput === 'string') {
                // String-form: concatenable incremental delta — emit ngay
                state.toolArgsEmitted.set(
                  toolCallId,
                  (state.toolArgsEmitted.get(toolCallId) || '') + toolInput,
                );
                const argsDelta = {
                  tool_calls: [{ index: toolIndex, function: { arguments: toolInput } }],
                };
                controller.enqueue(encodeSse(`data: ${JSON.stringify(mkChunk(argsDelta))}\n\n`));
                chunkIndex++;
              } else if (typeof toolInput === 'object' && toolInput !== null) {
                // Object-form: partial objects grow over time — buffer và flush tại finish
                state.toolArgsBuffered.set(toolCallId, {
                  toolIndex,
                  canonical: JSON.stringify(toolInput),
                });
              }
            }
          }
          continue;
        }

        // ── messageStopEvent ──
        if (eventType === 'messageStopEvent') {
          flushBufferedToolArgs(state, controller, flushCtx);
          state.stopSeen = true;
          continue;
        }

        // ── contextUsageEvent ──
        if (eventType === 'contextUsageEvent') {
          const pct = typeof event.payload?.contextUsagePercentage === 'number'
            ? event.payload.contextUsagePercentage
            : 0;
          if (pct > 0) state.contextUsagePercentage = pct;
          continue;
        }

        // ── token usage (metricsEvent / metadataEvent) ──
        if (eventType === 'metricsEvent' || eventType === 'metadataEvent') {
          const metrics =
            event.payload?.metricsEvent ||
            event.payload?.usage ||
            (event.payload?.metadataEvent as JsonRecord | undefined)?.usage ||
            event.payload;

          if (metrics && typeof metrics === 'object') {
            const m = metrics as JsonRecord;
            const readNum = (...vals: unknown[]) =>
              vals.find((v) => typeof v === 'number') as number | undefined;

            const inputTokens =
              readNum(m.inputTokens, m.prompt_tokens) || 0;
            const outputTokens =
              readNum(m.outputTokens, m.completion_tokens) || 0;
            const cacheRead = readNum(
              m.cacheReadInputTokens, m.cacheReadTokens, m.cache_read_input_tokens,
            );
            const cacheCreation = readNum(
              m.cacheWriteInputTokens, m.cacheCreationTokens, m.cache_creation_input_tokens,
            );

            if (inputTokens > 0 || outputTokens > 0) {
              state.usage = {
                prompt_tokens: inputTokens,
                completion_tokens: outputTokens,
                total_tokens: inputTokens + outputTokens,
                ...((cacheRead || 0) > 0 ? { cache_read_input_tokens: cacheRead } : {}),
                ...((cacheCreation || 0) > 0 ? { cache_creation_input_tokens: cacheCreation } : {}),
              };
            } else if ((cacheRead || 0) > 0 || (cacheCreation || 0) > 0) {
              state.usage = {
                ...(state.usage || {}),
                ...((cacheRead || 0) > 0 ? { cache_read_input_tokens: cacheRead } : {}),
                ...((cacheCreation || 0) > 0 ? { cache_creation_input_tokens: cacheCreation } : {}),
              } as KiroStreamState['usage'];
            }
          }
          continue;
        }

        // meteringEvent: chỉ mark received, không emit gì
      }

      if (iterations >= 1000) {
        console.warn('[Kiro] Max iterations reached in event parsing');
      }
    },

    flush(controller) {
      // Flush buffered tool args (idempotent nếu messageStopEvent đã flush)
      flushBufferedToolArgs(state, controller, flushCtx);

      // Drain pending inline-thinking tag fragment
      if (thinkingExpected && state.thinking) {
        flushPendingThinking(
          state.thinking,
          (text) => {
            if (!text) return;
            controller.enqueue(encodeSse(`data: ${JSON.stringify(mkChunk({ content: text }))}\n\n`));
            chunkIndex++;
          },
          (reasoning) => {
            if (!reasoning) return;
            controller.enqueue(encodeSse(`data: ${JSON.stringify(mkChunk({ reasoning_content: reasoning }))}\n\n`));
            chunkIndex++;
          },
        );
      }

      if (!state.finishEmitted) {
        state.finishEmitted = true;
        ensureKiroUsage(state, model);
        const finishReason = state.hasToolCalls ? 'tool_calls' : 'stop';
        const finishChunk: JsonRecord = mkChunk({}, finishReason);
        if (state.usage) finishChunk.usage = state.usage;
        controller.enqueue(encodeSse(`data: ${JSON.stringify(finishChunk)}\n\n`));
      }

      controller.enqueue(encodeSse('data: [DONE]\n\n'));
    },
  });

  const transformedStream = response.body.pipeThrough(transformStream);

  return new Response(transformedStream, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
