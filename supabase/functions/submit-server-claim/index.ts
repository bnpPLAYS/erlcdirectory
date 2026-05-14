/**
 * Verified staff of an unclaimed server submit an ownership claim for ERLC staff to review.
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

function discordContactLooksValid(s: string): boolean {
  const t = s.trim()
  if (t.length < 8 || t.length > 2000) return false
  const low = t.toLowerCase()
  if (/discord\.gg|discord\.com|discordapp\.com/.test(low)) return true
  if (/^https?:\/\//.test(low)) return true
  if (/^[\w.]{2,32}$/.test(t)) return true
  return false
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

  let body: { serverId?: string; discordLink?: string; message?: string | null }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const serverId = typeof body.serverId === 'string' ? body.serverId.trim() : ''
  const discordLink = typeof body.discordLink === 'string' ? body.discordLink.trim() : ''
  const message =
    typeof body.message === 'string' && body.message.trim().length > 0 ? body.message.trim().slice(0, 2000) : null

  if (!UUID_RE.test(serverId)) return json({ ok: false, error: 'Invalid server.' }, 400)
  if (!discordContactLooksValid(discordLink)) {
    return json(
      {
        ok: false,
        error:
          'Add a Discord profile link, server invite, or your Discord username so staff can reach you.',
      },
      400,
    )
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt)
  if (userErr || !user) return json({ ok: false, error: 'Invalid session' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profErr || !profile?.id) return json({ ok: false, error: 'Profile not found.' }, 400)

  const { data: server, error: sErr } = await admin
    .from('servers')
    .select('id, owner_id, guild_id, claim_open')
    .eq('id', serverId)
    .maybeSingle()
  if (sErr || !server?.id) return json({ ok: false, error: 'Server not found.' }, 404)

  if (server.owner_id) {
    return json({ ok: false, error: 'This server is already claimed.' }, 400)
  }
  if (server.claim_open === false) {
    return json({ ok: false, error: 'Claims are closed for this server.' }, 400)
  }
  const gid = typeof server.guild_id === 'string' ? server.guild_id.trim() : ''
  if (!gid) {
    return json({ ok: false, error: 'This server has no Discord guild linked yet.' }, 400)
  }

  const { data: expRows, error: expErr } = await admin
    .from('experiences')
    .select('id, guild_id')
    .eq('profile_id', profile.id)
    .eq('is_verified', true)

  const guildMatch = (expRows ?? []).some(
    (e) => typeof e.guild_id === 'string' && e.guild_id.trim() === gid,
  )

  if (expErr || !guildMatch) {
    return json(
      { ok: false, error: 'Only verified staff listed for this server can request ownership.' },
      403,
    )
  }

  const { count: pendingCount, error: pendErr } = await admin
    .from('server_claim_requests')
    .select('id', { count: 'exact', head: true })
    .eq('server_id', serverId)
    .eq('status', 'pending')

  if (pendErr) return json({ ok: false, error: pendErr.message }, 500)
  if ((pendingCount ?? 0) > 0) {
    return json({ ok: false, error: 'A claim is already pending for this server.' }, 400)
  }

  const { error: insErr } = await admin.from('server_claim_requests').insert({
    server_id: serverId,
    claimant_profile_id: profile.id,
    status: 'pending',
    discord_link: discordLink,
    message,
  } as never)

  if (insErr) {
    if (/unique|duplicate/i.test(insErr.message)) {
      return json({ ok: false, error: 'A claim is already pending for this server.' }, 400)
    }
    return json({ ok: false, error: insErr.message }, 500)
  }

  return json({ ok: true })
})
