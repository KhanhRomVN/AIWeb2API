import express from 'express';
import { RateLimiter } from '../../rate-limiter';

// ============================================================
// sse.ts — SSE helpers: headers + token buffering/flushing
// Tách từ server.ts để tái sử dụng giữa handleMessages và handleApiChatCompletions.
// ============================================================

/** Ghi SSE response headers chuẩn kèm X-RateLimit-* + token info */
export function writeSSEHeaders(
    res: express.Response,
    rateLimiter: RateLimiter,
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null
): void {
    const rl = rateLimiter.getStatus();
    const headers: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-RateLimit-Limit-Per-Minute': String(rl.maxRequestsPerMinute),
        'X-RateLimit-Limit-Per-Hour': String(rl.maxRequestsPerHour),
        'X-RateLimit-Remaining-Per-Minute': String(Math.max(0, rl.maxRequestsPerMinute - rl.requestsThisMinute)),
        'X-RateLimit-Remaining-Per-Hour': String(Math.max(0, rl.maxRequestsPerHour - rl.requestsThisHour)),
    };

    // ← NEW: Add token count headers if usage data available
    if (usage) {
        headers['X-Tokens-Input'] = String(usage.promptTokens);
        headers['X-Tokens-Output'] = String(usage.completionTokens);
        headers['X-Tokens-Total'] = String(usage.totalTokens);
    }

    res.writeHead(200, headers);
}

/** ← NEW: Write usage SSE event before [DONE] */
export function writeUsageEvent(
    res: express.Response,
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        source: 'api' | 'estimated';
    },
    conversationId: string
): void {
    res.write(`data: ${JSON.stringify({
        type: 'usage',
        input_tokens: usage.promptTokens,
        output_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        source: usage.source,
        conversation_id: conversationId,
    })}\n\n`);
}

/** 
 * Tạo token flusher với buffer 2000 ký tự hoặc 300ms.
 * Trả về { addToken, flush } để dùng trong streaming callback.
 */
export function createTokenFlusher(res: express.Response) {
    let pendingTokens = '';
    let lastFlushTime = Date.now();

    const flush = () => {
        if (pendingTokens) {
            res.write(`data: ${JSON.stringify({ content: pendingTokens })}\n\n`);
            if ((res as any).flush) {
                (res as any).flush();
            }
            pendingTokens = '';
            lastFlushTime = Date.now();
        }
    };

    const addToken = (token: string) => {
        pendingTokens += token;
        const now = Date.now();
        if (pendingTokens.length >= 2000 || now - lastFlushTime >= 300) {
            flush();
        }
    };

    return { addToken, flush };
}
