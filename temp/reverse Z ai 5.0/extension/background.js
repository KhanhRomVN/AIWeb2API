// background.js - Unified background script / service worker
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;
let pendingReconnectTimer = null;
let proxyChangeInProgress = false;
let lastAppliedConfigHash = '';

function configHash(config) {
    if (!config) return '';
    return JSON.stringify({
        e: config.enabled,
        h: config.host,
        p: config.port,
        t: config.type,
        u: config.username,
        w: config.password,
        fa: config.forwarderActive,
        fp: config.forwarderPort
    });
}

function scheduleReconnect(delayMs) {
    if (pendingReconnectTimer) {
        clearTimeout(pendingReconnectTimer);
        pendingReconnectTimer = null;
    }
    pendingReconnectTimer = setTimeout(() => {
        pendingReconnectTimer = null;
        connectWS();
    }, delayMs);
}

function connectWS() {
    if (pendingReconnectTimer) {
        clearTimeout(pendingReconnectTimer);
        pendingReconnectTimer = null;
    }
    if (ws) {
        try { ws.close(); } catch (e) {}
        ws = null;
    }

    console.log("[Background] Connecting to WebSocket Server...");
    ws = new WebSocket("ws://127.0.0.1:8899?client=background");

    ws.onopen = () => {
        console.log("[Background] WebSocket Connected successfully.");
        reconnectAttempts = 0;
        setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'request_proxy_config' }));
            }
        }, 1000);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log("[Background] Message received:", data.action);
            if (data.action === 'apply_proxy') {
                const config = data.config;
                const serverHash = configHash(config);
                if (serverHash === lastAppliedConfigHash) {
                    console.log("[Background] Received apply_proxy but config is unchanged. Skipping.");
                    return;
                }
                applyProxy(config);
            }
        } catch (e) {
            console.error("[Background] Error parsing message:", e);
        }
    };

    ws.onclose = () => {
        console.log("[Background] WebSocket disconnected.");
        ws = null;

        if (proxyChangeInProgress) {
            console.log("[Background] Disconnect expected due to proxy settings update. Reconnecting in settle period.");
            scheduleReconnect(6000); // settle duration + buffer
            return;
        }

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const baseDelay = Math.min(3000 * Math.pow(1.5, reconnectAttempts), 30000);
            const delay = baseDelay + Math.floor(Math.random() * baseDelay * 0.25);
            reconnectAttempts++;
            console.log(`[Background] Attempting WS reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${Math.round(delay)}ms`);
            scheduleReconnect(delay);
        } else {
            console.log("[Background] Max attempts reached. Restting and retrying in 2 mins.");
            reconnectAttempts = 0;
            scheduleReconnect(120000);
        }
    };

    ws.onerror = (err) => {
        console.warn("[Background] WebSocket connection issue (server offline):", err);
    };
}

function applyProxy(config) {
    if (!config || !config.enabled) {
        chrome.proxy.settings.clear({ scope: 'regular' }, () => {
            console.log("[Background] Proxy cleared.");
            lastAppliedConfigHash = configHash(config);
            chrome.storage.local.set({ proxyConfig: config });
        });
        return;
    }

    proxyChangeInProgress = true;

    const useForwarder = config.type === 'socks5' && config.forwarderActive && config.forwarderPort;
    const pacScript = useForwarder
        ? `function FindProxyForURL(url, host) {
            if (host === "127.0.0.1" || host === "localhost") return "DIRECT";
            return "PROXY 127.0.0.1:${config.forwarderPort}";
           }`
        : `function FindProxyForURL(url, host) {
            if (host === "127.0.0.1" || host === "localhost") return "DIRECT";
            return "${config.type.toUpperCase() === 'SOCKS5' ? 'SOCKS5' : 'PROXY'} ${config.host}:${config.port}";
           }`;

    const proxyConfig = {
        mode: "pac_script",
        pacScript: {
            data: pacScript
        }
    };

    chrome.proxy.settings.set(
        { value: proxyConfig, scope: 'regular' },
        () => {
            console.log("[Background] Proxy applied successfully:", config);
            lastAppliedConfigHash = configHash(config);
            chrome.storage.local.set({ proxyConfig: config });
            setTimeout(() => {
                proxyChangeInProgress = false;
            }, 5000); // Settle time
        }
    );
}

// Listen for storage changes from the extension popup
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.proxyConfig) {
        const newConfig = changes.proxyConfig.newValue;
        const newHash = configHash(newConfig);
        if (newHash !== lastAppliedConfigHash) {
            console.log("[Background] Local storage config changed. Applying proxy...");
            applyProxy(newConfig);
        }
    }
});

// Initialize config from storage then start WS bridge
chrome.storage.local.get('proxyConfig', (result) => {
    if (result && result.proxyConfig) {
        console.log("[Background] Initial proxy config found. Applying...");
        applyProxy(result.proxyConfig);
    }
    setTimeout(() => {
        connectWS();
    }, 1500);
});
