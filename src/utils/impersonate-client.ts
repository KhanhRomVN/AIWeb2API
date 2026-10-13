/**
 * ------------------------------------------------------------------
 * Impersonate HTTP Client (cycletls transport + wrapper dùng chung)
 * ------------------------------------------------------------------
 * Tầng thấp: Transport TLS/HTTP2 giả fingerprint trình duyệt, dùng cho các
 * provider web-session bị WAF/Cloudflare chặn khi dùng `node-fetch` (JA3 OpenSSL).
 *   - Singleton: 1 subprocess cycletls dùng chung cho mọi request, chỉ exit()
 *     khi app shutdown (gọi `closeImpersonateClient`).
 *
 * Tầng cao: Class `ImpersonateHttpClient` gắn baseURL, header mặc định và
 * profile giả lập browser lên `impersonateRequest`, cung cấp API get/post/
 * streamSSE cho provider.
 *
 * <ceiling> Chưa stream thật: cycletls buffer toàn bộ body trước khi trả.
 * — upgrade path: dùng client.sse() hoặc đổi backend (impit/curl-impersonate).
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import FormData from 'form-data';

// ── Utils ─
import { createLogger } from './logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ImpersonateClient');

/** Timeout mặc định (giây) cho request thông thường. */
export const DEFAULT_TIMEOUT_SECONDS = 120;

/**
 * Timeout cho SSE completion request — cần lớn hơn nhiều vì thinking models
 * (medium/high effort) có thể mất 5–10 phút mới trả xong response.
 * cycletls buffer toàn bộ body trước khi return nên timeout phải cover
 * thời gian provider xử lý + truyền tải toàn bộ stream.
 */
export const SSE_TIMEOUT_SECONDS = 600; // 10 phút

// ─── Types ─────────────────────────────────────────────────────────────

/** Bộ fingerprint giả lập trình duyệt, mỗi provider truyền profile của mình. */
export interface ImpersonateProfile {
  ja3: string;
  http2Fingerprint: string;
  userAgent: string;
  /** Thứ tự header; bỏ trống thì để cycletls tự quyết định. */
  headerOrder?: readonly string[];
}

export interface ImpersonateRequestOptions {
  profile: ImpersonateProfile;
  headers?: Record<string, string>;
  body?: string | Buffer | FormData;
  method?: string;
  /** Timeout tính bằng giây. Mặc định DEFAULT_TIMEOUT_SECONDS. */
  timeoutSeconds?: number;
  /** true → trả `body` stream thật (không buffer toàn bộ response). */
  stream?: boolean;
}

/**
 * Response tối giản — chỉ chứa những gì caller hiện tại cần.
 */
export interface ImpersonateResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  text(): Promise<string>;
  json(): Promise<any>;
  /** Chỉ có khi caller tự wrap (vd. streamSSE); là async iterator các chunk Buffer. */
  body?: AsyncIterable<Buffer>;
}

export interface ImpersonateHttpClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
  /** Profile giả lập browser (JA3, HTTP/2 fingerprint, header order, UA). */
  profile: ImpersonateProfile;
}

export interface ImpersonateHttpRequestOptions {
  headers?: Record<string, string>;
  body?: string | Buffer | FormData;
  method?: string;
  responseType?: 'json' | 'text' | 'arraybuffer' | 'stream';
  /** Timeout tính bằng giây, truyền thẳng vào cycletls. */
  timeoutSeconds?: number;
  /** true → `body` là stream thật (không buffer toàn bộ response). */
  stream?: boolean;
}

export type ImpersonateHttpResponse = ImpersonateResponse;

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
  darwin: {
    x64: 'index-mac',
    arm: 'index-mac-arm64',
    arm64: 'index-mac-arm64',
  },
  freebsd: { x64: 'index-freebsd' },
};

/**
 * Fix bug cycletls: `spawn(execPath, [], { shell: true })` không quote
 * path → nếu workspace có khoảng trắng, shell tách path thành nhiều token
 * → không tìm thấy binary.
 *
 * Cách xử lý: nếu path có khoảng trắng (hoặc chạy từ pkg snapshot), copy
 * binary sang `os.tmpdir()` và trả về path mới.
 */
