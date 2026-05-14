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
    const j = JSON.parse(text) as { error?: string; ok?: boolean };
    if (typeof j.error === 'string' && j.error.trim()) return j.error;
  } catch {
    /* ignore */
  }
  if (res.status === 404) return 'Endpoint not found.';
  return text || `Request failed (${res.status}).`;
}

async function postEdge(
  name: 'submit-server-claim' | 'staff-server-claim-action',
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
    return { ok: false, error: 'This build is missing the Supabase public key.' };
  }
  const body = JSON.stringify(payload);
  let lastErr: string | null = null;

  for (const base of candidateSupabaseBases()) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/${name}`, {
        method: 'POST',
        headers,
        body,
      });
      const text = await res.text();
      let j: { ok?: boolean; error?: string } = {};
      try {
        j = JSON.parse(text) as { ok?: boolean; error?: string };
      } catch {
        lastErr = 'Bad response from server.';
        continue;
      }
      if (res.ok && j.ok === true) return { ok: true };
      if (typeof j.error === 'string' && j.error.trim()) lastErr = j.error;
      else lastErr = `Request failed (${res.status}).`;
      if (res.status !== 404 && res.status !== 502) return { ok: false, error: lastErr };
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
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { ok?: boolean; error?: string };
      if (res.ok && j.ok === true) return { ok: true };
      if (typeof j.error === 'string') return { ok: false, error: j.error };
    } catch {
      return { ok: false, error: 'Bad response from server.' };
    }
    lastErr = await readJsonError(res);
  } catch (e) {
    lastErr = e instanceof Error ? e.message : String(e);
  }

  return {
    ok: false,
    error: lastErr || 'Server claim service is unreachable. Deploy the Edge functions or /api proxy.',
  };
}

export async function submitServerClaim(params: {
  serverId: string;
  discordLink: string;
  message?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return postEdge('submit-server-claim', {
    serverId: params.serverId,
    discordLink: params.discordLink,
    message: params.message ?? null,
  });
}

export async function staffDecideServerClaim(params: {
  requestId: string;
  decision: 'approve' | 'reject';
  staffNotes: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return postEdge('staff-server-claim-action', {
    requestId: params.requestId,
    decision: params.decision,
    staffNotes: params.staffNotes,
  });
}
