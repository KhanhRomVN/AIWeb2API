import express from 'express';
import { ZChat } from '../../z';
import { RateLimiter } from '../../rate-limiter';
import { isWAFError } from '../utils/sanitizer';
import { writeSSEHeaders } from '../utils/sse';

// ============================================================
// webui.ts — Z.AI Web UI Mock API endpoints (/api/*)
// Tách từ server.ts (lines 617–825).
// Phục vụ Offline Z.AI Web UI, không dùng MappingService
// vì không cần history resume.
// ============================================================

export function webuiRouter(
    chatEngine: ZChat,
    getInitStatus: () => { isInitialized: boolean; initError: string | null }
): express.Router {
    const router = express.Router();

    // ---- Static config mocks ----

    router.get('/api/config', (req, res) => {
        res.json({ success: true, data: { enable_captcha: false } });
    });

    router.get('/api/models', (req, res) => {
        res.json({
            success: true,
            data: [
                {
                    id: 'glm-5-turbo',
                    name: 'GLM-5-Turbo',
                    direct: true,
                    info: { meta: { capabilities: { returnThink: true } } }
                }
            ]
        });
    });

    router.get('/api/v1/users/default/permissions', (req, res) => {
        res.json({ success: true, data: { chat: { file_upload: true } } });
    });

    router.get('/api/v1/users/user/settings', (req, res) => {
        res.json({ success: true, data: { ui: { theme: 'dark' } } });
    });

    router.get('/api/v1/auths', (req, res) => {
        res.json({
            success: true,
            data: {
                id: 'z-account',
                email: 'user@chat.z.ai',
                name: 'User',
                role: 'admin',
                permissions: { chat: { file_upload: true } }
            }
        });
    });

    // ---- Chat history mocks (always empty — Z.AI Web UI manages its own history) ----

    router.get('/api/v1/chats', (req, res) => res.json({ success: true, data: [] }));
    router.get('/api/v1/chats/pinned', (req, res) => res.json({ success: true, data: [] }));
    router.get('/api/v1/chats/archived', (req, res) => res.json({ success: true, data: [] }));
    router.get('/api/v1/chats/all/tags', (req, res) => res.json({ success: true, data: [] }));

    router.get('/api/v1/chats/:chatId', (req, res) => {
        res.json({
            success: true,
            data: {
                id: req.params.chatId,
                title: 'New Chat',
                history: { currentId: null, messages: {} },
                models: ['glm-5-turbo']
            }
        });
    });

    router.get('/api/v1/chats/:chatId/pinned', (req, res) => {
        res.json({ success: true, data: false });
    });

    router.post('/api/v1/chats/:chatId/messages/batch', (req, res) => {
        res.json({ success: true, data: {} });
    });

    router.post('/api/v1/chats/new', (req, res) => {
        res.json({
            success: true,
            data: {
                id: req.body.chat?.id || 'chat-' + Date.now(),
                title: 'New Chat',
                history: { currentId: null, messages: {} },
                models: ['glm-5-turbo']
            }
        });
    });

    // ---- Chat completions handler (Z.AI Web UI native format) ----

    const handleApiChatCompletions = async (req: express.Request, res: express.Response) => {
        // ⭐ Rate limit check is delegated to chatEngine.chat internally.

        const { isInitialized, initError } = getInitStatus();
        if (initError) {
            res.status(500).json({ error: `Browser initialization failed: ${initError}` });
            return;
        }
        if (!isInitialized) {
            res.status(503).json({ error: 'Browser session is still initializing. Please wait.' });
            return;
        }

        const { messages, stream } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            res.status(400).json({ error: 'Missing or empty messages list.' });
            return;
        }

        const lastMessage = messages[messages.length - 1];
        let prompt = lastMessage.content;
        const resolvedConversationId =
            req.body.chat_id || req.body.conversationId || `z-session-${Date.now()}`;

        // Simple isNewChat — Web UI không cần conversation mapping
        const isNewChat = !req.body.chat_id;
        if (!isNewChat) {
            const userContentMatch = prompt.match(/<zen-user-content>([\s\S]*?)<\/zen-user-content>/);
            if (userContentMatch && userContentMatch[1]) {
                prompt = userContentMatch[1].trim();
            }
        }

        try {
            if (stream !== false) {
                // ---- SSE streaming (Z.AI Web UI format) ----
                writeSSEHeaders(res, chatEngine.rateLimiter);

                let currentPhase = 'thinking';

                try {
                    await chatEngine.chat(prompt, (token) => {
                        let sseToken = token;
                        if (token === '<thinking>') {
                            currentPhase = 'thinking';
                            sseToken = '';
                        } else if (token === '</thinking>') {
                            currentPhase = 'answer';
                            sseToken = '';
                        }

                        const sseData = {
                            type: 'chat:message:delta',
                            data: { delta_content: sseToken, phase: currentPhase }
                        };
                        res.write(`data: ${JSON.stringify(sseData)}\n\n`);
                        if ((res as any).flush) (res as any).flush();
                    }, resolvedConversationId, isNewChat);

                    res.write(`data: ${JSON.stringify({ type: 'chat:message', data: { done: true, phase: 'done' } })}\n\n`);
                } catch (err: any) {
                    console.error('[WebUI Route] Stream error:', err);
                    if (isWAFError(err.message || String(err))) {
                        console.log('[RateLimiter] 🚨 WAF-related error in WebUI stream, activating cooldown...');
                        chatEngine.reportWAFBlock();
                    }
                } finally {
                    res.write('data: [DONE]\n\n');
                    res.end();
                }
            } else {
                // ---- Non-streaming mode ----
                let accumulatedContent = '';
                await chatEngine.chat(prompt, (token) => {
                    if (token !== '<thinking>' && token !== '</thinking>') {
                        accumulatedContent += token;
                    }
                }, resolvedConversationId, isNewChat);

                res.json({
                    success: true,
                    messages: [
                        {
                            id: 'msg-' + Date.now(),
                            role: 'assistant',
                            content: accumulatedContent,
                            done: true
                        }
                    ]
                });
            }
        } catch (err: any) {
            console.error('[WebUI Route] Error in completions:', err);
            if (isWAFError(err.message || String(err))) {
                console.log('[RateLimiter] 🚨 WAF-related error detected in completions, activating cooldown...');
                chatEngine.reportWAFBlock();
            }
            if (!res.headersSent) {
                res.status(500).json({ error: err.message || String(err) });
            }
        }
    };

    router.post('/api/chat/completions', handleApiChatCompletions);
    router.post('/api/v2/chat/completions', handleApiChatCompletions);
    router.post('/api/agent/v2/chat/completions', handleApiChatCompletions);

    router.post('/api/chat/actions/:actionId', (req, res) => {
        if (req.body.messages) {
            handleApiChatCompletions(req, res);
        } else {
            res.json({ success: true, messages: [] });
        }
    });

    return router;
}
