/**
 * Pull Discord avatar and/or profile banner (Nitro) from the Discord API using stored OAuth tokens.
 * Request body: `{ "sync": "both" | "banner" | "avatar" }` (default both). Refreshes OAuth on 401.
 * After a successful profile update, refreshes matching `servers` rows (banner, invite, description, icon)
 * for Discord guilds you are in that exist on the directory (capped per request).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import {
  discordIconCdnUrl,
  enrichDiscordGuildForDirectory,
} from '../_shared/discordGuildEnrichment.ts'
import { discordDefaultAvatarCdnUrl } from '../_shared/discordDefaultAvatar.ts'
import { upsertDiscordOAuthCredentials } from '../_shared/discordOAuthCredentials.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

type DiscordUser = {
  id: string
  username?: string
  global_name?: string | null
  avatar?: string | null
  banner?: string | null
}

function avatarCdn(userId: string, hash: string | null | undefined): string | null {
  if (!hash) return null
  const ext = String(hash).startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=256`
}

function bannerCdn(userId: string, hash: string | null | undefined): string | null {
  if (!hash) return null
  const ext = String(hash).startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/banners/${userId}/${hash}.${ext}?size=1024`
}

async function refreshDiscordAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
} | null> {
  const clientId = Deno.env.get('DISCORD_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')?.trim()
  if (!clientId || !clientSecret) return null

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) return null
  try {
    const d = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }
    if (!d.access_token) return null
    return {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_in: Number(d.expires_in ?? 0),
    }
  } catch {
    return null
  }
}

async function fetchDiscordMe(accessToken: string): Promise<{ ok: boolean; user?: DiscordUser; status: number }> {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return { ok: false, status: res.status }
  try {
    const user = (await res.json()) as DiscordUser
    return { ok: true, user, status: res.status }
  } catch {
    return { ok: false, status: res.status }
  }
}

async function fetchUserGuildIds(accessToken: string): Promise<string[]> {
  const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  try {
    const arr = (await res.json()) as Array<{ id?: string }>
    return [...new Set(arr.map((g) => String(g.id ?? '').trim()).filter(Boolean))]
  } catch {
    return []
  }
}

const MAX_DIRECTORY_SERVERS_PER_SYNC = 40
const GUILD_ID_QUERY_CHUNK = 80

type ServerRow = {
  id: string
  guild_id: string | null
  discord_invite: string | null
  banner: string | null
  description: string | null
  icon: string | null
}

/**
 * Update directory `servers` the user shares with Discord: banners, invites, etc.
 * Uses the same OAuth token so GET /guilds/:id works for guilds the user is in.
 */
