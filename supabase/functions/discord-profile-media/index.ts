/**
 * Pull latest Discord avatar + profile banner (Nitro) from Discord API using stored OAuth tokens.
 * Refreshes OAuth access token when Discord returns 401.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

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
    .select(
      'id, user_id, discord_access_token, discord_refresh_token, discord_id',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (rowErr || !row?.id) {
    return json({ ok: false, error: 'Profile not found.' }, 400)
  }

  let accessToken = row.discord_access_token?.trim() ?? ''
  let refreshToken = row.discord_refresh_token?.trim() ?? ''
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
  const avatarUrl = discordId ? avatarCdn(discordId, du.avatar ?? null) : null
  const bannerUrl = discordId ? bannerCdn(discordId, du.banner ?? null) : null

  const patch: Record<string, unknown> = {
    discord_access_token: accessToken || null,
    discord_refresh_token: refreshToken || null,
    updated_at: new Date().toISOString(),
  }
  // Only overwrite media URLs when Discord returns hashes — avoid wiping a custom banner/avatar.
  if (avatarUrl != null) patch.discord_avatar = avatarUrl
  if (bannerUrl != null) patch.banner_url = bannerUrl
  if (oauthExpiresIn != null && oauthExpiresIn > 0) {
    patch.discord_token_expires_at = new Date(Date.now() + oauthExpiresIn * 1000).toISOString()
  }

  const { error: upErr } = await admin.from('profiles').update(patch).eq('id', row.id)
  if (upErr) return json({ ok: false, error: upErr.message }, 500)

  return json({
    ok: true,
    banner_url: bannerUrl,
    discord_avatar: avatarUrl,
  })
})
