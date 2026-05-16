import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import { loadDiscordOAuthCredentials, upsertDiscordOAuthCredentials } from '../_shared/discordOAuthCredentials.ts'

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
    const creds = await loadDiscordOAuthCredentials(admin, userId)

    if (!creds?.access_token?.trim()) return json({ error: 'No Discord account linked.' }, 400)

    let accessToken = creds.access_token.trim()
    const refreshToken = creds.refresh_token?.trim() ?? ''

    if (
      creds.expires_at &&
      new Date(creds.expires_at).getTime() < Date.now() + 30_000 &&
      refreshToken
    ) {
      const refreshRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })
      const refreshed = await refreshRes.json()
      if (refreshRes.ok && refreshed.access_token) {
        accessToken = refreshed.access_token
        const expireIso = new Date(
          Date.now() + Number(refreshed.expires_in ?? 0) * 1000,
        ).toISOString()
        await upsertDiscordOAuthCredentials(admin, userId, {
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? refreshToken,
          expires_at: expireIso,
        })
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
        try {
          return BigInt(g.permissions ?? '0')
        } catch {
          return 0n
        }
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
