/**
 * Starts Roblox OAuth (PKCE) for linking a Roblox account to the signed-in directory user.
 * Returns authorize URL; after consent, Roblox redirects to ROBLOX_OAUTH_REDIRECT_URI with ?code=&state=.
 *
 * Secrets: ROBLOX_OAUTH_CLIENT_ID, ROBLOX_OAUTH_CLIENT_SECRET (token exchange),
 * ROBLOX_OAUTH_REDIRECT_URI (must match Creator OAuth app redirect exactly).
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

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomVerifier(): string {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  return base64UrlEncode(a.buffer)
}

function randomState(): string {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return base64UrlEncode(a.buffer)
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(digest)
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
  const clientId = Deno.env.get('ROBLOX_OAUTH_CLIENT_ID')?.trim() || ''
  const redirectUri = Deno.env.get('ROBLOX_OAUTH_REDIRECT_URI')?.trim() || ''

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: 'Server configuration error.' }, 500)
  }
  const missingStart: string[] = []
  if (!clientId) missingStart.push('ROBLOX_OAUTH_CLIENT_ID')
  if (!redirectUri) missingStart.push('ROBLOX_OAUTH_REDIRECT_URI')
  if (missingStart.length) {
    return json(
      {
        ok: false,
        error: `Roblox sign-in is not configured: missing ${missingStart.join(' and ')}. Add these in Supabase Dashboard → Edge Functions → Secrets (Vercel env vars are not used here). Register the same redirect URL in Roblox Creator OAuth (e.g. https://www.erlc.directory/roblox/callback) and set ROBLOX_OAUTH_REDIRECT_URI to match it exactly. Deploy roblox-oauth-start and roblox-oauth-complete if they are not live yet.`,
      },
      503,
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

  const state = randomState()
  const codeVerifier = randomVerifier()
  const codeChallenge = await pkceChallenge(codeVerifier)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const admin = createClient(supabaseUrl, serviceKey)
  await admin.from('roblox_oauth_states').delete().lt('expires_at', new Date().toISOString())

  const { error: insErr } = await admin.from('roblox_oauth_states').insert({
    state,
    user_id: user.id,
    code_verifier: codeVerifier,
    expires_at: expiresAt,
  })

  if (insErr) {
    console.error('[roblox-oauth-start] insert', insErr)
    return json({ ok: false, error: 'Could not start Roblox sign-in. Try again.' }, 500)
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile',
    response_type: 'code',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const url = `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`
  return json({ ok: true, url })
})
