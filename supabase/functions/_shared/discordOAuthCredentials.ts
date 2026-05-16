import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'

export type DiscordOAuthCreds = {
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
}

function trimToken(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length ? t : null
}

export async function loadDiscordOAuthCredentials(
  admin: SupabaseClient,
  userId: string,
): Promise<DiscordOAuthCreds | null> {
  const { data, error } = await admin
    .from('discord_oauth_credentials')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[discord_oauth_credentials] load', error.message)
    return null
  }
  return (data as DiscordOAuthCreds | null) ?? null
}

/**
 * Upsert Discord OAuth tokens for a user. Undefined patch fields keep existing DB values.
 */
export async function upsertDiscordOAuthCredentials(
  admin: SupabaseClient,
  userId: string,
  patch: { access_token?: string | null; refresh_token?: string | null; expires_at?: string | null },
): Promise<void> {
  const cur = await loadDiscordOAuthCredentials(admin, userId)
  const access_token =
    patch.access_token !== undefined ? trimToken(patch.access_token) : cur?.access_token ?? null
  const refresh_token =
    patch.refresh_token !== undefined ? trimToken(patch.refresh_token) : cur?.refresh_token ?? null
  const expires_at = patch.expires_at !== undefined ? patch.expires_at : cur?.expires_at ?? null

  const row = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    access_token,
    refresh_token,
    expires_at,
  }
  const { error } = await admin.from('discord_oauth_credentials').upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[discord_oauth_credentials] upsert', error.message)
  }
}
