/**
 * ------------------------------------------------------------------
 * Z.AI Browser Provider
 * ------------------------------------------------------------------
 * Provider implementation cho Z.AI Browser (browser-based).
 * Hỗ trợ login qua CDP, chat completion qua WebSocket bridge,
 * và session management với extension.
 *
 * Main features:
 * - login()          : Đăng nhập qua CDP browser
 * - handleMessage()  : Gửi tin nhắn qua WebSocket bridge
 * - getModels()      : Lấy danh sách models
 * - WebSocket        : Kết nối với extension bridge
 * - Session remapping: Tự động remap session ID
 *
 * Credential format:
 * - cookies          : Cookie string
 * - sessionId        : Browser session ID
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Types ──
import { Provider, SendMessageOptions } from '../../types';

// ── Repositories ──
import {
  findBrowserAccountsByProvider,
  updateAccountLastUsed,
} from '../../repositories/account.repository';

// ── Services ──
import { loginService } from '../../services/login.service';
import { getWebSocketServer } from '../../websocket-server';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── ZaiBrowser Imports ──
import { proxyHandler } from './zai-browser.proxy-handler';
import { parseZaiBrowserCredential } from './zai-browser.helpers';
import {
  PROVIDER_ID,
  PROVIDER_NAME,
  IS_ENABLED,
  WEBSITE_URL,
  AUTH_METHOD,
  CONNECTION_TYPE,
  IS_PAUSABLE,
  IS_MEMORY,
  PLATFORM,
  BROWSER_EXTENSION_FOLDER,
  MODELS,
} from './zai-browser.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ZaiBrowserProvider');

// ─── Provider Class ────────────────────────────────────────────────────

export class ZaiBrowserProvider implements Provider {
  name = 'Z.AI Browser';
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
    platform: PLATFORM,
    browser_extension_folder: BROWSER_EXTENSION_FOLDER,
    models: MODELS,
  };

  // ─── WebSocket Connection ──────────────────────────────────────────

  private async ensureWebSocket(sessionId: string) {
    const wsServer = getWebSocketServer();

    if (wsServer.isConnected(sessionId)) {
      return wsServer;
    }

    const anyConnectedSession = wsServer.getAnyConnectedContentSession();
    if (anyConnectedSession && anyConnectedSession !== sessionId) {
      wsServer.updateSessionId(anyConnectedSession, sessionId);
      await new Promise((resolve) => setTimeout(resolve, 500));

      wsServer.setAccountId(sessionId, sessionId);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (wsServer.isConnected(sessionId)) {
        return wsServer;
      }
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        wsServer.off('connected', onConnected);
        logger.error(
          '[ZaiBrowser] Extension connection timeout after 30 seconds',
        );
        reject(new Error('Extension connection timeout after 30 seconds'));
      }, 30000);

      const onConnected = (connectedSessionId: string) => {
        if (connectedSessionId === sessionId) {
          clearTimeout(timeout);
          wsServer.off('connected', onConnected);
          resolve();
        }
      };

      wsServer.on('connected', onConnected);

      if (wsServer.isConnected(sessionId)) {
        clearTimeout(timeout);
        wsServer.off('connected', onConnected);
        resolve();
      }
    });

    return wsServer;
  }

  // ─── Models ─────────────────────────────────────────────────────────

  async getModels(_credential: string, _accountId?: string): Promise<any[]> {
    return [
      {
        id: 'GLM-5.1',
        name: 'GLM-5.1',
        is_thinking: true,
        max_context_length: null,
        is_search: true,
        is_image_upload: false,
        is_video_upload: false,
        description:
          'Z.AI GLM-5.1 - Advanced language model with thinking mode and web search',
      },
      {
        id: 'GLM-5',
        name: 'GLM-5',
        is_thinking: true,
        max_context_length: null,
        is_search: true,
        is_image_upload: false,
        is_video_upload: false,
        description:
          'Z.AI GLM-5 - Fast and efficient model with thinking capabilities',
      },
    ];
  }

  // ─── Profile ────────────────────────────────────────────────────────

  async getUserProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const parsed = parseZaiBrowserCredential(credential);
    if (!parsed) {
      logger.warn('[ZaiBrowser] Get Profile: failed to parse credential');
      return { email: null };
    }

    const emailMatch = parsed.cookies.match(/email=([^;]+)/);
    if (emailMatch) {
      return { email: decodeURIComponent(emailMatch[1]) };
    }

    logger.warn('[ZaiBrowser] Get Profile: no email found in cookies');
    return { email: null };
  }

  // ─── Handle Message ─────────────────────────────────────────────────

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      messages,
      onContent,
      onThinking,
      onDone,
      onError,
      conversationId,
      search,
    } = options;

    const isSearch = search === true;

    const sessions = findBrowserAccountsByProvider('zai-browser');
    const session = sessions.length > 0 ? sessions[0] : null;
    if (!session) {
      logger.error('[ZaiBrowser] No active browser session found');
      onError(
        new Error(
          'No active browser session. Please create a session via POST /v1/browser-sessions/login',
        ),
      );
      return;
    }

    updateAccountLastUsed(session.id);

    const wsSessionId = session.id;

    const lastMessage = messages[messages.length - 1];
    let prompt = lastMessage.content;

    const isNewChat = !conversationId || conversationId.trim() === '';

    if (!isNewChat) {
      const userContentMatch = prompt.match(
        /<zen-user-content>([\s\S]*?)<\/zen-user-content>/,
      );
      if (userContentMatch && userContentMatch[1]) {
        prompt = userContentMatch[1].trim();
      }
    }

    try {
      const wsServer = await this.ensureWebSocket(wsSessionId);

      wsServer.setAccountId(wsSessionId, session.id);

      if (isNewChat) {
        await wsServer.resetPage(wsSessionId);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const requestId = await wsServer.sendPrompt(
        wsSessionId,
        prompt,
        isNewChat,
        isSearch,
      );

      wsServer.registerRequestHandler(wsSessionId, requestId, {
        onContent: (chunk: string) => {
          onContent(chunk);
        },
        onThinking: (chunk: string) => {
          if (onThinking) onThinking(chunk);
        },
        onDone: () => {
          onDone();
        },
        onError: (err: Error) => {
          onError(err);
        },
        onUsage: () => {},
      });
    } catch (err: any) {
      logger.error('[ZaiBrowser] Error sending message:', err);
      onError(err);
    }
  }

  // ─── Continue Message ───────────────────────────────────────────────

  async continueMessage(options: SendMessageOptions): Promise<void> {
    return this.handleMessage(options);
  }

  // ─── Login ──────────────────────────────────────────────────────────

  async login(): Promise<{ user_data_dir?: string }> {
    const loginUrl = 'https://chat.z.ai/';
    try {
      const result = await loginService.captureBrowserProfileViaCDP(
        'zai-browser',
        loginUrl,
        'zai-default',
      );

      return {
        user_data_dir: result.user_data_dir,
      };
    } catch (error: any) {
      logger.error('[ZaiBrowser] Login failed:', error);
      throw new Error(`Z.AI Browser login failed: ${error.message}`);
    }
  }

  // ─── Disconnect ─────────────────────────────────────────────────────

  async disconnect(): Promise<void> {}
}

export default new ZaiBrowserProvider();
