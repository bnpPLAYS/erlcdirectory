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

function messagePayload(data: unknown): string | null {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message;
    if (typeof m === 'string' && m.length) return m;
  }
  return null;
}

/** Prefer VITE_SUPABASE_URL; fall back to project ref so a mistyped URL does not break verify. */
function candidateSupabaseBases(): string[] {
  const fromUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '';
  const ref = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim();
  const fromRef = ref ? `https://${ref}.supabase.co` : '';
  const out: string[] = [];
  if (fromUrl) out.push(fromUrl);
  if (fromRef && !out.includes(fromRef)) out.push(fromRef);
  if (out.length === 0) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PROJECT_ID');
  }
  return out;
}

function experienceVerifyUrl(base: string, action: string): string {
  return `${base.replace(/\/$/, '')}/functions/v1/experience-verify?action=${encodeURIComponent(action)}`;
}

/** Supabase anon key + optional user JWT (directory session) so Edge Functions can use stored Discord tokens. */
function verifyRequestHeaders(userAccessToken?: string | null): Record<string, string> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: key,
  };
  if (userAccessToken?.trim()) {
    headers.Authorization = `Bearer ${userAccessToken.trim()}`;
  } else {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

const NOT_DEPLOYED_HINT =
  'The verification endpoint returned 404. In the Supabase dashboard, deploy the Edge Function named experience-verify for this project, then redeploy the site. Also confirm VITE_SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID) in Vercel matches that project.';

/** Supabase returns this JSON when /functions/v1/experience-verify is not deployed. */
function expandFunctionMissingError(message: string): string {
  const m = message.trim();
  if (
    /requested function was not found/i.test(m) ||
    /^function not found$/i.test(m) ||
    /no function named/i.test(m)
  ) {
    return [
      'The experience-verify Edge Function is not deployed on this Supabase project.',
      'Deploy from your machine (repo root): supabase login && supabase link --project-ref YOUR_REF && supabase functions deploy experience-verify',
      'In Supabase Dashboard → Edge Functions → Secrets, set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET for approve/reject.',
      'Vercel env VITE_SUPABASE_URL must match that same project.',
    ].join(' ');
  }
  return message;
}

function isDefiniteBusinessRejection(message: string): boolean {
  return (
    message.includes('verification link is not valid') ||
    message.includes('Missing or invalid token') ||
    message.includes('This request is already') ||
    message.includes('Missing Discord authorization') ||
    message.includes('Discord authorization required')
  );
}

async function parseRes(res: Response): Promise<{ data: unknown; error: string | null }> {
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    if (res.status === 404) {
      return { data: null, error: NOT_DEPLOYED_HINT };
    }
    return {
      data: null,
      error: `Verification service returned a non-JSON response (${res.status}).`,
    };
  }
  const rawErr = fnErrorPayload(json) || (!res.ok ? messagePayload(json) : null);
  const err = rawErr ? expandFunctionMissingError(rawErr) : null;
  if (!res.ok || err) {
    if (err) return { data: null, error: err };
    if (res.status === 404) return { data: null, error: NOT_DEPLOYED_HINT };
    return { data: null, error: `Verification request failed (${res.status}).` };
  }
  return { data: json, error: null };
}

async function directHttp(
  action: 'lookup' | 'approve' | 'reject',
  body: Record<string, unknown>,
  userAccessToken?: string | null,
): Promise<{ data: unknown; error: string | null }> {
  let last: { data: unknown; error: string | null } = { data: null, error: null };
  for (const base of candidateSupabaseBases()) {
    const res = await fetch(experienceVerifyUrl(base, action), {
      method: 'POST',
      headers: verifyRequestHeaders(userAccessToken),
      body: JSON.stringify(body),
    });
    last = await parseRes(res);
    if (!last.error && last.data !== null) return last;
    if (last.error && isDefiniteBusinessRejection(last.error)) return last;
  }
  return last;
}

async function proxiedHttp(
  action: 'lookup' | 'approve' | 'reject',
  body: Record<string, unknown>,
  userAccessToken?: string | null,
): Promise<{ data: unknown; error: string | null }> {
  const res = await fetch(`/api/experience-verify?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: verifyRequestHeaders(userAccessToken),
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
  /** When set, approve/reject can use stored Discord OAuth tokens (no redirect). Lookup ignores this. */
  userAccessToken?: string | null,
): Promise<{ data: T | null; error: string | null }> {
  let lastErr: string | null = null;

  try {
    const r1 = await directHttp(action, body, userAccessToken);
    if (!r1.error && r1.data !== null) return { data: r1.data as T, error: null };
    lastErr = r1.error || lastErr;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  try {
    const r2 = await proxiedHttp(action, body, userAccessToken);
    if (!r2.error && r2.data !== null) return { data: r2.data as T, error: null };
    lastErr = r2.error || lastErr;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  return { data: null, error: humanizeNetworkError(lastErr) };
}
