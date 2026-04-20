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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'You must be signed in before connecting Discord.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const clientId = Deno.env.get('DISCORD_CLIENT_ID')
    const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')

    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Backend auth is not configured.' }, 500)
    if (!clientId || !clientSecret) return json({ error: 'Discord credentials are not configured.' }, 500)

    const body = await req.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code : ''
    const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri : ''

    if (!code || code.length > 256) return json({ error: 'Missing Discord authorization code.' }, 400)
    if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
      return json({ error: 'Invalid redirect URL.' }, 400)
    }

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims?.sub) return json({ error: 'Your session expired. Please sign in again.' }, 401)

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) return json({ error: 'Discord rejected the authorization code.', details: tokenData }, 400)

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const discordUser = await userRes.json()
    if (!userRes.ok || !discordUser?.id) return json({ error: 'Could not read your Discord account.' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`
      : null
    const expiresAt = new Date(Date.now() + Number(tokenData.expires_in ?? 0) * 1000).toISOString()

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        discord_id: discordUser.id,
        discord_username: discordUser.global_name || discordUser.username,
        discord_avatar: avatarUrl,
        display_name: discordUser.global_name || discordUser.username,
        discord_access_token: tokenData.access_token,
        discord_refresh_token: tokenData.refresh_token,
        discord_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', claimsData.claims.sub)

    if (updateError) return json({ error: 'Could not connect Discord to your profile.' }, 500)

    return json({
      success: true,
      discord: {
        id: discordUser.id,
        username: discordUser.username,
        displayName: discordUser.global_name || discordUser.username,
        avatarUrl,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})
