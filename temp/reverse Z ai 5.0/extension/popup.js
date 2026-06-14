// popup.js - Controller logic for the proxy configuration panel

document.addEventListener('DOMContentLoaded', () => {
    // DOM Selectors
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const proxyEnabled = document.getElementById('proxyEnabled');
    const proxyQuickPaste = document.getElementById('proxyQuickPaste');
    const proxyType = document.getElementById('proxyType');
    const proxyHost = document.getElementById('proxyHost');
    const proxyPort = document.getElementById('proxyPort');
    const proxyUser = document.getElementById('proxyUser');
    const proxyPass = document.getElementById('proxyPass');
    const btnReset = document.getElementById('btnReset');
    const btnSave = document.getElementById('btnSave');
    const toast = document.getElementById('toast');

    // Check Local Server Health status
    function checkServerHealth() {
        fetch('http://127.0.0.1:8888/v1/health')
            .then(res => res.json())
            .then(data => {
                if (data && data.status === 'ok') {
                    statusDot.classList.add('online');
                    statusText.innerText = 'Online';
                } else {
                    statusDot.classList.remove('online');
                    statusText.innerText = 'Offline';
                }
            })
            .catch(() => {
                statusDot.classList.remove('online');
                statusText.innerText = 'Offline';
            });
    }

    // Call initially and every 3 seconds
    checkServerHealth();
    setInterval(checkServerHealth, 3000);

    // Load saved configurations from chrome.storage.local
    chrome.storage.local.get('proxyConfig', (result) => {
        if (result && result.proxyConfig) {
            const config = result.proxyConfig;
            proxyEnabled.checked = !!config.enabled;
            proxyType.value = config.type || 'http';
            proxyHost.value = config.host || '';
            proxyPort.value = config.port || '';
            proxyUser.value = config.username || '';
            proxyPass.value = config.password || '';
        }
    });

    // Toast notifications
    function showToast(message, isSuccess = true) {
        toast.innerText = message;
        toast.style.background = isSuccess ? 'var(--success)' : 'var(--danger)';
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    // Parse raw proxy string (ip:port:user:pass or user:pass@ip:port)
    function parseRawProxy(raw) {
        raw = raw.trim();
        if (!raw) return null;

        let type = 'http';
        let host = '';
        let port = 80;
        let username = '';
        let password = '';

        // Check protocols
        if (raw.startsWith('socks5://')) {
            type = 'socks5';
            raw = raw.substring(9);
        } else if (raw.startsWith('socks4://')) {
            type = 'socks5'; // fallback
            raw = raw.substring(9);
        } else if (raw.startsWith('http://')) {
            type = 'http';
            raw = raw.substring(7);
        } else if (raw.startsWith('https://')) {
            type = 'https';
            raw = raw.substring(8);
        }

        // Format: user:pass@host:port
        if (raw.includes('@')) {
            const parts = raw.split('@');
            const auth = parts[0].split(':');
            username = auth[0] || '';
            password = auth[1] || '';
            raw = parts[1];
        }

        const pieces = raw.split(':');
        if (pieces.length >= 2) {
            host = pieces[0].trim();
            port = parseInt(pieces[1].trim(), 10) || 80;
            if (pieces.length >= 4) {
                username = pieces[2].trim();
                password = pieces[3].trim();
            }
        } else {
            host = raw;
        }

        return {
            enabled: true,
            type,
            host,
            port,
            username,
            password
        };
    }

    // Quick Paste Handler
    proxyQuickPaste.addEventListener('input', () => {
        const value = proxyQuickPaste.value;
        const parsed = parseRawProxy(value);
        if (parsed) {
            proxyEnabled.checked = true;
            proxyType.value = parsed.type;
            proxyHost.value = parsed.host;
            proxyPort.value = parsed.port;
            proxyUser.value = parsed.username;
            proxyPass.value = parsed.password;
            
            // Auto save
            saveConfig(parsed);
            proxyQuickPaste.value = ''; // clear paste box
        } else if (value.trim()) {
            showToast('Invalid Proxy Format!', false);
        }
    });

    // Save configurations
    function saveConfig(config) {
        chrome.storage.local.set({ proxyConfig: config }, () => {
            showToast('Changes Applied!');
            
            // Sync with local server REST API if online
            fetch('http://127.0.0.1:8888/api/proxy/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer zen-local-key'
                },
                body: JSON.stringify(config)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    console.log("[Popup] Config synced with Local Server.");
                }
            })
            .catch(() => {
                console.log("[Popup] Failed to sync config (Server Offline). Local setting applied.");
            });
        });
    }

    btnSave.addEventListener('click', () => {
        const config = {
            enabled: proxyEnabled.checked,
            type: proxyType.value,
            host: proxyHost.value.trim(),
            port: parseInt(proxyPort.value, 10) || 80,
            username: proxyUser.value.trim(),
            password: proxyPass.value.trim()
        };

        if (config.enabled && !config.host) {
            showToast('Host Address is required!', false);
            return;
        }

        saveConfig(config);
    });

    // Reset button
    btnReset.addEventListener('click', () => {
        proxyEnabled.checked = false;
        proxyType.value = 'http';
        proxyHost.value = '';
        proxyPort.value = '';
        proxyUser.value = '';
        proxyPass.value = '';
        proxyQuickPaste.value = '';

        const emptyConfig = {
            enabled: false,
            type: 'http',
            host: '',
            port: 80,
            username: '',
            password: ''
        };
        saveConfig(emptyConfig);
    });
});
