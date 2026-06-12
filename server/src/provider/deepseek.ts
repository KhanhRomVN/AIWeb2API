import { Provider, SendMessageOptions } from './types';
import { Router } from 'express';
import { HttpClient } from '../utils/http-client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch, { Response as NodeFetchResponse } from 'node-fetch';
import { findAccount } from '../services/account-selector';
import { createLogger } from '../utils/logger';
import { loginService } from '../services/login.service';
import { ProxyHandler } from '../services/proxy.service';
import { proxyEvents } from '../services/proxy-events';
import { countTokens, countMessagesTokens } from '../utils/tokenizer';

const logger = createLogger('DeepSeekProvider');

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface PoWChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  difficulty: number;
  signature: string;
  expire_at: number;
  target_path: string;
}

export interface PoWResponse {
  algorithm: string;
  challenge: string;
  salt: string;
  answer: number;
  signature: string;
  target_path: string;
}

export interface ChatPayload {
  model?: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  search?: boolean;
  conversation_id?: string;
  ref_file_ids?: string[];
  thinking?: boolean;
  parent_message_id?: string;
  client_stream_id?: string;
  chat_session_id?: string;
  prompt?: string;
  thinking_enabled?: boolean;
  search_enabled?: boolean;
  model_type?: string;
}

export interface ContinuePayload {
  request: string; // JSON-stringified { chat_session_id, message_id, fallback_to_resume }
  response: string; // The prior SSE stream text (can be empty string for auto-resume)
}

// =============================================================================
// POW HASH (WASM)
// =============================================================================

class DeepSeekHash {
  private instance: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private wasmPath: string;

  constructor(wasmPath: string) {
    this.wasmPath = wasmPath;
  }

  async init() {
    if (this.instance) return;
    try {
      if (!fs.existsSync(this.wasmPath)) {
        throw new Error(`WASM file not found at ${this.wasmPath}`);
      }
      const wasmBuffer = fs.readFileSync(this.wasmPath);
      const wasmModule = new WebAssembly.Module(wasmBuffer);
      const instance = new WebAssembly.Instance(wasmModule, {
        wasi_snapshot_preview1: {
          fd_write: () => 0,
          environ_sizes_get: () => 0,
          environ_get: () => 0,
          clock_time_get: () => 0,
          fd_close: () => 0,
          fd_seek: () => 0,
          fd_fdstat_get: () => 0,
          proc_exit: () => 0,
        },
        env: {},
      });
      this.instance = instance;
      this.memory = instance.exports.memory as WebAssembly.Memory;
    } catch (e) {
      logger.error('Failed to initialize DeepSeek WASM:', e);
      throw e;
    }
  }

  private writeToMemory(text: string): [number, number] {
    if (!this.instance || !this.memory) throw new Error('WASM not initialized');
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    const length = encoded.length;
    const malloc = this.instance.exports
      .__wbindgen_export_0 as CallableFunction;
    const ptr = malloc(length, 1) as number;
    const memoryView = new Uint8Array(this.memory.buffer);
    memoryView.set(encoded, ptr);
    return [ptr, length];
  }

  calculateHash(
    difficulty: number,
    challenge: string,
    prefix: string,
  ): number | null {
    if (!this.instance || !this.memory) throw new Error('WASM not initialized');
    const stackPointerFn = this.instance.exports
      .__wbindgen_add_to_stack_pointer as CallableFunction;
    const solveFn = this.instance.exports.wasm_solve as CallableFunction;
    const retptr = stackPointerFn(-16) as number;
    try {
      const [cPtr, cLen] = this.writeToMemory(challenge);
      const [pPtr, pLen] = this.writeToMemory(prefix);
      solveFn(retptr, cPtr, cLen, pPtr, pLen, difficulty);
      const memoryView = new DataView(this.memory.buffer);
      const status = memoryView.getInt32(retptr, true);
      if (status === 0) return null;
      return Number(memoryView.getFloat64(retptr + 8, true));
    } finally {
      stackPointerFn(16);
    }
  }
}

// =============================================================================
// API UTILS
// =============================================================================

export const BASE_URL = 'https://chat.deepseek.com';

// (Moved into class)

// =============================================================================
// PROXY HANDLER
// =============================================================================

