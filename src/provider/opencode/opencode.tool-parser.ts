/**
 * ------------------------------------------------------------------
 * OpenCode Tool Parser
 * ------------------------------------------------------------------
 * Parse tool-call markup mà model free của OpenCode phát ra trong text.
 * Port rút gọn từ OpenCode2API/src/tool-runtime/parser.js — chỉ giữ các
 * định dạng tự phân định (không cần registry):
 *   1. Canonical : <function_calls>{json}</function_calls>
 *   2. DSML      : <｜｜DSML｜｜tool_calls> / <invoke name=...> / <parameter name=...>
 *   3. Wrapper   : <tool_call>{json}</tool_call>
 *   4. Qwen/GLM  : <function=name><parameter=key>value</parameter></function>
 *
 * Main functions:
 * - parseToolCalls()       : Tách tool call + text còn lại
 * - createMarkupHoldback() : Giữ lại phần có thể là markup khi stream
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { EXTERNAL_TOOL_PREFIX } from './opencode.constant';
import {
  OpenCodeParsedToolCall,
  OpenCodeRawToolCall,
} from './opencode.types';

// ─── Types ──────────────────────────────────────────────────────────────

type Span = [number, number];

interface Extraction {
  calls: OpenCodeRawToolCall[];
  spans: Span[];
}

// ─── Constants ──────────────────────────────────────────────────────────

/** U+FF5C (fullwidth vertical line) hoặc ASCII pipe quanh tag DSML tuỳ chọn. */
const MARK = '[\\uFF5C|]*(?:DSML)?[\\uFF5C|]*';

const RE = {
  canonicalBlock: /<function_calls>([\s\S]*?)<\/function_calls>/g,
  strayTag: /<\/?function_calls>/g,
  dsmlContainer: new RegExp(
    `<${MARK}tool_calls\\s*>([\\s\\S]*?)</${MARK}tool_calls\\s*>`,
    'g',
  ),
  invokeBlock: new RegExp(
    `<${MARK}invoke\\s+name\\s*=\\s*["']([^"']+)["']\\s*>([\\s\\S]*?)</${MARK}invoke\\s*>`,
    'g',
  ),
  invokeParam: new RegExp(
    `<${MARK}parameter\\s+name\\s*=\\s*["']([^"']+)["']([^>]*)>([\\s\\S]*?)</${MARK}parameter\\s*>`,
    'g',
  ),
  jsonWrapper: /<tool_call\s*>([\s\S]*?)<\/tool_call\s*>/g,
  functionEquals: /<function\s*=\s*([^\s/>]+)\s*>/gi,
  parameterEquals: /<parameter\s*=\s*([^\s/>]+)\s*>([\s\S]*?)<\/parameter\s*>/gi,
  leadingNewline: /^\r?\n/,
  trailingNewline: /\r?\n[ \t]*$/,
};

/** Opener có thể bắt đầu một khối tool markup (so khớp lowercase). */
const MARKUP_OPENERS = [
  '<function_calls',
  '<tool_calls',
  '<tool_call',
  '<invoke',
  '<function=',
  '<\uFF5C',
  '<|',
];

// ─── Helpers ────────────────────────────────────────────────────────────

/** ES2018 không có String.matchAll → dùng exec loop. */
function allMatches(re: RegExp, text: string): RegExpExecArray[] {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    out.push(m);
    if (m[0] === '') r.lastIndex += 1;
  }
  return out;
}

function trimParamValue(raw: string): string {
  return String(raw ?? '')
    .replace(RE.leadingNewline, '')
    .replace(RE.trailingNewline, '');
}

/** `string="true"` ép string; ngược lại số/bool/object/array được decode. */
function coerceParamValue(value: string, attrs: string): unknown {
  if (/string\s*=\s*["']true["']/i.test(attrs || '')) return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!/^(-?\d|true$|false$|null$|\{|\[|")/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function findJsonEnd(text: string, start: number): number {
  const opener = text[start];
  if (opener !== '{' && opener !== '[') return -1;
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === opener) depth += 1;
    else if (ch === closer) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function findFirstJsonValue(text: string): string | null {
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '{' && text[i] !== '[') continue;
    const end = findJsonEnd(text, i);
    if (end === -1) continue;
    const json = text.slice(i, end);
    try {
      JSON.parse(json);
      return json;
    } catch {
      // brace này không phải đầu JSON hợp lệ, quét tiếp
    }
  }
  return null;
}

