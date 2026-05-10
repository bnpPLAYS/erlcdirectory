import { supabase } from '@/integrations/supabase/client';

/** What to copy from Discord into `profiles` (Edge Function only applies selected fields). */
export type DiscordProfileMediaSyncMode = 'banner' | 'avatar' | 'both';

export type DiscordProfileMediaResult = {
  ok: boolean;
  banner_url?: string | null;
  discord_avatar?: string | null;
  /** Matching `servers` rows refreshed (banner, invite, etc.) for guilds you are in. */
  servers_refreshed?: number;
  error?: string;
};

function parsePayload(data: unknown): DiscordProfileMediaResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Invalid response' };
  }
  const d = data as Record<string, unknown>;
  if (d.ok === false) {
    return { ok: false, error: typeof d.error === 'string' ? d.error : 'Sync failed' };
  }
  if (d.ok === true) {
    const sr = d.servers_refreshed;
    return {
      ok: true,
      banner_url: (d.banner_url as string | null) ?? null,
      discord_avatar: (d.discord_avatar as string | null) ?? null,
      servers_refreshed: typeof sr === 'number' && Number.isFinite(sr) ? Math.max(0, Math.floor(sr)) : undefined,
    };
  }
  return { ok: false, error: 'Unexpected response' };
}

function shouldTryProxy(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) return true;
  return /Failed to send a request to the Edge Function|network|fetch|Load failed|blocked/i.test(errorMessage);
}

/** Pull latest Discord avatar and/or banner into `profiles` (Edge Function + same-origin API fallback). */
export async function invokeDiscordProfileMediaSync(options?: {
  sync?: DiscordProfileMediaSyncMode;
}): Promise<DiscordProfileMediaResult> {
  const sync: DiscordProfileMediaSyncMode = options?.sync ?? 'both';
  const bodyJson = JSON.stringify({ sync });

  const { data, error } = await supabase.functions.invoke<DiscordProfileMediaResult>('discord-profile-media', {
    body: { sync },
  });

  if (!error) {
    return parsePayload(data);
  }

  if (!shouldTryProxy(error.message)) {
    return { ok: false, error: error.message };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { ok: false, error: 'Sign in with Discord to sync from Discord.' };
  }

  try {
    const res = await fetch('/api/discord-profile-media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: bodyJson,
    });
    const json = (await res.json().catch(() => null)) as unknown;
    const parsed = parsePayload(json);
    if (!res.ok && !parsed.error) {
      return { ok: false, error: `Request failed (${res.status})` };
    }
    if (!parsed.ok && res.status === 404) {
      return {
        ok: false,
        error:
          'discord-profile-media is not deployed on this Supabase project. Deploy: supabase functions deploy discord-profile-media',
      };
    }
    return parsed;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not reach the sync service. Try again.',
    };
  }
}
