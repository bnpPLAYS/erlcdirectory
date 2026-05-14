/**
 * Completes Roblox OAuth: exchange code for tokens, read user id from userinfo, link profile.
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
  const clientId = Deno.env.get('ROBLOX_OAUTH_CLIENT_ID')?.trim() || ''
  const clientSecret = Deno.env.get('ROBLOX_OAUTH_CLIENT_SECRET')?.trim() || ''
  const redirectUri = Deno.env.get('ROBLOX_OAUTH_REDIRECT_URI')?.trim() || ''

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: 'Server configuration error.' }, 500)
  }
  const missingComplete: string[] = []
  if (!clientId) missingComplete.push('ROBLOX_OAUTH_CLIENT_ID')
  if (!clientSecret) missingComplete.push('ROBLOX_OAUTH_CLIENT_SECRET')
  if (!redirectUri) missingComplete.push('ROBLOX_OAUTH_REDIRECT_URI')
  if (missingComplete.length) {
    return json(
      {
        ok: false,
        error: `Roblox sign-in is not configured: missing ${missingComplete.join(', ')}. Add them in Supabase Dashboard → Edge Functions → Secrets (not Vercel). ROBLOX_OAUTH_REDIRECT_URI must match the Roblox OAuth app redirect exactly.`,
      },
      503,
    )
  }

  let body: { state?: string; code?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400)
  }

  const state = (body.state ?? '').trim()
  const code = (body.code ?? '').trim()
  if (!state || !code) {
    return json({ ok: false, error: 'Missing code or state.' }, 400)
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
  const { data: row, error: selErr } = await admin
    .from('roblox_oauth_states')
    .select('user_id, code_verifier, expires_at')
    .eq('state', state)
    .maybeSingle()

  if (selErr || !row?.code_verifier) {
    return json({ ok: false, error: 'This sign-in link expired or was already used. Start again from your profile.' }, 400)
  }

  if (row.user_id !== user.id) {
    return json({ ok: false, error: 'Session does not match this Roblox sign-in. Use the same browser profile you started from.' }, 403)
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await admin.from('roblox_oauth_states').delete().eq('state', state)
    return json({ ok: false, error: 'Sign-in expired. Try again from your profile.' }, 400)
  }

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: row.code_verifier,
    redirect_uri: redirectUri,
  })

  const tokRes = await fetch('https://apis.roblox.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  })

  const tokText = await tokRes.text()
  if (!tokRes.ok) {
    console.error('[roblox-oauth-complete] token', tokRes.status, tokText.slice(0, 400))
    await admin.from('roblox_oauth_states').delete().eq('state', state)
    return json(
      {
        ok: false,
        error:
          'Roblox did not accept the sign-in code. It may have expired (one minute) or already been used. Start again from your profile.',
      },
      400,
    )
  }

  let tokJson: { access_token?: string }
  try {
    tokJson = JSON.parse(tokText) as typeof tokJson
  } catch {
    await admin.from('roblox_oauth_states').delete().eq('state', state)
    return json({ ok: false, error: 'Unexpected response from Roblox.' }, 502)
  }

  const accessToken = tokJson.access_token?.trim()
  if (!accessToken) {
    await admin.from('roblox_oauth_states').delete().eq('state', state)
    return json({ ok: false, error: 'Roblox did not return an access token.' }, 502)
  }

  const ui = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!ui.ok) {
    const t = await ui.text().catch(() => '')
    console.error('[roblox-oauth-complete] userinfo', ui.status, t.slice(0, 240))
    await admin.from('roblox_oauth_states').delete().eq('state', state)
    return json({ ok: false, error: 'Could not read your Roblox profile from Roblox. Try again.' }, 502)
  }

  let uiJson: { sub?: string }
  try {
    uiJson = (await ui.json()) as typeof uiJson
  } catch {
    await admin.from('roblox_oauth_states').delete().eq('state', state)
    return json({ ok: false, error: 'Invalid userinfo from Roblox.' }, 502)
  }

  const sub = (uiJson.sub ?? '').trim()
  if (!/^\d{5,20}$/.test(sub)) {
    await admin.from('roblox_oauth_states').delete().eq('state', state)
    return json({ ok: false, error: 'Roblox did not return a valid user id.' }, 502)
  }

  await admin.from('roblox_oauth_states').delete().eq('state', state)

  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (pErr || !profile?.id) {
    return json({ ok: false, error: 'Profile not found. Refresh the site and try again.' }, 400)
  }

  const now = new Date().toISOString()
  const { error: upErr } = await admin
    .from('profiles')
    .update({
      roblox_user_id: sub,
      roblox_verified_at: now,
    })
    .eq('id', profile.id)

  if (upErr) {
    console.error('[roblox-oauth-complete] profile update', upErr)
    return json({ ok: false, error: 'Could not save your Roblox link. Try again or contact support.' }, 500)
  }

  return json({ ok: true, roblox_user_id: Number(sub), roblox_verified_at: now })
})
