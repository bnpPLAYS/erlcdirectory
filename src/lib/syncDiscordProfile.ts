import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { invokeDiscordProfileMediaSync } from '@/lib/callDiscordProfileMedia';

/** Discord CDN avatar URL from user id + avatar hash (OAuth sometimes omits full `avatar_url` in JWT). */
export function discordAvatarCdnUrl(userId: string, avatarHash: string | null | undefined): string | null {
  if (!userId || avatarHash == null) return null;
  const h = String(avatarHash).trim();
  if (!h) return null;
  const ext = h.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${h}.${ext}?size=256`;
}

/** Immediate Discord display fields from the session JWT (no network). */
export type DiscordSessionDisplay = {
  displayName: string;
  discordUsername: string;
  avatarUrl: string | null;
};

/** Navbar / chrome: show Discord name & avatar before `profiles` finishes loading. */
export function getDiscordSessionDisplay(user: User | null | undefined): DiscordSessionDisplay | null {
  if (!user) return null;
  const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const custom = (meta.custom_claims || {}) as Record<string, unknown>;
  const discordIdForAvatar =
    discordIdentity?.id ??
    (typeof meta.provider_id === 'string' ? meta.provider_id : null) ??
    (typeof meta.sub === 'string' && String(meta.sub).match(/^\d+$/) ? meta.sub : null) ??
    (typeof custom.sub === 'string' ? custom.sub : null);

  const usernameRaw =
    (typeof meta.preferred_username === 'string' ? meta.preferred_username : null) ??
    (typeof meta.full_name === 'string' ? meta.full_name : null) ??
    (typeof meta.name === 'string' ? meta.name : null) ??
    'user';
  const discordUsername = usernameRaw.replace(/^@/u, '').trim() || 'user';

  let avatarUrl: string | null = typeof meta.avatar_url === 'string' ? meta.avatar_url : null;
  if (!avatarUrl && typeof meta.picture === 'string') {
    avatarUrl = meta.picture;
  }
  if (!avatarUrl && discordIdentity?.identity_data && typeof discordIdentity.identity_data === 'object') {
    const idata = discordIdentity.identity_data as Record<string, unknown>;
    if (typeof idata.avatar_url === 'string') {
      avatarUrl = idata.avatar_url;
    }
    if (!avatarUrl && typeof idata.avatar === 'string' && discordIdForAvatar) {
      avatarUrl = discordAvatarCdnUrl(String(discordIdForAvatar), idata.avatar);
    }
  }

  const displayName =
    (typeof meta.full_name === 'string' ? meta.full_name : null) ??
    (typeof meta.name === 'string' ? meta.name : null) ??
    (typeof custom.global_name === 'string' ? custom.global_name : null) ??
    discordUsername;

  return { displayName, discordUsername, avatarUrl };
}

/**
 * Persist Discord identity + tokens on `profiles` after Supabase OAuth (discord-guilds reads tokens from here).
 * Uses `session.user` only — avoids an extra `getUser()` round trip on every sync.
 */
export async function syncDiscordProfileFromSession(session: Session): Promise<{ error: Error | null }> {
  const user = session.user;

  const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const custom = (meta.custom_claims || {}) as Record<string, unknown>;

  const discordId =
    discordIdentity?.id ??
    (typeof meta.provider_id === 'string' ? meta.provider_id : null) ??
    (typeof meta.sub === 'string' && String(meta.sub).match(/^\d+$/) ? meta.sub : null) ??
    (typeof custom.sub === 'string' ? custom.sub : null);

  if (!discordId) {
    console.warn('syncDiscordProfileFromSession: no Discord id in JWT yet; skipping profile patch');
    return { error: null };
  }

  const username =
    (typeof meta.preferred_username === 'string' ? meta.preferred_username : null) ??
    (typeof meta.full_name === 'string' ? meta.full_name : null) ??
    (typeof meta.name === 'string' ? meta.name : null) ??
    'Discord User';

  let avatarUrl: string | null = typeof meta.avatar_url === 'string' ? meta.avatar_url : null;
  if (!avatarUrl && typeof meta.picture === 'string') {
    avatarUrl = meta.picture;
  }
  if (!avatarUrl && discordIdentity?.identity_data && typeof discordIdentity.identity_data === 'object') {
    const idata = discordIdentity.identity_data as Record<string, unknown>;
    if (typeof idata.avatar_url === 'string') {
      avatarUrl = idata.avatar_url;
    }
    if (!avatarUrl && typeof idata.avatar === 'string') {
      avatarUrl = discordAvatarCdnUrl(String(discordId), idata.avatar);
    }
  }

  const displayName =
    (typeof meta.full_name === 'string' ? meta.full_name : null) ??
    (typeof meta.name === 'string' ? meta.name : null) ??
    (typeof custom.global_name === 'string' ? custom.global_name : null) ??
    username;

  const patch: Record<string, unknown> = {
    discord_id: String(discordId),
    discord_username: username,
    discord_avatar: avatarUrl,
    display_name: displayName,
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

/**
 * After Discord OAuth: persist identity + tokens, then pull avatar/banner from Discord API into `profiles`.
 * Safe to call on every sign-in; media step no-ops if the edge function is unavailable.
 */
export async function pullDiscordProfileAfterOAuth(session: Session): Promise<{ error: Error | null }> {
  const syncResult = await syncDiscordProfileFromSession(session);
  if (syncResult.error) return syncResult;
  try {
    const r = await invokeDiscordProfileMediaSync();
    if (!r.ok && r.error) {
      console.warn('pullDiscordProfileAfterOAuth: media sync', r.error);
    }
  } catch (e) {
    console.warn('pullDiscordProfileAfterOAuth: media sync threw', e);
  }
  return { error: null };
}
