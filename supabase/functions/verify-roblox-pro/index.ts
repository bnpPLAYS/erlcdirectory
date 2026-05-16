/**
 * Verifies ERLC Directory Pro ownership (Roblox Open Cloud inventory) and sets is_pro.
 * See _shared/robloxInventoryOwnership.ts for inventory logic.
 * Caller must have linked Roblox via OAuth (`profiles.roblox_user_id`); arbitrary usernames are not accepted.
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
  const listingId = (Deno.env.get('ROBLOX_PRO_GAME_PASS_ID') || DEFAULT_GAME_PASS_ID).trim()

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

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('id, roblox_user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (pErr || !profile?.id) {
    return json({ ok: false, error: 'Profile not found. Refresh the page and try again.' }, 400)
  }

  const linkedRaw = (profile.roblox_user_id ?? '').toString().trim()
  if (!linkedRaw || !/^\d+$/.test(linkedRaw)) {
    return json(
      {
        ok: false,
        error:
          'Link your Roblox account in Edit profile (Roblox authorization) before verifying Pro. Verification only checks the account you linked — not a typed username.',
      },
      400,
    )
  }

  const robloxUserId = parseInt(linkedRaw, 10)

  const own = await userOwnsRobloxListing({ robloxUserId, listingId, apiKey: robloxKey })

  if (own.kind === 'privacy_blocked') {
    return json(
      {
        ok: false,
        error:
          'Roblox blocked the ownership check. In Roblox: Settings → Privacy → set “Who can see my inventory?” to Everyone, then try again. If it already is, the site’s Roblox API key may be missing the user.inventory-item:read scope.',
      },
      403,
    )
  }

  if (own.kind === 'roblox_error') {
    console.error('[verify-roblox-pro] Roblox API', own.status, own.snippet)
    if (own.status === 401) {
      return json(
        {
          ok: false,
          error:
            'Roblox rejected the server API key (401). Site owner: check ROBLOX_OPEN_CLOUD_API_KEY in Supabase secrets — it may be wrong, expired, or revoked.',
        },
        502,
      )
    }
    if (own.status === 403) {
      return json(
        {
          ok: false,
          error:
            'Roblox rejected this API key for inventory reads. Site owner: Creator Hub → Credentials → API Keys → edit the key → enable **user.inventory-item:read** on the User / Inventory resource, then paste the new key into ROBLOX_OPEN_CLOUD_API_KEY.',
        },
        502,
      )
    }
    return json(
      {
        ok: false,
        error:
          'Could not verify with Roblox right now. Site owner: confirm ROBLOX_OPEN_CLOUD_API_KEY is an Open Cloud key with **user.inventory-item:read** (User → Inventory). Players: set inventory visibility to Everyone under Roblox → Settings → Privacy.',
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

  const now = new Date().toISOString()
  const { error: upErr } = await admin
    .from('profiles')
    .update({
      is_pro: true,
      roblox_user_id: String(robloxUserId),
      pro_verified_at: now,
      roblox_verified_at: now,
    })
    .eq('id', profile.id)

  if (upErr) {
    console.error('[verify-roblox-pro] profile update', upErr)
    return json({ ok: false, error: 'Could not save Pro status. Try again or contact support.' }, 500)
  }

  return json({ ok: true, roblox_user_id: robloxUserId, pro_verified_at: now })
})
