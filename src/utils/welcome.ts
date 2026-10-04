/**
 * ------------------------------------------------------------------
 * Welcome UI
 * ------------------------------------------------------------------
 * Banner + about section + interactive host/port picker shown before the
 * server starts. Automatically skips all prompts (uses defaults) when
 * stdin is not a TTY.
 *
 * Main functions:
 * - showWelcome()   : Print banner/intro, ask for host/port, return { host, port }
 * - printStarted()  : Print the "server is running" card
 * - printCancelled(): Print the cancellation message
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import * as net from 'net';
import * as dns from 'dns';
import * as os from 'os';
import * as readline from 'readline';
import { getLastPort, saveLastPort } from './preferences';

// ─── Version ────────────────────────────────────────────────────────────
// Read from package.json — falls back when a pkg binary does not expose it
let APP_VERSION = '?.?.?';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../../package.json');
  APP_VERSION = pkg.version ?? APP_VERSION;
} catch {
  // ignored inside the binary
}

// ─── ANSI helpers ───────────────────────────────────────────────────────
const IS_TTY = Boolean(process.stdout.isTTY);
const USE_COLOR = IS_TTY && !process.env['NO_COLOR'];

const ansi =
  (code: string) =>
  (t: string): string =>
    USE_COLOR ? `\x1b[${code}m${t}\x1b[0m` : t;

const fg256 =
  (n: number) =>
  (t: string): string =>
    USE_COLOR ? `\x1b[38;5;${n}m${t}\x1b[0m` : t;

const bold = ansi('1');
const dim = ansi('2');
const green = ansi('1;32');
const red = ansi('1;31');
const yellow = ansi('1;33');
const cyan = ansi('1;36');
const blue = fg256(39);

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/** Visible length of a string (ANSI escape codes removed). */
const vlen = (s: string): number => s.replace(ANSI_RE, '').length;

/** Right-pad a string to a visible width. */
const padEnd = (s: string, width: number): string =>
  s + ' '.repeat(Math.max(0, width - vlen(s)));

// ─── Layout helpers ─────────────────────────────────────────────────────
const MIN_WIDTH = 44;
const MAX_WIDTH = 72;

/** Card width adapted to the current terminal size. */
function cardWidth(): number {
  const cols = process.stdout.columns || 80;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, cols - 4));
}

