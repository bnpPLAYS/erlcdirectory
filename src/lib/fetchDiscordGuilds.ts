import { supabase } from '@/integrations/supabase/client';

export interface DiscordGuildListItem {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  is_admin: boolean;
}

function normalizeGuildList(raw: unknown): DiscordGuildListItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DiscordGuildListItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Record<string, unknown>;
    const id = typeof g.id === 'string' ? g.id : typeof g.id === 'number' ? String(g.id) : '';
    if (!id) continue;
    const nameRaw = g.name;
    const name =
      typeof nameRaw === 'string' && nameRaw.trim().length > 0 ? nameRaw.trim() : 'Unnamed server';
    const icon = g.icon === null || typeof g.icon === 'string' ? (g.icon as string | null) : null;
    out.push({
      id,
      name,
      icon,
      owner: !!g.owner,
      is_admin: !!g.is_admin,
    });
  }
  return out;
}

/**
 * Loads the signed-in user's Discord guilds via Supabase Edge Function (JWT), or same-origin
 * `/api/discord-guilds` with the session access token when the Edge Function is unavailable.
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
    return normalizeGuildList(edgeGuilds);
  }

  const discordToken = session.provider_token ?? null;

  if (!discordToken) {
    throw new Error(
      'No Discord access token in your session. Sign out and sign in with Discord again, or deploy the discord-guilds function on Supabase.',
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

  return normalizeGuildList(parsed.guilds);
}
