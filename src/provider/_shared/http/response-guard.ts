import { ProviderAuthError, ProviderHttpError } from './provider-error';

interface ResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text(): Promise<string>;
}

interface ThrowIfNotOkOptions {
  label: string;
  reloginName?: string;
  maxDetailLength?: number;
  /** Custom message builder. If provided, overrides default formatting. */
  buildMessage?: (status: number, detail: string) => string;
  /** Pre-extracted error body/detail if already read (avoids double-read). */
  preReadDetail?: string;
}

/**
 * Extracts a human-readable error detail from a failed response.
 * Handles JSON parsing with fallback to raw text.
 */
async function extractErrorDetail(res: ResponseLike): Promise<string> {
  try {
    const body = await res.json();
    return (
      body?.error?.message ??
      body?.message ??
      body?.msg ??
      JSON.stringify(body)
    );
  } catch {
    return await res.text().catch(() => '');
  }
}

/**
 * Validates a fetch/impersonate response and throws typed errors.
 * - 401/403 → ProviderAuthError (with isAuthError=true contract)
 * - Other !ok → ProviderHttpError
 *
 * Usage in provider:
 *   await throwIfNotOk(response, { label: 'Groq' });
 */
export async function throwIfNotOk(
  res: ResponseLike,
  opts: ThrowIfNotOkOptions,
): Promise<void> {
  if (res.ok) return;

  let detail = opts.preReadDetail ?? '';
  if (!detail && !opts.buildMessage) {
    detail = await extractErrorDetail(res);
  }

  // Truncate if max length specified
  if (opts.maxDetailLength && detail.length > opts.maxDetailLength) {
    detail = detail.slice(0, opts.maxDetailLength);
  }

  const reloginName = opts.reloginName ?? opts.label;

  if (res.status === 401 || res.status === 403) {
    const msg = opts.buildMessage
      ? opts.buildMessage(res.status, detail)
      : `${reloginName}: Session expired or invalid. Please re-login.`;
    throw new ProviderAuthError(msg, res.status);
  }

  const msg = opts.buildMessage
    ? opts.buildMessage(res.status, detail)
    : `${opts.label} API returned ${res.status}${detail ? `: ${detail}` : ''}`;
  throw new ProviderHttpError(msg, res.status);
}