/**
 * ------------------------------------------------------------------
 * Logger
 * ------------------------------------------------------------------
 * Lightweight logger with timestamps, levels, colored module context,
 * optional caller location and metadata.
 *
 * Output adapts to where it is written:
 * - TTY            → pretty, colored, aligned columns
 * - Pipe / file    → plain text (no ANSI codes), ISO timestamps
 * - LOG_FORMAT=json → one JSON object per line
 *
 * Environment variables:
 * - LOG_LEVEL   : debug | info | warn | error | silent   (default: info)
 * - LOG_FORMAT  : pretty | text | json                   (default: auto)
 * - LOG_CALLER  : 1 = always show caller, 0 = never      (default: warn/error/debug only)
 * - NO_COLOR    : disable colors
 * - FORCE_COLOR : force colors even when not a TTY
 *
 * Main exports:
 * - Logger         : Class with info / warn / error / debug
 * - createLogger() : Factory that creates a logger bound to a context
 * - setLogLevel()  : Change the minimum level at runtime
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import path from 'path';
import { inspect } from 'util';

// ─── Types ──────────────────────────────────────────────────────────────

type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
type Format = 'pretty' | 'text' | 'json';

// ─── Constants ──────────────────────────────────────────────────────────

const LEVEL_WEIGHT: Record<Level | 'SILENT', number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  SILENT: 99,
};

const LEVEL_STYLE: Record<Level, { code: string; label: string }> = {
  DEBUG: { code: '34', label: 'DEBUG' },
  INFO: { code: '32', label: 'INFO ' },
  WARN: { code: '33', label: 'WARN ' },
  ERROR: { code: '1;31', label: 'ERROR' },
};

// Context palette (256-color) — each context gets a stable color
const CONTEXT_PALETTE = [39, 78, 141, 178, 204, 114, 73, 215, 105, 150];
const CONTEXT_WIDTH = 10;

// Levels that show the caller location by default
const CALLER_LEVELS = new Set<Level>(['WARN', 'ERROR', 'DEBUG']);

// ─── Runtime config ─────────────────────────────────────────────────────

let minLevel: number =
  LEVEL_WEIGHT[
    (process.env['LOG_LEVEL'] ?? 'info').toUpperCase() as Level | 'SILENT'
  ] ?? LEVEL_WEIGHT.INFO;

/** Change the minimum level at runtime. */
export function setLogLevel(
  level: Level | 'SILENT' | Lowercase<Level | 'SILENT'>,
): void {
  minLevel = LEVEL_WEIGHT[level.toUpperCase() as Level | 'SILENT'] ?? minLevel;
}

function useColor(stream: NodeJS.WriteStream): boolean {
  if (process.env['NO_COLOR']) return false;
  if (process.env['FORCE_COLOR']) return true;
  return Boolean(stream.isTTY);
}

function resolveFormat(stream: NodeJS.WriteStream): Format {
  const env = process.env['LOG_FORMAT'];
  if (env === 'json' || env === 'text' || env === 'pretty') return env;
  return stream.isTTY ? 'pretty' : 'text';
}

function wantsCaller(level: Level): boolean {
  const env = process.env['LOG_CALLER'];
  if (env === '1') return true;
  if (env === '0') return false;
  return CALLER_LEVELS.has(level);
}

// ─── Color helpers ──────────────────────────────────────────────────────

const paint = (on: boolean, code: string, text: string): string =>
  on ? `\x1b[${code}m${text}\x1b[0m` : text;

const dim = (on: boolean, text: string): string => paint(on, '90', text);