export const proxyHandler: ProxyHandler = {
  onRequest: (ctx: any, callback: () => void) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (host && host.includes('chat.deepseek.com')) {
      logger.debug(`[Proxy] DeepSeek Request: ${url}`);
      const auth = ctx.clientToProxyRequest.headers['authorization'];

      if (auth) {
        logger.debug(
          '[Proxy] Intercepting DeepSeek request with Authorization header',
        );
        proxyEvents.emit('deepseek-auth-header', auth);
      }
    }
    callback();
  },

  onRequestData: (
    ctx: any,
    chunk: Buffer,
    callback: (err: Error | null, data?: Buffer) => void,
  ) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('chat.deepseek.com') &&
      url.includes('/api/v0/users/login')
    ) {
      const bodyStr = chunk.toString();
      try {
        const outerJson = JSON.parse(bodyStr);
        let foundEmail = null;
        if (outerJson.request) {
          const innerJson = JSON.parse(outerJson.request);
          if (innerJson.email) {
            foundEmail = innerJson.email;
          }
        } else if (outerJson.email) {
          foundEmail = outerJson.email;
        }

        if (foundEmail) {
          logger.info(
            `[Proxy] Captured DeepSeek Login Email (JSON): ${foundEmail}`,
          );
          (ctx as any).capturedUnmaskedEmail = foundEmail;
          proxyEvents.emit('deepseek-login-email', { email: foundEmail });
        }
      } catch (e) {
        const emailMatch = bodyStr.match(
          /\\?"email\\?":\s*\\?"([^"\\*]+)@([^"\\*]+)\\?"/,
        );
        if (emailMatch && emailMatch[0]) {
          const email = `${emailMatch[1]}@${emailMatch[2]}`.replace(/\\/g, '');
          if (!email.includes('***')) {
            logger.info(
              `[Proxy] Captured DeepSeek Login Email (Regex): ${email}`,
            );
            (ctx as any).capturedUnmaskedEmail = email;
            proxyEvents.emit('deepseek-login-email', { email });
          }
        }
      }
    }
    callback(null, chunk);
  },

  onResponseBody: (ctx: any, body: string) => {
    const host = ctx.clientToProxyRequest.headers.host;
    const url = ctx.clientToProxyRequest.url;

    if (
      host &&
      host.includes('chat.deepseek.com') &&
      url.includes('/api/v0/users/login')
    ) {
      try {
        const json = JSON.parse(body);
        let userData;

        if (json.response && typeof json.response === 'string') {
          const innerResponse = JSON.parse(json.response);
          userData = innerResponse?.data?.biz_data?.user;
        } else if (json.data && json.data.biz_data && json.data.biz_data.user) {
          userData = json.data.biz_data.user;
        } else if (json.code === 0 && json.data) {
          userData = json.data;
        }

        if (userData && userData.token) {
          logger.info(`[Proxy] Captured DeepSeek Login Token`);
          const eventPayload: any = { cookies: userData.token };
          const capturedEmail = (ctx as any).capturedUnmaskedEmail;
          let bestEmail = capturedEmail || userData.email;

          if (bestEmail?.includes('***') && capturedEmail) {
            bestEmail = capturedEmail;
          }

          if (bestEmail) {
            logger.info(`[Proxy] Using DeepSeek Login Email: ${bestEmail}`);
            eventPayload.email = bestEmail;
            proxyEvents.emit('deepseek-login-email', { email: bestEmail });
          }
          proxyEvents.emit('deepseek-login-token', eventPayload);
          delete (ctx as any).capturedUnmaskedEmail;
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse DeepSeek Login Response:', e);
      }
    }

    if (
      host &&
      host.includes('accounts.google.com') &&
      url.includes('signin/oauth/id')
    ) {
      const emailMatch = body.match(/"oPEP7c":"([^"]+)"/);
      if (emailMatch && emailMatch[1] && !emailMatch[1].includes('***')) {
        logger.info(
          `[Proxy] Found Google Email for DeepSeek: ${emailMatch[1]}`,
        );
        (ctx as any).capturedUnmaskedEmail = emailMatch[1];
        proxyEvents.emit('deepseek-google-email', { email: emailMatch[1] });
      }
    }

    if (
      host &&
      host.includes('chat.deepseek.com') &&
      url.includes('/api/v0/users/current')
    ) {
      try {
        const userInfo = JSON.parse(body);
        if (userInfo.code === 0 && userInfo.data) {
          proxyEvents.emit('deepseek-user-info', userInfo.data);
          const bizData = userInfo.data?.biz_data;
          if (bizData) {
            if (bizData.token) {
              logger.info(
                '[Proxy] Captured DeepSeek Login Token from User Info',
              );
              const eventPayload: any = { cookies: bizData.token };
              const capturedEmail = (ctx as any).capturedUnmaskedEmail;
              let bestEmail = capturedEmail || bizData.email;
              if (bestEmail?.includes('***') && capturedEmail) {
                bestEmail = capturedEmail;
              }
              if (bestEmail) {
                eventPayload.email = bestEmail;
              }
              proxyEvents.emit('deepseek-login-token', eventPayload);
            }
            if (bizData.email) {
              proxyEvents.emit('deepseek-login-email', {
                email: bizData.email,
              });
            }
          }
        }
      } catch (e) {
        logger.error('[Proxy] Failed to parse DeepSeek User Info:', e);
      }
    }
  },
};

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class DeepSeekProvider implements Provider {
  name = 'DeepSeek';
  proxyHandler = proxyHandler;
  defaultModel = 'deepseek-instant';
  private wasmPath: string = '';
  private dsHash: DeepSeekHash | null = null;

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const url = `${BASE_URL}/api/v0/users/current`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credential}`,
          Origin: BASE_URL,
          Referer: `${BASE_URL}/`,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (response.status === 200 || response.ok) {
        const json = await response.json();
        if (json.code === 0 && json.data) {
          return {
            email: json.data.email || null,
            name: json.data.name,
            id: json.data.id,
          };
        }
      }
      return { email: null };
    } catch (e) {
      logger.error('[DeepSeek] Get Profile Error:', e);
      return { email: null };
    }
  }

  async login(options?: { deepseekMethod?: 'basic' | 'google' }) {
    const method = options?.deepseekMethod || 'basic';
    const loginUrl =
      method === 'google'
        ? 'https://accounts.google.com/ServiceLogin?service=lso&passive=1209600&continue=https://chat.deepseek.com/login'
        : 'https://chat.deepseek.com/login';

    logger.info(`Starting DeepSeek login with method: ${method}`);

    return await loginService.login({
      providerId: 'deepseek',
      loginUrl,
      partition: `deepseek-${Date.now()}`,
      cookieEvent: 'deepseek-login-token',
      infoEvent: 'deepseek-login-email',
      validate: async (data: {
        cookies: string;
        headers?: any;
        email?: string;
      }) => {
        if (data.cookies) {
          logger.info('[DeepSeek] Validating with captured token');
          const token = data.cookies;
          let email = data.email;

          if (!email) {
            logger.info(
              '[DeepSeek] Email not captured directly, fetching profile...',
            );
            const profile = await this.getProfile(token);
            email = profile.email || undefined;
          }

          if (email) {
            return { isValid: true, cookies: token, email };
          }
        }
        return { isValid: false };
      },
    });
  }

  constructor() {
    this.initWasm();
  }

  private async initWasm() {
    const possiblePaths = [
      path.resolve(__dirname, 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      path.join(process.cwd(), 'resources', 'sha3_wasm_bg.7b9ca65ddd.wasm'),
      path.join(
        process.cwd(),
        'backend',
        'src',
        'provider',
        'sha3_wasm_bg.7b9ca65ddd.wasm',
      ),
      ...(typeof (process as any).resourcesPath !== 'undefined'
        ? [
            path.join(
              (process as any).resourcesPath,
              'resources',
              'sha3_wasm_bg.7b9ca65ddd.wasm',
            ),
            path.join(
              (process as any).resourcesPath,
              'app.asar.unpacked',
              'resources',
              'sha3_wasm_bg.7b9ca65ddd.wasm',
            ),
          ]
        : []),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.wasmPath = p;
        break;
      }
    }

    if (!this.wasmPath) {
      logger.error(
        `DeepSeek WASM not found. Tried paths: ${JSON.stringify(possiblePaths, null, 2)}`,
      );
    }
  }

  private async getDsHash(): Promise<DeepSeekHash> {
    if (this.dsHash) return this.dsHash;
    if (!this.wasmPath) await this.initWasm();
    if (!this.wasmPath || !fs.existsSync(this.wasmPath)) {
      throw new Error('DeepSeek WASM file not found');
    }
    this.dsHash = new DeepSeekHash(this.wasmPath);
    await this.dsHash.init();
    return this.dsHash;
  }

  private async solvePoW(challenge: PoWChallenge): Promise<PoWResponse> {
    const dsHash = await this.getDsHash();
    const prefix = `${challenge.salt}_${challenge.expire_at}_`;
    const answer = dsHash.calculateHash(
      challenge.difficulty,
      challenge.challenge,
      prefix,
    );

    return {
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      salt: challenge.salt,
      answer: answer !== null ? answer : 0,
      signature: challenge.signature,
      target_path: challenge.target_path,
    };
  }

  // =============================================================================
  // TOOL CALL DETECTION
  // Checks if accumulated content ends with a partial (unclosed) tool tag.
  // Used to detect when INCOMPLETE cuts off mid-toolcall.
  // =============================================================================
  private detectPartialToolcall(content: string): { hasPartial: boolean; toolType: string | null } {
    const TOOL_NAMES = [
      'write_to_file', 'replace_in_file', 'read_file', 'run_command',
      'list_files', 'search_files', 'delete_file', 'delete_folder', 'execute_agent_action',
    ];

    for (const tool of TOOL_NAMES) {
      // Check for unclosed opening tag: <tool_name> exists but </tool_name> does not
      const openTagRegex = new RegExp(`<${tool}(?:\\s[^>]*)?>`, 'i');
      const closeTagRegex = new RegExp(`</${tool}>`, 'i');
      if (openTagRegex.test(content) && !closeTagRegex.test(content)) {
        return { hasPartial: true, toolType: tool };
      }
    }
    return { hasPartial: false, toolType: null };
  }

  // =============================================================================
  // SSE STREAM PARSER
  // Parses a DeepSeek SSE response body and emits content/thinking/metadata.
  // Returns an object indicating whether the response was INCOMPLETE and the
  // response_message_id needed to call /chat/continue.
  // =============================================================================
  private async parseSSEStream(
    responseBody: NodeJS.ReadableStream,
    opts: {
      onContent: (chunk: string) => void;
      onThinking?: (chunk: string) => void;
      onMetadata?: (meta: any) => void;
      onRaw?: (data: string) => void;
      sessionId: string;
      promptTokens: number;
      completionTokensRef: { value: number };
      currentModeRef: { value: 'THINK' | 'RESPONSE' };
      /**
       * Length (in chars) of content already accumulated from previous stream(s).
       * When DeepSeek's /chat/continue returns a full snapshot of the entire response
       * (not just the new delta), this offset lets us skip content we've already
       * emitted and only forward the genuinely new suffix to onContent().
       * Set to 0 for the initial stream.
       */
      priorContentLength?: number;
    },
  ): Promise<{ incomplete: boolean; responseMessageId: number | null; accumulatedContent: string }> {
    const {
      onContent,
      onThinking,
      onMetadata,
      onRaw,
      sessionId,
      promptTokens,
      completionTokensRef,
      currentModeRef,
      priorContentLength = 0,
    } = opts;

    let buffer = '';
    let currentEventType = '';
    let isIncomplete = false;
    let responseMessageId: number | null = null;
    let contentChunkCount = 0;
    let totalBytesProcessed = 0;
    let accumulatedContent = '';

    // Tracks how many chars of the reconstructed full-snapshot we have seen so far.
    // Used to deduplicate the snapshot content that overlaps with priorContentLength.
    let snapshotSeenLength = 0;
    let snapshotMode = false; // true once we detect the stream is a full-snapshot replay

    for await (const chunk of responseBody) {
      const chunkStr = chunk.toString();
      totalBytesProcessed += chunkStr.length;
      if (onRaw) onRaw(chunkStr);
      buffer += chunkStr;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.substring(7).trim();
          continue;
        }

        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.substring(6).trim();
        if (jsonStr === '[DONE]') {
          // Explicit [DONE] means complete — not INCOMPLETE
          return { incomplete: false, responseMessageId, accumulatedContent };
        }

        try {
          const json = JSON.parse(jsonStr);

          // ── event: ready ──────────────────────────────────────────────────
          if (currentEventType === 'ready') {
            if (json.response_message_id !== undefined) {
              responseMessageId = json.response_message_id;
              if (onMetadata) {
                onMetadata({
                  response_message_id: json.response_message_id,
                  chat_session_id: sessionId,
                });
              }
            }
            currentEventType = '';
            continue;
          }

          // ── event: title ──────────────────────────────────────────────────
          if (currentEventType === 'title') {
            if (json.content && onMetadata) {
              onMetadata({ conversation_title: json.content });
            }
            currentEventType = '';
            continue;
          }

          // ── event: close ─────────────────────────────────────────────────
          // DeepSeek sends `event: close` with auto_resume info when INCOMPLETE
          if (currentEventType === 'close') {
            currentEventType = '';
            continue;
          }

          // ── event: hint ───────────────────────────────────────────────────
          // DeepSeek sends `event: hint` for server-side errors, e.g. expert model busy
          if (currentEventType === 'hint') {
            if (json.type === 'error') {
              const hintMsg = json.content || 'Unknown DeepSeek server hint error';
              const finishReason = json.finish_reason || '';
              logger.warn(
                `[DeepSeek] Server hint error | session=${sessionId} | finish_reason=${finishReason} | message=${hintMsg}`,
              );
              const err: any = new Error(hintMsg);
              if (finishReason) err.code = finishReason;
              throw err;
            }
            currentEventType = '';
            continue;
          }

          currentEventType = '';

          // ── Detect INCOMPLETE status ──────────────────────────────────────
          // Pattern 1: {"p":"response/status","o":"SET","v":"INCOMPLETE"}
          if (json.p === 'response/status' && json.v === 'INCOMPLETE') {
            isIncomplete = true;
            const { hasPartial, toolType } = this.detectPartialToolcall(accumulatedContent);
            logger.info(
              `[DeepSeek] INCOMPLETE detected (Pattern 1) | session=${sessionId} | msgId=${responseMessageId} | contentChunks=${contentChunkCount} | bytesProcessed=${totalBytesProcessed} | hasPartialTool=${hasPartial} | toolType=${toolType ?? 'none'}`,
            );
            if (onMetadata) {
              onMetadata({
                incomplete_has_partial_tool: hasPartial,
                incomplete_partial_tool_type: toolType,
              });
            }
            continue;
          }

          // Pattern 2: batch update containing quasi_status=INCOMPLETE
          // {"p":"response","o":"BATCH","v":[...,{"p":"quasi_status","v":"INCOMPLETE"}]}
          if (json.p === 'response' && json.o === 'BATCH' && Array.isArray(json.v)) {
            for (const item of json.v) {
              if (item.p === 'quasi_status' && item.v === 'INCOMPLETE') {
                isIncomplete = true;
                const { hasPartial, toolType } = this.detectPartialToolcall(accumulatedContent);
                logger.info(
                  `[DeepSeek] INCOMPLETE detected (Pattern 2/BATCH) | session=${sessionId} | msgId=${responseMessageId} | contentChunks=${contentChunkCount} | bytesProcessed=${totalBytesProcessed} | hasPartialTool=${hasPartial} | toolType=${toolType ?? 'none'}`,
                );
                if (onMetadata) {
                  onMetadata({
                    incomplete_has_partial_tool: hasPartial,
                    incomplete_partial_tool_type: toolType,
                  });
                }
              }
              if (item.p === 'accumulated_token_usage' && onMetadata) {
                onMetadata({ total_token: item.v });
              }
            }
            continue;
          }

          // ── OpenAI-compat delta ───────────────────────────────────────────
          if (json.choices?.[0]?.delta?.content) {
            const deltaText = json.choices[0].delta.content;
            completionTokensRef.value += countTokens(deltaText);
            accumulatedContent += deltaText;
            onContent(deltaText);
            contentChunkCount++;
            if (onMetadata) {
              onMetadata({ total_token: promptTokens + completionTokensRef.value });
            }
            continue;
          }

          const path = json.p;
          const value = json.v;

          // ── Helper: emit a content chunk, skipping the priorContentLength prefix
          // when this stream is replaying a full snapshot from /chat/continue.
          const emitContentChunk = (text: string, fromSnapshot: boolean) => {
            if (fromSnapshot && priorContentLength > 0) {
              // The snapshot replays everything from char 0. Skip chars we already saw.
              const alreadySeen = snapshotSeenLength;
              snapshotSeenLength += text.length;
              if (snapshotSeenLength <= priorContentLength) {
                // Entire chunk is old content — skip silently
                return;
              }
              if (alreadySeen < priorContentLength) {
                // Chunk straddles the boundary — only emit the new suffix
                text = text.slice(priorContentLength - alreadySeen);
              }
              // If snapshotSeenLength > priorContentLength and alreadySeen >= priorContentLength,
              // the whole chunk is new → fall through and emit normally.
            }
            completionTokensRef.value += countTokens(text);
            accumulatedContent += text;
            onContent(text);
            contentChunkCount++;
            if (onMetadata) {
              onMetadata({ total_token: promptTokens + completionTokensRef.value });
            }
          };

          // ── Initial full object: {"v":{"response":{"fragments":[...]}}} ───
          // DeepSeek sends this at the START of a /chat/continue stream as a
          // full replay of everything generated so far (prior + new content).
          // We must deduplicate using priorContentLength to avoid double-emit.
          if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            value.response?.fragments
          ) {
            // Also capture response_message_id from initial snapshot
            if (value.response?.message_id != null) {
              responseMessageId = value.response.message_id;
            }
            // Mark that this stream is operating in snapshot-replay mode.
            // All RESPONSE content from this point is deduplicated via emitContentChunk.
            snapshotMode = true;
            // Reset snapshotSeenLength at start of each snapshot object so we can
            // correctly measure overlap against priorContentLength.
            snapshotSeenLength = 0;
            for (const fragment of value.response.fragments) {
              if (fragment.type === 'THINK') {
                currentModeRef.value = 'THINK';
                if (fragment.content) {
                  if (onThinking) onThinking(fragment.content);
                  else { onContent(`[Thinking] ${fragment.content}\n`); contentChunkCount++; }
                }
              } else if (fragment.type === 'RESPONSE') {
                currentModeRef.value = 'RESPONSE';
                if (fragment.content) {
                  emitContentChunk(fragment.content, true /* fromSnapshot */);
                }
              }
            }
            // Check if initial snapshot already shows INCOMPLETE
            if (value.response?.status === 'INCOMPLETE') {
              isIncomplete = true;
            }
            continue;
          }

          // ── Array fragment ────────────────────────────────────────────────
          if (Array.isArray(value)) {
            const fragment = value[0];
            if (fragment) {
              if (fragment.type === 'THINK') {
                currentModeRef.value = 'THINK';
                if (fragment.content) {
                  if (onThinking) onThinking(fragment.content);
                  else { onContent(`[Thinking] ${fragment.content}\n`); contentChunkCount++; }
                }
              } else if (fragment.type === 'RESPONSE') {
                currentModeRef.value = 'RESPONSE';
                if (fragment.content) {
                  emitContentChunk(fragment.content, snapshotMode);
                }
              }
            }
            continue;
          }

          // ── String value (incremental delta) ─────────────────────────────
          if (typeof value === 'string') {
            if (path?.includes('thinking_content')) {
              currentModeRef.value = 'THINK';
              completionTokensRef.value += countTokens(value);
              if (onThinking) onThinking(value);
              else { onContent(`[Thinking] ${value}\n`); contentChunkCount++; }
              if (onMetadata) {
                onMetadata({ total_token: promptTokens + completionTokensRef.value });
              }
            } else if (
              path === 'response/content' ||
              path?.endsWith('/content')
            ) {
              if (path === 'response/content') {
                currentModeRef.value = 'RESPONSE';
              }
              if (currentModeRef.value === 'THINK') {
                completionTokensRef.value += countTokens(value);
                if (onThinking) onThinking(value);
                else { onContent(`[Thinking] ${value}\n`); contentChunkCount++; }
                if (onMetadata) {
                  onMetadata({ total_token: promptTokens + completionTokensRef.value });
                }
              } else {
                emitContentChunk(value, snapshotMode);
              }
            } else if (!path) {
              if (currentModeRef.value === 'THINK') {
                completionTokensRef.value += countTokens(value);
                if (onThinking) onThinking(value);
                else { onContent(`[Thinking] ${value}\n`); contentChunkCount++; }
                if (onMetadata) {
                  onMetadata({ total_token: promptTokens + completionTokensRef.value });
                }
              } else {
                emitContentChunk(value, snapshotMode);
              }
            }
          } else if (
            path?.endsWith('/elapsed_secs') ||
            path?.endsWith('thinking_elapsed_secs')
          ) {
            if (onMetadata) {
              onMetadata({ thinking_elapsed: value });
            }
          } else if (contentChunkCount === 0) {
            // Unhandled path — silently ignore
          }
        } catch (_e) {
          // Ignore parse errors for non-hint lines (hint errors are re-thrown above)
        }
      }
    }

    logger.debug(`[DeepSeek] parseSSEStream complete | session=${sessionId} | status=${isIncomplete ? 'INCOMPLETE' : 'COMPLETE'} | msgId=${responseMessageId} | totalBytes=${totalBytesProcessed} | contentChunks=${contentChunkCount}`);
    return { incomplete: isIncomplete, responseMessageId, accumulatedContent };
  }

  // =============================================================================
  // CONTINUE INCOMPLETE RESPONSE
  // Calls POST /api/v0/chat/continue to resume a truncated DeepSeek response.
  // =============================================================================
  private async continueIncompleteResponse(
    client: HttpClient,
    sessionId: string,
    responseMessageId: number,
  ): Promise<NodeFetchResponse> {
    // DeepSeek /chat/continue expects a flat JSON body — NOT wrapped in a "request" field.
    const continuePayload = {
      chat_session_id: sessionId,
      message_id: responseMessageId,
      fallback_to_resume: true,
    };

    logger.info(
      `[DeepSeek] Calling /chat/continue for session=${sessionId} msgId=${responseMessageId} | payload=${JSON.stringify(continuePayload)}`,
    );

    const response = await client.post('/api/v0/chat/continue', continuePayload);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `DeepSeek /chat/continue returned ${response.status}: ${errText}`,
      );
    }

    return response;
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onThinking,
      onMetadata,
      onDone,
      onError,
      onRaw,
      onSessionCreated,
    } = options;
    const baseHeaders = {
      Cookie: `DS-AUTH-TOKEN=${credential}`,
      Authorization: credential,
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      Origin: 'https://chat.deepseek.com',
      Referer: 'https://chat.deepseek.com/',
      'X-App-Version': '2.0.0',
      'X-Client-Version': '2.0.0',
      'X-Client-Platform': 'web',
      'X-Client-Locale': 'en_US',
    };

    const client = new HttpClient({
      baseURL: 'https://chat.deepseek.com',
      headers: baseHeaders,
    });

    try {
      let sessionId = options.conversationId;
      if (!sessionId) {
        const sessionRes = await client.post('/api/v0/chat_session/create', {
          character_id: null,
        });
        if (!sessionRes.ok) {
          const errText = await sessionRes.text();
          throw new Error(
            `Failed to create chat session: ${sessionRes.status} - ${errText}`,
          );
        }
        const sessionData = await sessionRes.json();
        sessionId =
          sessionData?.data?.biz_data?.chat_session?.id ||
          sessionData?.data?.biz_data?.id;
        if (!sessionId) {
          throw new Error(
            `Session ID missing from response: ${JSON.stringify(sessionData)}`,
          );
        }
      }

      if (!sessionId) throw new Error('Failed to obtain session ID');

      if (onSessionCreated) onSessionCreated(sessionId);
      if (onMetadata) {
        onMetadata({
          conversation_id: sessionId,
          conversation_title: 'New Chat',
        });
      }

      let parentMessageId: string | null | undefined = undefined;
      if (options.parent_message_id) {
        parentMessageId = options.parent_message_id;
      } else if (options.conversationId) {
        parentMessageId = await this.getLastMessageId(client, sessionId);
      }

      const challengeClient = new HttpClient({
        baseURL: 'https://chat.deepseek.com',
        headers: {
          ...baseHeaders,
          Referer: `https://chat.deepseek.com/a/chat/s/${sessionId}`,
        },
      });

      const challengeRes = await challengeClient.post(
        '/api/v0/chat/create_pow_challenge',
        { target_path: '/api/v0/chat/completion' },
      );
      let powResponseBase64 = '';
      logger.debug(
        `[DeepSeek] PoW challenge response | status=${challengeRes.status} | ok=${challengeRes.ok} | session=${sessionId}`,
      );
      if (challengeRes.ok) {
        try {
          const rawText = await challengeRes.text();
          logger.debug(
            `[DeepSeek] PoW challenge raw body | len=${rawText.length} | preview=${rawText.slice(0, 120)}`,
          );
          const challengeJson = JSON.parse(rawText);
          const challengeData: PoWChallenge =
            challengeJson?.data?.biz_data?.challenge;
          if (challengeData) {
            const powAnswer = await this.solvePoW(challengeData);
            powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
              'base64',
            );
          } else {
            logger.warn(
              `[DeepSeek] PoW challenge data missing from response | session=${sessionId} | body=${rawText.slice(0, 200)}`,
            );
          }
        } catch (e) {
          logger.warn(
            `[DeepSeek] Failed to parse PoW challenge response | session=${sessionId} | error=${e}`,
          );
        }
      } else {
        const errText = await challengeRes.text().catch(() => '<unreadable>');
        logger.warn(
          `[DeepSeek] PoW challenge request failed | status=${challengeRes.status} | session=${sessionId} | body=${errText.slice(0, 200)}`,
        );
      }

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = crypto.randomBytes(8).toString('hex');
      const clientStreamId = `${date}-${randomPart}`;

      const requestPayload: ChatPayload = {
        chat_session_id: sessionId,
        parent_message_id: parentMessageId || null || undefined,
        prompt: messages[messages.length - 1].content,
        messages: [],
        ref_file_ids: options.ref_file_ids || [],
        thinking_enabled: options.thinking ?? model === 'deepseek-reasoner',
        search_enabled: options.search || false,
        client_stream_id: clientStreamId,
        model_type: model === 'deepseek-expert' ? 'expert' : 'default',
      };

      const completionClient = new HttpClient({
        baseURL: 'https://chat.deepseek.com',
        headers: {
          ...baseHeaders,
          Referer: `https://chat.deepseek.com/a/chat/s/${sessionId}`,
          'X-Ds-Pow-Response': powResponseBase64,
        },
      });

      const response = await completionClient.post(
        '/api/v0/chat/completion',
        requestPayload,
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API returned ${response.status}: ${errorText}`,
        );
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Shared mutable state across initial + continuation streams
      const promptTokens = countMessagesTokens(messages);
      const completionTokensRef = { value: 0 };
      const currentModeRef: { value: 'THINK' | 'RESPONSE' } = { value: 'RESPONSE' };

      // Client for continue calls (uses session-scoped Referer)
      const continueClient = new HttpClient({
        baseURL: 'https://chat.deepseek.com',
        headers: {
          ...baseHeaders,
          Referer: `https://chat.deepseek.com/a/chat/s/${sessionId}`,
        },
      });

      // ── Parse initial stream ──────────────────────────────────────────────
      let { incomplete, responseMessageId, accumulatedContent } = await this.parseSSEStream(
        response.body as NodeJS.ReadableStream,
        {
          onContent,
          onThinking,
          onMetadata,
          onRaw,
          sessionId,
          promptTokens,
          completionTokensRef,
          currentModeRef,
        },
      );

      // ── Auto-continue loop ────────────────────────────────────────────────
      // DeepSeek may truncate long responses. We keep calling /chat/continue
      // until the response is complete (quasi_status !== INCOMPLETE).
      const MAX_CONTINUATIONS = 10; // safety cap to prevent infinite loops
      let continuationCount = 0;

      while (incomplete && responseMessageId !== null && continuationCount < MAX_CONTINUATIONS) {
        continuationCount++;
        logger.info(
          `[DeepSeek] Auto-continue attempt ${continuationCount}/${MAX_CONTINUATIONS} | session=${sessionId} | msgId=${responseMessageId}`,
        );

        if (onMetadata) {
          onMetadata({ continuing: true, continuation_count: continuationCount });
        }

        let continueResponse: NodeFetchResponse;
        try {
          continueResponse = await this.continueIncompleteResponse(
            continueClient,
            sessionId,
            responseMessageId,
          );
        } catch (continueErr: any) {
          logger.error(`[DeepSeek] /chat/continue failed: ${continueErr.message}`);
          // Don't propagate — treat as end of stream with what we have
          break;
        }

        if (!continueResponse.body) {
          logger.warn('[DeepSeek] /chat/continue returned no body, stopping continuation');
          break;
        }

        const continueResult = await this.parseSSEStream(
          continueResponse.body as unknown as NodeJS.ReadableStream,
          {
            onContent,
            onThinking,
            onMetadata,
            onRaw,
            sessionId,
            promptTokens,
            completionTokensRef,
            currentModeRef,
            // Tell the parser how many chars are already accumulated so it can
            // skip the snapshot prefix that DeepSeek replays from /chat/continue.
            priorContentLength: accumulatedContent.length,
          },
        );

        // Merge accumulated content across continuations
        accumulatedContent += continueResult.accumulatedContent;

        incomplete = continueResult.incomplete;
        // Update responseMessageId if the continuation stream provides a new one
        if (continueResult.responseMessageId !== null) {
          responseMessageId = continueResult.responseMessageId;
        }
        logger.info(`[DeepSeek] Auto-continue attempt ${continuationCount} result | incomplete=${continueResult.incomplete} | newMsgId=${continueResult.responseMessageId ?? 'unchanged'} | session=${sessionId}`);
      }

      if (continuationCount >= MAX_CONTINUATIONS && incomplete) {
        logger.warn(
          `[DeepSeek] Max continuations reached | session=${sessionId} | totalAttempts=${continuationCount}`,
        );
      }

      // Signal that all continuations are done — Zen uses this to know the merged response is complete
      if (continuationCount > 0 && onMetadata) {
        onMetadata({ continuing: false, continuation_complete: true, total_continuations: continuationCount });
      }

      onDone();
    } catch (err: any) {
      onError(err);
    }
  }

  private async getLastMessageId(
    client: HttpClient,
    sessionId: string,
  ): Promise<string | null> {
    try {
      const res = await client.get(
        `/api/v0/chat/history_messages?chat_session_id=${sessionId}&count=20`,
      );
      if (res.ok) {
        const data = await res.json();
        const messages = data?.data?.biz_data?.chat_messages || [];
        const lastAssistant = [...messages]
          .reverse()
          .find((m: any) => m.role && m.role.toUpperCase() === 'ASSISTANT');
        return lastAssistant?.message_id || null;
      }
    } catch (e) {}
    return null;
  }

  async stopStream(credential: string, chatId: string, messageId: string) {
    const client = this.createClient(credential);
    await client.post('/api/v0/chat/stop_generation', {
      chat_session_id: chatId,
      current_message_id: messageId,
    });
  }

  async uploadFile(credential: string, file: any) {
    const baseHeaders = {
      Cookie: `DS-AUTH-TOKEN=${credential}`,
      Authorization: credential,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Origin: 'https://chat.deepseek.com',
      Referer: 'https://chat.deepseek.com/',
    };

    const client = this.createClient(credential);

    try {
      const challengeRes = await client.post(
        '/api/v0/chat/create_pow_challenge',
        { target_path: '/api/v0/file/upload_file' },
      );

      let powResponseBase64 = '';
      if (challengeRes.ok) {
        try {
          const challengeJson = await challengeRes.json();
          const challengeData = challengeJson?.data?.biz_data?.challenge;

          if (challengeData) {
            logger.info('[DeepSeek Upload] Solving PoW...');
            const powAnswer = await this.solvePoW(challengeData);
            powResponseBase64 = Buffer.from(JSON.stringify(powAnswer)).toString(
              'base64',
            );
          }
        } catch (e) {
          logger.warn(
            '[DeepSeek Upload] Failed to parse PoW challenge response, continuing without PoW token',
            e,
          );
        }
      }

      const boundary =
        '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
      const crlf = '\r\n';
      const header = `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${file.originalname}"${crlf}Content-Type: ${file.mimetype}${crlf}${crlf}`;
      const footer = `${crlf}--${boundary}--${crlf}`;
      const payloadBuffer = Buffer.concat([
        Buffer.from(header),
        file.buffer,
        Buffer.from(footer),
      ]);

      const headers: any = {
        ...baseHeaders,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'x-client-locale': 'en_US',
        'x-app-version': '20241129.1',
        'x-client-version': '1.6.1',
        'x-client-platform': 'web',
        'x-file-size': file.buffer.length.toString(),
      };

      if (powResponseBase64) {
        headers['X-Ds-Pow-Response'] = powResponseBase64;
      }

      const uploadRes = await fetch(
        'https://chat.deepseek.com/api/v0/file/upload_file',
        {
          method: 'POST',
          headers,
          body: payloadBuffer,
        },
      );

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(
          `DeepSeek Upload Failed ${uploadRes.status}: ${errorText}`,
        );
      }

      const result: any = await uploadRes.json();
      if (result.code === 0 && result.data?.biz_data?.id) {
        const fileId = result.data.biz_data.id;
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          try {
            const listRes = await client.get(
              `/api/v0/file/fetch_files?file_ids=${fileId}`,
            );
            if (listRes.ok) {
              const listData = await listRes.json();
              const files = listData?.data?.biz_data?.files || [];
              const targetFile = files.find((f: any) => f.id === fileId);

              if (targetFile) {
                if (
                  targetFile.status === 'SUCCESS' ||
                  targetFile.status === 'READY'
                ) {
                  return {
                    id: fileId,
                    token_usage: targetFile.token_usage || 0,
                  };
                }
                if (
                  targetFile.status === 'FAIL' ||
                  targetFile.status === 'ERROR'
                ) {
                  throw new Error(
                    `File processing failed: ${targetFile.status}`,
                  );
                }
              }
            }
          } catch (e) {}
          attempts++;
        }
        return { id: fileId, token_usage: 0 };
      } else {
        throw new Error(`Upload failed: ${result.msg || 'Unknown error'}`);
      }
    } catch (error) {
      logger.error('[DeepSeek Upload] Error:', error);
      throw error;
    }
  }

  private createClient(credential: string) {
    return new HttpClient({
      baseURL: 'https://chat.deepseek.com',
      headers: {
        Cookie: `DS-AUTH-TOKEN=${credential}`,
        Authorization: credential,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
  }

  registerRoutes(router: Router) {
    router.post('/files', async (req, res) => {
      res.json({ id: 'mock-id-uploaded' });
    });
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return (
      m.includes('deepseek-chat') ||
      m.includes('deepseek-reasoner') ||
      m.includes('deepseek-instant') ||
      m.includes('deepseek-expert')
    );
  }
}

export default new DeepSeekProvider();