function resolveCycletlsExecutablePath(): string | undefined {
  const binName = PLATFORM_BINARIES[process.platform]?.[os.arch()];
  if (!binName) return undefined;

  // 1. Kiểm tra bên cạnh file thực thi hoặc trong thư mục resources (khi chạy từ pkg binary)
  const exeDir = path.dirname(process.execPath);
  const cwd = process.cwd();
  const directCandidates = [
    path.join(exeDir, 'cycletls-index.exe'),
    path.join(exeDir, binName),
    path.join(exeDir, 'resources', 'cycletls-index.exe'),
    path.join(exeDir, 'resources', binName),
    path.join(cwd, 'cycletls-index.exe'),
    path.join(cwd, binName),
    path.join(cwd, 'dist-bin', 'cycletls-index.exe'),
  ];

  for (const candidate of directCandidates) {
    if (!candidate.includes('snapshot') && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // 2. Tìm trong cycletls package (khi chạy từ node / source)
  let cycletlsPkgDir: string | undefined;
  try {
    cycletlsPkgDir = path.dirname(require.resolve('cycletls'));
  } catch {
    // ignore
  }

  const srcPath = cycletlsPkgDir
    ? path.join(cycletlsPkgDir, binName)
    : undefined;
  const isSnapshot = srcPath
    ? srcPath.includes('snapshot') ||
      process.execPath.includes('snapshot') ||
      __dirname.includes('snapshot')
    : false;

  // Nếu file tồn tại trên ổ đĩa thật (không phải virtual snapshot và không có khoảng trắng)
  if (
    srcPath &&
    fs.existsSync(srcPath) &&
    !isSnapshot &&
    !srcPath.includes(' ')
  ) {
    return srcPath;
  }

  // 3. Nếu chạy từ virtual snapshot hoặc đường dẫn có khoảng trắng:
  // Copy / Extract ra os.tmpdir() để có thể spawn được.
  try {
    const tmpDir = path.join(os.tmpdir(), 'aiweb2api-cycletls');
    const dstPath = path.join(tmpDir, binName);

    if (srcPath && fs.existsSync(srcPath)) {
      const srcBuf = fs.readFileSync(srcPath);
      let needsWrite = true;
      if (fs.existsSync(dstPath)) {
        try {
          const dstStat = fs.statSync(dstPath);
          if (dstStat.size === srcBuf.length) {
            needsWrite = false;
          }
        } catch {
          needsWrite = true;
        }
      }
      if (needsWrite) {
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(dstPath, srcBuf);
        if (process.platform !== 'win32') {
          fs.chmodSync(dstPath, 0o755);
        }
      }
      return dstPath;
    }
  } catch (e) {
    logger.warn(
      '[ImpersonateClient] Failed to extract cycletls binary to tmp:',
      e,
    );
  }

  return undefined;
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
        'cycletls is not installed. Run `npm install cycletls` to enable impersonated providers. ' +
          'This package is required to bypass TLS fingerprinting.',
      );
    }

    const executablePath = resolveCycletlsExecutablePath();
    if (!executablePath || !fs.existsSync(executablePath)) {
      throw new Error(
        'cycletls binary not found. Impersonated providers require the cycletls binary (e.g. cycletls-index.exe) next to the executable.',
      );
    }

    const factory = initCycleTLS.default || initCycleTLS;
    const client = (await factory({
      timeout: 120_000,
      autoExit: false,
      executablePath,
    })) as CycleTLSClient;
    sharedClient = client;
    return client;
  })();

  // Init lỗi thì reset để lần gọi sau thử lại thay vì cache promise rejected.
  initPromise.catch(() => {
    initPromise = null;
  });

  return initPromise;
}

/**
 * Đóng singleton cycletls. Gọi trong shutdown hook để tránh leak
 * Go subprocess.
 */
export async function closeImpersonateClient(): Promise<void> {
  if (!sharedClient) return;
  try {
    await sharedClient.exit();
  } catch (e) {
    logger.warn('[ImpersonateClient] Error while closing cycletls:', e);
  } finally {
    sharedClient = null;
    initPromise = null;
  }
}

// ─── Request ────────────────────────────────────────────────────────────

/**
 * Gửi 1 request với fingerprint của `options.profile`.
 * Response được buffer hoàn toàn (xem <ceiling> ở đầu file).
 */
