import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/** Discord fields readable from the Supabase session JWT (before `profiles` row hydrates). */
export type DiscordPresentation = {
  discordId: string | null;
  discordUsername: string;
  displayName: string;
  avatarUrl: string | null;
};

function readDiscordPresentation(user: User): DiscordPresentation {
  const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const custom = (meta.custom_claims || {}) as Record<string, unknown>;
  const idata =
    discordIdentity?.identity_data && typeof discordIdentity.identity_data === 'object'
      ? (discordIdentity.identity_data as Record<string, unknown>)
      : null;

  const discordIdRaw =
    discordIdentity?.id ??
    (typeof meta.provider_id === 'string' ? meta.provider_id : null) ??
    (typeof meta.sub === 'string' && /^\d+$/.test(String(meta.sub)) ? meta.sub : null) ??
    (typeof custom.sub === 'string' ? custom.sub : null);
  const discordId = discordIdRaw != null && String(discordIdRaw).length > 0 ? String(discordIdRaw) : null;

  const discordUsername =
    (typeof meta.preferred_username === 'string' ? meta.preferred_username : null) ??
    (idata && typeof idata.username === 'string' ? idata.username : null) ??
    (typeof meta.full_name === 'string' ? meta.full_name : null) ??
    (typeof meta.name === 'string' ? meta.name : null) ??
    'Discord User';

  let avatarUrl: string | null = typeof meta.avatar_url === 'string' ? meta.avatar_url : null;
  if (!avatarUrl && typeof meta.picture === 'string') {
    avatarUrl = meta.picture;
  }
  if (!avatarUrl && idata && typeof idata.avatar_url === 'string') {
    avatarUrl = idata.avatar_url;
  }

  const displayName =
    (typeof meta.full_name === 'string' ? meta.full_name : null) ??
    (typeof meta.name === 'string' ? meta.name : null) ??
    (typeof custom.global_name === 'string' ? custom.global_name : null) ??
    discordUsername;

  return { discordId, discordUsername, displayName, avatarUrl };
}

/** Navbar / UI: show Discord name & avatar immediately while `profiles` is still loading. */
export function getDiscordSessionDisplay(user: User | null | undefined): DiscordPresentation | null {
  if (!user) return null;
  return readDiscordPresentation(user);
}

/**
 * Persist Discord identity + tokens on `profiles` after Supabase OAuth (discord-guilds reads tokens from here).
 */
export async function syncDiscordProfileFromSession(session: Session): Promise<{ error: Error | null }> {
  let user = session.user;

  const { data: refreshed, error: refreshErr } = await supabase.auth.getUser();
  if (!refreshErr && refreshed.user) {
    user = refreshed.user;
  }

  const p = readDiscordPresentation(user);
  if (!p.discordId) {
    console.warn('syncDiscordProfileFromSession: no Discord id in JWT yet; skipping profile patch');
    return { error: null };
  }

  const patch: Record<string, unknown> = {
    discord_id: p.discordId,
    discord_username: p.discordUsername,
    discord_avatar: p.avatarUrl,
    display_name: p.displayName,
    updated_at: new Date().toISOString(),
  };

  if (session.provider_token) {
    patch.discord_access_token = session.provider_token;
  }
  if (session.provider_refresh_token) {
    patch.discord_refresh_token = session.provider_refresh_token;
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from('profiles').update(patch).eq('user_id', user.id);
    return { error: error ? new Error(error.message) : null };
  }

  const { error } = await supabase.from('profiles').insert({
    user_id: user.id,
    ...patch,
  });
  return { error: error ? new Error(error.message) : null };
}
