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
  'Pro verification is not available yet. The site owner must deploy the verify-roblox-pro Edge Function on Supabase and set ROBLOX_OPEN_CLOUD_API_KEY there.';

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

type VerifyJson = {
  ok?: boolean;
  error?: string;
  roblox_user_id?: number;
  pro_verified_at?: string;
};

async function parseRes(res: Response): Promise<{ ok: true; data: VerifyJson } | { ok: false; error: string }> {
  const text = await res.text();
  let j: VerifyJson;
  try {
    j = JSON.parse(text) as VerifyJson;
  } catch {
    if (res.status === 404) return { ok: false, error: FN_MISSING_HINT };
    return { ok: false, error: 'Unexpected response from verification. Try again.' };
  }
  const err = typeof j.error === 'string' ? j.error : null;
  if (!res.ok) {
    return { ok: false, error: expandFnMissing(err || `Verification failed (${res.status}).`) };
  }
  if (j.ok === false && err) {
    return { ok: false, error: expandFnMissing(err) };
  }
  if (j.ok === true && j.roblox_user_id != null && j.pro_verified_at) {
    return { ok: true, data: j };
  }
  return { ok: false, error: err || 'Verification did not complete. Try again.' };
}

function isDefiniteUserFacing(err: string): boolean {
  return (
    err.includes('Roblox username') ||
    err.includes('Roblox blocked') ||
    err.includes('does not own ERLC Directory Pro') ||
    err.includes('Enter a valid Roblox') ||
    err.includes('Invalid session') ||
    err.includes('Profile not found') ||
    err.includes('Pro verification is not configured') ||
    err.includes('Open Cloud API key') ||
    err.includes('That Roblox account does not own')
  );
}

export async function invokeVerifyRobloxPro(opts: {
  roblox_username?: string;
  roblox_user_id?: string;
}): Promise<{ ok: true; roblox_user_id: number; pro_verified_at: string } | { ok: false; error: string }> {
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
      const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/verify-roblox-pro`, {
        method: 'POST',
        headers,
        body,
      });
      const parsed = await parseRes(res);
      if (parsed.ok) {
        return {
          ok: true,
          roblox_user_id: parsed.data.roblox_user_id as number,
          pro_verified_at: parsed.data.pro_verified_at as string,
        };
      }
      lastErr = parsed.error;
      if (parsed.error && isDefiniteUserFacing(parsed.error)) {
        return { ok: false, error: parsed.error };
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    const res = await fetch('/api/verify-roblox-pro', {
      method: 'POST',
      headers,
      body,
    });
    const parsed = await parseRes(res);
    if (parsed.ok) {
      return {
        ok: true,
        roblox_user_id: parsed.data.roblox_user_id as number,
        pro_verified_at: parsed.data.pro_verified_at as string,
      };
    }
    lastErr = parsed.error;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  return {
    ok: false,
    error: lastErr || 'Could not reach Pro verification. Try again in a moment.',
  };
}
