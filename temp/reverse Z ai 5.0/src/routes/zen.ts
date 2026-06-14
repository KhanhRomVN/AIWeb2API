import express from 'express';
import { ZChat } from '../../z';
import { RateLimiter } from '../../rate-limiter';
import { MappingService } from '../services/MappingService';
import { sanitizeToken, isWAFError } from '../utils/sanitizer';
import { writeSSEHeaders, createTokenFlusher, writeUsageEvent } from '../utils/sse';

// ============================================================
// zen.ts — Zen VSCode Extension API endpoints (/v1/*)
// Tách từ server.ts (lines 140–612).
// ============================================================

export function zenRouter(
    chatEngine: ZChat,
    mappingService: MappingService,
    getInitStatus: () => { isInitialized: boolean; initError: string | null }
): express.Router {
    const router = express.Router();

    // Optional token-based API authentication middleware.
    // Cho phép request không có header (tương thích Zen extension không gửi Auth).
    // Chỉ block khi header Authorization được gửi nhưng sai giá trị.
    router.use((req, res, next) => {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader !== 'Bearer zen-local-key') {
            console.warn(`[Zen Router] 🔒 Invalid auth token rejected: ${req.method} ${req.url}`);
            res.status(401).json({ error: 'Unauthorized. Invalid local API key.' });
            return;
        }
        next();
    });

    // ---- Info endpoints ----

    router.get('/v1/health', (req, res) => {
        res.json({
            status: 'ok',
            elara: 'khanhromvn/elara',
            timestamp: new Date().toISOString(),
            rateLimit: chatEngine.rateLimiter.getStatus(),
        });
    });

    router.post('/v1/tokenize', (req, res) => {
        const { text, messages } = req.body;

        let tokenCount = 0;
        if (messages && Array.isArray(messages)) {
            tokenCount = chatEngine.usageTracker.estimateMessagesTokens(messages);
        } else if (text && typeof text === 'string') {
            tokenCount = chatEngine.usageTracker.estimateTokens(text);
        } else {
            res.status(400).json({
                error: 'Provide either "text" (string) or "messages" (array) in request body.'
            });
            return;
        }

        res.json({
            success: true,
            token_count: tokenCount,
            estimation_method: 'heuristic',
            accuracy: '±15% (estimate only — Z.AI provides exact counts in chat responses)',
            model: 'GLM-5.1',
        });
    });

    router.get('/v1/usage', (req, res) => {
        const summary = chatEngine.usageTracker.getSummary();
        res.json({
            success: true,
            data: summary,
        });
    });

    router.get('/v1/providers', (req, res) => {
        res.json({
            success: true,
            message: 'Providers retrieved successfully',
            data: [
                {
                    provider_id: 'z',
                    provider_name: 'Z.AI',
                    is_enabled: true,
                    website: 'https://chat.z.ai/',
                    is_search: true,
                    is_upload: false,
                    auth_method: ['google', 'basic'],
                    is_temperature: false,
                    models: [
                        {
                            id: 'GLM-5.1',
                            name: 'GLM-5.1',
                            is_thinking: true,
                            context_length: null,
                            success_rate: 100,
                            max_req_conversation: 0,
                            max_token_conversation: 0
                        }
                    ],
                    connection_mode: 'headless_browser',
                    concurrency_mode: 'concurrent',
                    total_accounts: 1
                }
            ],
            meta: { timestamp: new Date().toISOString() }
        });
    });

    router.get('/v1/accounts', (req, res) => {
        res.json({
            success: true,
            message: 'Accounts retrieved successfully',
            data: {
                accounts: [
                    {
                        id: 'z-account',
                        provider_id: 'z',
                        email: 'user@chat.z.ai',
                        credential: 'dummy-credential'
                    }
                ],
                pagination: { total: 1, page: 1, limit: 1000, total_pages: 1 }
            },
            meta: { timestamp: new Date().toISOString() }
        });
    });

    router.get('/v1/stats', (req, res) => {
        res.json({ success: true, message: 'Stats retrieved successfully', data: { usage: [], models: [] } });
    });

    router.post('/v1/chat/pause', (req, res) => {
        res.json({ success: true });
    });

    // ---- Main chat completion handler ----

    const handleMessages = async (req: express.Request, res: express.Response) => {
        // ⭐ Rate limiting checks are handled internally inside ZChat (chatEngine.chat).
        // Removing double checking in router.

        const { isInitialized, initError } = getInitStatus();
        if (initError) {
            res.status(500).json({ error: `Browser initialization failed: ${initError}` });
            return;
        }
        if (!isInitialized) {
            res.status(503).json({ error: 'Browser session is still initializing. Please wait.' });
            return;
        }

        const { messages, conversationId, stream, is_search, search } = req.body;
        const useSearch = is_search === true || search === true;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            res.status(400).json({ error: 'Missing or empty messages list.' });
            return;
        }

        const lastMessage = messages[messages.length - 1];
        let prompt = lastMessage.content;
        const resolvedConversationId = conversationId || `z-session-${Date.now()}`;

        // 🔑 Kiểm tra qua MappingService để xác định chính xác cuộc chat mới từ Zen UUID
        const isActiveInMemory = mappingService.isActiveInMemory(resolvedConversationId);
        const isActiveInMapping = mappingService.has(resolvedConversationId);
        const isNewChat = !isActiveInMemory && !isActiveInMapping;

        // Debug: log conversationId để phân tích vấn đề
        console.log(`[Zen Route] conversationId from request: "${conversationId}" → resolved: "${resolvedConversationId}" | hasBrowserSession: ${chatEngine.hasBrowserSession}`);

        if (isNewChat) {
            mappingService.touch(resolvedConversationId);
            console.log(`[Zen Route] 🆕 New browser chat for: ${resolvedConversationId}`);
            console.log(`[Zen Route] First message: Sending full payload (Length: ${prompt.length})`);
        } else {
            mappingService.touch(resolvedConversationId);
            console.log(`[Zen Route] ➡️ Continuing browser chat for: ${resolvedConversationId}`);
            // Từ tin nhắn thứ 2: chỉ gửi nội dung user nhập để tăng tốc
            const userContentMatch = prompt.match(/<zen-user-content>([\s\S]*?)<\/zen-user-content>/);
            if (userContentMatch && userContentMatch[1]) {
                prompt = userContentMatch[1].trim();
                console.log(`[Zen Route] Stripped system prompt. Sending only user content (Length: ${prompt.length})`);
            }
        }

        try {
            if (stream !== false) {
                // ---- SSE streaming mode ----
                writeSSEHeaders(res, chatEngine.rateLimiter);

                // Fix H01+H04: Gửi initialMeta ngay, bao gồm zai_chat_id nếu đã biết
                const initialMeta: any = {
                    meta: {
                        accountId: 'z-account',
                        providerId: 'z',
                        modelId: 'GLM-5.1',
                        email: 'user@chat.z.ai',
                        conversation_id: resolvedConversationId
                    }
                };
                res.write(`data: ${JSON.stringify(initialMeta)}\n\n`);

                // Send search status if applicable
                if (useSearch) {
                    res.write(`data: ${JSON.stringify({
                        type: 'search_status',
                        enabled: true,
                        message: 'Search mode activated. Z.AI will search the web before responding.',
                    })}\n\n`);
                }

                const { addToken, flush: flushPending } = createTokenFlusher(res);
                let outputAccumulator = '';

                try {
                    console.log(`\n--- [STREAM START] ---`);
                    console.log(`[Prompt]: "${prompt}"\n`);
                    process.stdout.write(`[Response]: `);

                    const bufferParts: string[] = [];
                    let inTag = false;
                    let tagStart = -1;

                    await chatEngine.chat(prompt, (token) => {
                        bufferParts.push(token);
                        let buffer = bufferParts.join('');

                        let output = '';
                        let i = 0;
                        while (i < buffer.length) {
                            if (!inTag && buffer[i] === '<') {
                                inTag = true;
                                tagStart = i;
                                i++;
                            } else if (inTag && buffer[i] === '>') {
                                const tag = buffer.substring(tagStart, i + 1);
                                const fixedTag = sanitizeToken(tag);
                                output += buffer.substring(0, tagStart) + fixedTag;
                                buffer = buffer.substring(i + 1);
                                bufferParts.length = 0;
                                bufferParts.push(buffer);
                                inTag = false;
                                tagStart = -1;
                                i = 0;
                            } else {
                                i++;
                            }
                        }

                        if (!inTag && buffer.length > 0) {
                            output += buffer;
                            bufferParts.length = 0;
                        } else if (inTag && tagStart > 0) {
                            output += buffer.substring(0, tagStart);
                            buffer = buffer.substring(tagStart);
                            bufferParts.length = 0;
                            bufferParts.push(buffer);
                            tagStart = 0;
                        }

                        if (output) {
                            const sanitized = sanitizeToken(output);
                            outputAccumulator += sanitized;
                            process.stdout.write(sanitized);
                            addToken(sanitized);
                        }
                    }, resolvedConversationId, isNewChat, useSearch);

                    if (bufferParts.length > 0) {
                        const final = sanitizeToken(bufferParts.join(''));
                        if (final) {
                            process.stdout.write(final);
                            addToken(final);
                            outputAccumulator += final;
                        }
                    }

                    flushPending();

                    // Send search results if available
                    const searchResults = chatEngine.currentSearchResults;
                    if (searchResults && searchResults.length > 0) {
                        res.write(`data: ${JSON.stringify({
                            type: 'search_results',
                            results: searchResults.map((r: any, i: number) => ({
                                index: i + 1,
                                title: r.title || '',
                                url: r.url || r.link || '',
                                snippet: r.snippet || r.content || '',
                            })),
                        })}\n\n`);
                    }

                    // Get usage data
                    const apiUsage = chatEngine.lastUsage;
                    let finalUsage: { promptTokens: number; completionTokens: number; totalTokens: number; source: 'api' | 'estimated' };

                    if (apiUsage) {
                        finalUsage = { ...apiUsage, source: 'api' };
                    } else {
                        const estimatedInput = chatEngine.usageTracker.estimateMessagesTokens(messages);
                        const estimatedOutput = chatEngine.usageTracker.estimateTokens(outputAccumulator);
                        finalUsage = {
                            promptTokens: estimatedInput,
                            completionTokens: estimatedOutput,
                            totalTokens: estimatedInput + estimatedOutput,
                            source: 'estimated',
                        };
                        chatEngine.usageTracker.recordEstimated({
                            conversationId: resolvedConversationId,
                            inputText: messages.map((m: any) => m.content).join('\n'),
                            outputText: outputAccumulator,
                            model: 'GLM-5.1',
                        });
                    }

                    writeUsageEvent(res, finalUsage, resolvedConversationId);

                    console.log(`\n--- [STREAM END] ---\n`);
                } catch (err: any) {
                    console.error(`\n[Stream Error]: ${err.message || String(err)}`);
                    if (isWAFError(err.message || String(err))) {
                        console.log('[RateLimiter] 🚨 WAF-related error detected in stream, activating cooldown...');
                        chatEngine.reportWAFBlock();
                    }
                    flushPending();
                    res.write(`data: ${JSON.stringify({ error: err.message || String(err) })}\n\n`);
                } finally {
                    res.write('data: [DONE]\n\n');
                    res.end();
                }
            } else {
                // ---- Non-streaming mode ----
                try {
                    let accumulatedContent = '';
                    console.log(`\n--- [NON-STREAM START] ---`);
                    console.log(`[Prompt]: "${prompt}"\n`);
                    if (useSearch) console.log(`[Search]: 🔍 ENABLED`);

                    await chatEngine.chat(prompt, (token) => {
                        accumulatedContent += sanitizeToken(token);
                    }, resolvedConversationId, isNewChat, useSearch);

                    const finalContent = sanitizeToken(accumulatedContent);
                    console.log(`[Response]: ${finalContent}`);
                    console.log(`--- [NON-STREAM END] ---\n`);

                    // ← NEW: Get usage data
                    const apiUsage = chatEngine.lastUsage;
                    let finalUsage: { promptTokens: number; completionTokens: number; totalTokens: number; source: 'api' | 'estimated' };

                    if (apiUsage) {
                        finalUsage = { ...apiUsage, source: 'api' };
                    } else {
                        const estimatedInput = chatEngine.usageTracker.estimateMessagesTokens(messages);
                        const estimatedOutput = chatEngine.usageTracker.estimateTokens(finalContent);
                        finalUsage = {
                            promptTokens: estimatedInput,
                            completionTokens: estimatedOutput,
                            totalTokens: estimatedInput + estimatedOutput,
                            source: 'estimated',
                        };
                        chatEngine.usageTracker.recordEstimated({
                            conversationId: resolvedConversationId,
                            inputText: messages.map((m: any) => m.content).join('\n'),
                            outputText: finalContent,
                            model: 'GLM-5.1',
                        });
                    }

                    // ← NEW: Search results
                    const searchResults = chatEngine.currentSearchResults;

                    res.json({
                        success: true,
                        message: { role: 'assistant', content: finalContent },
                        metadata: {
                            accountId: 'z-account',
                            providerId: 'z',
                            modelId: 'GLM-5.1',
                            email: 'user@chat.z.ai',
                            conversation_id: resolvedConversationId
                        },
                        search_results: searchResults ? searchResults.map((r: any, i: number) => ({
                            index: i + 1,
                            title: r.title || '',
                            url: r.url || r.link || '',
                            snippet: r.snippet || r.content || '',
                        })) : undefined,
                        usage: {
                            input_tokens: finalUsage.promptTokens,
                            output_tokens: finalUsage.completionTokens,
                            total_tokens: finalUsage.totalTokens,
                            source: finalUsage.source,
                        }
                    });

                } catch (err: any) {
                    console.error(`\n[Non-Stream Error]: ${err.message || String(err)}`);
                    if (isWAFError(err.message || String(err))) {
                        console.log('[RateLimiter] 🚨 WAF-related error detected (non-stream), activating cooldown...');
                        chatEngine.reportWAFBlock();
                    }
                    res.status(500).json({ error: err.message || String(err) });
                }
            }
        } catch (err: any) {
            console.error('[Zen Route] Error handling request:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message || String(err) });
            }
        }
    };

    router.post('/v1/chat/accounts/messages', handleMessages);
    router.post('/v1/chat/accounts/:accountId/messages', handleMessages);

    return router;
}
