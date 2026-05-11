/**
 * Verifies the signed-in user owns the ERLC Directory Pro game pass (Roblox Open Cloud inventory),
 * then sets profiles.is_pro (service role).
 *
 * Secrets: ROBLOX_OPEN_CLOUD_API_KEY (Supabase → Edge Functions → Secrets).
 * Optional: ROBLOX_PRO_GAME_PASS_ID
 * SUPABASE_* injected automatically.
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

type InvItem = { gamePassDetails?: { gamePassId?: string } }

async function userOwnsGamePass(params: {
  robloxUserId: number
  gamePassId: string
  apiKey: string
}): Promise<
  | { kind: 'owns' }
  | { kind: 'not_owned' }
  | { kind: 'privacy_blocked' }
  | { kind: 'roblox_error'; status: number; snippet: string }
> {
  const targetId = String(params.gamePassId).trim()
  let pageToken: string | undefined

  for (let page = 0; page < 25; page++) {
    const url = new URL(`https://apis.roblox.com/cloud/v2/users/${params.robloxUserId}/inventory-items`)
    url.searchParams.set('maxPageSize', '50')
    url.searchParams.set('filter', `gamePassIds=${targetId}`)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const inv = await fetch(url.toString(), {
      headers: { 'x-api-key': params.apiKey },
    })

    if (inv.status === 403) {
      return { kind: 'privacy_blocked' }
    }

    if (!inv.ok) {
      const t = await inv.text().catch(() => '')
      return { kind: 'roblox_error', status: inv.status, snippet: t.slice(0, 240) }
    }

    let invJson: { inventoryItems?: InvItem[]; nextPageToken?: string }
    try {
      invJson = (await inv.json()) as typeof invJson
    } catch {
      return { kind: 'roblox_error', status: 502, snippet: 'invalid_json' }
    }

    const items = Array.isArray(invJson.inventoryItems) ? invJson.inventoryItems : []
    for (const it of items) {
      const gid = it.gamePassDetails?.gamePassId
      if (gid != null && String(gid) === targetId) {
        return { kind: 'owns' }
      }
    }

    const next = invJson.nextPageToken?.trim()
    if (!next) break
    pageToken = next
  }

  return { kind: 'not_owned' }
}

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
    return json({ ok: false, error: 'Server configuration error.' }, 500)
  }
  if (!robloxKey) {
    return json(
      {
        ok: false,
        error:
          'Pro verification is not configured yet. Ask the site owner to add ROBLOX_OPEN_CLOUD_API_KEY in Supabase (Edge Function secrets) and deploy verify-roblox-pro.',
      },
      500,
    )
  }

  let body: { roblox_username?: string; roblox_user_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json({ ok: false, error: 'Invalid session.' }, 401)
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
      return json({ ok: false, error: 'Could not reach Roblox. Try again in a moment.' }, 502)
    }
    const uj = (await ur.json()) as { data?: Array<{ id: number; name: string }> }
    const row = uj.data?.[0]
    if (!row?.id) {
      return json({ ok: false, error: 'That Roblox username was not found. Check spelling (including capitals).' }, 400)
    }
    robloxUserId = row.id
  } else {
    return json({ ok: false, error: 'Enter a valid Roblox username (3–64 characters).' }, 400)
  }

  const own = await userOwnsGamePass({ robloxUserId, gamePassId, apiKey: robloxKey })

  if (own.kind === 'privacy_blocked') {
    return json(
      {
        ok: false,
        error:
          'Roblox blocked the ownership check. In Roblox: Settings → Privacy → set “Who can see my inventory?” to Everyone, then try again.',
      },
      403,
    )
  }

  if (own.kind === 'roblox_error') {
    console.error('[verify-roblox-pro] Roblox API', own.status, own.snippet)
    return json(
      {
        ok: false,
        error:
          'Could not verify with Roblox right now. If you are the site owner, confirm the Open Cloud API key has Inventory read access.',
      },
      502,
    )
  }

  if (own.kind === 'not_owned') {
    return json(
      {
        ok: false,
        error:
          'That Roblox account does not own ERLC Directory Pro yet, or the purchase is still processing. Wait a few minutes after buying, then try again with the account that bought the pass.',
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
    return json({ ok: false, error: 'Profile not found. Refresh the page and try again.' }, 400)
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
    console.error('[verify-roblox-pro] profile update', upErr)
    return json({ ok: false, error: 'Could not save Pro status. Try again or contact support.' }, 500)
  }

  return json({ ok: true, roblox_user_id: robloxUserId, pro_verified_at: now })
})