/** Word-wrap plain text to a given width. */
function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    if (!cur) cur = word;
    else if (cur.length + 1 + word.length <= width) cur += ' ' + word;
    else {
      out.push(cur);
      cur = word;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const print = (lines: string[]): void =>
  lines.forEach((l) => console.log('  ' + l));

// ─── Banner ─────────────────────────────────────────────────────────────

const BANNER_LINES = [
  ' █████╗ ██╗██╗    ██╗███████╗██████╗ ██████╗  █████╗ ██████╗ ██╗',
  '██╔══██╗██║██║    ██║██╔════╝██╔══██╗╚════██╗██╔══██╗██╔══██╗██║',
  '███████║██║██║ █╗ ██║█████╗  ██████╔╝ █████╔╝███████║██████╔╝██║',
  '██╔══██║██║██║███╗██║██╔══╝  ██╔══██╗██╔═══╝ ██╔══██║██╔═══╝ ██║',
  '██║  ██║██║╚███╔███╔╝███████╗██████╔╝███████╗██║  ██║██║     ██║',
  '╚═╝  ╚═╝╚═╝ ╚══╝╚══╝ ╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝',
];

// Gradient: cyan → blue (256-color palette)
const GRADIENT = [51, 45, 39, 33, 27, 21];

const TAGLINE = 'Turn any web AI into an API';
const BANNER_WIDTH = 65;

function printBanner(): void {
  const cols = process.stdout.columns || 80;
  console.log();

  if (cols >= BANNER_WIDTH + 4) {
    BANNER_LINES.forEach((line, i) => {
      console.log('  ' + fg256(GRADIENT[i % GRADIENT.length])(line));
    });
    console.log();
  } else {
    // Narrow terminal: compact one-line title instead of the ASCII art
    console.log('  ' + fg256(45)('◆ ') + bold('AIWeb2API'));
  }

  console.log('  ' + bold(TAGLINE) + '  ' + dim(`v${APP_VERSION}`));
  console.log();
}

// ─── Update warning ─────────────────────────────────────────────────────

// GitHub redirects /releases/latest to the newest release tag page
const RELEASES_URL = 'https://github.com/KhanhRomVN/AIWeb2API/releases/latest';
// GitHub API endpoint for latest release — returns JSON with tag_name
const GITHUB_API_LATEST = 'https://api.github.com/repos/KhanhRomVN/AIWeb2API/releases/latest';

/**
 * Parse a semver string like "v2.0.2" or "2.0.2" into [major, minor, patch].
 * Returns null if the format is invalid.
 */
function parseSemver(v: string): [number, number, number] | null {
  const m = v.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/**
 * Returns true if `latest` is strictly newer than `current`.
 * Both must be valid semver strings (with or without leading "v").
 */
function isOutdated(current: string, latest: string): boolean {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  if (!c || !l) return false;
  if (l[0] !== c[0]) return l[0] > c[0];
  if (l[1] !== c[1]) return l[1] > c[1];
  return l[2] > c[2];
}

/** Fetch the latest release tag from GitHub. Returns null on any error. */
async function fetchLatestVersion(): Promise<string | null> {
  try {
    const https = await import('https');
    return await new Promise<string | null>((resolve) => {
      const req = https.get(
        GITHUB_API_LATEST,
        {
          headers: {
            'User-Agent': `AIWeb2API/${APP_VERSION}`,
            Accept: 'application/vnd.github+json',
          },
          timeout: 4000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => (body += chunk.toString()));
          res.on('end', () => {
            try {
              const json = JSON.parse(body) as { tag_name?: string };
              resolve(json.tag_name ?? null);
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

/** Cached result so we only hit GitHub once per process */
let _cachedOutdated: { outdated: boolean; latestVersion: string } | null = null;
let _versionChecked = false;

async function getUpdateStatus(): Promise<{ outdated: boolean; latestVersion: string }> {
  if (_versionChecked) return _cachedOutdated ?? { outdated: false, latestVersion: APP_VERSION };
  _versionChecked = true;
  const latest = await fetchLatestVersion();
  const outdated = latest ? isOutdated(APP_VERSION, latest) : false;
  _cachedOutdated = { outdated, latestVersion: latest ?? APP_VERSION };
  return _cachedOutdated;
}

async function printUpdateWarning(): Promise<void> {
  const { outdated, latestVersion } = await getUpdateStatus();
  if (!outdated) return;

  const width = cardWidth();
  const textWidth = width - 4;
  const bar = red('▌') + ' ';
  const blank = red('▌');

  const lines: string[] = [
    bar + red('⚠ UPDATE REQUIRED') + yellow(`  v${APP_VERSION} → ${latestVersion}`),
    blank,
    ...wrap(
      'Open the Releases page, download the latest version and replace this one.',
      textWidth,
    ).map((l) => bar + yellow(l)),
    blank,
    bar + red('↗ ') + yellow(RELEASES_URL),
  ];

  print(lines);
  console.log();
}

// ─── About / ecosystem (borderless) ─────────────────────────────────────

const AUTHOR = {
  name: 'KhanhRomVN',
  role: 'Author of AIWeb2API and its companion tools',
  url: 'https://github.com/KhanhRomVN',
};

interface Tool {
  name: string;
  summary: string;
  description: string;
  url: string;
  install?: string;
}

const TOOLS: Tool[] = [
  {
    name: 'Zen',
    summary: 'AI coding agent for VS Code',
    description:
      'Chat with any LLM through API keys or free web accounts, with checkpoints, permission modes and a skills marketplace.',
    url: 'https://github.com/KhanhRomVN/Zen',
  },
  {
    name: 'ZenCLI',
    summary: 'AI coding agent for the terminal',
    description:
      'Terminal-native companion to Zen with a rich TUI, slash commands and persistent history.',
    install: 'npm install -g @khanhromvn/zencli',
    url: 'https://github.com/KhanhRomVN/ZenCLI',
  },
];

/** Section heading: "── Title ─────────────" */
function sectionTitle(label: string, width: number): string {
  const rule = '─'.repeat(Math.max(2, width - vlen(label) - 4));
  return `${dim('──')} ${bold(label)} ${dim(rule)}`;
}

function printIntro(): void {
  const width = cardWidth();
  const bar = dim('│') + '  '; // left gutter for item bodies
  const textWidth = width - 4; // gutter (3) + 1 spare
  const lines: string[] = [];

  // ── Developer ─────────────────────────────────────────────────────
  lines.push(sectionTitle('Developer', width));
  lines.push('');
  lines.push(`${blue('◆')} ${bold(AUTHOR.name)}`);
  wrap(AUTHOR.role, textWidth).forEach((l) => lines.push(bar + dim(l)));
  lines.push(bar + cyan('↗ ') + cyan(AUTHOR.url));
  lines.push('');

  // ── Companion tools ───────────────────────────────────────────────
  lines.push(sectionTitle('Companion tools', width));

  for (const tool of TOOLS) {
    lines.push('');
    lines.push(`${blue('◆')} ${bold(tool.name)}  ${dim(tool.summary)}`);
    wrap(tool.description, textWidth).forEach((l) => lines.push(bar + l));
    if (tool.install) {
      lines.push(bar + green('$ ') + bold(tool.install));
    }
    lines.push(bar + cyan('↗ ') + cyan(tool.url));
  }

  lines.push('');
  print(lines);
}

// ─── Input helpers ──────────────────────────────────────────────────────

type Answer =
  | { kind: 'line'; value: string }
  | { kind: 'eof' } // Ctrl+D
  | { kind: 'cancel' }; // Ctrl+C

/** One readline interface reused for every prompt in the session. */
function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let pending: ((a: Answer) => void) | null = null;
  const settle = (a: Answer): void => {
    const fn = pending;
    pending = null;
    fn?.(a);
  };

  rl.on('SIGINT', () => settle({ kind: 'cancel' }));
  rl.on('close', () => settle({ kind: 'eof' }));

  return {
    ask(question: string): Promise<Answer> {
      return new Promise((resolve) => {
        pending = resolve;
        rl.question(question, (ans) =>
          settle({ kind: 'line', value: ans.trim() }),
        );
      });
    },
    close(): void {
      rl.removeAllListeners('close');
      rl.close();
    },
  };
}

/**
 * Parse user input: '9000', ':9000', 'localhost:9000', 'http://...'
 * Throws an Error if the input is invalid.
 */
function parseTarget(
  raw: string,
  defaultHost: string,
): { host: string; port: number } {
  raw = raw.trim();

  // Digits only → use the default host
  if (/^\d+$/.test(raw)) {
    return { host: defaultHost, port: parseInt(raw, 10) };
  }

  const urlStr = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error('Invalid format. Examples: 9000 or localhost:9000');
  }

  const host = url.hostname || (raw.startsWith(':') ? defaultHost : '');
  const port = url.port ? parseInt(url.port, 10) : NaN;

  if (!host)
    throw new Error(
      'Could not read the address. Examples: 9000 or localhost:9000',
    );
  if (isNaN(port)) throw new Error('Missing port. Example: localhost:9000');

  return { host, port };
}

function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Port must be between 1 and 65535.');
  }
}

// ─── Port availability check ─────────────────────────────────────────────

async function resolveHost(host: string): Promise<string> {
  if (net.isIP(host)) return host;
  if (host === 'localhost') return '127.0.0.1';
  try {
    const { address } = await dns.promises.lookup(host);
    return address;
  } catch {
    throw new Error(`Could not resolve host '${host}'.`);
  }
}

/**
 * Returns null if the port can be bound, otherwise an error message.
 * Uses a bind probe (listen + close), which is more reliable than a
 * connect probe: it also catches permission and wrong-interface errors.
 */
async function checkAvailable(
  host: string,
  port: number,
): Promise<string | null> {
  let ip: string;
  try {
    ip = await resolveHost(host);
  } catch (e: any) {
    return e.message as string;
  }

  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.once('error', (err: NodeJS.ErrnoException) => {
      switch (err.code) {
        case 'EADDRINUSE':
          return resolve(`Port ${port} is already in use by another process.`);
        case 'EACCES':
        case 'EPERM':
          return resolve(
            `Permission denied for port ${port} (ports below 1024 need admin rights).`,
          );
        case 'EADDRNOTAVAIL':
          return resolve(`Address '${host}' is not available on this machine.`);
        default:
          return resolve(null); // unknown error → let startup surface it
      }
    });
    srv.listen({ host: ip, port, exclusive: true }, () => {
      srv.close(() => resolve(null));
    });
  });
}

// ─── Interactive picker ──────────────────────────────────────────────────

export interface ServerAddress {
  host: string;
  port: number;
}

const displayHostOf = (host: string): string =>
  host === '0.0.0.0' || host === '::' ? 'localhost' : host;

/**
 * Ask for host/port. If stdin is not a TTY, returns the defaults immediately.
 * Ctrl+C cancels and exits; Enter or Ctrl+D accepts the current value.
 *
 * Logic port:
 * 1. Nếu có port đã lưu từ lần trước → hỏi xác nhận dùng lại (kèm cảnh báo nếu bị chiếm)
 * 2. Nếu không có → hỏi có dùng port mặc định không
 * 3. Người dùng có thể nhập port/address mới bất kỳ lúc nào
 * 4. Nếu người dùng nhập port mới (khác default) → lưu lại vào preferences
 */
async function askServerAddress(
  defaultHost: string,
  defaultPort: number,
): Promise<ServerAddress> {
  if (!process.stdin.isTTY) {
    return { host: defaultHost, port: defaultPort };
  }

  // ── Xác định port khởi đầu (saved hoặc default) ───────────────────
  const savedPort = getLastPort();
  const hasSaved = savedPort !== undefined && savedPort !== defaultPort;

  let currentHost = defaultHost;
  let currentPort = hasSaved ? savedPort! : defaultPort;

  // ── Kiểm tra port hiện tại có bị chiếm không ──────────────────────
  const initialPortErr = await checkAvailable(currentHost, currentPort);

  const url = `http://${displayHostOf(currentHost)}:${currentPort}`;

  if (hasSaved) {
    // Có port đã lưu → thông báo
    if (initialPortErr) {
      console.log(
        `  ${yellow('!')} Last used port ${bold(String(currentPort))} is currently in use.`,
      );
    } else {
      console.log(
        `  ${cyan('?')} Start AIWeb2API at ${bold(url)} ? ${dim(`(last used)`)}`,
      );
    }
  } else {
    console.log(`  ${cyan('?')} Start the AIWeb2API server at ${bold(url)} ?`);
  }

  console.log(dim('    Enter a port or address (e.g. 9000, localhost:9000)'));
  console.log(dim('    Press ENTER to accept · Ctrl+C to cancel'));
  console.log();

  // Nếu port bị chiếm, nhắc ngay sau dòng hỏi
  if (initialPortErr) {
    console.log(
      `  ${red('✗')} ${initialPortErr} Please enter a different port.\n`,
    );
  }

  const prompt = createPrompt();

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const answer = await prompt.ask(`  ${cyan('›')} `);

      if (answer.kind === 'cancel') {
        prompt.close();
        printCancelled();
        process.exit(130);
      }

      // EOF (Ctrl+D) hoặc ENTER → chấp nhận currentPort
      // (nếu currentPort bị chiếm, không cho qua — phải nhập port mới)
      if (answer.kind === 'eof' || answer.value === '') {
        if (
          initialPortErr &&
          currentPort === (hasSaved ? savedPort! : defaultPort)
        ) {
          // Port vẫn bị chiếm, user ấn Enter mà không nhập gì → nhắc lại
          console.log(
            `  ${red('✗')} ${initialPortErr} Please enter a different port.\n`,
          );
          continue;
        }
        break;
      }

      let parsed: ServerAddress;
      try {
        parsed = parseTarget(answer.value, currentHost);
        validatePort(parsed.port);
      } catch (e: any) {
        console.log(`  ${red('✗')} ${e.message}\n`);
        continue;
      }

      const portErr = await checkAvailable(parsed.host, parsed.port);
      if (portErr) {
        console.log(
          `  ${red('✗')} ${portErr} Please enter a different port.\n`,
        );
        continue;
      }

      currentHost = parsed.host;
      currentPort = parsed.port;
      break;
    }
  } finally {
    prompt.close();
  }

  // Lưu port nếu khác với default (người dùng đã chọn tường minh)
  saveLastPort(currentPort, defaultPort);

  return { host: currentHost, port: currentPort };
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Show the banner + about section, then ask for host/port.
 * Call before startServer(). Returns the address the user selected.
 */
export async function showWelcome(
  defaultHost: string,
  defaultPort: number,
): Promise<ServerAddress> {
  printBanner();
  if (IS_TTY) printIntro();
  await printUpdateWarning(); // bottom of the welcome screen, right above the prompt
  return askServerAddress(defaultHost, defaultPort);
}

/** First non-internal IPv4 address, used for the "Network" URL. */
function lanAddress(): string | null {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) return ni.address;
    }
  }
  return null;
}