async function refreshDirectoryServersForUserGuilds(
  admin: ReturnType<typeof createClient>,
  accessToken: string,
): Promise<number> {
  const guildIds = await fetchUserGuildIds(accessToken)
  if (guildIds.length === 0) return 0

  const seen = new Set<string>()
  const rows: ServerRow[] = []

  for (let i = 0; i < guildIds.length; i += GUILD_ID_QUERY_CHUNK) {
    const part = guildIds.slice(i, i + GUILD_ID_QUERY_CHUNK)
    const { data } = await admin
      .from('servers')
      .select('id, guild_id, discord_invite, banner, description, icon')
      .in('guild_id', part)

    for (const r of data ?? []) {
      const sr = r as ServerRow
      if (!sr.guild_id || seen.has(sr.id)) continue
      seen.add(sr.id)
      rows.push(sr)
    }
  }

  const candidates = rows.slice(0, MAX_DIRECTORY_SERVERS_PER_SYNC)
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN')?.trim()
  let updated = 0

  for (const srow of candidates) {
    const guildId = String(srow.guild_id)
    try {
      const enriched = await enrichDiscordGuildForDirectory(guildId, null, {
        userAccessToken: accessToken,
      })

      const patch: Record<string, unknown> = {}
      if (enriched.discordInvite?.trim()) patch.discord_invite = enriched.discordInvite.trim()
      if (enriched.bannerUrl?.trim()) patch.banner = enriched.bannerUrl.trim()
      if (enriched.description?.trim()) patch.description = enriched.description.trim()

      if (botToken) {
        const gr = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}`, {
          headers: { Authorization: `Bot ${botToken}` },
        })
        if (gr.ok) {
          try {
            const g = (await gr.json()) as { icon?: string | null }
            const iconUrl = discordIconCdnUrl(guildId, g.icon ?? null)
            if (iconUrl) patch.icon = iconUrl
          } catch {
            /* ignore */
          }
        }
      }

      if (Object.keys(patch).length === 0) continue

      const { error: upErr } = await admin.from('servers').update(patch).eq('id', srow.id)
      if (!upErr) updated += 1
    } catch {
      /* skip guild */
    }
  }

  return updated
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  let syncMode: 'banner' | 'avatar' | 'both' = 'both'
  try {
    const raw = await req.text()
    if (raw.trim()) {
      const parsed = JSON.parse(raw) as { sync?: unknown }
      const s = parsed?.sync
      if (s === 'banner' || s === 'avatar' || s === 'both') syncMode = s
    }
  } catch {
    /* invalid or empty body — default both */
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.includes('Bearer')) return json({ ok: false, error: 'Unauthorized' }, 401)

  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser(jwt)
  if (authErr || !user) return json({ ok: false, error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: row, error: rowErr } = await admin
    .from('profiles')
    .select('id, user_id, discord_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (rowErr || !row?.id) {
    return json({ ok: false, error: 'Profile not found.' }, 400)
  }

  const { data: credsRow } = await admin
    .from('discord_oauth_credentials')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const creds = credsRow as { access_token: string | null; refresh_token: string | null; expires_at: string | null } | null

  let accessToken = creds?.access_token?.trim() ?? ''
  let refreshToken = creds?.refresh_token?.trim() ?? ''
  let oauthExpiresIn: number | null = null

  if (!accessToken && !refreshToken) {
    return json(
      {
        ok: false,
        error:
          'No Discord tokens on file. Sign out and sign in with Discord once so we can load your banner.',
      },
      400,
    )
  }

  if (!accessToken && refreshToken) {
    const refreshed = await refreshDiscordAccessToken(refreshToken)
    if (refreshed?.access_token) {
      accessToken = refreshed.access_token
      if (refreshed.refresh_token) refreshToken = refreshed.refresh_token
      oauthExpiresIn = refreshed.expires_in
    }
  }

  if (!accessToken) {
    return json(
      {
        ok: false,
        error:
          'Could not refresh your Discord session. Sign out and sign in with Discord again.',
      },
      400,
    )
  }

  let me = await fetchDiscordMe(accessToken)
  if (!me.ok && me.status === 401 && refreshToken) {
    const refreshed = await refreshDiscordAccessToken(refreshToken)
    if (refreshed?.access_token) {
      accessToken = refreshed.access_token
      if (refreshed.refresh_token) refreshToken = refreshed.refresh_token
      oauthExpiresIn = refreshed.expires_in
      me = await fetchDiscordMe(accessToken)
    }
  }


  if (!me.ok || !me.user?.id) {
    return json(
      {
        ok: false,
        error:
          'Could not read your Discord profile. Try signing out and signing in with Discord again.',
      },
      502,
    )
  }

  const du = me.user
  const discordId = du.id || row.discord_id
  const customAvatar = discordId ? avatarCdn(discordId, du.avatar ?? null) : null
  /** When `avatar` is null Discord uses a default image — still write it so we never keep a stale custom CDN URL. */
  const avatarUrl =
    syncMode !== 'banner' && discordId
      ? customAvatar ?? discordDefaultAvatarCdnUrl(String(discordId))
      : null
  const bannerUrl = discordId ? bannerCdn(discordId, du.banner ?? null) : null

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  // Respect syncMode so "banner only" does not replace the profile picture (and vice versa).
  if (syncMode !== 'banner' && avatarUrl != null) patch.discord_avatar = avatarUrl
  if (syncMode !== 'avatar' && bannerUrl != null) patch.banner_url = bannerUrl

  const { error: upErr } = await admin.from('profiles').update(patch).eq('id', row.id)
  if (upErr) return json({ ok: false, error: 'Could not update profile media.' }, 500)

  let expiresAt: string | null = null
  if (oauthExpiresIn != null && oauthExpiresIn > 0) {
    expiresAt = new Date(Date.now() + oauthExpiresIn * 1000).toISOString()
  } else if (creds?.expires_at) {
    expiresAt = creds.expires_at
  }
  await upsertDiscordOAuthCredentials(admin, user.id, {
    access_token: accessToken || null,
    refresh_token: refreshToken || null,
    expires_at: expiresAt,
  })

  let servers_refreshed = 0
  try {
    servers_refreshed = await refreshDirectoryServersForUserGuilds(admin, accessToken)
  } catch {
    /* non-fatal — profile sync already succeeded */
  }

  return json({
    ok: true,
    banner_url: bannerUrl,
    discord_avatar: avatarUrl,
    servers_refreshed,
  })
})
