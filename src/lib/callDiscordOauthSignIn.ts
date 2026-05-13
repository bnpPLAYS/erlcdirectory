/**
 * Completes native Discord OAuth (identify + guilds) via the discord-oauth Edge Function.
 * Direct POST to Supabase first, then same-origin /api proxy (mirrors experience-verify).
 */

function fnErrorPayload(data: unknown): string | null {
  if (data && typeof data === 'object' && 'error' in data) {
    const e = (data as { error: unknown }).error;
    if (typeof e === 'string' && e.length) return e;
  }
  return null;
}

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

function anonHeaders(): Record<string, string> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

type OkBody = { success?: boolean; actionLink?: string };

async function parseRes(res: Response): Promise<{ data: OkBody | null; error: string | null }> {
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    if (res.status === 404) {
      return { data: null, error: 'Sign-in backend is missing (404).' };
    }
    return { data: null, error: `Bad response from sign-in (${res.status}).` };
  }
  if (!res.ok) {
    return { data: null, error: fnErrorPayload(json) || `Sign-in failed (${res.status}).` };
  }
  const o = json as OkBody;
  if (!o?.actionLink || typeof o.actionLink !== 'string') {
    return { data: null, error: 'Sign-in returned an invalid payload.' };
  }
  return { data: o, error: null };
}

async function directHttp(body: Record<string, string>): Promise<{ data: OkBody | null; error: string | null }> {
  let last: { data: OkBody | null; error: string | null } = { data: null, error: null };
  for (const base of candidateSupabaseBases()) {
    const url = `${base.replace(/\/$/, '')}/functions/v1/discord-oauth`;
    const res = await fetch(url, { method: 'POST', headers: anonHeaders(), body: JSON.stringify(body) });
    last = await parseRes(res);
    if (!last.error && last.data) return last;
  }
  return last;
}

async function proxiedHttp(body: Record<string, string>): Promise<{ data: OkBody | null; error: string | null }> {
  const res = await fetch('/api/discord-oauth', {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify(body),
  });
  return parseRes(res);
}

export async function invokeDiscordOauthSignIn(params: {
  code: string;
  redirectUri: string;
  appRedirectTo: string;
}): Promise<{ ok: true; actionLink: string } | { ok: false; error: string }> {
  const body = {
    code: params.code,
    redirectUri: params.redirectUri,
    appRedirectTo: params.appRedirectTo,
  };

  try {
    const r1 = await directHttp(body);
    if (!r1.error && r1.data?.actionLink) return { ok: true, actionLink: r1.data.actionLink };
    let lastErr = r1.error;
    try {
      const r2 = await proxiedHttp(body);
      if (!r2.error && r2.data?.actionLink) return { ok: true, actionLink: r2.data.actionLink };
      lastErr = r2.error || lastErr;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    return { ok: false, error: lastErr || 'Discord sign-in did not finish.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error talking to sign-in.' };
  }
}
