import { supabase } from '@/integrations/supabase/client';

export interface DiscordGuildListItem {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  is_admin: boolean;
}

/**
 * Loads the signed-in user's Discord guilds. Tries Supabase Edge Function first, then
 * same-origin `/api/discord-guilds` (Vercel) with the Discord OAuth access token so the
 * app works when Edge Functions are not deployed.
 */
export async function fetchDiscordGuilds(): Promise<DiscordGuildListItem[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('You must be signed in.');
  }

  const { data, error } = await supabase.functions.invoke('discord-guilds', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const edgeGuilds = data && typeof data === 'object' && 'guilds' in data ? (data as { guilds: unknown }).guilds : null;
  const edgeErr =
    (data && typeof data === 'object' && 'error' in data && (data as { error: string }).error) || null;

  if (!error && Array.isArray(edgeGuilds) && !edgeErr) {
    return edgeGuilds as DiscordGuildListItem[];
  }

  let discordToken = session.provider_token ?? null;
  if (!discordToken) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('discord_access_token')
      .eq('user_id', session.user.id)
      .maybeSingle();
    discordToken = profile?.discord_access_token ?? null;
  }

  if (!discordToken) {
    throw new Error(
      'No Discord access token. Sign out and sign in with Discord again, or deploy the discord-guilds function on Supabase.',
    );
  }

  const res = await fetch('/api/discord-guilds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: discordToken }),
  });

  const text = await res.text();
  let parsed: { guilds?: DiscordGuildListItem[]; error?: string } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    if (!res.ok) {
      throw new Error(`Could not load Discord servers (${res.status}). Deploy finished? Try production URL.`);
    }
    throw new Error('Invalid response when loading Discord servers.');
  }

  if (!res.ok) {
    throw new Error(parsed.error || `Could not load Discord servers (${res.status}).`);
  }

  if (!Array.isArray(parsed.guilds)) {
    throw new Error('Invalid Discord server list.');
  }

  return parsed.guilds;
}
