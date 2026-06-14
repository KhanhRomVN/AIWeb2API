// Socks5Forwarder.ts - Local HTTP to SOCKS5 proxy forwarder with credentials auth
import * as net from 'net';

export interface Socks5ForwarderConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
}

export class Socks5Forwarder {
    private server: net.Server | null = null;
    private config: Socks5ForwarderConfig;
    private port: number = 10809;
    private connections: Set<net.Socket> = new Set();

    constructor(config: Socks5ForwarderConfig) {
        this.config = config;
    }

    public updateConfig(config: Socks5ForwarderConfig) {
        this.config = config;
        console.log('[Socks5Forwarder] Config updated.');
    }

    public getPort(): number {
        return this.port;
    }

    public async start(preferredPort: number = 10809): Promise<number> {
        this.port = preferredPort;
        return new Promise((resolve, reject) => {
            const tryBind = (portToTry: number) => {
                const server = net.createServer((clientSocket) => {
                    this.connections.add(clientSocket);
                    clientSocket.on('close', () => this.connections.delete(clientSocket));
                    this.handleClient(clientSocket);
                });

                server.on('error', (err: any) => {
                    if (err.code === 'EADDRINUSE' && portToTry < preferredPort + 100) {
                        console.log(`[Socks5Forwarder] Port ${portToTry} in use, trying ${portToTry + 1}...`);
                        tryBind(portToTry + 1);
                    } else {
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

    public async stop(): Promise<void> {
        if (!this.server) return;

        return new Promise((resolve) => {
            // Close all active client connections
            for (const socket of this.connections) {
                socket.destroy();
            }
            this.connections.clear();

            this.server!.close(() => {
                console.log('[Socks5Forwarder] Server stopped.');
                this.server = null;
                resolve();
            });
        });
    }

    private handleClient(clientSocket: net.Socket) {
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

    private connectToSocks(targetHost: string, targetPort: number, clientSocket: net.Socket) {
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
                } else if (chosenMethod === 0x00) {
                    // No authentication required
                    this.requestSocksConnect(socksSocket, targetHost, targetPort, clientSocket);
                } else {
                    socksSocket.destroy();
                    clientSocket.destroy();
                }
            });
        });
    }

    private authenticateSocks(socksSocket: net.Socket, targetHost: string, targetPort: number, clientSocket: net.Socket) {
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

    private requestSocksConnect(socksSocket: net.Socket, targetHost: string, targetPort: number, clientSocket: net.Socket) {
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