function contextColor(context: string): string {
  let hash = 0;
  for (let i = 0; i < context.length; i++) {
    hash = (hash * 31 + context.charCodeAt(i)) >>> 0;
  }
  return `38;5;${CONTEXT_PALETTE[hash % CONTEXT_PALETTE.length]}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Resolve the caller location. The stack is captured relative to the public
 * logger method, so the first frame is already the caller — no fragile
 * hard-coded frame index.
 */
function getCaller(skipFn: Function): string {
  const holder: { stack?: string } = {};
  Error.captureStackTrace(holder, skipFn);
  const line = (holder.stack ?? '').split('\n')[1] ?? '';
  const match =
    line.match(/\((.+):(\d+):\d+\)\s*$/) ||
    line.match(/at\s+(?:async\s+)?(.+):(\d+):\d+\s*$/);
  if (!match) return '';
  const file = match[1].replace(/^file:\/\//, '');
  return `${path.relative(process.cwd(), file) || file}:${match[2]}`;
}

/** Local time HH:MM:SS.mmm (pretty) or full ISO string (text/json). */
function timestamp(format: Format): string {
  const d = new Date();
  if (format !== 'pretty') return d.toISOString();
  const p = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** Format metadata arguments. Safe for circular references. */
function formatMeta(args: unknown[], color: boolean): string {
  if (!args.length) return '';
  const parts = args.map((a) => {
    if (a instanceof Error) return a.message;
    if (typeof a === 'string') return a;
    return inspect(a, {
      depth: 4,
      breakLength: Infinity,
      colors: color,
      compact: true,
    });
  });
  return ' ' + parts.join(' ');
}

/** Stack lines (without the first message line) for the first Error argument. */
function errorStack(args: unknown[]): string[] {
  const err = args.find((a): a is Error => a instanceof Error);
  if (!err?.stack) return [];
  return err.stack
    .split('\n')
    .slice(1)
    .map((l) => l.trim());
}

/** JSON.stringify that survives circular references and serializes Errors. */
function safeJson(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_k, v) => {
    if (v instanceof Error) {
      return { name: v.name, message: v.message, stack: v.stack };
    }
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
    }
    return v;
  });
}

// ─── Class ──────────────────────────────────────────────────────────────

export class Logger {
  constructor(private context: string) {}

  private emit(
    level: Level,
    skipFn: Function,
    message: string,
    args: unknown[],
  ): void {
    if (LEVEL_WEIGHT[level] < minLevel) return;

    // warn / error go to stderr so stdout stays clean when piping
    const stream =
      level === 'WARN' || level === 'ERROR' ? process.stderr : process.stdout;
    const format = resolveFormat(stream);
    const color = format === 'pretty' && useColor(stream);
    const caller = wantsCaller(level) ? getCaller(skipFn) : '';
    const time = timestamp(format);

    if (format === 'json') {
      stream.write(
        safeJson({
          time,
          level,
          context: this.context,
          message,
          ...(caller && { caller }),
          ...(args.length && { meta: args }),
        }) + '\n',
      );
      return;
    }

    const { code, label } = LEVEL_STYLE[level];
    const ctx = `[${this.context}]`.padEnd(CONTEXT_WIDTH + 2);

    let line =
      `${dim(color, time)} ` +
      `${paint(color, code, label)} ` +
      `${paint(color, contextColor(this.context), ctx)} ` +
      `${message}${formatMeta(args, color)}`;

    if (caller) line += `  ${dim(color, caller)}`;

    // Errors: print the stack indented under the line (dimmed)
    if (level === 'ERROR') {
      for (const frame of errorStack(args)) {
        line += `\n${' '.repeat(CONTEXT_WIDTH + 22)}${dim(color, frame)}`;
      }
    }

    stream.write(line + '\n');
  }

  info = (message: string, ...args: unknown[]): void =>
    this.emit('INFO', this.info, message, args);

  warn = (message: string, ...args: unknown[]): void =>
    this.emit('WARN', this.warn, message, args);

  error = (message: string, ...args: unknown[]): void =>
    this.emit('ERROR', this.error, message, args);

  debug = (message: string, ...args: unknown[]): void =>
    this.emit('DEBUG', this.debug, message, args);
}

export const createLogger = (context: string): Logger => new Logger(context);
