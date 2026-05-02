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

const ADMIN = 0x8n

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const clientId = Deno.env.get('DISCORD_CLIENT_ID')!
    const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')!

    const admin = createClient(supabaseUrl, serviceKey)
    const url = new URL(req.url)
    const action = url.searchParams.get('action') ?? 'lookup'
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const tokenParam = (body.token ?? url.searchParams.get('token') ?? '').toString().trim()

    if (!tokenParam || tokenParam.length > 128) return json({ error: 'Missing or invalid token.' }, 400)

    // Load the request and the experience + member it points to
    const { data: vr } = await admin
      .from('experience_verification_requests')
      .select('*')
      .eq('token', tokenParam)
      .maybeSingle()

    if (!vr) return json({ error: 'This verification link is not valid.' }, 404)

    // Auto-expire
    let status = vr.status as string
    if (status === 'pending' && new Date(vr.expires_at).getTime() < Date.now()) {
      await admin
        .from('experience_verification_requests')
        .update({ status: 'expired' })
        .eq('id', vr.id)
      status = 'expired'
    }

    const { data: experience } = await admin
      .from('experiences')
      .select('id, role, server_name, server_icon, department, start_date, end_date, is_current, is_verified, profile_id')
      .eq('id', vr.experience_id)
      .maybeSingle()

    const { data: profile } = await admin
      .from('profiles')
      .select('id, display_name, discord_username, discord_avatar')
      .eq('id', vr.profile_id)
      .maybeSingle()

    // Lookup-only request: just return state
    if (action === 'lookup') {
      return json({
        request: {
          id: vr.id,
          guild_id: vr.guild_id,
          guild_name: vr.guild_name,
          guild_icon: vr.guild_icon,
          status,
          expires_at: vr.expires_at,
          decided_at: vr.decided_at,
          approver_discord_username: vr.approver_discord_username,
        },
        experience,
        member: profile,
      })
    }

    // Decision actions require a Discord OAuth code from the verifier
    if (action !== 'approve' && action !== 'reject') {
      return json({ error: 'Unsupported action.' }, 400)
    }

    if (status !== 'pending') {
      return json({ error: `This request is already ${status}.` }, 400)
    }

    const code = (body.code ?? '').toString()
    const redirectUri = (body.redirectUri ?? '').toString()
    if (!code || !redirectUri) return json({ error: 'Missing Discord authorization.' }, 400)

    // Exchange code for token
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
    if (!tokenRes.ok) return json({ error: 'Discord rejected the sign-in.', details: tokenData }, 400)

    const me = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }).then((r) => r.json())
    if (!me?.id) return json({ error: 'Could not read Discord account.' }, 400)

    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    if (!guildsRes.ok) return json({ error: 'Could not read your servers from Discord.' }, 400)
    const guilds = (await guildsRes.json()) as any[]

    const target = guilds.find((g) => String(g.id) === String(vr.guild_id))
    if (!target) {
      return json({
        error: `You are not in the server "${vr.guild_name ?? vr.guild_id}", so you cannot verify this experience.`,
      }, 403)
    }
    let perms = 0n
    try { perms = BigInt(target.permissions ?? '0') } catch { /* ignore */ }
    const isAdmin = !!target.owner || (perms & ADMIN) === ADMIN
    if (!isAdmin) {
      return json({
        error: `You don't have Administrator permission in "${target.name}". Only an admin can approve this.`,
      }, 403)
    }

    const decidedAt = new Date().toISOString()

    if (action === 'approve') {
      await admin
        .from('experience_verification_requests')
        .update({
          status: 'approved',
          approver_discord_id: me.id,
          approver_discord_username: me.username,
          decided_at: decidedAt,
        })
        .eq('id', vr.id)

      await admin
        .from('experiences')
        .update({
          is_verified: true,
          guild_id: vr.guild_id,
          verified_by_discord_id: me.id,
          verified_by_discord_username: me.username,
          verified_at: decidedAt,
        })
        .eq('id', vr.experience_id)

      return json({ ok: true, status: 'approved', approver: me.username })
    } else {
      await admin
        .from('experience_verification_requests')
        .update({
          status: 'rejected',
          approver_discord_id: me.id,
          approver_discord_username: me.username,
          decided_at: decidedAt,
        })
        .eq('id', vr.id)
      return json({ ok: true, status: 'rejected', approver: me.username })
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
