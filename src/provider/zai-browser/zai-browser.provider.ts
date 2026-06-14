import { Provider, SendMessageOptions } from '../../types';
import { Router } from 'express';
import { createLogger } from '../../utils/logger';
import { proxyHandler } from './zai-browser.proxy-handler';
import { ZaiBrowserWebSocketManager } from './zai-browser.websocket';
import { parseZaiBrowserCredential } from './zai-browser.helpers';
import { ZaiBrowserExtensionManager } from './zai-browser.extension-manager';
import {
    getActiveBrowserSession,
    touchSession,
    parseBrowserCredential,
} from '../../services/browser-session.service';

const logger = createLogger('ZaiBrowserProvider');

export { proxyHandler };

export class ZaiBrowserProvider implements Provider {
    name = 'Z.AI Browser';
    defaultModel = 'GLM-5.1';
    proxyHandler = proxyHandler;

    private wsManager: ZaiBrowserWebSocketManager | null = null;
    private isExtensionValidated: boolean = false;

    constructor() {
        // Validate extension on startup
        this.validateExtension();
    }

    private validateExtension(): void {
        this.isExtensionValidated = ZaiBrowserExtensionManager.validateExtension();
        if (!this.isExtensionValidated) {
            logger.warn('[ZaiBrowser] Extension not found. Please copy extension to server/extensions/zai-bridge/');
        }
    }

    private async ensureWebSocket(): Promise<ZaiBrowserWebSocketManager> {
        if (!this.isExtensionValidated) {
            throw new Error('Z.AI Browser extension not installed. Please copy extension to server/extensions/zai-bridge/');
        }

        if (!this.wsManager) {
            this.wsManager = new ZaiBrowserWebSocketManager();
            this.wsManager.on('disconnected', () => {
                logger.warn('[ZaiBrowser] WebSocket disconnected');
            });
            this.wsManager.on('error', (err) => {
                logger.error('[ZaiBrowser] WebSocket error:', err);
            });
        }

        if (!this.wsManager.isConnected()) {
            await this.wsManager.connect();
        }

        return this.wsManager;
    }

    async getModels(credential: string, accountId?: string): Promise<any[]> {
        // Hardcoded models - không dùng bảng models
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

    async getProfile(credential: string): Promise<{ email: string | null; name?: string; id?: string }> {
        const parsed = parseZaiBrowserCredential(credential);
        if (!parsed) {
            return { email: null };
        }

        // Try to extract email from cookie
        const emailMatch = parsed.cookie.match(/email=([^;]+)/);
        if (emailMatch) {
            return { email: decodeURIComponent(emailMatch[1]) };
        }

        return { email: null };
    }

    async handleMessage(options: SendMessageOptions): Promise<void> {
        const {
            credential,
            messages,
            onContent,
            onThinking,
            onDone,
            onError,
            conversationId,
            search,
            thinking,
        } = options;

        const isSearch = search === true;
        const isThinking = thinking === true;

        // Get active browser session
        let session = getActiveBrowserSession('zai-browser');
        if (!session) {
            onError(new Error('No active browser session. Please create a session via POST /v1/browser-sessions/login or create a session manually.'));
            return;
        }

        // Touch session to update last_used_at
        touchSession(session.id);

        // Parse credential from session
        const parsed = parseBrowserCredential(session.credential);
        if (!parsed) {
            onError(new Error('Invalid credential format in browser session'));
            return;
        }

        const lastMessage = messages[messages.length - 1];
        let prompt = lastMessage.content;

        // Determine if this is a new chat
        const isNewChat = !conversationId || conversationId.trim() === '';

        // Strip system prompt wrapper for continuation messages
        if (!isNewChat) {
            const userContentMatch = prompt.match(/<zen-user-content>([\s\S]*?)<\/zen-user-content>/);
            if (userContentMatch && userContentMatch[1]) {
                prompt = userContentMatch[1].trim();
                logger.debug(`[ZaiBrowser] Stripped system prompt, sending only user content (${prompt.length} chars)`);
            }
        }

        try {
            const ws = await this.ensureWebSocket();

            // Reset page if this is a new chat
            if (isNewChat) {
                await ws.resetPage();
                // Wait a bit for page to reset
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            // Send prompt to extension
            const requestId = await ws.sendPrompt(prompt, isNewChat, isSearch);

            // Register handlers for this request
            ws.registerRequestHandler(requestId, {
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
                    logger.info(`[ZaiBrowser] Usage: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
                },
            });
        } catch (err: any) {
            logger.error('[ZaiBrowser] Error sending message:', err);
            onError(err);
        }
    }

    async login(): Promise<{ cookies: string }> {
        // Login is handled via browser-session service
        // This method is for compatibility with existing login flow
        throw new Error('Login for Z.AI Browser must be done via POST /v1/browser-sessions/login');
    }

    isModelSupported(model: string): boolean {
        const m = model.toLowerCase();
        return m.includes('glm') || m.includes('z.ai') || m.includes('glm-5');
    }

    registerRoutes(router: Router): void {
        router.get('/auth/status', async (_req, res) => {
            const session = getActiveBrowserSession('zai-browser');
            res.json({ authenticated: !!session });
        });
    }

    async disconnect(): Promise<void> {
        if (this.wsManager) {
            await this.wsManager.disconnect();
            this.wsManager = null;
        }
    }
}

export default new ZaiBrowserProvider();