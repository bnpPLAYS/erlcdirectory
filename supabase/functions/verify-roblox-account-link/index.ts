/**
 * Links a verified Roblox account to the directory profile (no Pro).
 * User must own a dedicated free catalog / game pass item (inventory proof), same Open Cloud flow as Pro.
 *
 * Secrets: ROBLOX_OPEN_CLOUD_API_KEY, ROBLOX_ACCOUNT_LINK_VERIFY_ID (Roblox catalog listing id for the free link item).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import { userOwnsRobloxListing } from '../_shared/robloxInventoryOwnership.ts'

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
  const listingId = Deno.env.get('ROBLOX_ACCOUNT_LINK_VERIFY_ID')?.trim() || ''

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: 'Server configuration error.' }, 500)
  }
  if (!robloxKey) {
    return json(
      {
        ok: false,
        error:
          'Roblox linking is not configured. Ask the site owner to add ROBLOX_OPEN_CLOUD_API_KEY in Supabase Edge Function secrets.',
      },
      500,
    )
  }
  if (!listingId) {
    return json(
      {
        ok: false,
        error:
          'Roblox account linking is not enabled yet. The site owner must publish a free Roblox item for verification, then set ROBLOX_ACCOUNT_LINK_VERIFY_ID in Supabase secrets to that item’s id and deploy verify-roblox-account-link.',
      },
      503,
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

  const own = await userOwnsRobloxListing({ robloxUserId, listingId, apiKey: robloxKey })

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
    console.error('[verify-roblox-account-link] Roblox API', own.status, own.snippet)
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
          'That Roblox account does not have the free “link” item in its inventory yet. Claim it on Roblox (see the link on this page), wait a minute, set inventory privacy to Everyone, then verify again.',
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
      roblox_user_id: String(robloxUserId),
      roblox_verified_at: now,
    })
    .eq('id', profile.id)

  if (upErr) {
    console.error('[verify-roblox-account-link] profile update', upErr)
    return json({ ok: false, error: 'Could not save your Roblox link. Try again or contact support.' }, 500)
  }

  return json({ ok: true, roblox_user_id: robloxUserId, roblox_verified_at: now })
})
