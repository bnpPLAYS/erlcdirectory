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

function verifyRequestHeaders(accessToken: string): Record<string, string> {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${accessToken.trim()}`,
  };
}

const FN_NOT_DEPLOYED_HINT =
  'The verify-roblox-pro Edge Function is not deployed on this Supabase project. Run: supabase functions deploy verify-roblox-pro — then in Dashboard → Edge Functions → Secrets set ROBLOX_OPEN_CLOUD_API_KEY.';

function expandFunctionMissingError(message: string): string {
  const m = message.trim();
  if (
    /requested function was not found/i.test(m) ||
    /^function not found$/i.test(m) ||
    /no function named/i.test(m)
  ) {
    return FN_NOT_DEPLOYED_HINT;
  }
  return message;
}

type VerifyJson = {
  ok?: boolean;
  error?: string;
  roblox_user_id?: number;
  pro_verified_at?: string;
};

async function parseVerifyResponse(res: Response): Promise<
  | { kind: 'success'; data: { roblox_user_id: number; pro_verified_at: string } }
  | { kind: 'error'; error: string }
> {
  const text = await res.text();
  let j: VerifyJson;
  try {
    j = JSON.parse(text) as VerifyJson;
  } catch {
    if (res.status === 404) {
      return { kind: 'error', error: FN_NOT_DEPLOYED_HINT };
    }
    return { kind: 'error', error: `Verification service returned non-JSON (${res.status}).` };
  }

  const errRaw = typeof j.error === 'string' ? j.error : null;
  if (!res.ok) {
    return {
      kind: 'error',
      error: expandFunctionMissingError(errRaw || `Verification failed (${res.status}).`),
    };
  }
  if (j.ok === false && errRaw) {
    return { kind: 'error', error: expandFunctionMissingError(errRaw) };
  }
  if (j.ok === true && j.roblox_user_id != null && j.pro_verified_at) {
    return {
      kind: 'success',
      data: { roblox_user_id: j.roblox_user_id, pro_verified_at: j.pro_verified_at },
    };
  }
  return { kind: 'error', error: errRaw || 'Incomplete verification response.' };
}

function isDefiniteBusinessRejection(message: string): boolean {
  return (
    message.includes('Roblox username not found') ||
    message.includes('does not own ERLC Directory Pro') ||
    message.includes('Provide roblox_username') ||
    message.includes('Invalid session') ||
    message.includes('Unauthorized') ||
    message.includes('Profile not found') ||
    message.includes('Roblox blocked inventory check') ||
    message.includes('ROBLOX_OPEN_CLOUD_API_KEY is not set') ||
    message.includes('Edge function missing Supabase env')
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
    headers = verifyRequestHeaders(session.access_token);
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
      const parsed = await parseVerifyResponse(res);
      if (parsed.kind === 'success') {
        return { ok: true, ...parsed.data };
      }
      lastErr = parsed.error;
      if (parsed.error && isDefiniteBusinessRejection(parsed.error)) {
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
    const parsed = await parseVerifyResponse(res);
    if (parsed.kind === 'success') {
      return { ok: true, ...parsed.data };
    }
    lastErr = parsed.error;
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  return {
    ok: false,
    error:
      lastErr ||
      'Could not reach Pro verification. Deploy verify-roblox-pro on Supabase and set ROBLOX_OPEN_CLOUD_API_KEY.',
  };
}
