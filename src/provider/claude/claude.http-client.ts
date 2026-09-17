/**
 * ------------------------------------------------------------------
 * Claude HTTP Client (cycletls transport)
 * ------------------------------------------------------------------
 * Wrapper quanh cycletls — TLS/HTTP2 transport giả Chrome fingerprint.
 *
 * Lý do tồn tại: `node-fetch` (dùng OpenSSL default) có JA3 fingerprint
 * khác Chrome → Cloudflare luôn bật challenge "Just a moment..." dù cookie
 * `cf_clearance` hợp lệ. cycletls dùng uTLS của Go để replicate ClientHello
 * của Chrome, qua được challenge.
 *
 * Singleton: 1 subprocess cycletls dùng chung cho mọi request, chỉ exit()
 * khi app shutdown (tiết kiệm spawn cost + giữ HTTP/2 keep-alive).
 *
 * Public API cố tình giống HttpClient cũ (get/post/streamSSE) để caller
 * ít phải sửa. Nhưng trả `ClaudeHttpResponse` (không phải node-fetch Response)
 * vì cycletls không tương thích interface chuẩn.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ── Utils ──
import { createLogger } from '../../utils/logger';

// ── Constants ──
import {
  CHROME_JA3,
  CHROME_HTTP2_FINGERPRINT,
  CHROME_HEADER_ORDER,
  USER_AGENT,
} from './claude.constant';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ClaudeHttpClient');

// ─── Types ──────────────────────────────────────────────────────────────

export interface ClaudeHttpClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
}

export interface ClaudeHttpRequestOptions {
  headers?: Record<string, string>;
  body?: string | Buffer;
  method?: string;
  responseType?: 'json' | 'text' | 'arraybuffer' | 'stream';
}

/**
 * Response tối giản — chỉ chứa những gì caller hiện tại cần
 * (`ok`, `status`, `text()`, `json()`, `body`).
 */
export interface ClaudeHttpResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  text(): Promise<string>;
  json(): Promise<any>;
  /** Chỉ có khi `responseType: 'stream'`; là async iterator các chunk Buffer. */
  body?: AsyncIterable<Buffer>;
}

// ─── cycletls lazy loader ───────────────────────────────────────────────

type CycleTLSClient = {
  (
    url: string,
    options: Record<string, any>,
    method?: string,
  ): Promise<{
    status: number;
    headers: Record<string, any>;
    data: any;
    text(): Promise<string>;
    json(): Promise<any>;
  }>;
  exit(): Promise<undefined>;
  sse?(url: string, options: Record<string, any>): Promise<any>;
};

let sharedClient: CycleTLSClient | null = null;
let initPromise: Promise<CycleTLSClient> | null = null;

/** Map platform/arch → tên binary, khớp với cycletls/dist/index.js. */
const PLATFORM_BINARIES: Record<string, Record<string, string>> = {
  win32: { x64: 'index.exe' },
  linux: { arm: 'index-arm', arm64: 'index-arm64', x64: 'index' },
  darwin: { x64: 'index-mac', arm: 'index-mac-arm64', arm64: 'index-mac-arm64' },
  freebsd: { x64: 'index-freebsd' },
};

/**
 * Fix bug cycletls: `spawn(execPath, [], { shell: true })` không quote
 * path → nếu workspace có khoảng trắng (vd. "AIWeb2API & Zen"), shell
 * tách path thành nhiều token → không tìm thấy binary.
 *
 * Cách xử lý: nếu path có khoảng trắng, copy binary sang `os.tmpdir()`
 * (thường không có khoảng trắng) và trả về path mới. Cache theo
 * platform + arch + mtime.
 */
function resolveCycletlsExecutablePath(): string | undefined {
  let cycletlsPkgDir: string;
  try {
    cycletlsPkgDir = path.dirname(require.resolve('cycletls'));
  } catch {
    return undefined;
  }

  const binName =
    PLATFORM_BINARIES[process.platform]?.[os.arch()];
  if (!binName) return undefined;

  const srcPath = path.join(cycletlsPkgDir, binName);
  if (!fs.existsSync(srcPath)) {
    logger.warn(`[ClaudeHttpClient] cycletls binary not found: ${srcPath}`);
    return undefined;
  }

  // Path không có khoảng trắng → không cần copy, để cycletls tự resolve.
  if (!srcPath.includes(' ')) return undefined;

  try {
    const stat = fs.statSync(srcPath);
    const cacheDir = path.join(
      os.tmpdir(),
      `elara-cycletls-${process.platform}-${os.arch()}-${stat.mtimeMs}`,
    );
    const dstPath = path.join(cacheDir, binName);

    if (!fs.existsSync(dstPath)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.copyFileSync(srcPath, dstPath);
      if (process.platform !== 'win32') {
        fs.chmodSync(dstPath, 0o755);
      }
      logger.info(
        `[ClaudeHttpClient] Copied cycletls binary to ${dstPath} (source path had spaces)`,
      );
    }
    return dstPath;
  } catch (e) {
    logger.warn(
      '[ClaudeHttpClient] Failed to copy cycletls binary to tmp:',
      e,
    );
    return undefined;
  }
}