function rawCallFromJson(node: any): OpenCodeRawToolCall | null {
  if (!node || typeof node !== 'object') return null;
  const name = node?.function?.name || node?.name || node?.tool_name || node?.tool;
  if (!name || typeof name !== 'string') return null;
  let args =
    node?.function?.arguments ?? node?.arguments ?? node?.parameters ?? node?.args ?? {};
  if (typeof args === 'string') {
    const trimmed = args.trim();
    if (!trimmed) {
      args = {};
    } else {
      try {
        args = JSON.parse(trimmed);
      } catch {
        return { id: node?.id, name, arguments: trimmed };
      }
    }
  }
  return { id: node?.id, name, arguments: args };
}

function rawCallsFromJsonPayload(parsed: any): OpenCodeRawToolCall[] {
  const candidates: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.tool_calls)
      ? parsed.tool_calls
      : Array.isArray(parsed?.invokes)
        ? parsed.invokes
        : [parsed];
  return candidates
    .map(rawCallFromJson)
    .filter((c): c is OpenCodeRawToolCall => c !== null);
}

function rawCallsFromJsonText(text: string): OpenCodeRawToolCall[] {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return [];
  try {
    return rawCallsFromJsonPayload(JSON.parse(trimmed));
  } catch {
    const found = findFirstJsonValue(trimmed);
    if (!found) return [];
    try {
      return rawCallsFromJsonPayload(JSON.parse(found));
    } catch {
      return [];
    }
  }
}

// ─── Format Extractors ──────────────────────────────────────────────────

function extractCanonical(text: string): Extraction {
  const calls: OpenCodeRawToolCall[] = [];
  const spans: Span[] = [];
  for (const m of allMatches(RE.canonicalBlock, text)) {
    spans.push([m.index, m.index + m[0].length]);
    calls.push(...rawCallsFromJsonText(m[1]));
  }
  return { calls, spans };
}

function extractInvokeBlocks(segment: string): OpenCodeRawToolCall[] {
  const calls: OpenCodeRawToolCall[] = [];
  for (const invoke of allMatches(RE.invokeBlock, segment)) {
    const args: Record<string, unknown> = {};
    for (const param of allMatches(RE.invokeParam, invoke[2])) {
      args[param[1]] = coerceParamValue(trimParamValue(param[3]), param[2]);
    }
    calls.push({ name: invoke[1], arguments: args });
  }
  return calls;
}

function extractDsml(text: string): Extraction {
  const calls: OpenCodeRawToolCall[] = [];
  const spans: Span[] = [];
  let remainder = text;

  for (const container of allMatches(RE.dsmlContainer, text)) {
    spans.push([container.index, container.index + container[0].length]);
    const inner = extractInvokeBlocks(container[1]);
    calls.push(...(inner.length ? inner : rawCallsFromJsonText(container[1])));
    remainder = remainder.replace(container[0], ' '.repeat(container[0].length));
  }

  for (const invoke of allMatches(RE.invokeBlock, remainder)) {
    spans.push([invoke.index, invoke.index + invoke[0].length]);
    calls.push(...extractInvokeBlocks(invoke[0]));
  }
  return { calls, spans };
}

function extractJsonWrapper(text: string): Extraction {
  const calls: OpenCodeRawToolCall[] = [];
  const spans: Span[] = [];
  for (const m of allMatches(RE.jsonWrapper, text)) {
    spans.push([m.index, m.index + m[0].length]);
    calls.push(...rawCallsFromJsonText(m[1]));
  }
  return { calls, spans };
}

function extractFunctionEquals(text: string): Extraction {
  const calls: OpenCodeRawToolCall[] = [];
  const spans: Span[] = [];
  for (const m of allMatches(RE.functionEquals, text)) {
    const name = m[1].trim();
    if (!name) continue;
    const openEnd = m.index + m[0].length;
    const closeIdx = text.indexOf('</function>', openEnd);
    const end = closeIdx === -1 ? text.length : closeIdx + '</function>'.length;
    const body = closeIdx === -1 ? text.slice(openEnd) : text.slice(openEnd, closeIdx);

    const args: Record<string, unknown> = {};
    for (const p of allMatches(RE.parameterEquals, body)) {
      args[p[1].trim()] = trimParamValue(p[2]);
    }
    calls.push({ name, arguments: args });
    spans.push([m.index, end]);
  }
  return { calls, spans };
}

