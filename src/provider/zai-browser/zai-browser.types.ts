export interface ZaiBrowserConfig {
    wsPort: number;
    extensionReadyTimeout: number;
    reconnectAttempts: number;
    reconnectDelayMs: number;
}

export interface ZaiBrowserSession {
// Import WebSocket type from ws package
import type WebSocket from 'ws';

export interface ZaiBrowserConfig {
    wsPort: number;
    extensionReadyTimeout: number;
    reconnectAttempts: number;
    reconnectDelayMs: number;
}

export interface ZaiBrowserSession {
    ws: WebSocket | null;
    currentRequestId: string | null;
    isConnected: boolean;
    reconnectAttempts: number;
    reconnectTimer: NodeJS.Timeout | null;
    pendingRequests: Map<string, {
        onContent: (chunk: string) => void;
        onThinking?: (chunk: string) => void;
        onDone: () => void;
        onError: (err: Error) => void;
        onMetadata?: (meta: any) => void;
        onUsage?: (usage: any) => void;
    }>;
}
    cookie: string;
    userAgent: string;
}

export const DEFAULT_ZAI_BROWSER_CONFIG: ZaiBrowserConfig = {
    wsPort: 8899,
    extensionReadyTimeout: 30000,
    reconnectAttempts: 20,
    reconnectDelayMs: 3000,
};