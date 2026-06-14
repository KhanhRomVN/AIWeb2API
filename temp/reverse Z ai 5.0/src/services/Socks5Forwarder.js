"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Socks5Forwarder = void 0;
// Socks5Forwarder.ts - Local HTTP to SOCKS5 proxy forwarder with credentials auth
const net = __importStar(require("net"));
class Socks5Forwarder {
    server = null;
    config;
    port = 10809;
    connections = new Set();
    constructor(config) {
        this.config = config;
    }
    updateConfig(config) {
        this.config = config;
        console.log('[Socks5Forwarder] Config updated.');
    }
    getPort() {
        return this.port;
    }
    async start(preferredPort = 10809) {
        this.port = preferredPort;
        return new Promise((resolve, reject) => {
            const tryBind = (portToTry) => {
                const server = net.createServer((clientSocket) => {
                    this.connections.add(clientSocket);
                    clientSocket.on('close', () => this.connections.delete(clientSocket));
                    this.handleClient(clientSocket);
                });
                server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE' && portToTry < preferredPort + 100) {
                        console.log(`[Socks5Forwarder] Port ${portToTry} in use, trying ${portToTry + 1}...`);
                        tryBind(portToTry + 1);
                    }
                    else {
                        reject(err);
                    }
                });
                server.listen(portToTry, '127.0.0.1', () => {
                    this.server = server;
                    this.port = portToTry;
                    console.log(`[Socks5Forwarder] Listening on 127.0.0.1:${this.port}`);
                    resolve(this.port);
                });
            };
            tryBind(preferredPort);
        });
    }
    async stop() {
        if (!this.server)
            return;
        return new Promise((resolve) => {
            // Close all active client connections
            for (const socket of this.connections) {
                socket.destroy();
            }
            this.connections.clear();
            this.server.close(() => {
                console.log('[Socks5Forwarder] Server stopped.');
                this.server = null;
                resolve();
            });
        });
    }
    handleClient(clientSocket) {
        clientSocket.once('data', (data) => {
            const requestStr = data.toString();
            if (!requestStr.startsWith('CONNECT')) {
                // SOCKS5 Forwarder only supports HTTP CONNECT tunnels
                clientSocket.write('HTTP/1.1 405 Method Not Allowed\r\n\r\n');
                clientSocket.destroy();
                return;
            }
            // Parse CONNECT target:port HTTP/1.1
            const match = requestStr.match(/^CONNECT\s+([^:\s]+):(\d+)/i);
            if (!match) {
                clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                clientSocket.destroy();
                return;
            }
            const targetHost = match[1];
            const targetPort = parseInt(match[2], 10);
            // Establish tunnel via target SOCKS5 proxy server
            this.connectToSocks(targetHost, targetPort, clientSocket);
        });
    }
    connectToSocks(targetHost, targetPort, clientSocket) {
        const socksSocket = new net.Socket();
        socksSocket.on('error', (err) => {
            console.error(`[Socks5Forwarder] Tunnel error to ${targetHost}:${targetPort}:`, err.message);
            if (!clientSocket.destroyed) {
                clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
                clientSocket.destroy();
            }
        });
        socksSocket.connect(this.config.port, this.config.host, () => {
            // SOCKS5 Handshake - Greeting
            const methods = this.config.username ? [0, 2] : [0]; // 0: NO AUTH, 2: USER/PASS
            const greeting = Buffer.alloc(2 + methods.length);
            greeting[0] = 0x05; // SOCKS Version 5
            greeting[1] = methods.length;
            for (let i = 0; i < methods.length; i++) {
                greeting[2 + i] = methods[i];
            }
            socksSocket.write(greeting);
            // Process greeting response
            socksSocket.once('data', (greetResp) => {
                if (greetResp[0] !== 0x05) {
                    socksSocket.destroy();
                    clientSocket.destroy();
                    return;
                }
                const chosenMethod = greetResp[1];
                if (chosenMethod === 0xff) {
                    // No acceptable methods
                    socksSocket.destroy();
                    clientSocket.destroy();
                    return;
                }
                if (chosenMethod === 0x02) {
                    // Username/Password authentication
                    this.authenticateSocks(socksSocket, targetHost, targetPort, clientSocket);
                }
                else if (chosenMethod === 0x00) {
                    // No authentication required
                    this.requestSocksConnect(socksSocket, targetHost, targetPort, clientSocket);
                }
                else {
                    socksSocket.destroy();
                    clientSocket.destroy();
                }
            });
        });
    }
    authenticateSocks(socksSocket, targetHost, targetPort, clientSocket) {
        const user = this.config.username || '';
        const pass = this.config.password || '';
        const userBuf = Buffer.from(user);
        const passBuf = Buffer.from(pass);
        const authRequest = Buffer.alloc(3 + userBuf.length + passBuf.length);
        authRequest[0] = 0x01; // Subnegotiation version 1
        authRequest[1] = userBuf.length;
        userBuf.copy(authRequest, 2);
        authRequest[2 + userBuf.length] = passBuf.length;
        passBuf.copy(authRequest, 3 + userBuf.length);
        socksSocket.write(authRequest);
        socksSocket.once('data', (authResp) => {
            if (authResp[0] !== 0x01 || authResp[1] !== 0x00) {
                console.error('[Socks5Forwarder] Authentication failed on SOCKS5 server.');
                socksSocket.destroy();
                clientSocket.destroy();
                return;
            }
            // Proceed to CONNECT command after authentication
            this.requestSocksConnect(socksSocket, targetHost, targetPort, clientSocket);
        });
    }
    requestSocksConnect(socksSocket, targetHost, targetPort, clientSocket) {
        const hostBuf = Buffer.from(targetHost);
        const request = Buffer.alloc(6 + hostBuf.length);
        request[0] = 0x05; // SOCKS5 version
        request[1] = 0x01; // CONNECT command
        request[2] = 0x00; // Reserved
        request[3] = 0x03; // Address type: DOMAINNAME
        request[4] = hostBuf.length;
        hostBuf.copy(request, 5);
        request.writeUInt16BE(targetPort, 5 + hostBuf.length);
        socksSocket.write(request);
        socksSocket.once('data', (connectResp) => {
            if (connectResp[0] !== 0x05 || connectResp[1] !== 0x00) {
                console.error(`[Socks5Forwarder] SOCKS CONNECT failed: status ${connectResp[1]}`);
                socksSocket.destroy();
                clientSocket.destroy();
                return;
            }
            // Connection established successfully
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            // Pipe data back and forth
            clientSocket.pipe(socksSocket);
            socksSocket.pipe(clientSocket);
        });
    }
}
exports.Socks5Forwarder = Socks5Forwarder;
