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

function authHeaders(accessToken: string): Record<string, string> | null {
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
  return text || `Request failed (${res.status}).`;
}

async function callEdge<T>(
  name: 'submit-server-claim' | 'staff-server-claim-action' | 'server-review-webhook',
  payload: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: 'Sign in first.' };

  const headers = authHeaders(session.access_token);
  if (!headers) return { ok: false, error: 'Missing Supabase public key in this build.' };

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
          if (j.ok) return { ok: true, data: j as unknown as T };
          if (typeof j.error === 'string') return { ok: false, error: j.error };
        } catch {
          /* ignore */
        }
        return { ok: false, error: 'Bad response from server.' };
      }
      lastErr = await readJsonError(res);
      if (res.status !== 404) return { ok: false, error: lastErr };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  return { ok: false, error: lastErr || `Edge function ${name} is not deployed.` };
}

export type ServerClaimSubmitResult =
  | { ok: true; request_id: string | null }
  | { ok: false; error: string };

export async function submitServerClaim(args: {
  serverId: string;
  discordLink: string;
  message?: string;
}): Promise<ServerClaimSubmitResult> {
  const r = await callEdge<{ ok: true; request_id?: string }>('submit-server-claim', {
    server_id: args.serverId,
    discord_link: args.discordLink,
    message: args.message ?? '',
  });
  if (!r.ok) return r;
  return { ok: true, request_id: (r.data.request_id as string | null | undefined) ?? null };
}

export async function staffDecideServerClaim(args: {
  requestId: string;
  decision: 'approve' | 'reject';
  staffNotes: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await callEdge<{ ok: true }>('staff-server-claim-action', {
    request_id: args.requestId,
    decision: args.decision,
    staff_notes: args.staffNotes,
  });
  if (!r.ok) return r;
  return { ok: true };
}

/** Best-effort fire of webhook; errors are swallowed so the reviewer never sees a webhook problem. */
export async function tryFireServerReviewWebhook(reviewId: string): Promise<void> {
  try {
    await callEdge<{ ok: true }>('server-review-webhook', { review_id: reviewId });
  } catch {
    /* ignore */
  }
}
