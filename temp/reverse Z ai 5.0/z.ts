import * as readline from 'readline';
import { WebSocketServer, WebSocket } from 'ws';
import { RateLimiter, RateLimitConfig, DEFAULT_RATE_LIMIT_CONFIG } from './rate-limiter';
import { UsageTracker } from './src/utils/usage-tracker';

async function askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

export class ZChat {
    private wss: WebSocketServer | null = null;
    private wsConnection: WebSocket | null = null;
    private bgConnection: WebSocket | null = null;
    public proxyManager: any = null;
    private currentStreamResolver: ((chunk: string) => void) | null = null;
    private currentEndResolver: ((err?: string) => void) | null = null;
    private chatLock = Promise.resolve();
    public rateLimiter: RateLimiter;
    public usageTracker!: UsageTracker;
    private _lastUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
    private _currentSearchResults: any[] | null = null;

    // 🔗 Z.AI chat_id tracking — persist across requests
    private currentZaiChatId: string | null = null;

    // Fix H03: Per-request context thay vì singleton resolvers.
    private _activeCtx: {
        chatIdResolve: ((id: string | null) => void) | null;
        navigationResolve: ((ok: boolean) => void) | null;
        pageReadyResolve: ((ready: boolean) => void) | null;
    } | null = null;

    // 🔑 Biết liệu đã có cuộc hội thoại đang mở trên browser chưa
    // → đat trực tiếp trong ZChat, không phụ thuộc vào conversationId từ Zen
    private _hasBrowserSession: boolean = false;

    public get hasBrowserSession(): boolean {
        return this._hasBrowserSession;
    }

    public get lastUsage() {
        return this._lastUsage;
    }

    public get currentSearchResults(): any[] | null {
        return this._currentSearchResults;
    }

    public resetBrowserSession(): void {
        this._hasBrowserSession = false;
        console.log('[System] 🔴 Browser session reset.');
    }

    public broadcastProxyConfig(config: any) {
        if (this.bgConnection && this.bgConnection.readyState === WebSocket.OPEN) {
            console.log('[System] Broadcasting apply_proxy config to extension background SW.');
            this.bgConnection.send(JSON.stringify({ action: 'apply_proxy', config }));
        } else {
            console.log('[System] Background connection not active. Skipping proxy config broadcast.');
        }
    }

    constructor(rateLimitConfig?: Partial<RateLimitConfig>) {
        this.rateLimiter = new RateLimiter(rateLimitConfig || DEFAULT_RATE_LIMIT_CONFIG);
        this.usageTracker = new UsageTracker();
        console.log('[RateLimiter] ✅ Initialized with config:', JSON.stringify(this.rateLimiter.getStatus()));
    }

    public isConnected(): boolean {
        return this.wsConnection !== null;
    }

