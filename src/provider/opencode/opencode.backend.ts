/**
 * ------------------------------------------------------------------
 * OpenCode Backend
 * ------------------------------------------------------------------
 * Tự cài opencode-ai 1.x (thư mục riêng ở HOME) và spawn
 * `opencode serve` khi backend local chưa chạy. Chỉ áp dụng cho
 * serverUrl loopback; URL từ xa giữ nguyên hành vi health check.
 *
 * Main functions:
 * - ensureBackend() : Health check, spawn nếu chưa chạy, chờ healthy
 * - stopBackend()   : Kill process do provider spawn
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { ChildProcess, execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

import { createLogger } from '../../utils/logger';

import { checkHealth } from './opencode.client';
import {
  BACKEND_INSTALL_DIR_NAME,
  BACKEND_INSTALL_TIMEOUT_MS,
  BACKEND_LOCAL_HOSTS,
  BACKEND_PACKAGE_VERSION,
  BACKEND_START_POLL_MS,
  BACKEND_START_TIMEOUT_MS,
  BACKEND_UNREACHABLE_REGEX,
  DEFAULT_SERVER_PORT,
} from './opencode.constant';
import { OpenCodeCredential } from './opencode.types';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('OpenCodeBackend');

const execFileAsync = promisify(execFile);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const IS_WINDOWS = process.platform === 'win32';

let backendProcess: ChildProcess | null = null;
let startingPromise: Promise<void> | null = null;

// ─── Install ────────────────────────────────────────────────────────────

function installDir(): string {
  return path.join(os.homedir(), BACKEND_INSTALL_DIR_NAME);
}

function binPath(): string {
  const bin = IS_WINDOWS ? 'opencode.cmd' : 'opencode';
  return path.join(installDir(), 'node_modules', '.bin', bin);
}

async function ensureInstalled(): Promise<string> {
  const bin = binPath();
  if (fs.existsSync(bin)) return bin;

  await execFileAsync(
    IS_WINDOWS ? 'npm.cmd' : 'npm',
    [
      'install',
      '--prefix',
      installDir(),
      `opencode-ai@${BACKEND_PACKAGE_VERSION}`,
    ],
    { timeout: BACKEND_INSTALL_TIMEOUT_MS, shell: IS_WINDOWS },
  );
  if (!fs.existsSync(bin)) {
    throw new Error(
      `Cài opencode-ai@${BACKEND_PACKAGE_VERSION} xong nhưng không thấy ${bin}`,
    );
  }
  return bin;
}

// ─── Start / Stop ───────────────────────────────────────────────────────

export function stopBackend(): void {
  if (backendProcess && !backendProcess.killed) backendProcess.kill('SIGTERM');
  backendProcess = null;
}

async function startBackend(cred: OpenCodeCredential, url: URL): Promise<void> {
  const bin = await ensureInstalled();

  const env = { ...process.env };
  delete env.OPENCODE_SERVER_PASSWORD;
  delete env.OPENCODE_API_KEY;
  if (cred.password) env.OPENCODE_SERVER_PASSWORD = cred.password;

  const proc = spawn(
    bin,
    [
      'serve',
      '--port',
      url.port || DEFAULT_SERVER_PORT,
      '--hostname',
      url.hostname,
    ],
    { env, stdio: 'ignore', shell: IS_WINDOWS },
  );
  backendProcess = proc;

  let exited = false;
  proc.on('exit', (code, signal) => {
    exited = true;
    if (backendProcess === proc) backendProcess = null;
    logger.warn(
      `[OpenCode] opencode serve thoát: code=${code} signal=${signal}`,
    );
  });
  proc.on('error', (e) => {
    exited = true;
    if (backendProcess === proc) backendProcess = null;
    logger.error('[OpenCode] Không spawn được opencode serve:', e);
  });

  const deadline = Date.now() + BACKEND_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited) throw new Error('opencode serve thoát sớm khi khởi động.');
    try {
      await checkHealth(cred);
      return;
    } catch {
      await sleep(BACKEND_START_POLL_MS);
    }
  }

  stopBackend();
  throw new Error(
    `opencode serve không healthy sau ${BACKEND_START_TIMEOUT_MS / 1000}s.`,
  );
}

// ─── Ensure ─────────────────────────────────────────────────────────────

export async function ensureBackend(cred: OpenCodeCredential): Promise<void> {
  const url = new URL(cred.serverUrl);
  try {
    await checkHealth(cred);
    return;
  } catch (e) {
    const unreachable = BACKEND_UNREACHABLE_REGEX.test((e as Error).message);
    if (!BACKEND_LOCAL_HOSTS.includes(url.hostname) || !unreachable) throw e;
  }

  if (!startingPromise) {
    startingPromise = startBackend(cred, url).finally(() => {
      startingPromise = null;
    });
  }
  await startingPromise;
}

process.on('exit', stopBackend);
