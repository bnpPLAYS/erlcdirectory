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

// Discord ADMINISTRATOR permission flag = 0x8
const ADMIN = 0x8n

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const clientId = Deno.env.get('DISCORD_CLIENT_ID')!
    const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Not signed in.' }, 401)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData } = await authClient.auth.getClaims(token)
    const userId = claimsData?.claims?.sub
    if (!userId) return json({ error: 'Not signed in.' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: profile } = await admin
      .from('profiles')
      .select('id, discord_access_token, discord_refresh_token, discord_token_expires_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile?.discord_access_token) return json({ error: 'No Discord account linked.' }, 400)

    let accessToken = profile.discord_access_token as string

    // Refresh if expired
    if (
      profile.discord_token_expires_at &&
      new Date(profile.discord_token_expires_at).getTime() < Date.now() + 30_000 &&
      profile.discord_refresh_token
    ) {
      const refreshRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: profile.discord_refresh_token,
        }),
      })
      const refreshed = await refreshRes.json()
      if (refreshRes.ok && refreshed.access_token) {
        accessToken = refreshed.access_token
        await admin
          .from('profiles')
          .update({
            discord_access_token: refreshed.access_token,
            discord_refresh_token: refreshed.refresh_token ?? profile.discord_refresh_token,
            discord_token_expires_at: new Date(
              Date.now() + Number(refreshed.expires_in ?? 0) * 1000
            ).toISOString(),
          })
          .eq('id', profile.id)
      }
    }

    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!guildsRes.ok) {
      const detail = await guildsRes.text()
      return json({ error: 'Discord rejected the request. Re-link your Discord account.', detail }, 400)
    }
    const guilds = await guildsRes.json()

    const out = (guilds as any[]).map((g) => {
      const perms = (() => {
        try { return BigInt(g.permissions ?? '0') } catch { return 0n }
      })()
      return {
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
          : null,
        owner: !!g.owner,
        is_admin: !!g.owner || (perms & ADMIN) === ADMIN,
      }
    })

    return json({ guilds: out })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
