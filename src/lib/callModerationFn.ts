import { supabase } from '@/integrations/supabase/client';

function candidateSupabaseBases(): string[] {
  const fromUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '';
  const ref = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim();
  const fromRef = ref ? `https://${ref}.supabase.co` : '';
  const out: string[] = [];
  if (fromUrl) out.push(fromUrl);
  if (fromRef && !out.includes(fromRef)) out.push(fromRef);
  return out;
}

function buildHeaders(accessToken: string): Record<string, string> | null {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) return null;
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${accessToken.trim()}`,
  };
}

async function readJsonError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    if (typeof j.error === 'string' && j.error.trim()) return j.error;
  } catch {
    /* not JSON */
  }
  if (res.status === 404) return 'Endpoint not found.';
  return text || `Request failed (${res.status}).`;
}

/**
 * Calls a moderation Edge Function (`submit-report` or `staff-moderation-action`).
 * Tries Supabase Edge Function first (where SUPABASE_SERVICE_ROLE_KEY is auto-injected),
 * then falls back to the Vercel proxy at `/api/<name>` if the project hasn't deployed
 * the Edge Function yet.
 */
export async function callModerationFn(
  name: 'submit-report' | 'staff-moderation-action' | 'staff-directory-action',
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'You need to be signed in.' };
  }

  const headers = buildHeaders(session.access_token);
  if (!headers) {
    return {
      ok: false,
      error: 'This build is missing the Supabase public key.',
    };
  }

  const body = JSON.stringify(payload ?? {});
  let lastErr: string | null = null;

  for (const base of candidateSupabaseBases()) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/${name}`, {
        method: 'POST',
        headers,
        body,
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const j = JSON.parse(text) as { ok?: boolean; error?: string };
          if (j.ok === true) return { ok: true };
          if (typeof j.error === 'string') {
            lastErr = j.error;
          } else {
            lastErr = `Request failed (${res.status}).`;
          }
        } catch {
          lastErr = 'Bad response from server.';
        }
        if (lastErr && !/Server (configuration error|missing Supabase configuration)|not found|Function not found|requested function/i.test(lastErr)) {
          return { ok: false, error: lastErr };
        }
      } else {
        lastErr = await readJsonError(res);
        if (
          res.status !== 404 &&
          res.status !== 502 &&
          !/Server (configuration error|missing Supabase configuration)/i.test(lastErr)
        ) {
          return { ok: false, error: lastErr };
        }
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    const res = await fetch(`/api/${name}`, {
      method: 'POST',
      headers,
      body,
    });
    if (res.ok) {
      const text = await res.text();
      try {
        const j = JSON.parse(text) as { ok?: boolean; error?: string };
        if (j.ok === true) return { ok: true };
        if (typeof j.error === 'string') return { ok: false, error: j.error };
        return { ok: false, error: 'Bad response from server.' };
      } catch {
        return { ok: false, error: 'Bad response from server.' };
      }
    }
    lastErr = await readJsonError(res);
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  return {
    ok: false,
    error:
      lastErr ||
      'Reporting is unreachable. Deploy the moderation Edge functions (or fix the /api proxy).',
  };
}
