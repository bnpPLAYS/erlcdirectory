/**
 * Verifies the signed-in user owns the ERLC Directory Pro game pass (Roblox Open Cloud),
 * then sets profiles.is_pro via service role.
 *
 * ## Secrets (Supabase Dashboard → Edge Functions → Secrets)
 * - ROBLOX_OPEN_CLOUD_API_KEY — Creator Dashboard API key with user inventory read / game pass filter.
 * - ROBLOX_PRO_GAME_PASS_ID — optional; defaults to catalog pass id used by the site.
 *
 * SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are provided automatically when deployed.
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

const DEFAULT_GAME_PASS_ID = '76823573023998'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim() || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''
  const robloxKey = Deno.env.get('ROBLOX_OPEN_CLOUD_API_KEY')?.trim() || ''
  const gamePassId = (Deno.env.get('ROBLOX_PRO_GAME_PASS_ID') || DEFAULT_GAME_PASS_ID).trim()

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(
      {
        ok: false,
        error:
          'Edge function missing Supabase env (SUPABASE_URL / ANON / SERVICE_ROLE). Redeploy the function or re-link the project.',
      },
      500,
    )
  }
  if (!robloxKey) {
    return json(
      {
        ok: false,
        error:
          'ROBLOX_OPEN_CLOUD_API_KEY is not set. Add it under Supabase → Edge Functions → Secrets, then redeploy verify-roblox-pro.',
      },
      500,
    )
  }

  let body: { roblox_username?: string; roblox_user_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json({ ok: false, error: 'Invalid session' }, 401)
  }

  let robloxUserId: number
  const rawId = (body.roblox_user_id ?? '').toString().trim()
  const username = (body.roblox_username ?? '').trim()

  if (rawId && /^\d+$/.test(rawId)) {
    robloxUserId = parseInt(rawId, 10)
  } else if (username.length >= 3 && username.length <= 64) {
    const ur = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
    })
    if (!ur.ok) {
      return json({ ok: false, error: 'Could not reach Roblox to resolve username.' }, 502)
    }
    const uj = (await ur.json()) as { data?: Array<{ id: number; name: string }> }
    const row = uj.data?.[0]
    if (!row?.id) {
      return json({ ok: false, error: 'Roblox username not found. Check spelling and try again.' }, 400)
    }
    robloxUserId = row.id
  } else {
    return json(
      { ok: false, error: 'Provide roblox_username (3–64 chars) or roblox_user_id (numeric).' },
      400,
    )
  }

  const filter = encodeURIComponent(`gamePassIds=${gamePassId}`)
  const invUrl = `https://apis.roblox.com/cloud/v2/users/${robloxUserId}/inventory-items?maxPageSize=10&filter=${filter}`

  const inv = await fetch(invUrl, {
    headers: { 'x-api-key': robloxKey },
  })

  if (inv.status === 403) {
    return json(
      {
        ok: false,
        error:
          'Roblox blocked inventory check. On Roblox: Settings → Privacy → set “Who can see my inventory?” to Everyone, then try again.',
      },
      403,
    )
  }

  if (!inv.ok) {
    const t = await inv.text().catch(() => '')
    return json(
      {
        ok: false,
        error: `Roblox Open Cloud error (${inv.status}). Check API key permissions and game pass id. ${t.slice(0, 200)}`,
      },
      502,
    )
  }

  let invJson: { inventoryItems?: unknown[] }
  try {
    invJson = (await inv.json()) as { inventoryItems?: unknown[] }
  } catch {
    return json({ ok: false, error: 'Invalid response from Roblox.' }, 502)
  }

  const owns = Array.isArray(invJson.inventoryItems) && invJson.inventoryItems.length > 0
  if (!owns) {
    return json(
      {
        ok: false,
        error:
          'This Roblox account does not own ERLC Directory Pro yet, or the pass id does not match. Buy the pass, wait a minute, then verify again.',
      },
      400,
    )
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (pErr || !profile?.id) {
    return json({ ok: false, error: 'Profile not found. Sign in once to create your profile.' }, 400)
  }

  const now = new Date().toISOString()
  const { error: upErr } = await admin
    .from('profiles')
    .update({
      is_pro: true,
      roblox_user_id: String(robloxUserId),
      pro_verified_at: now,
    })
    .eq('id', profile.id)

  if (upErr) {
    return json({ ok: false, error: upErr.message || 'Could not update profile.' }, 500)
  }

  return json({ ok: true, roblox_user_id: robloxUserId, pro_verified_at: now })
})
