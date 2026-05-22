import { createLogger } from '../utils/logger';
import { configService } from './config.service';
import { getCertificateManager } from '../utils/cert-manager';
import { proxyEvents } from './proxy-events';
import * as zlib from 'zlib';

const logger = createLogger('ProxyService');

export interface ProxyConfig {
  enabled: boolean;
  port: number;
  interceptSSL: boolean;
}

export interface ProxyHandler {
  onRequest?: (ctx: any, callback: () => void) => void;
  onRequestData?: (ctx: any, chunk: Buffer, callback: () => void) => void;
  onResponse?: (ctx: any, callback: () => void) => void;
  onResponseBody?: (ctx: any, body: string) => void;
}

export class ProxyService {
  private isRunning = false;
  private proxy: any = null;
  private handlers: ProxyHandler[] = [];

  registerHandler(handler: ProxyHandler) {
    this.handlers.push(handler);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      // Lazy load http-mitm-proxy to handle missing dependency gracefully
      let MitmProxyModule;
      try {
        MitmProxyModule = require('http-mitm-proxy');
      } catch (e) {
        logger.warn('http-mitm-proxy not installed. Proxy feature disabled.');
        return;
      }

      const MitmProxy = MitmProxyModule.Proxy || MitmProxyModule;
      this.proxy = new MitmProxy();

      const config = this.getConfig();
      const certManager = getCertificateManager();
      const certsDir = certManager.getCertificateDir();

      this.proxy.onError((ctx: any, err: any) => {
        if (
          err &&
          (err.code === 'ECONNRESET' || err.message?.includes('socket hang up'))
        )
          return;
        logger.error('Proxy Error:', err);
      });

      this.proxy.onRequest(async (ctx: any, callback: any) => {
        for (const handler of this.handlers) {
          if (handler.onRequest) {
            try {
              handler.onRequest(ctx, () => {});
            } catch (e) {
              logger.error('Error in handler onRequest:', e);
            }
          }
        }
        return callback();
      });

      this.proxy.onRequestData(
        async (ctx: any, chunk: Buffer, callback: any) => {
          for (const handler of this.handlers) {
            if (handler.onRequestData) {
              try {
                handler.onRequestData(ctx, chunk, () => {});
              } catch (e) {
                logger.error('Error in handler onRequestData:', e);
              }
            }
          }
          return callback(null, chunk);
        },
      );

      this.proxy.onResponse((ctx: any, callback: any) => {
        for (const handler of this.handlers) {
          if (handler.onResponse) {
            try {
              handler.onResponse(ctx, () => {});
            } catch (e) {
              logger.error('Error in handler onResponse:', e);
            }
          }
        }

        // Body Handling with decompression
        const encoding = ctx.serverToProxyResponse.headers['content-encoding'];
        const contentType =
          ctx.serverToProxyResponse.headers['content-type'] || '';

        if (
          contentType.includes('text/') ||
          contentType.includes('application/json') ||
          contentType.includes('application/javascript')
        ) {
          const stream = ctx.serverToProxyResponse;
          let decoder: any;

          if (encoding === 'gzip') {
            decoder = zlib.createGunzip();
          } else if (encoding === 'br') {
            decoder = zlib.createBrotliDecompress();
          } else if (encoding === 'deflate') {
            decoder = zlib.createInflate();
          }

          if (decoder) {
            stream.pipe(decoder);
            let body = '';
            decoder.on(
              'data',
              (chunk: Buffer) => (body += chunk.toString('utf8')),
            );
            decoder.on('end', () => {
              for (const handler of this.handlers) {
                if (handler.onResponseBody) {
                  try {
                    handler.onResponseBody(ctx, body);
                  } catch (e) {
                    logger.error('Error in handler onResponseBody:', e);
                  }
                }
              }
            });
          } else {
            let body = '';
            ctx.serverToProxyResponse.on(
              'data',
              (chunk: Buffer) => (body += chunk.toString('utf8')),
            );
            ctx.serverToProxyResponse.on('end', () => {
              for (const handler of this.handlers) {
                if (handler.onResponseBody) {
                  try {
                    handler.onResponseBody(ctx, body);
                  } catch (e) {
                    logger.error(
                      'Error in handler onResponseBody (uncompressed):',
                      e,
                    );
                  }
                }
              }
            });
          }
        }
        return callback();
      });

      this.proxy.listen(
        { port: config.port, sslCaDir: certsDir, host: '0.0.0.0' },
        (err: any) => {
          if (err) {
            logger.error('Failed to start proxy:', err);
          } else {
            logger.info(`Proxy listening on port ${config.port}`);
            this.isRunning = true;
          }
        },
      );
    } catch (err) {
      logger.error('Error starting proxy service:', err);
    }
  }

  stop(): void {
    if (this.isRunning && this.proxy) {
      this.proxy.close();
      this.isRunning = false;
      logger.info('Proxy stopped');
    }
  }

  getConfig(): ProxyConfig {
    return configService.get('proxy_config', {
      enabled: false,
      port: 22122,
      interceptSSL: true,
    });
  }

  updateConfig(updates: Partial<ProxyConfig>): void {
    const current = this.getConfig();
    const updated = { ...current, ...updates };
    configService.set('proxy_config', updated);

    if (this.isRunning) {
      this.stop();
      if (updated.enabled) {
        this.start();
      }
    } else if (updated.enabled) {
      this.start();
    }
  }

  getServerInfo() {
    return {
      isRunning: this.isRunning,
      port: this.getConfig().port,
    };
  }
}

export const proxyService = new ProxyService();