    public async initBrowser() {
        console.log('[System] Khoi dong WebSocket Server tren cong 8899 de ket noi voi Chrome Extension...');
        
        const url = require('url');
        // Start WebSocket Server
        const WS_PORT = parseInt(process.env.WS_PORT || '8899', 10);
        this.wss = new WebSocketServer({ port: WS_PORT });
        
        this.wss.on('connection', (ws, req) => {
            const parsedUrl = url.parse(req.url || '', true);
            const client = parsedUrl.query.client;

            if (client === 'background') {
                console.log('[System] Z.AI Bridge Extension (Background Worker) da ket noi!');
                this.bgConnection = ws;
                
                ws.on('message', (messageStr) => {
                    if (ws !== this.bgConnection) return;
                    try {
                        const msg = JSON.parse(messageStr.toString());
                        if (msg.type === 'request_proxy_config') {
                            console.log('[System] Background SW requested proxy config.');
                            if (this.proxyManager) {
                                const proxyCfg = this.proxyManager.getConfig(false);
                                ws.send(JSON.stringify({ action: 'apply_proxy', config: proxyCfg }));
                            }
                        }
                    } catch (e) {}
                });
                
                ws.on('close', () => {
                    console.log('[System] Z.AI Bridge Extension (Background) da ngat ket noi.');
                    if (ws === this.bgConnection) {
                        this.bgConnection = null;
                    }
                });
            } else {
                console.log('[System] Z.AI Bridge Extension (Content Script) da ket noi!');
                this.wsConnection = ws;
                
                ws.on('message', (messageStr) => {
                    if (ws !== this.wsConnection) {
                        console.log('[System WS] Bo qua tin nhan tu ket noi WebSocket cu.');
                        return;
                    }
                    const rawStr = messageStr.toString();
                    const lines = rawStr.split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const msg = JSON.parse(line);
                            if (process.env.DEBUG_STREAM) {
                                console.log(`[System WS] Nhan tin nhan: type=${msg.type}, hasStreamResolver=${!!this.currentStreamResolver}, hasEndResolver=${!!this.currentEndResolver}`);
                            }
                            if (msg.type === 'stream_chunk') {
                                if (this.currentStreamResolver) {
                                    this.currentStreamResolver(msg.chunk);
                                }
                            } else if (msg.type === 'usage' && msg.usage) {
                                console.log(`[System] 📊 Usage from Z.AI API: prompt=${msg.usage.prompt_tokens}, completion=${msg.usage.completion_tokens}, total=${msg.usage.total_tokens}`);
                                this._lastUsage = {
                                    promptTokens: msg.usage.prompt_tokens || 0,
                                    completionTokens: msg.usage.completion_tokens || 0,
                                    totalTokens: msg.usage.total_tokens || 0,
                                };
                            } else if (msg.type === 'search_results' && msg.results) {
                                console.log(`[System] 🔍 Search results received: ${msg.results.length} results`);
                                this._currentSearchResults = msg.results;
                            } else if (msg.type === 'search_phase') {
                                console.log(`[System] 🔍 Search phase: ${msg.phase}`);
                            } else if (msg.type === 'stream_end') {
                                console.log(`[System WS] Nhan stream_end. Goi currentEndResolver.`);
                                if (this.currentEndResolver) {
                                    this.currentEndResolver(msg.error);
                                }
                            } else if (msg.type === 'waf_block') {
                                console.log(`[System] 🚨 WAF block detected from extension! Status: ${msg.status}`);
                                this.rateLimiter.reportWAFBlock();
                                if (this.currentEndResolver) {
                                    this.currentEndResolver('WAF block detected. Rate limit cooldown activated.');
                                }
                            } else if (msg.type === 'chat_id_detected') {
                                console.log(`[System] 🔗 Z.AI chat_id detected from browser: ${msg.chat_id}`);
                                this.currentZaiChatId = msg.chat_id;
                                if (this._activeCtx?.chatIdResolve) {
                                    this._activeCtx.chatIdResolve(msg.chat_id);
                                    this._activeCtx.chatIdResolve = null;
                                }
                                if (this._activeCtx?.navigationResolve) {
                                    console.log(`[System] 🔗 Navigation resolved via chat_id_detected`);
                                    this._activeCtx.navigationResolve(true);
                                    this._activeCtx.navigationResolve = null;
                                }
                            } else if (msg.type === 'navigation_complete') {
                                console.log(`[System] 🔗 Navigation to conversation complete: ${msg.chat_id}`);
                                this.currentZaiChatId = msg.chat_id;
                                if (this._activeCtx?.navigationResolve) {
                                    this._activeCtx.navigationResolve(true);
                                    this._activeCtx.navigationResolve = null;
                                }
                            } else if (msg.type === 'page_ready') {
                                console.log(`[System] ✅ page_ready signal received (context: ${msg.context}${msg.timedOut ? ', timedOut' : ''})`);
                                if (this._activeCtx?.pageReadyResolve) {
                                    this._activeCtx.pageReadyResolve(true);
                                    this._activeCtx.pageReadyResolve = null;
                                }
                            } else if (msg.type === 'remote_log') {
                                console.log(`[Extension ${msg.logType.toUpperCase()}] ${msg.text}`);
                            }
                        } catch (e) {
                            console.error('[System WS] Error parsing extension message:', e);
                        }
                    }
                });
                
                ws.on('close', () => {
                    console.log('[System] Z.AI Bridge extension da ngat ket noi.');
                    if (ws === this.wsConnection) {
                        this.wsConnection = null;
                        this._hasBrowserSession = false;
                        console.log('[System] 🔴 Browser session cleared (extension disconnected).');
                    }
                });
            }
        });

        console.log('[System] WebSocket Server khoi dong thanh cong.');
        console.log('[System] Vui long mo Chrome chinh thuc (da load extension) va truy cap https://chat.z.ai/ de ket noi.\n');
    }

    public async chat(prompt: string, onToken?: (token: string) => void, conversationId: string = '', isNewChat: boolean = false, isSearch: boolean = false) {
        // Enforce sequential prompts using a promise lock
        const result = this.chatLock.then(async () => {
            await this.executeChat(prompt, onToken, conversationId, isNewChat, isSearch);
        });
        this.chatLock = result.catch(() => {});
        return result;
    }

    /**
     * Fix H02+H05+H03: Chờ extension báo page_ready (textarea sẵn sàng).
     * Thay thế magic setTimeout — event-driven, không có timing cứng.
     */
    private async waitForPageReady(timeoutMs: number = 13000): Promise<boolean> {
        return new Promise((resolve) => {
            if (this._activeCtx) this._activeCtx.pageReadyResolve = resolve;
            setTimeout(() => {
                if (this._activeCtx?.pageReadyResolve === resolve) {
                    this._activeCtx.pageReadyResolve = null;
                    console.warn('[System] ⚠️ waitForPageReady timeout — proceeding anyway');
                    resolve(false);
                }
            }, timeoutMs);
        });
    }

    private async executeChat(prompt: string, onToken?: (token: string) => void, conversationId: string = '', isNewChat: boolean = false, isSearch: boolean = false) {
        if (!this.wsConnection) {
            throw new Error('Extension is not connected. Make sure Chrome is running and Z.AI Bridge extension is active.');
        }

        // ⭐ Rate limit check - Prevent WAF blocking
        const rateLimitResult = await this.rateLimiter.acquire();
        if (!rateLimitResult.allowed) {
            const retrySec = Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000);
            console.log(`[RateLimiter] 🚫 Request blocked: ${rateLimitResult.reason}. Retry after ${retrySec}s`);
            throw new Error(`Rate limit: ${rateLimitResult.reason}. Retry after ${retrySec} seconds.`);
        }
        const status = this.rateLimiter.getStatus();
        console.log(`[RateLimiter] ✅ Request allowed. ${status.requestsThisMinute}/${status.maxRequestsPerMinute} per min, ${status.requestsThisHour}/${status.maxRequestsPerHour} per hour`);

        // Reset per-request state
        this._lastUsage = null;
        this._currentSearchResults = null;

        // Fix H03: khởi tạo per-request context
        this._activeCtx = {
            chatIdResolve: null,
            navigationResolve: null,
            pageReadyResolve: null,
        };

        let requestError: string | null = null;

        try {
        if (isNewChat) {
            console.log(`[Page] Khoi tao cuoc tro chuyen moi...`);
            this.wsConnection.send(JSON.stringify({ action: 'reset_page' }));
            console.log('[Page] Waiting for page_ready signal (reset)...');
            await this.waitForPageReady(15000);
            this._hasBrowserSession = true; // ✅ Đánh dấu đã có chat đang mở
            console.log('[Page] page_ready received, proceeding to send prompt.');
        }
        // Tin nhắn tiếp theo: gửi thẳng vào chat đang mở, không điều hướng

        // ✅ Fix P2: Single string buffer thay vì array + join — giảm GC pressure
        let sseBuffer = '';
        let currentPhase: 'thinking' | 'output' | null = null;
        let streamEndResolve: ((value: string | null) => void) | null = null;
        const streamEndPromise = new Promise<string | null>((resolve) => {
            streamEndResolve = resolve;
        });

        // Hook stream handlers
        this.currentStreamResolver = (chunkStr: string) => {
            // Debug: only log when DEBUG_STREAM is enabled (Issue #1 fix)
            if (process.env.DEBUG_STREAM) {
                console.log(`[ZChat RAW CHUNK]`, chunkStr.substring(0, 200));
            }

            sseBuffer += chunkStr;
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6).trim();
                    if (jsonStr === '[DONE]') continue;
                    try {
                        const json = JSON.parse(jsonStr);
                        let content = '';
                        let phase = '';
                        
                        if (json.data) {
                            content = json.data.delta_content || '';
                            phase = json.data.phase || '';
                        }
                        
                        if (!content) {
                            if (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) {
                                content = json.choices[0].delta.content;
                            } else if (json.message && json.message.content) {
                                content = json.message.content;
                            } else if (json.delta && json.delta.content) {
                                content = json.delta.content;
                            } else if (json.content) {
                                content = json.content;
                            }
                        }
                        
                        if (content) {
                            if (phase === 'thinking') {
                                if (currentPhase !== 'thinking') {
                                    currentPhase = 'thinking';
                                    if (onToken) onToken('<thinking>');
                                }
                            } else {
                                if (currentPhase === 'thinking') {
                                    currentPhase = 'output';
                                    if (onToken) onToken('</thinking>');
                                }
                            }
                            
                            if (onToken) {
                                onToken(content);
                            } else {
                                process.stdout.write(content);
                            }
                        }
                    } catch (e) {}
                }
            }
        };

        this.currentEndResolver = (err?: string) => {
            if (streamEndResolve) {
                streamEndResolve(err || null);
            }
        };

        // Send prompt over websocket to extension
        this.wsConnection.send(JSON.stringify({ action: 'send_prompt', prompt, isNewChat, isSearch }));

        // Wait until request finishes (event-driven, no polling — Issue #2 fix)
        const timeoutPromise = new Promise<string>(resolve => 
            setTimeout(() => resolve('Loi: Cho phan hoi tu Z.ai qua 20 phut.'), 1200000)
        );
        
        // Progress indicator after 10 seconds
        let requestDone = false;
        const progressTimer = setTimeout(() => {
            if (!requestDone) {
                console.log('[System] Dang cho phan hoi tu Z.ai... (Neu co CAPTCHA hien len tren trinh duyet Chrome, vui long keo slider de tiep tuc).');
            }
        }, 10000);
        
        const result = await Promise.race([streamEndPromise, timeoutPromise]);
        requestDone = true;
        clearTimeout(progressTimer);
        if (result) {
            requestError = result;
        }

        // Close thinking tag if still open
        if (currentPhase === 'thinking') {
            if (onToken) onToken('</thinking>');
        }

        this.currentStreamResolver = null;
        this.currentEndResolver = null;

        } finally {
            // Fix H03: đảm bảo _activeCtx luôn được giải phóng dù có throw
            this._activeCtx = null;
        }

        // ← NEW: Record usage if available from Z.AI API
        if (this._lastUsage) {
            this.usageTracker.recordFromAPI({
                conversationId,
                promptTokens: this._lastUsage.promptTokens,
                completionTokens: this._lastUsage.completionTokens,
                totalTokens: this._lastUsage.totalTokens,
                model: 'GLM-5.1',
            });
        }

        if (requestError) {
            // Detect WAF-related errors and activate cooldown
            const errLower = requestError.toLowerCase();
            if (errLower.includes('waf') || errLower.includes('blocked') || 
                errLower.includes('captcha') || errLower.includes('403') || 
                errLower.includes('405') || errLower.includes('429') || 
                errLower.includes('rate limit')) {
                console.log('[RateLimiter] 🚨 WAF-related error detected in response, activating cooldown...');
                this.rateLimiter.reportWAFBlock();
            }
            throw new Error(requestError);
        }
    }

    public getRateLimitStatus() {
        return this.rateLimiter.getStatus();
    }

    public updateRateLimitConfig(config: Partial<RateLimitConfig>) {
        this.rateLimiter.updateConfig(config);
        console.log('[RateLimiter] 🔄 Config updated:', JSON.stringify(this.rateLimiter.getStatus()));
    }

    public reportWAFBlock() {
        this.rateLimiter.reportWAFBlock();
    }

    public resetRateLimits() {
        this.rateLimiter.reset();
    }

    public async close() {
        if (this.wss) {
            try {
                this.wss.close();
            } catch (e) {}
            this.wss = null;
        }
        this.wsConnection = null;
        console.log('[System] ZChat bridge closed.');
    }
}

async function main() {
    const chatEngine = new ZChat({
        maxRequestsPerMinute: 10,
        maxRequestsPerHour: 59,
        minIntervalMs: 3000,
        cooldownAfterWAFMs: 60000,
    });
    await chatEngine.initBrowser();
    
    const args = process.argv.slice(2);
    let prompt = args.join(' ');
    
    if (!chatEngine.isConnected()) {
        console.log('[System] Dang cho Chrome Extension ket noi qua WebSocket...');
        while (!chatEngine.isConnected()) {
            await new Promise(r => setTimeout(r, 1000));
        }
        console.log('[System] Extension da ket noi. Tiep tuc execution...');
    }

    if (prompt) {
        process.stdout.write('Assistant: ');
        await chatEngine.chat(prompt);
    } else {
        while (true) {
            prompt = await askQuestion('\nUser: ');
            if (!prompt.trim()) continue;
            if (['exit', 'quit'].includes(prompt.toLowerCase())) break;
            
            process.stdout.write('Assistant: ');
            await chatEngine.chat(prompt);
        }
    }
    
    await chatEngine.close();
    process.exit(0);
}

if (require.main === module || process.env.RUN_AS_CLI === 'true' || process.argv.includes('--cli')) {
    main().catch(console.error);
}