export async function impersonateRequest(
  url: string,
  options: ImpersonateRequestOptions,
): Promise<ImpersonateResponse> {
  const client = await getClient();
  const { profile } = options;

  // cycletls nhận `body` dạng string, URLSearchParams, hoặc FormData.
  // Buffer không hỗ trợ trực tiếp — nếu cần truyền binary phải dùng FormData.
  const body: string | FormData | undefined =
    options.body instanceof FormData
      ? options.body
      : typeof options.body === 'string'
        ? options.body
        : options.body !== undefined
          ? options.body.toString('utf-8')
          : undefined;

  const response = await client(
    url,
    {
      body,
      headers: options.headers || {},
      ja3: profile.ja3,
      http2Fingerprint: profile.http2Fingerprint,
      ...(profile.headerOrder
        ? { headerOrder: [...profile.headerOrder], orderAsProvided: false }
        : {}),
      userAgent: profile.userAgent,
      disableRedirect: false,
      responseType: options.stream ? 'stream' : 'text',
      timeout: options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
    },
    (options.method || 'GET').toLowerCase() as any,
  );

  // cycletls có thể trả `data` là string (text/SSE) hoặc object (JSON đã
  // parse sẵn). Giữ cả 2 đường đi để `text()` trả raw string và `json()`
  // trả object không cần round-trip.
  const responseHeaders = normalizeHeaders(response.headers);

  // Stream thật: cycletls trả `data` là Readable live. Nếu lỗi xảy ra trước
  // khi có header, `data` là string → rơi xuống nhánh buffer bên dưới.
  if (
    options.stream &&
    response.data &&
    typeof response.data.on === 'function'
  ) {
    const readable = response.data as AsyncIterable<Buffer | string>;
    const body: AsyncIterable<Buffer> = {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of readable) {
          yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        }
      },
    };
    // text()/json() đọc hết stream; sau đó không dùng lại `body` được.
    let allText: Promise<string> | null = null;
    const readAll = (): Promise<string> => {
      if (!allText) {
        allText = (async () => {
          const parts: Buffer[] = [];
          for await (const c of body) parts.push(c);
          return Buffer.concat(parts).toString('utf-8');
        })();
      }
      return allText;
    };
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: responseHeaders,
      text: readAll,
      json: async () => JSON.parse(await readAll()),
      body,
    };
  }

  const rawData = response.data;
  const isObjectData = rawData !== null && typeof rawData === 'object';

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    headers: responseHeaders,
    text: async () =>
      typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
    json: async () => (isObjectData ? rawData : JSON.parse(String(rawData))),
  };
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

// ─── High-level Client Wrapper ──────────────────────────────────────────

/**
 * Client HTTP giả lập browser cho provider 'website'.
 * Mỗi provider truyền `profile` của mình khi khởi tạo.
 */
export class ImpersonateHttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private profile: ImpersonateProfile;

  constructor(options: ImpersonateHttpClientOptions) {
    this.baseURL = options.baseURL || '';
    this.defaultHeaders = options.headers || {};
    this.profile = options.profile;
  }

  async request(
    url: string,
    options: ImpersonateHttpRequestOptions = {},
  ): Promise<ImpersonateHttpResponse> {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    return impersonateRequest(fullURL, {
      profile: this.profile,
      method: options.method,
      body: options.body,
      timeoutSeconds: options.timeoutSeconds,
      stream: options.stream,
      headers: {
        ...this.defaultHeaders,
        ...(options.headers || {}),
      },
    });
  }

  async get(
    url: string,
    options: Omit<ImpersonateHttpRequestOptions, 'method'> = {},
  ): Promise<ImpersonateHttpResponse> {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(
    url: string,
    body?: any,
    options: Omit<ImpersonateHttpRequestOptions, 'method' | 'body'> = {},
  ): Promise<ImpersonateHttpResponse> {
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
   * SSE stream thật: dùng cycletls `responseType: 'stream'` nên `body` yield
   * chunk ngay khi upstream gửi. parseSSEStream tự buffer + split \n.
   *
   * <ceiling> Lỗi giữa chừng khi đang đọc body bị cycletls đóng stream êm
   * (không throw) → response cụt trông như kết thúc bình thường.
   * — upgrade path: kiểm tra event kết thúc (vd. message_stop) ở caller.
   */
  async streamSSE(
    url: string,
    options: Omit<ImpersonateHttpRequestOptions, 'method'> = {},
  ): Promise<ImpersonateHttpResponse> {
    return this.request(url, {
      ...options,
      method: 'POST',
      stream: true,
      timeoutSeconds: SSE_TIMEOUT_SECONDS,
      headers: {
        Accept: 'text/event-stream',
        ...options.headers,
      },
    });
  }
}
