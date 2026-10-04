/**
 * ------------------------------------------------------------------
 * Welcome UI
 * ------------------------------------------------------------------
 * Banner + about card + interactive host/port picker shown before the
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

/** Render lines inside a rounded box with an optional title. */
function box(title: string, lines: string[], width: number): string[] {
  const inner = width - 4;
  const head = title
    ? `╭─ ${bold(title)} ${'─'.repeat(Math.max(0, width - 5 - vlen(title)))}╮`
    : `╭${'─'.repeat(width - 2)}╮`;
  const rows = lines.map((l) => `│ ${padEnd(l, inner)} │`);
  const foot = `╰${'─'.repeat(width - 2)}╯`;
  return [head, ...rows, foot].map((l, i, a) =>
    i === 0 || i === a.length - 1
      ? dim(l)
      : dim('│') + l.slice(1, -1) + dim('│'),
  );
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

// ─── About / ecosystem card ─────────────────────────────────────────────

const AUTHOR = {
  name: 'KhanhRomVN',
  url: 'https://github.com/KhanhRomVN',
};

const TOOLS = [
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

function printIntro(): void {
  const width = cardWidth();
  const inner = width - 4;
  const body: string[] = [];

  body.push(`Built by ${bold(AUTHOR.name)}`);
  body.push(cyan(AUTHOR.url));
  body.push('');
  body.push(dim('Companion tools for AIWeb2API'));

  for (const tool of TOOLS) {
    body.push('');
    body.push(`${blue('◆')} ${bold(tool.name)} ${dim('— ' + tool.summary)}`);
    wrap(tool.description, inner - 2).forEach((l) => body.push('  ' + l));
    if ('install' in tool && tool.install) {
      body.push('  ' + dim('$ ') + tool.install);
    }
    body.push('  ' + cyan(tool.url));
  }

  print(box('About', body, width));
  console.log();
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
    console.log(`  ${red('✗')} ${initialPortErr} Please enter a different port.\n`);
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
        if (initialPortErr && currentPort === (hasSaved ? savedPort! : defaultPort)) {
          // Port vẫn bị chiếm, user ấn Enter mà không nhập gì → nhắc lại
          console.log(`  ${red('✗')} ${initialPortErr} Please enter a different port.\n`);
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
 * Show the banner + about card, then ask for host/port.
 * Call before startServer(). Returns the address the user selected.
 */
export async function showWelcome(
  defaultHost: string,
  defaultPort: number,
): Promise<ServerAddress> {
  printBanner();
  if (IS_TTY) printIntro();
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

/**
 * Print the "server started" card.
 */
export function printStarted(
  host: string,
  port: number,
  isHttps = false,
): void {
  const protocol = isHttps ? 'https' : 'http';
  const exposed = host === '0.0.0.0' || host === '::';
  const local = `${protocol}://${displayHostOf(host)}:${port}`;
  const lan = exposed ? lanAddress() : null;

  const body: string[] = [
    `${green('✓')} ${bold('AIWeb2API is running')}`,
    '',
    `${dim('Local  ')}  ${cyan(local)}`,
  ];
  if (lan)
    body.push(`${dim('Network')}  ${cyan(`${protocol}://${lan}:${port}`)}`);
  body.push('', dim('Press Ctrl+C to stop.'));

  console.log();
  print(box('', body, cardWidth()));
  console.log();
}

/**
 * Print the cancellation message.
 */
export function printCancelled(): void {
  console.log(`\n\n  ${yellow('!')} Cancelled. See you next time!\n`);
}
