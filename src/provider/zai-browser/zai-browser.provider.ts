import { Provider, SendMessageOptions } from '../../types';
import { Router } from 'express';
import { createLogger } from '../../utils/logger';
import { proxyHandler } from './zai-browser.proxy-handler';
import { parseZaiBrowserCredential } from './zai-browser.helpers';
import {
  findBrowserAccountsByProvider,
  updateAccountLastUsed,
} from '../../repositories/account.repository';
import { loginViaCDP } from '../../services/browser-session.service';
import { getWebSocketServer } from '../../websocket-server';

const logger = createLogger('ZaiBrowserProvider');

export { proxyHandler };

export class ZaiBrowserProvider implements Provider {
  name = 'Z.AI Browser';
  defaultModel = 'GLM-5.1';
  proxyHandler = proxyHandler;

  private async ensureWebSocket(sessionId: string) {
    const wsServer = getWebSocketServer();

    // Check if already connected with this sessionId
    if (wsServer.isConnected(sessionId)) {
      return wsServer;
    }

    // Try to find any active content connection (extension connected with random ID)
    const anyConnectedSession = wsServer.getAnyConnectedContentSession();
    if (anyConnectedSession && anyConnectedSession !== sessionId) {
      logger.info(`[ZaiBrowser] Found active connection with session ${anyConnectedSession}, remapping to ${sessionId}`);
      // Rename the session to match our account ID
      wsServer.updateSessionId(anyConnectedSession, sessionId);
      // Wait a moment for the rename to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Send set_session_id to extension so it reconnects with correct ID
      wsServer.setAccountId(sessionId, sessionId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (wsServer.isConnected(sessionId)) {
        logger.info(`[ZaiBrowser] Successfully remapped session to ${sessionId}`);
        return wsServer;
      }
    }

    // Wait for extension to connect (max 30 seconds)
    logger.info('[ZaiBrowser] Waiting for extension to connect...');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        wsServer.off('connected', onConnected);
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

      // Check again in case it connected already
      if (wsServer.isConnected(sessionId)) {
        clearTimeout(timeout);
        wsServer.off('connected', onConnected);
        resolve();
      }
    });

    return wsServer;
  }

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
        description: 'Z.AI GLM-5.1 - Advanced language model with thinking mode and web search',
      },
      {
        id: 'GLM-5',
        name: 'GLM-5',
        is_thinking: true,
        max_context_length: null,
        is_search: true,
        is_image_upload: false,
        is_video_upload: false,
        description: 'Z.AI GLM-5 - Fast and efficient model with thinking capabilities',
      },
    ];
  }

  async getProfile(
    credential: string,
  ): Promise<{ email: string | null; name?: string; id?: string }> {
    const parsed = parseZaiBrowserCredential(credential);
    if (!parsed) {
      return { email: null };
    }

    const emailMatch = parsed.cookie.match(/email=([^;]+)/);
    if (emailMatch) {
      return { email: decodeURIComponent(emailMatch[1]) };
    }

    return { email: null };
  }

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

    // Get active browser session from accounts table
    const sessions = findBrowserAccountsByProvider('zai-browser');
    const session = sessions.length > 0 ? sessions[0] : null;
    if (!session) {
      onError(
        new Error(
          'No active browser session. Please create a session via POST /v1/browser-sessions/login or create a session manually.',
        ),
      );
      return;
    }

    // Update last_used_at
    updateAccountLastUsed(session.id);

    const wsSessionId = session.id;

    const lastMessage = messages[messages.length - 1];
    let prompt = lastMessage.content;

    // Determine if this is a new chat
    const isNewChat = !conversationId || conversationId.trim() === '';

    // Strip system prompt wrapper for continuation messages
    if (!isNewChat) {
      const userContentMatch = prompt.match(
        /<zen-user-content>([\s\S]*?)<\/zen-user-content>/,
      );
      if (userContentMatch && userContentMatch[1]) {
        prompt = userContentMatch[1].trim();
        logger.debug(
          `[ZaiBrowser] Stripped system prompt, sending only user content (${prompt.length} chars)`,
        );
      }
    }

    try {
      const wsServer = await this.ensureWebSocket(wsSessionId);

      // Sync session ID with extension
      wsServer.setAccountId(wsSessionId, session.id);

      // Reset page if this is a new chat
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
        onUsage: (usage: any) => {
          logger.info(
            `[ZaiBrowser] Usage: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`,
          );
        },
      });
    } catch (err: any) {
      logger.error('[ZaiBrowser] Error sending message:', err);
      onError(err);
    }
  }

  async login(): Promise<{
    cookies: string;
    email?: string;
    pending?: boolean;
    tempSessionId?: string;
  }> {
    const loginUrl = 'https://chat.z.ai/';
    logger.info(`[ZaiBrowser] Starting login via CDP at ${loginUrl}`);

    try {
      const result = await loginViaCDP('zai-browser', loginUrl, 'zai-default');

      return {
        pending: true,
        tempSessionId: result.tempSessionId,
        cookies: '',
        email: '',
      };
    } catch (error: any) {
      logger.error('[ZaiBrowser] Login failed:', error);
      throw new Error(`Z.AI Browser login failed: ${error.message}`);
    }
  }

  isModelSupported(model: string): boolean {
    const m = model.toLowerCase();
    return m.includes('glm') || m.includes('z.ai') || m.includes('glm-5');
  }

  registerRoutes(router: Router): void {
    router.get('/auth/status', async (_req, res) => {
      const sessions = findBrowserAccountsByProvider('zai-browser');
      res.json({ authenticated: sessions.length > 0 });
    });
  }

  async disconnect(): Promise<void> {
    logger.info('[ZaiBrowser] Disconnect called (no-op for shared WebSocket)');
  }
}

export default new ZaiBrowserProvider();
