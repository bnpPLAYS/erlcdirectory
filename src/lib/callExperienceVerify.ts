/**
 * Client for the experience-verify Edge Function without using supabase.functions.invoke,
 * which often fails in production with "Failed to send a request to the Edge Function".
 * Order: direct POST to Supabase (with anon + Bearer), then same-origin /api proxy on Vercel.
 */

function fnErrorPayload(data: unknown): string | null {
  if (data && typeof data === 'object' && 'error' in data) {
    const e = (data as { error: unknown }).error;
    if (typeof e === 'string' && e.length) return e;
  }
  return null;
}

function experienceVerifyUrl(action: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Missing VITE_SUPABASE_URL');
  return `${base}/functions/v1/experience-verify?action=${encodeURIComponent(action)}`;
}

function anonHeaders(): Record<string, string> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

async function parseRes(res: Response): Promise<{ data: unknown; error: string | null }> {
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      data: null,
      error: `Verification service returned an unexpected response (${res.status}).`,
    };
  }
  const err = fnErrorPayload(json);
  if (!res.ok || err) {
    return { data: null, error: err || `Verification request failed (${res.status}).` };
  }
  return { data: json, error: null };
}

async function directHttp(
  action: 'lookup' | 'approve' | 'reject',
  body: Record<string, unknown>,
): Promise<{ data: unknown; error: string | null }> {
  const res = await fetch(experienceVerifyUrl(action), {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify(body),
  });
  return parseRes(res);
}

async function proxiedHttp(
  action: 'lookup' | 'approve' | 'reject',
  body: Record<string, unknown>,
): Promise<{ data: unknown; error: string | null }> {
  const res = await fetch(`/api/experience-verify?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseRes(res);
}

function humanizeNetworkError(message: string | null): string {
  if (!message) {
    return 'Could not reach the verification service. Check your connection and try again.';
  }
  if (/Failed to send a request to the Edge Function/i.test(message)) {
    return 'Could not reach the verification service. Try again in a moment, or ask the site owner to confirm the experience-verify function is deployed.';
  }
  return message;
}

export async function callExperienceVerify<T = unknown>(
  action: 'lookup' | 'approve' | 'reject',
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  let lastErr: string | null = null;

  try {
    const r1 = await directHttp(action, body);
    if (!r1.error && r1.data !== null) return { data: r1.data as T, error: null };
    lastErr = r1.error || lastErr;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  try {
    const r2 = await proxiedHttp(action, body);
    if (!r2.error && r2.data !== null) return { data: r2.data as T, error: null };
    lastErr = r2.error || lastErr;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  return { data: null, error: humanizeNetworkError(lastErr) };
}
