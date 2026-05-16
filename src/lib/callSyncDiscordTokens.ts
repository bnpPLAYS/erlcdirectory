import { supabase } from '@/integrations/supabase/client';

export type SyncDiscordTokensBody = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_in?: number | null;
};

function parsePayload(data: unknown): { ok: boolean; skipped?: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Invalid response' };
  }
  const d = data as Record<string, unknown>;
  if (d.ok === false) {
    return { ok: false, error: typeof d.error === 'string' ? d.error : 'Sync failed' };
  }
  if (d.ok === true) {
    return { ok: true, skipped: d.skipped === true };
  }
  return { ok: false, error: 'Unexpected response' };
}

function shouldTryProxy(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) return true;
  return /Failed to send a request to the Edge Function|network|fetch|Load failed|blocked/i.test(errorMessage);
}

/** Persists Discord OAuth tokens in `discord_oauth_credentials` (not exposed via PostgREST). */
export async function invokeSyncDiscordTokens(body: SyncDiscordTokensBody): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('sync-discord-tokens', { body });

  if (!error) {
    const p = parsePayload(data);
    return p.ok ? { ok: true } : { ok: false, error: p.error };
  }

  if (!shouldTryProxy(error.message)) {
    return { ok: false, error: error.message };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { ok: false, error: 'Sign in required.' };
  }

  try {
    const res = await fetch('/api/sync-discord-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    const parsed = parsePayload(json);
    if (!parsed.ok && res.status === 404) {
      return {
        ok: false,
        error:
          'sync-discord-tokens is not deployed on this Supabase project. Deploy: supabase functions deploy sync-discord-tokens',
      };
    }
    return parsed.ok ? { ok: true } : { ok: false, error: parsed.error };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not reach the sync service. Try again.',
    };
  }
}
