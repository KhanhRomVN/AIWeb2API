/**
 * ------------------------------------------------------------------
 * Qwen Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Qwen AI (Alibaba Cloud).
 * Hỗ trợ login qua browser, chat completion với streaming,
 * thinking mode, search, và token auto-refresh.
 *
 * Main features:
 * - login()                : Đăng nhập qua browser
 * - handleMessage()        : Gửi tin nhắn với streaming response
 * - refreshToken()         : Tự động refresh token khi hết hạn
 * - getModels()            : Lấy danh sách models từ API hoặc fallback
 * - getProfile()           : Lấy thông tin user profile
 * - Session locking        : Ngăn concurrent requests trên cùng session
 * - Parent ID caching      : Cache parent_id để tránh lỗi sibling
 *
 * Credential format (JSON string hoặc raw JWT):
 * - accessToken         : JWT access token (tự động refresh qua API)
 *
 * Note: Qwen CHỈ dùng accessToken qua Authorization header.
 *       KHÔNG dùng Cookie hay User-Agent.
 *       Token được refresh bằng cách gửi accessToken hiện tại lên /api/v1/auths/
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as crypto from 'crypto';
import fetch from 'node-fetch';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Services ──
import { loginService } from '../../services/login.service';
import { proxyEvents } from '../../services/proxy.service';

// ── Database ──
import { getDb } from '../../database';
import { updateAccountCredential } from '../../repositories/account.repository';

// ── Utils ──
import { createLogger } from '../../utils/logger';
import { StreamingThinkingParser } from '../../utils/thinking-parser';
import {
  getJwtExpiry,
  isJwtExpired,
  isJwtExpiringSoon,
  coordinateTokenRefresh,
  DEFAULT_REFRESH_THRESHOLD_SEC,
} from '../../utils/jwt-helper';

// ── Qwen Imports ──
import { proxyHandler } from './qwen.proxy-handler';
import type { QwenCredential } from './qwen.types';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  IS_MEMORY,
  BASE_URL,
  QWEN_EVENTS,
  API_VERSION,
  BX_VERSION,
  USER_AGENT,
} from './qwen.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('QwenProvider');

// ─── Session Lock ──────────────────────────────────────────────────────

const sessionLocks = new Map<string, Promise<void>>();

function acquireLock(key: string): {
  promise: Promise<void>;
  release: () => void;
} {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = sessionLocks.get(key) ?? Promise.resolve();
  sessionLocks.set(
    key,
    previous.then(() => next),
  );
  return { promise: previous, release };
}

// ─── Parent ID Cache ───────────────────────────────────────────────────

const lastParentIdCache = new Map<string, string>();

// ─── Provider Class ────────────────────────────────────────────────────

export class QwenProvider implements Provider {
  name = 'Qwen';
  proxyHandler = proxyHandler;

  // ─── Provider Configuration ────────────────────────────────────────
  static config = {
    provider_id: PROVIDER_ID,
    provider_name: PROVIDER_NAME,
    is_enabled: IS_ENABLED,
    website_url: WEBSITE_URL,
    auth_method: AUTH_METHOD,
    connection_type: CONNECTION_TYPE,
    is_pausable: IS_PAUSABLE,
    is_memory: IS_MEMORY,
  };

  // ─── Token Helpers ─────────────────────────────────────────────────

  private parseCredential(credential: string): {
    token: string | null;
    cookieValue: string;
    bxUa: string;
    bxUmidToken: string;
    userAgent: string;
  } {
    // Try parsing as JSON first
    if (credential.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(credential);

        // New format: {accessToken, ...} or old format: {token, bxUa, ...}
        const token =
          parsed.accessToken || parsed.access_token || parsed.token || null;

        return {
          token,
          cookieValue: token ? `token=${token}` : '',
          bxUa: parsed.bxUa || '',
          bxUmidToken: parsed.bxUmidToken || '',
          userAgent: parsed.userAgent || USER_AGENT,
        };
      } catch {
        logger.warn(
          '[Qwen] Credential is not valid JSON, treating as raw token',
        );
      }
    }

    // Check if raw JWT token
    if (credential.trim().startsWith('eyJ')) {
      const token = credential.trim();
      return {
        token,
        cookieValue: `token=${token}`,
        bxUa: '',
        bxUmidToken: '',
        userAgent: USER_AGENT,
      };
    }

    // Try extracting from cookie format: token=eyJ...
    const m = credential.match(/(?:^|;\s*)token=(eyJ[^;]+)/);
    if (m && m[1]) {
      return {
        token: m[1],
        cookieValue: credential,
        bxUa: '',
        bxUmidToken: '',
        userAgent: USER_AGENT,
      };
    }

    // Fallback: treat as raw token
    return {
      token: credential,
      cookieValue: `token=${credential}`,
      bxUa: '',
      bxUmidToken: '',
      userAgent: USER_AGENT,
    };
  }

  private extractToken(credential: string): string | null {
    return this.parseCredential(credential).token;
  }

  // JWT helpers are now in shared utils/jwt-helper.ts

  private async performTokenRefresh(
    credential: string,
  ): Promise<string | null> {
    const accessToken = this.extractToken(credential);
    if (!accessToken) return null;

    try {
      const response = await fetch(`${BASE_URL}/api/v1/auths/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          source: 'web',
          version: API_VERSION,
        },
      });

      if (!response.ok) {
        logger.warn(`[Qwen] Token refresh failed: HTTP ${response.status}`);
        return null;
      }

      const json: any = await response.json();
      const userData = json.data ?? json;
      const newAccessToken: string | undefined = userData?.token;

      if (!newAccessToken) {
        logger.warn('[Qwen] Token refresh response had no token field');
        return null;
      }

      if (newAccessToken === accessToken) {
        return newAccessToken;
      }

      const email: string | undefined = userData?.email;
      if (email) {
        try {
          const db = getDb();
          const accounts = db
            .prepare(
              "SELECT * FROM accounts WHERE LOWER(provider_id) = 'qwen' AND LOWER(email) = ?",
            )
            .all(email.toLowerCase()) as any[];
          for (const acc of accounts) {
            updateAccountCredential(acc.id, newAccessToken);
          }
        } catch (e) {
          logger.error('[Qwen] Failed to persist refreshed token to DB:', e);
        }
      }

      return newAccessToken;
    } catch (e) {
      logger.error('[Qwen] Token refresh error:', e);
      return null;
    }
  }

  async refreshToken(credential: string): Promise<string | null> {
    const accessToken = this.extractToken(credential);
    if (!accessToken) return null;

    // Use coordinated refresh to prevent duplicate refresh operations
    return coordinateTokenRefresh('qwen', accessToken, () =>
      this.performTokenRefresh(credential),
    );
  }

  private async getFreshCredential(credential: string): Promise<string> {
    const accessToken = this.extractToken(credential);
    if (!accessToken) return credential;

    // Check if token is already expired
    if (isJwtExpired(accessToken)) {
      logger.error('[Qwen] Token has already expired. Please login again.');
      throw new Error('Token has expired. Please login again to Qwen.');
    }

    // Check if token is expiring soon (within 5 minutes by default)
    if (!isJwtExpiringSoon(accessToken, DEFAULT_REFRESH_THRESHOLD_SEC)) {
      return credential;
    }

    const newAccessToken = await this.refreshToken(credential);
    if (!newAccessToken) {
      logger.error(
        '[Qwen] Token refresh failed - token may be expired. Please login again.',
      );
      throw new Error('Token refresh failed. Please login again to Qwen.');
    }

    return newAccessToken;
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login() {
    let capturedHeaders: Record<string, string> = {};
    const self = this;

    const onHeaders = (headers: Record<string, string>) => {
      capturedHeaders = { ...capturedHeaders, ...headers };
    };

    proxyEvents.on(QWEN_EVENTS.HEADERS, onHeaders);

    try {
      return await loginService.captureCredentialsViaCDP({
        providerId: 'qwen',
        loginUrl: `${BASE_URL}/auth`,
        partition: `qwen-${Date.now()}`,
        cookieEvent: QWEN_EVENTS.LOGIN_TOKEN,
        infoEvent: QWEN_EVENTS.LOGIN_EMAIL,
        extraEvents: [QWEN_EVENTS.HEADERS, QWEN_EVENTS.COOKIES],
        validate: async (data: {
          cookies: string;
          headers?: any;
          email?: string;
        }) => {
          if (!data.cookies) return { isValid: false };

          // Extract access token
          const accessToken = data.cookies.trim().startsWith('eyJ')
            ? data.cookies.trim()
            : (data.cookies.match(/token=(eyJ[^;]+)/) || [])[1] || data.cookies;

          if (!accessToken || !accessToken.startsWith('eyJ')) {
            logger.warn('[Qwen] Login validation failed: invalid token format');
            return { isValid: false };
          }

          let email = data.email || null;

          // Try fetching profile to get email
          if (!email) {
            try {
              const profile = await this.getProfile(
                accessToken,
                capturedHeaders,
              );
              if (profile.email) {
                email = profile.email;
              }
            } catch (e) {
              logger.warn('[Qwen] Login profile fetch failed:', e);
            }
          }

          return {
            isValid: true,
            cookies: accessToken, // Return raw JWT token
            email,
            headers: capturedHeaders,
          };
        },
      });
    } finally {
      proxyEvents.off(QWEN_EVENTS.HEADERS, onHeaders);
    }
  }

  // ─── List Chats ─────────────────────────────────────────────────────

  private async fetchListChats(credential: string): Promise<void> {
    try {
      const accessToken = this.extractToken(credential);

      if (!accessToken) {
        logger.warn('[Qwen] Cannot fetch list chats: no token found');
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        source: 'web',
        version: API_VERSION,
        'bx-v': BX_VERSION,
        'x-request-id': crypto.randomUUID(),
        'sec-ch-ua-platform': '"Linux"',
        'sec-ch-ua':
          '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'sec-ch-ua-mobile': '?0',
      };

      const response = await fetch(
        `${BASE_URL}/api/v2/chats/?page=1&exclude_project=true`,
        { headers },
      );

      if (response.ok) {
      } else {
        logger.warn(`[Qwen] Failed to fetch list chats: ${response.status}`);
      }
    } catch (error) {
      logger.error('[Qwen] Error fetching list chats:', error);
      throw error;
    }
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getProfile(
    credential: string,
    extraHeaders?: any,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    try {
      const accessToken = this.extractToken(credential);

      if (!accessToken) {
        logger.warn('[Qwen] Cannot get profile: no token found');
        return { email: null };
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        source: 'web',
        version: API_VERSION,
      };

      const response = await fetch(`${BASE_URL}/api/v1/auths/`, {
        headers,
      });

      if (response.ok) {
        const json: any = await response.json();
        const userData = json.data ?? json;
        if (!userData?.email) {
          logger.warn('[Qwen] Get Profile response missing email field');
        }
        return {
          email: userData?.email || null,
          name: userData?.name,
          id: userData?.id,
        };
      }
      logger.warn(`[Qwen] Get Profile returned status ${response.status}`);
      return { email: null };
    } catch (e) {
      logger.error('[Qwen] Get Profile Error:', e);
      return { email: null };
    }
  }

  // ─── Create Chat ────────────────────────────────────────────────────

  private async createChat(
    credential: string,
    model: string,
  ): Promise<string> {
    const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
      this.parseCredential(credential);

    if (!token) {
      throw new Error('[Qwen] Cannot create chat: no token found');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      accept: 'application/json, text/plain, */*',
      'User-Agent': userAgent || USER_AGENT,
      Cookie: cookieValue || `token=${token}`,
      source: 'web',
      version: API_VERSION,
      Referer: `${BASE_URL}/c/new-chat`,
      Origin: BASE_URL,
      'X-Request-Id': crypto.randomUUID(),
      'sec-ch-ua':
        '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'Accept-Language': 'en-US,en;q=0.9',
      Timezone:
        new Date().toDateString() +
        ' ' +
        new Date().toTimeString().split(' ')[0] +
        ' GMT+0700',
      'bx-v': BX_VERSION,
    };

    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (bxUa) headers['bx-ua'] = bxUa;
    if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

    const response = await fetch(`${BASE_URL}/api/v2/chats/new`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        chatId: '',
        models: [model],
        project_id: '',
        timestamp: Date.now(),
        chat_type: 't2t',
        chat_mode: 'normal',
      }),
    });

    const actualStatusCode = response.headers.get('x-actual-status-code');
    if (actualStatusCode && actualStatusCode !== '200') {
      const errorText = await response.text();
      throw new Error(`Create chat failed: ${actualStatusCode} - ${errorText}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Create chat failed: ${response.status} - ${errorText}`);
    }

    const json = await response.json();

    // Check if response indicates error (even with 200 status)
    if (json.success === false) {
      const errorCode = json.data?.code || 'unknown';
      const errorDetails = json.data?.details || JSON.stringify(json);
      throw new Error(`Create chat failed: ${errorCode} - ${errorDetails}`);
    }

    const chatId = json.data?.id || json.id;

    if (!chatId) {
      throw new Error(`No chat_id in response: ${JSON.stringify(json)}`);
    }

    return chatId;
  }

  // ─── Get Last Message ID ────────────────────────────────────────────

  private async getLastMessageId(
    conversationId: string,
    credential: string,
  ): Promise<string | null> {
    const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
      this.parseCredential(credential);

    const headers: Record<string, string> = {
      Cookie: cookieValue || `token=${token}`,
      'User-Agent': userAgent || USER_AGENT,
      accept: 'application/json',
      source: 'web',
      version: API_VERSION,
      'x-request-id': crypto.randomUUID(),
      'X-Request-Id': crypto.randomUUID(),
      'sec-ch-ua-platform': '"Linux"',
      'bx-v': BX_VERSION,
      Referer: `${BASE_URL}/c/${conversationId}`,
      'Accept-Language': 'en-US,en;q=0.9',
      Timezone:
        new Date().toDateString() +
        ' ' +
        new Date().toTimeString().split(' ')[0] +
        ' GMT+0700',
      'sec-ch-ua':
        '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
    };

    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (bxUa) headers['bx-ua'] = bxUa;
    if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

    const response = await fetch(
      `${BASE_URL}/api/v2/chats/${conversationId}/messages/`,
      { headers },
    );
    if (!response.ok) {
      logger.warn(
        `[Qwen] Failed to fetch last message ID: HTTP ${response.status}`,
      );
      return null;
    }

    const json = await response.json();
    const messages = json.messages || json.data || [];
    if (messages.length > 0) {
      const lastAssistant = [...messages]
        .reverse()
        .find((m: any) => m.role === 'assistant');
      return lastAssistant?.id || null;
    }
    return null;
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const { messages, onContent, onThinking, onMetadata, onDone, onError } =
      options;
    const onSessionCreated = options.onSessionCreated;
    let { conversationId } = options;

    let modelToUse = options.model;
    if (modelToUse.includes('/')) {
      modelToUse = modelToUse.split('/').pop() || modelToUse;
    }
    modelToUse = modelToUse.trim();

    if (modelToUse.startsWith('qwen-3.')) {
      modelToUse = modelToUse.replace('qwen-', 'qwen');
    }

    const lockKey = conversationId || options.accountId || 'qwen_default';
    const { promise: previousLock, release } = acquireLock(lockKey);

    try {
      await previousLock;

      const credential = await this.getFreshCredential(options.credential);
      const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
        this.parseCredential(credential);

      if (!token) {
        throw new Error('[Qwen] No access token found');
      }

      const isNewChat = !conversationId;

      if (isNewChat) {
        conversationId = await this.createChat(credential, modelToUse);
        if (onSessionCreated) onSessionCreated(conversationId);
        if (onMetadata) onMetadata({ conversation_id: conversationId });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const requestId = crypto.randomUUID();
      const timezone = `${new Date().toDateString()} ${new Date().toTimeString().split(' ')[0]} GMT+0700`;

      const lastMsg = messages[messages.length - 1];
      const msgFid = crypto.randomUUID();

      let parentId: string | null = options.parent_message_id ?? null;

      if (!parentId && conversationId && !isNewChat) {
        const cached = lastParentIdCache.get(conversationId);
        if (cached) {
          parentId = cached;
        } else {
          try {
            parentId = await this.getLastMessageId(conversationId, credential);
          } catch (e) {
            logger.warn('[Qwen] Failed to fetch last message ID');
          }
        }
      }

      const payload = {
        stream: true,
        version: '2.1',
        incremental_output: true,
        chatId: conversationId || '',
        parentId: parentId || '',
        ...(conversationId && { chat_id: conversationId }),
        chat_mode: 'normal',
        model: modelToUse,
        parent_id: parentId as string | null,
        messages: [
          {
            id: null,
            fid: msgFid,
            parentId: parentId as string | null,
            childrenIds: [] as string[],
            role: lastMsg.role,
            content: lastMsg.content,
            user_action: 'chat',
            files: [],
            timestamp: nowSec,
            models: [modelToUse],
            model: '',
            chat_type: 't2t',
            feature_config: {
              thinking_enabled: false,
              output_schema: 'phase',
              research_mode: 'normal',
              auto_thinking: false,
              thinking_mode: 'Fast',
              auto_search: true,
            },
            extra: { meta: { subChatType: 't2t' } },
            sub_chat_type: 't2t',
            parent_id: parentId as string | null,
          },
        ],
        timestamp: nowSec,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'User-Agent': userAgent || USER_AGENT,
        Cookie: cookieValue || `token=${token}`,
        Origin: BASE_URL,
        Referer: conversationId ? `${BASE_URL}/c/${conversationId}` : BASE_URL,
        'x-accel-buffering': 'no',
        'X-Accel-Buffering': 'no',
        'x-request-id': requestId,
        'X-Request-Id': requestId,
        source: 'web',
        version: API_VERSION,
        'bx-v': BX_VERSION,
        timezone,
        Timezone: timezone,
        'accept-language': 'en-US,en;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-ch-ua':
          '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
      };

      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (bxUa) headers['bx-ua'] = bxUa;
      if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

      const url = conversationId
        ? `${BASE_URL}/api/v2/chat/completions?chat_id=${conversationId}`
        : `${BASE_URL}/api/v2/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const actualStatusCode = response.headers.get('x-actual-status-code');
      if (actualStatusCode && actualStatusCode !== '200') {
        const errText = await response.text();
        logger.error(
          `[Qwen] API returned error via x-actual-status-code=${actualStatusCode}:`,
          errText.slice(0, 500),
        );
        throw new Error(
          `Qwen API Error ${actualStatusCode}: ${errText.slice(0, 500)}`,
        );
      }

      if (!response.ok) {
        const errText = await response.text();
        logger.error(
          `[Qwen] API returned HTTP error ${response.status}:`,
          errText.slice(0, 500),
        );
        throw new Error(
          `Qwen API Error ${response.status}: ${errText.slice(0, 500)}`,
        );
      }

      if (!response.body) {
        logger.error('[Qwen] Response body is null/undefined');
        throw new Error('No response body');
      }

      let buffer = '';
      let conversationIdCaptured = false;
      let parentIdCaptured = false;
      let capturedParentId: string | null = null;
      const thinkingParser = new StreamingThinkingParser(onContent, onThinking);
      let totalContentReceived = 0;
      let totalChunksProcessed = 0;

      for await (const chunk of response.body as any) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let jsonStr = trimmed;
          if (trimmed.startsWith('data: ')) {
            jsonStr = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            jsonStr = trimmed.slice(5).trim();
          } else {
            continue;
          }

          if (jsonStr === '[DONE]') {
            thinkingParser.flush();
            onDone();
            return;
          }

          try {
            const json = JSON.parse(jsonStr);
            totalChunksProcessed++;

            let responseCreated = null;
            if (json['response.created']) {
              responseCreated = json['response.created'];
            } else if (json.response && json.response.created) {
              responseCreated = json.response.created;
            }

            if (responseCreated) {
              if (
                isNewChat &&
                !conversationIdCaptured &&
                responseCreated.chat_id
              ) {
                conversationIdCaptured = true;
                if (onSessionCreated) onSessionCreated(responseCreated.chat_id);
                if (onMetadata)
                  onMetadata({ conversation_id: responseCreated.chat_id });
              }

              if (!parentIdCaptured && responseCreated.response_id) {
                parentIdCaptured = true;
                capturedParentId = responseCreated.response_id;
                const chatIdForCache =
                  responseCreated.chat_id || conversationId;
                if (chatIdForCache && capturedParentId) {
                  lastParentIdCache.set(chatIdForCache, capturedParentId);
                }
                if (onMetadata)
                  onMetadata({ parent_message_id: capturedParentId });
              }
            }

            const delta = json.choices?.[0]?.delta;
            if (delta?.reasoning_content && onThinking) {
              onThinking(delta.reasoning_content);
            }

            if (delta?.content) {
              totalContentReceived += delta.content.length;
              thinkingParser.feed(delta.content);
            } else if (delta && totalChunksProcessed <= 10) {
              // Log when delta exists but has no content
            }
          } catch (e) {
            logger.warn('[Qwen] Failed to parse SSE line:', e);
          }
        }
      }

      // If we have remaining buffer content and no chunks were processed, it might be an error response
      if (buffer.length > 0 && totalChunksProcessed === 0) {
        logger.error(
          `[Qwen] Received non-streaming response (possible error):`,
          buffer,
        );
        try {
          const errorJson = JSON.parse(buffer);
          const errorMessage =
            errorJson.message ||
            errorJson.error ||
            errorJson.data?.message ||
            JSON.stringify(errorJson);
          throw new Error(`Qwen API returned error: ${errorMessage}`);
        } catch (parseErr) {
          // If not JSON, log raw content
          logger.error(`[Qwen] Raw response content:`, buffer.slice(0, 1000));
          throw new Error(
            `Qwen API returned non-streaming response: ${buffer.slice(0, 200)}`,
          );
        }
      }

      thinkingParser.flush();

      // Log summary before completing
      if (totalContentReceived === 0) {
        logger.warn(
          `[Qwen] No content received from API for model=${modelToUse}, conversationId=${conversationId}`,
        );
      }

      if (capturedParentId && onMetadata) {
        onMetadata({ last_parent_id: capturedParentId });
      }
      onDone();
    } catch (err: any) {
      logger.error('[Qwen] handleMessage error:', err);
      onError(err);
    } finally {
      release();
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Get Models ─────────────────────────────────────────────────────

  async getModels(credential: string): Promise<any[]> {
    const { token, cookieValue, bxUa, bxUmidToken, userAgent } =
      this.parseCredential(credential);

    const headers: Record<string, string> = {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      cookie: cookieValue || (token ? `token=${token}` : ''),
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
      'user-agent': userAgent || USER_AGENT,
      'x-request-id': crypto.randomUUID(),
      'sec-ch-ua-platform': '"Linux"',
      'sec-ch-ua':
        '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      source: 'web',
      version: API_VERSION,
      'bx-v': BX_VERSION,
      timezone:
        new Date().toDateString() +
        ' ' +
        new Date().toTimeString().split(' ')[0] +
        ' GMT+0700',
      'accept-language': 'en-US',
    };

    if (token) headers['authorization'] = `Bearer ${token}`;
    if (bxUa) headers['bx-ua'] = bxUa;
    if (bxUmidToken) headers['bx-umidtoken'] = bxUmidToken;

    try {
      const response = await fetch(`${BASE_URL}/api/v2/models/`, {
        headers,
        timeout: 10000,
      } as any);

      if (response.ok) {
        const json: any = await response.json();

        // Parse structure: {"success": true, "data": {"data": [...]}}
        const modelList =
          json?.data?.data || json?.data || (Array.isArray(json) ? json : null);

        if (modelList && Array.isArray(modelList) && modelList.length > 0) {
          return modelList
            .filter((model: any) => {
              // Filter active models only
              const info = model.info || {};
              return info.is_active === true;
            })
            .map((model: any) => {
              const info = model.info || {};
              const meta = info.meta || {};
              const capabilities = meta.capabilities || {};

              return {
                id: model.id || info.id,
                name: model.name || info.name || model.id,
                is_thinking: capabilities.thinking === true,
                max_context_length: meta.max_context_length || 1000000,
                is_search: capabilities.search === true,
                is_image_upload: capabilities.vision === true,
                description:
                  meta.short_description || meta.description || undefined,
              };
            });
        }
      } else {
        logger.warn(
          `[Qwen] Failed to fetch models from API: HTTP ${response.status}`,
        );
      }
    } catch (e) {
      logger.warn('[Qwen] Failed to fetch models from API:', e);
    }

    // Return empty array if API fetch fails - no hardcoded fallback
    logger.warn('[Qwen] No models available from API');
    return [];
  }

  // ─── Model Support ──────────────────────────────────────────────────

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('qwen') || m.startsWith('qwen-');
  }
}

export default new QwenProvider();
