/**
 * Submit a claim for an unclaimed server.
 *
 * The claimant must have a *verified* experience tied to the server's guild_id.
 * One pending claim per server (unique partial index in DB). Approved by staff via
 * staff-server-claim-action.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeDiscordLink(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (v.length > 400) return null
  try {
    const u = new URL(v.startsWith('http') ? v : `https://${v}`)
    const host = u.hostname.toLowerCase()
    if (host !== 'discord.com' && host !== 'www.discord.com' && host !== 'discord.gg' && host !== 'ptb.discord.com') {
      return null
    }
    return u.toString().slice(0, 400)
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized' }, 401)
  const jwt = authHeader.slice(7).trim()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '') || ''
  const anonKey =
    Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: 'Server configuration error.' }, 500)
  }

  let body: { server_id?: string; discord_link?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const serverId = (body.server_id ?? '').toString().trim()
  if (!UUID_RE.test(serverId)) return json({ ok: false, error: 'Invalid server id.' }, 400)

  const discordLink = normalizeDiscordLink((body.discord_link ?? '').toString())
  if (!discordLink) {
    return json(
      { ok: false, error: 'Provide a Discord profile/community link (discord.com/users/… or discord.gg/…).' },
      400,
    )
  }

  const message = (body.message ?? '').toString().trim().slice(0, 2000)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt)
  if (userErr || !user) return json({ ok: false, error: 'Invalid session' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: profile } = await admin
    .from('profiles')
    .select('id, display_name, discord_username, discord_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile?.id) return json({ ok: false, error: 'Your profile is missing — re-sign in.' }, 400)

  const { data: server } = await admin
    .from('servers')
    .select('id, name, owner_id, guild_id, claim_open')
    .eq('id', serverId)
    .maybeSingle()
  if (!server) return json({ ok: false, error: 'Server not found.' }, 404)
  if (server.owner_id) return json({ ok: false, error: 'This server has already been claimed.' }, 409)
  if (server.claim_open === false) {
    return json({ ok: false, error: 'Claim submissions are paused for this server.' }, 403)
  }
  if (!server.guild_id) {
    return json(
      { ok: false, error: 'This server has no linked Discord guild yet — staff must approve a claim manually.' },
      400,
    )
  }

  // Verified staff requirement: profile must have a verified experience on this guild.
  const { data: verifiedExp } = await admin
    .from('experiences')
    .select('id')
    .eq('profile_id', profile.id)
    .eq('guild_id', server.guild_id)
    .eq('is_verified', true)
    .limit(1)
    .maybeSingle()
  if (!verifiedExp) {
    return json(
      {
        ok: false,
        error:
          'Only members with a verified experience on this server can submit a claim. Add a role on your profile and have a Discord admin verify it first.',
      },
      403,
    )
  }

  // Single pending claim across all servers (enforced in DB for the same server via partial unique).
  const { data: existing } = await admin
    .from('server_claim_requests')
    .select('id, status')
    .eq('server_id', serverId)
    .eq('claimant_profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing?.status === 'pending') {
    return json({ ok: false, error: 'You already have a pending claim for this server.' }, 409)
  }

  const { error: insErr, data: ins } = await admin
    .from('server_claim_requests')
    .insert({
      server_id: serverId,
      claimant_profile_id: profile.id,
      claimant_user_id: user.id,
      claimant_discord_id: profile.discord_id,
      claimant_discord_username: profile.discord_username,
      claimant_discord_link: discordLink,
      message: message || null,
      status: 'pending',
    } as never)
    .select('id')
    .maybeSingle()

  if (insErr) {
    const msg = insErr.message || ''
    if (/server_claim_requests_unique_pending|duplicate key/i.test(msg)) {
      return json({ ok: false, error: 'A pending claim already exists for this server.' }, 409)
    }
    if (/relation|does not exist|schema cache/i.test(msg)) {
      return json(
        {
          ok: false,
          error:
            'Server claim schema is missing. Apply migration 20260629140000_server_claims_and_customization.sql in Supabase.',
        },
        503,
      )
    }
    return json({ ok: false, error: msg }, 400)
  }

  return json({ ok: true, request_id: ins?.id ?? null })
})