/**
 * Lazy init + cache cycletls singleton. Throw rõ ràng nếu package không
 * cài được (optionalDependency) — KHÔNG fallback về node-fetch để tránh
 * che giấu lỗi 403.
 */
async function getClient(): Promise<CycleTLSClient> {
  if (sharedClient) return sharedClient;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let initCycleTLS: any;
    try {
      // require động để tránh crash lúc import nếu package chưa cài.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      initCycleTLS = require('cycletls');
    } catch (e) {
      throw new Error(
        'cycletls is not installed. Run `npm install cycletls` to enable Claude provider. ' +
          'This package is required to bypass Cloudflare TLS fingerprinting.',
      );
    }

    const executablePath = resolveCycletlsExecutablePath();
    const factory = initCycleTLS.default || initCycleTLS;
    const client = (await factory({
      timeout: 120_000,
      autoExit: false,
      ...(executablePath ? { executablePath } : {}),
    })) as CycleTLSClient;
    sharedClient = client;
    logger.info('[ClaudeHttpClient] cycletls initialized');
    return client;
  })();

  return initPromise;
}

/**
 * Đóng singleton cycletls. Nên gọi trong shutdown hook để tránh leak
 * Go subprocess.
 */
export async function closeClaudeHttpClient(): Promise<void> {
  if (!sharedClient) return;
  try {
    await sharedClient.exit();
  } catch (e) {
    logger.warn('[ClaudeHttpClient] Error while closing cycletls:', e);
  } finally {
    sharedClient = null;
    initPromise = null;
  }
}

// ─── Class ──────────────────────────────────────────────────────────────

export class ClaudeHttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: ClaudeHttpClientOptions = {}) {
    this.baseURL = options.baseURL || '';
    this.defaultHeaders = options.headers || {};
  }

  async request(
    url: string,
    options: ClaudeHttpRequestOptions = {},
  ): Promise<ClaudeHttpResponse> {
    const client = await getClient();
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options.headers || {}),
    };

    // cycletls nhận `body` dạng string cho JSON. Buffer (multipart) không
    // hỗ trợ trực tiếp ở field body — upload file phải convert qua string
    // nhị phân; hiện tại Claude upload dùng JSON base64 → giữ string.
    const body =
      typeof options.body === 'string'
        ? options.body
        : options.body?.toString('utf-8');

    const response = await client(fullURL, {
      body,
      headers: mergedHeaders,
      ja3: CHROME_JA3,
      http2Fingerprint: CHROME_HTTP2_FINGERPRINT,
      headerOrder: [...CHROME_HEADER_ORDER],
      orderAsProvided: false,
      userAgent: USER_AGENT,
      disableRedirect: false,
      responseType: 'text',
      timeout: 120,
    }, (options.method || 'GET').toLowerCase() as any);

    // cycletls có thể trả `data` là string (text/SSE) hoặc object (JSON đã
    // parse sẵn). Giữ cả 2 đường đi để `text()` trả raw string và `json()`
    // trả object không cần round-trip.
    const responseHeaders = normalizeHeaders(response.headers);
    const rawData = response.data;
    const isObjectData = rawData !== null && typeof rawData === 'object';

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: responseHeaders,
      text: async () =>
        typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
      json: async () =>
        isObjectData ? rawData : JSON.parse(String(rawData)),
    };
  }

  async get(
    url: string,
    options: Omit<ClaudeHttpRequestOptions, 'method'> = {},
  ): Promise<ClaudeHttpResponse> {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(
    url: string,
    body?: any,
    options: Omit<ClaudeHttpRequestOptions, 'method' | 'body'> = {},
  ): Promise<ClaudeHttpResponse> {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * SSE stream: cycletls hiện trả full body khi responseType='text'.
   * Để tránh phá vỡ interface, wrap text thành async iterable 1 chunk.
   * parseSSEStream hiện tại vẫn xử lý được (nó buffer + split \n).
   *
   * <ceiling> Streaming thật sự cần cycletls.sse() API riêng — hiện chưa
   * dùng để tránh rủi ro. — upgrade path: dùng client.sse() khi cần
   * streaming incremental.
   */
  async streamSSE(
    url: string,
    options: Omit<ClaudeHttpRequestOptions, 'method'> = {},
  ): Promise<ClaudeHttpResponse> {
    const res = await this.request(url, {
      ...options,
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        ...options.headers,
      },
    });

    const textOnce = res.text;
    const text = await textOnce();

    return {
      ...res,
      text: async () => text,
      body: {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(text, 'utf-8');
        },
      },
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Chuẩn hóa header map về lowercase key + string value. */
function normalizeHeaders(
  input: Record<string, any> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) {
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}