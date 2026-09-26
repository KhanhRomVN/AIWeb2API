/**
 * ------------------------------------------------------------------
 * Entry Point
 * ------------------------------------------------------------------
 * Điểm khởi chạy của backend server.
 * Khởi tạo database, start server, và các background services.
 *
 * Main functions:
 * - startBackend() : Khởi động toàn bộ backend
 * - main()         : Main function với dbPath option
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as dns from 'dns';
import * as net from 'net';

// ── Env ──
import './env';

// ─── Network Fix ────────────────────────────────────────────────────────
// Node 20+ bật `autoSelectFamily` (Happy Eyeballs) mặc định: khi connect,
// nó thử song song cả IPv4 và IPv6. Trên mạng không có route IPv6 (phổ biến
// ở VN), các lần thử IPv6 nhận ENETUNREACH ngay lập tức và kết thúc toàn bộ
// attempt trước khi IPv4 kịp kết nối → ETIMEDOUT dù IPv4 thực tế reachable.
// `dns.setDefaultResultOrder('ipv4first')` KHÔNG đủ (đã kiểm chứng).
// Phải tắt autoSelectFamily để Node fallback về hành vi connect tuần tự.
// Đặt ở top-level (không chỉ trong CLI entry) để áp dụng cho mọi đường vào,
// bao gồm cả khi `startBackend()` được import từ extension.
try {
  if (typeof (net as any).setDefaultAutoSelectFamily === 'function') {
    (net as any).setDefaultAutoSelectFamily(false);
  }
} catch {
  // Node cũ không có API này — bỏ qua an toàn.
}
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// ── Server ──
import { startServer } from './server';

// ── Database ──
import { initDatabase } from './database';
import { initManagersDatabase } from './database/managers';
import { initConfigDatabase } from './database/config-db';
import { runIntegrityCheck } from './database/integrity-check';

// ── WebSocket ──
import { startWebSocketServer } from './websocket-server';

// ── Middleware ──
import { preconnectAllManagers } from './middleware/database-context.middleware';

// ── Services ──
import { accountRefreshService } from './services/account.service';

// ── Utils ──
import { createLogger } from './utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('Startup');

// ─── Main ──────────────────────────────────────────────────────────────

const main = async (options?: { dbPath?: string }) => {
  try {
    initDatabase(options?.dbPath);
    initManagersDatabase();
    initConfigDatabase();
    runIntegrityCheck();
  } catch (error) {
    logger.error('Failed to initialize database', error);
    if (require.main === module) process.exit(1);
    throw error;
  }

  const result = await startServer();

  if (result.success) {
    startWebSocketServer();
    accountRefreshService.start();
    // Kết nối trước toàn bộ database managers để Zen lấy status ngay
    // khi mở tab Database (không cần chạy health check lần đầu).
    preconnectAllManagers().catch(() => {});
  } else {
    logger.error(`Failed to start server: ${result.error}`);
    if (require.main === module) process.exit(1);
    throw new Error(result.error);
  }

  const shutdown = () => {
    if (require.main === module) process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Prevent unhandled promise rejections (e.g. browser closed mid-login)
  // from crashing the entire server process.
  process.on('unhandledRejection', (reason: any) => {
    logger.error(
      '[Server] Unhandled promise rejection (server kept alive):',
      reason,
    );
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error('[Server] Uncaught exception (server kept alive):', err);
  });
};

export const startBackend = main;

// ─── CLI Entry ─────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  let dbPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--db-path=')) {
      dbPath = arg.split('=')[1];
    } else if (arg === '--db-path' && i + 1 < args.length) {
      dbPath = args[++i];
    }
  }

  main({ dbPath }).catch((err) => {
    logger.error('Unhandled startup error', err);
    process.exit(1);
  });
}
