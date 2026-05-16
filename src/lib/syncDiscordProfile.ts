import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { invokeDiscordProfileMediaSync } from '@/lib/callDiscordProfileMedia';
import { invokeSyncDiscordTokens } from '@/lib/callSyncDiscordTokens';
import { discordDefaultAvatarCdnUrl } from '@/lib/discordDefaultAvatar';
import { devWarn } from '@/lib/clientErrorHandling';

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
  if (!avatarUrl && discordIdForAvatar) {
    avatarUrl = discordDefaultAvatarCdnUrl(String(discordIdForAvatar));
  }

  const displayName =
    (typeof meta.full_name === 'string' ? meta.full_name : null) ??
    (typeof meta.name === 'string' ? meta.name : null) ??
    (typeof custom.global_name === 'string' ? custom.global_name : null) ??
    discordUsername;

  return { displayName, discordUsername, avatarUrl };
}

/**
 * Persist Discord identity on `profiles` after Supabase OAuth. OAuth tokens are stored in
 * `discord_oauth_credentials` via the sync-discord-tokens Edge Function (not readable from PostgREST).
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
    devWarn('syncDiscordProfileFromSession: no Discord id in JWT yet; skipping profile patch');
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
  if (!avatarUrl) {
    avatarUrl = discordDefaultAvatarCdnUrl(String(discordId));
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

  const persistTokens = async () => {
    const body: { access_token?: string; refresh_token?: string; expires_in?: number } = {};
    if (session.provider_token) body.access_token = session.provider_token;
    if (session.provider_refresh_token) body.refresh_token = session.provider_refresh_token;
    const expIn = (session as { expires_in?: number }).expires_in;
    if (typeof expIn === 'number' && Number.isFinite(expIn) && expIn > 0) {
      body.expires_in = expIn;
    }
    if (!body.access_token && !body.refresh_token) return;
    const r = await invokeSyncDiscordTokens(body);
    if (!r.ok && r.error) {
      devWarn('syncDiscordProfileFromSession: token sync', r.error);
    }
  };

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.id) {
    // Never overwrite `discord_avatar` from the Supabase JWT on routine sync — after a Discord-side
    // avatar change, `user_metadata.avatar_url` / identity_data often stays stale for a long time.
    // Fresh URLs come from `discord-profile-media` (@me) or native discord-oauth; this patch only
    // updates identity fields (tokens go to `discord_oauth_credentials` via persistTokens).
    const { discord_avatar: _omitAvatar, ...patchSansAvatar } = patch;
    const { error } = await supabase.from('profiles').update(patchSansAvatar).eq('user_id', user.id);
    if (error) return { error: new Error(error.message) };
    await persistTokens();
    return { error: null };
  }

  const { error } = await supabase.from('profiles').insert({
    user_id: user.id,
    ...patch,
  });
  if (error) return { error: new Error(error.message) };
  await persistTokens();
  return { error: null };
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
      devWarn('pullDiscordProfileAfterOAuth: media sync', r.error);
    }
  } catch (e) {
    devWarn('pullDiscordProfileAfterOAuth: media sync threw', e);
  }
  return { error: null };
}
