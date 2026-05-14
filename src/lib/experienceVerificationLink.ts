import { supabase } from '@/integrations/supabase/client';
import { buildVerifyExperienceUrl } from '@/lib/publicSiteUrl';

/** Verification tokens expire after this many hours (server + client stay in sync). */
export const VERIFICATION_LINK_HOURS = 24;

function makeToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

function expiresAtIso(): string {
  return new Date(Date.now() + VERIFICATION_LINK_HOURS * 60 * 60 * 1000).toISOString();
}

export type VerificationGuild = { id: string; name: string; icon: string | null };

/**
 * Returns a shareable verification URL. Reuses a non-expired pending link unless `forceNew` is true.
 * `forceNew` deletes pending rows for this experience and creates a fresh 24h token.
 */
export async function ensureVerificationLink(params: {
  experienceId: string;
  profileId: string;
  guild: VerificationGuild;
  forceNew?: boolean;
}): Promise<{ url: string; token: string } | { error: string }> {
  const { experienceId, profileId, guild, forceNew } = params;

  if (!forceNew) {
    const { data: row } = await supabase
      .from('experience_verification_requests')
      .select('token, status, expires_at')
      .eq('experience_id', experienceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      row &&
      row.status === 'pending' &&
      new Date(row.expires_at).getTime() > Date.now()
    ) {
      return { url: buildVerifyExperienceUrl(row.token), token: row.token };
    }
  }

  await supabase
    .from('experience_verification_requests')
    .delete()
    .eq('experience_id', experienceId)
    .eq('status', 'pending');

  const token = makeToken();
  const { data, error } = await supabase
    .from('experience_verification_requests')
    .insert({
      experience_id: experienceId,
      profile_id: profileId,
      guild_id: guild.id,
      guild_name: guild.name,
      guild_icon: guild.icon,
      token,
      expires_at: expiresAtIso(),
    })
    .select('token')
    .single();

  if (error) return { error: error.message };
  return { url: buildVerifyExperienceUrl(data.token), token: data.token };
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
