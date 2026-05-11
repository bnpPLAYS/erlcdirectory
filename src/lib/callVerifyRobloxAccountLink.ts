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

const FN_MISSING_HINT =
  'Roblox linking is not deployed. The site owner should run: supabase functions deploy verify-roblox-account-link';

function expandFnMissing(msg: string): string {
  const m = msg.trim();
  if (
    /requested function was not found/i.test(m) ||
    /^function not found$/i.test(m) ||
    /no function named/i.test(m)
  ) {
    return FN_MISSING_HINT;
  }
  return msg;
}

type LinkJson = {
  ok?: boolean;
  error?: string;
  roblox_user_id?: number;
  roblox_verified_at?: string;
};

async function parseRes(res: Response): Promise<
  { ok: true; roblox_user_id: number; roblox_verified_at: string } | { ok: false; error: string }
> {
  const text = await res.text();
  let j: LinkJson;
  try {
    j = JSON.parse(text) as LinkJson;
  } catch {
    if (res.status === 404) return { ok: false, error: FN_MISSING_HINT };
    return { ok: false, error: 'Unexpected response from Roblox link service.' };
  }
  const err = typeof j.error === 'string' ? j.error : null;
  if (!res.ok) {
    return { ok: false, error: expandFnMissing(err || `Request failed (${res.status}).`) };
  }
  if (j.ok === false && err) {
    return { ok: false, error: expandFnMissing(err) };
  }
  if (j.ok === true && j.roblox_user_id != null && j.roblox_verified_at) {
    return { ok: true, roblox_user_id: j.roblox_user_id, roblox_verified_at: j.roblox_verified_at };
  }
  return { ok: false, error: err || 'Verification did not complete.' };
}

export async function invokeVerifyRobloxAccountLink(opts: {
  roblox_username?: string;
  roblox_user_id?: string;
}): Promise<{ ok: true; roblox_user_id: number; roblox_verified_at: string } | { ok: false; error: string }> {
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

  const body = JSON.stringify(opts);
  let lastErr: string | null = null;

  for (const base of candidateSupabaseBases()) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/verify-roblox-account-link`, {
        method: 'POST',
        headers,
        body,
      });
      const parsed = await parseRes(res);
      if (parsed.ok) return parsed;
      lastErr = parsed.error;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    const res = await fetch('/api/verify-roblox-account-link', {
      method: 'POST',
      headers,
      body,
    });
    const parsed = await parseRes(res);
    if (parsed.ok) return parsed;
    lastErr = parsed.error;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  return { ok: false, error: lastErr || 'Could not reach Roblox link verification.' };
}