function collectAll(text: string): Extraction {
  const results = [
    extractCanonical(text),
    extractDsml(text),
    extractJsonWrapper(text),
    extractFunctionEquals(text),
  ];

  const seen = new Set<string>();
  const calls: OpenCodeRawToolCall[] = [];
  for (const r of results) {
    for (const call of r.calls) {
      const key = `${call.name}::${JSON.stringify(call.arguments)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      calls.push(call);
    }
  }
  return { calls, spans: results.reduce<Span[]>((acc, r) => acc.concat(r.spans), []) };
}

function stripSpans(text: string, spans: Span[]): string {
  if (!spans.length) return text;
  const merged = [...spans]
    .sort((a, b) => a[0] - b[0])
    .reduce<Span[]>((acc, span) => {
      const last = acc[acc.length - 1];
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
      else acc.push([span[0], span[1]]);
      return acc;
    }, []);
  return merged.reduceRight(
    (acc, [start, end]) => acc.slice(0, start) + acc.slice(end),
    text,
  );
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Tách tool call khỏi text. Tên tool được bỏ prefix `external__`; arguments
 * luôn là object (chuỗi không parse được → `{}`).
 */
export function parseToolCalls(text: string): {
  calls: OpenCodeParsedToolCall[];
  text: string;
} {
  if (!text) return { calls: [], text: '' };
  const { calls: raw, spans } = collectAll(text);

  const calls: OpenCodeParsedToolCall[] = raw.map((call, index) => {
    let args: Record<string, unknown> = {};
    if (typeof call.arguments === 'string') {
      try {
        const parsed = JSON.parse(call.arguments);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>;
        }
      } catch {
        args = {};
      }
    } else if (
      call.arguments &&
      typeof call.arguments === 'object' &&
      !Array.isArray(call.arguments)
    ) {
      args = call.arguments as Record<string, unknown>;
    }
    return {
      id: call.id || `call_${Date.now()}_${index + 1}`,
      name: call.name.startsWith(EXTERNAL_TOOL_PREFIX)
        ? call.name.slice(EXTERNAL_TOOL_PREFIX.length)
        : call.name,
      arguments: args,
    };
  });

  return {
    calls,
    text: stripSpans(text, spans).replace(RE.strayTag, '').trim(),
  };
}

export interface MarkupHoldback {
  /** Nhận chunk, trả phần chắc chắn là text thường (có thể rỗng). */
  push(chunk: string): string;
  /** Kết thúc stream: `visible` là text an toàn còn sót, `markup` là phần đã giữ lại để parse. */
  flush(): { visible: string; markup: string };
}

/**
 * Bộ lọc stream: phát text bình thường ngay, nhưng giữ lại từ lúc gặp opener
 * của tool markup (hoặc đuôi chunk có thể là opener dở) để parse khi kết thúc.
 */
export function createMarkupHoldback(): MarkupHoldback {
  let held = '';
  let holding = false;

  return {
    push(chunk: string): string {
      if (holding) {
        held += chunk;
        return '';
      }
      const buf = held + chunk;
      held = '';
      const lower = buf.toLowerCase();

      let idx = -1;
      for (const opener of MARKUP_OPENERS) {
        const i = lower.indexOf(opener);
        if (i !== -1 && (idx === -1 || i < idx)) idx = i;
      }
      if (idx !== -1) {
        holding = true;
        held = buf.slice(idx);
        return buf.slice(0, idx);
      }

      const lt = lower.lastIndexOf('<');
      if (lt !== -1) {
        const tail = lower.slice(lt);
        if (MARKUP_OPENERS.some((o) => o.startsWith(tail))) {
          held = buf.slice(lt);
          return buf.slice(0, lt);
        }
      }
      return buf;
    },

    flush() {
      const rest = held;
      held = '';
      const wasHolding = holding;
      holding = false;
      return wasHolding
        ? { visible: '', markup: rest }
        : { visible: rest, markup: '' };
    },
  };
}