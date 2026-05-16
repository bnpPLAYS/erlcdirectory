const isDev = import.meta.env.DEV;

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === 'string') return m.trim();
  }
  return '';
}

/** Logs details only in local dev builds (never in production). */
export function devWarn(tag: string, ...args: unknown[]): void {
  if (!isDev) return;
  console.warn(tag, ...args);
}

/**
 * User-facing copy: in production always `fallback` so PostgREST / DB / RPC
 * strings are not exposed. In dev, appends the raw message for debugging.
 */
export function publicErrorMessage(fallback: string, err: unknown): string {
  if (!isDev) return fallback;
  const m = extractErrorMessage(err);
  if (!m) return fallback;
  const clipped = m.length > 220 ? `${m.slice(0, 220)}…` : m;
  return `${fallback} (${clipped})`;
}
