import { supabase } from '@/integrations/supabase/client';

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

function verifyHeaders(accessToken: string): Record<string, string> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${accessToken.trim()}`,
  };
}

const FN_MISSING =
  'Roblox sign-in is not deployed. The site owner must deploy roblox-oauth-start and roblox-oauth-complete on Supabase.';

function expandFnMissing(msg: string): string {
  const m = msg.trim();
  if (
    /requested function was not found/i.test(m) ||
    /^function not found$/i.test(m) ||
    /no function named/i.test(m)
  ) {
    return FN_MISSING;
  }
  return msg;
}

type StartJson = { ok?: boolean; error?: string; url?: string };

async function postFn(
  path: string,
  body: unknown,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Sign in required.' };
  }
  let headers: Record<string, string>;
  try {
    headers = verifyHeaders(session.access_token);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Configuration error.' };
  }
  const payload = JSON.stringify(body ?? {});
  let lastErr: string | null = null;

  for (const base of candidateSupabaseBases()) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/${path}`, {
        method: 'POST',
        headers,
        body: payload,
      });
      const text = await res.text();
      if (res.ok) return { ok: true, text };
      let err = text;
      try {
        const j = JSON.parse(text) as { error?: string };
        if (typeof j.error === 'string') err = j.error;
      } catch {
        /* raw */
      }
      lastErr = expandFnMissing(err || `Request failed (${res.status}).`);
      if (res.status !== 502 && res.status !== 404) return { ok: false, error: lastErr };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    const res = await fetch(`/api/${path}`, {
      method: 'POST',
      headers,
      body: payload,
    });
    const text = await res.text();
    if (res.ok) return { ok: true, text };
    let err = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j.error === 'string') err = j.error;
    } catch {
      /* raw */
    }
    lastErr = expandFnMissing(err || `Request failed (${res.status}).`);
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  return { ok: false, error: lastErr || 'Could not reach the server. Try again.' };
}

export async function invokeRobloxOAuthStart(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await postFn('roblox-oauth-start', {});
  if (!r.ok) return r;
  let j: StartJson;
  try {
    j = JSON.parse(r.text) as StartJson;
  } catch {
    return { ok: false, error: 'Unexpected response from Roblox sign-in.' };
  }
  if (j.ok === true && typeof j.url === 'string' && j.url.startsWith('https://')) {
    return { ok: true, url: j.url };
  }
  const err = typeof j.error === 'string' ? expandFnMissing(j.error) : 'Could not start Roblox sign-in.';
  return { ok: false, error: err };
}

export async function invokeRobloxOAuthComplete(opts: {
  code: string;
  state: string;
}): Promise<{ ok: true; roblox_user_id: number; roblox_verified_at: string } | { ok: false; error: string }> {
  const r = await postFn('roblox-oauth-complete', { code: opts.code, state: opts.state });
  if (!r.ok) return r;
  let j: { ok?: boolean; error?: string; roblox_user_id?: number; roblox_verified_at?: string };
  try {
    j = JSON.parse(r.text) as typeof j;
  } catch {
    return { ok: false, error: 'Unexpected response from Roblox sign-in.' };
  }
  if (j.ok === true && j.roblox_user_id != null && j.roblox_verified_at) {
    return {
      ok: true,
      roblox_user_id: j.roblox_user_id,
      roblox_verified_at: j.roblox_verified_at,
    };
  }
  return { ok: false, error: expandFnMissing(typeof j.error === 'string' ? j.error : 'Sign-in did not complete.') };
}
