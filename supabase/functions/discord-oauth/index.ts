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

const safeName = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

/**
 * Internal auth email (no inbox). Used when Discord does not return email (identify+guilds only),
 * which matches directory sign-in and experience verification OAuth.
 */
function discordSyntheticEmail(discordId: string): string {
  const id = String(discordId).replace(/[^\d]/g, '')
  if (!id) return 'discord-unknown@users.noreply.erlc.directory'
  return `discord.${id}@users.noreply.erlc.directory`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
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
    const appRedirectTo = typeof body.appRedirectTo === 'string' ? body.appRedirectTo : ''

    if (!code || code.length > 256) return json({ error: 'Missing Discord authorization code.' }, 400)
    if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) return json({ error: 'Invalid Discord redirect URL.' }, 400)
    if (!appRedirectTo.startsWith('http://') && !appRedirectTo.startsWith('https://')) return json({ error: 'Invalid app redirect URL.' }, 400)

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

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`
      : null
    const bannerUrl = discordUser.banner
      ? `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}.${discordUser.banner.startsWith('a_') ? 'gif' : 'png'}?size=600`
      : null
    const expiresAt = new Date(Date.now() + Number(tokenData.expires_in ?? 0) * 1000).toISOString()
    const displayName = safeName(discordUser.global_name) ?? safeName(discordUser.username) ?? 'Discord User'
    const username = typeof discordUser.username === 'string' && discordUser.username.trim() ? discordUser.username.trim() : 'user'

    const admin = createClient(supabaseUrl, serviceKey)
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const token = authHeader.replace('Bearer ', '')
      const { data: claimsData } = await authClient.auth.getClaims(token)
      userId = claimsData?.claims?.sub ?? null
    }

    if (!userId) {
      const { data: profileByDiscord } = await admin
        .from('profiles')
        .select('user_id')
        .eq('discord_id', discordUser.id)
        .maybeSingle()

      userId = profileByDiscord?.user_id ?? null
    }

    const syntheticEmail = discordSyntheticEmail(discordUser.id)

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: {
          provider: 'discord',
          sub: discordUser.id,
          provider_id: discordUser.id,
          discord_id: discordUser.id,
          discord_username: username,
          preferred_username: username,
          user_name: username,
          full_name: displayName,
          name: username,
          avatar_url: avatarUrl,
          custom_claims: {
            sub: discordUser.id,
            global_name: safeName(discordUser.global_name),
          },
        },
      })

      if (!createError) {
        userId = created.user?.id ?? null
      } else {
        const msg = createError.message.toLowerCase()
        if (msg.includes('already') || msg.includes('registered') || msg.includes('duplicate')) {
          const { data: pRetry } = await admin
            .from('profiles')
            .select('user_id')
            .eq('discord_id', discordUser.id)
            .maybeSingle()
          userId = pRetry?.user_id ?? null
        } else {
          return json({ error: 'Could not create your account.', details: createError.message }, 500)
        }
      }
    }

    if (!userId) {
      const { data: pLast } = await admin.from('profiles').select('user_id').eq('discord_id', discordUser.id).maybeSingle()
      userId = pLast?.user_id ?? null
    }

    if (!userId) return json({ error: 'Could not connect this Discord account.' }, 500)

    const { data: authUser, error: authUserErr } = await admin.auth.admin.getUserById(userId)
    if (authUserErr || !authUser?.user?.email) {
      return json({ error: 'Could not load your account for sign-in.' }, 500)
    }
    const signInEmail = authUser.user.email

    const { data: existingProfile } = await admin.from('profiles').select('id, banner_url').eq('user_id', userId).maybeSingle()
    const isNewProfile = !existingProfile?.id

    const profilePatch: Record<string, unknown> = {
      user_id: userId,
      discord_id: discordUser.id,
      discord_username: username,
      discord_avatar: avatarUrl,
      display_name: displayName,
      discord_access_token: tokenData.access_token,
      discord_refresh_token: tokenData.refresh_token,
      discord_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }
    if (bannerUrl && (isNewProfile || !existingProfile?.banner_url)) {
      profilePatch.banner_url = bannerUrl
    }

    const { error: profileError } = isNewProfile
      ? await admin.from('profiles').insert(profilePatch)
      : await admin.from('profiles').update(profilePatch).eq('id', existingProfile!.id)

    if (profileError) return json({ error: 'Could not save Discord to your profile.' }, 500)

    const { data: magicLink, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: signInEmail,
      options: { redirectTo: appRedirectTo },
    })

    if (linkError || !magicLink?.properties?.action_link) return json({ error: 'Could not finish sign in.' }, 500)

    return json({ success: true, actionLink: magicLink.properties.action_link, isNewProfile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})