export interface StartedOptions {
  /** WebSocket path on the same port. Default: '/ws' */
  wsPath?: string;
}

/**
 * Print the "server started" section (borderless):
 * HTTP + WebSocket endpoints for Local, and for Network when exposed.
 */
export function printStarted(
  host: string,
  port: number,
  isHttps = false,
  opts: StartedOptions = {},
): void {
  const wsPath = opts.wsPath ?? '/ws';
  const httpProto = isHttps ? 'https' : 'http';
  const wsProto = isHttps ? 'wss' : 'ws';
  const exposed = host === '0.0.0.0' || host === '::';
  const lan = exposed ? lanAddress() : null;
  const width = cardWidth();
  const LABEL_W = 9; // "WebSocket"

  const endpoints = (hostname: string): string[] => [
    `${dim(padEnd('HTTP', LABEL_W))}  ${cyan(`${httpProto}://${hostname}:${port}`)}`,
    `${dim(padEnd('WebSocket', LABEL_W))}  ${cyan(`${wsProto}://${hostname}:${port}${wsPath}`)}`,
  ];

  const lines: string[] = [
    `${green('✓')} ${bold('AIWeb2API is running')}`,
    '',
    sectionTitle('Local', width),
    ...endpoints(displayHostOf(host)),
  ];

  if (lan) {
    lines.push('', sectionTitle('Network', width), ...endpoints(lan));
  }

  lines.push('', dim('Press Ctrl+C to stop.'));

  console.log();
  print(lines);
  console.log();
}

/**
 * Print the cancellation message.
 */
export function printCancelled(): void {
  console.log(`\n\n  ${yellow('!')} Cancelled. See you next time!\n`);
}
