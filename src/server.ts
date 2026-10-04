/**
 * ------------------------------------------------------------------
 * Server
 * ------------------------------------------------------------------
 * HTTP/HTTPS server khởi tạo và quản lý.
 * Hỗ trợ tự động kill port khi đang sử dụng (interactive mode).
 *
 * Main functions:
 * - startServer() : Khởi động server
 * - stopServer()  : Dừng server
 * - getServerInfo(): Lấy thông tin server
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

// ── App ──
import { createApp } from './app';

// ── Config ──
import { getServerConfig, defaultConfig } from './config/server.config';

// ── Utils ──
import { createLogger } from './utils/logger';
import { askYesNo } from './utils/prompt';
import { killProcessOnPort } from './utils/kill-port';
import { showWelcome, printStarted, printCancelled } from './utils/welcome';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('Server');

let server: http.Server | https.Server | null = null;

// ─── Start ─────────────────────────────────────────────────────────────

export const startServer = async (): Promise<{
  success: boolean;
  port?: number;
  https?: boolean;
  error?: string;
  code?: string;
}> => {
  if (server) {
    const config = getServerConfig();
    return { success: true, port: config.port, https: config.tls.enable };
  }

  try {
    const config = getServerConfig();

    // ── Welcome UI: banner + hỏi host/port (chỉ khi TTY) ───────────
    // Trả về ngay với giá trị mặc định nếu stdin không phải TTY
    // (chạy trong pipe, service, extension, v.v.).
    let finalHost = config.host;
    let finalPort = config.port;

    try {
      const chosen = await showWelcome(config.host, config.port);
      finalHost = chosen.host;
      finalPort = chosen.port;
    } catch (e: any) {
      // Nếu người dùng Ctrl+C ngay ở prompt → thoát sạch
      if (e?.code === 'ERR_USE_AFTER_CLOSE' || e?.message?.includes('cancel')) {
        printCancelled();
        process.exit(0);
      }
      // Lỗi khác → log và tiếp tục với config mặc định
      logger.warn(`Welcome UI error: ${e?.message ?? e}`);
    }

    // Cập nhật config với host/port người dùng chọn (nếu khác default)
    if (finalHost !== config.host) (config as any).host = finalHost;
    if (finalPort !== config.port) (config as any).port = finalPort;

    const app = await createApp();

    return new Promise((resolve) => {
      try {
        if (config.tls.enable && config.tls.certPath && config.tls.keyPath) {
          const httpsOptions = {
            cert: fs.readFileSync(config.tls.certPath),
            key: fs.readFileSync(config.tls.keyPath),
          };
          server = https.createServer(httpsOptions, app);
        } else {
          server = http.createServer(app);
        }

        server.listen(finalPort, finalHost, () => {
          printStarted(finalHost, finalPort, config.tls.enable);
          resolve({
            success: true,
            port: finalPort,
            https: config.tls.enable,
          });
        });

        server.on('error', async (e: any) => {
          if (e.code === 'EADDRINUSE') {
            logger.error(`Port ${finalPort} already in use`);

            const isTTY = process.stdin.isTTY;
            let shouldKill = false;

            if (isTTY) {
              const answer = await askYesNo(
                `Port ${finalPort} is already in use. Do you want to kill the process using this port?`,
              );
              shouldKill = answer === true;
            }

            if (shouldKill) {
              const killed = await killProcessOnPort(finalPort);

              if (killed) {
                server?.close(() => {
                  const newServer = http.createServer(app);
                  newServer.listen(finalPort, finalHost, () => {
                    server = newServer;
                    printStarted(finalHost, finalPort, config.tls.enable);
                    resolve({
                      success: true,
                      port: finalPort,
                      https: config.tls.enable,
                    });
                  });
                  newServer.on('error', (err: any) => {
                    logger.error(`Retry failed: ${err.message}`);
                    resolve({
                      success: false,
                      error: `Retry failed: ${err.message}`,
                      code: err.code || 'RETRY_FAILED',
                    });
                  });
                });
                return;
              } else {
                logger.error(`Failed to kill process on port ${finalPort}`);
                resolve({
                  success: false,
                  error: `Port ${finalPort} is already in use and could not be killed`,
                  code: 'EADDRINUSE_KILL_FAILED',
                });
                return;
              }
            }

            resolve({
              success: false,
              error: `Port ${finalPort} is already in use`,
              code: 'EADDRINUSE',
            });
          } else {
            logger.error('Server error', e);
            resolve({ success: false, error: e.message });
          }
        });
      } catch (error: any) {
        logger.error('Failed to create server', error);
        resolve({ success: false, error: error.message });
      }
    });
  } catch (error: any) {
    logger.error('Configuration error', error);
    return { success: false, error: error.message };
  }
};
