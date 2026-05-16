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

const enc = new TextEncoder()

function randomHex(bytes: number): string {
  const u = new Uint8Array(bytes)
  crypto.getRandomValues(u)
  return [...u].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(message))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type SignSecretResult = { ok: true; secret: string } | { ok: false; error: string }

/**
 * Prefer `CANARY_SIGNING_SECRET` (≥16 chars) when set. If unset or empty, derive a stable HMAC key from
 * `SUPABASE_SERVICE_ROLE_KEY` so canary works without an extra Edge secret (existing passes become invalid if the service key rotates).
 */
async function resolveCanarySigningSecret(serviceKey: string): Promise<SignSecretResult> {
  const raw = Deno.env.get('CANARY_SIGNING_SECRET')
  if (raw != null && raw.trim().length > 0) {
    const explicit = raw.trim()
    if (explicit.length >= 16) return { ok: true, secret: explicit }
    return {
      ok: false,
      error:
        'CANARY_SIGNING_SECRET is set but shorter than 16 characters. Remove it to use automatic signing, or use at least 16 characters.',
    }
  }
  if (!serviceKey) return { ok: false, error: 'Backend is not configured.' }
  const secret = await sha256Hex(`erlc.directory|canary-session|v1|${serviceKey}`)
  return { ok: true, secret }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function base64UrlEncode(s: string): string {
  const b = btoa(s)
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

function base64UrlDecode(s: string): string {
  let b = s.replace(/-/g, '+').replace(/_/g, '/')
  while (b.length % 4) b += '='
  return atob(b)
}

function siteOwnerFromEnv(): string {
  const v = (Deno.env.get('SITE_OWNER_DISCORD_USERNAME') ?? 'pixelnovaa').trim().toLowerCase().replace(/\.+$/u, '')
  return v || 'pixelnovaa'
}

function isSiteOwnerDiscordUsername(username: string | null | undefined): boolean {
  if (username == null || typeof username !== 'string') return false
  const normalized = username.trim().toLowerCase().replace(/\.+$/u, '')
  return normalized === siteOwnerFromEnv()
}

async function assertStaff(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: actor, error } = await admin
    .from('profiles')
    .select('id, discord_username')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !actor?.id) return { ok: false, error: 'Staff profile not found.' }
  if (isSiteOwnerDiscordUsername(actor.discord_username)) return { ok: true }
  const { data: role } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  if (!role) return { ok: false, error: 'Not authorized.' }
  return { ok: true }
}

type ConfigRow = {
  is_active: boolean
  code_salt: string | null
  code_hash: string | null
  session_nonce: string
  started_at: string | null
}

async function loadConfig(admin: ReturnType<typeof createClient>): Promise<ConfigRow | null> {
  const { data, error } = await admin.from('canary_test_config').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return null
  return data as ConfigRow
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: 'Backend is not configured.' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const action = typeof body.action === 'string' ? body.action.trim() : ''
  const admin = createClient(supabaseUrl, serviceKey)

  if (action === 'public_status') {
    const row = await loadConfig(admin)
    return json({
      ok: true,
      /** When true, canary host requires a valid test code (or existing pass token). */
      gate_required: !!row?.is_active,
    })
  }

  const staffActions = new Set(['staff_status', 'staff_start', 'staff_stop'])
  if (staffActions.has(action)) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ ok: false, error: 'Unauthorized' }, 401)
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser(authHeader.slice(7).trim())
    if (userErr || !user) return json({ ok: false, error: 'Invalid session' }, 401)

    const staff = await assertStaff(admin, user.id)
    if (!staff.ok) return json({ ok: false, error: staff.error }, 403)

    if (action === 'staff_status') {
      const row = await loadConfig(admin)
      return json({
        ok: true,
        active: !!row?.is_active,
        started_at: row?.started_at ?? null,
      })
    }

    if (action === 'staff_start') {
      const sr = await resolveCanarySigningSecret(serviceKey)
      if (!sr.ok) return json({ ok: false, error: sr.error }, 500)
      const row = await loadConfig(admin)
      if (row?.is_active) {
        return json(
          { ok: false, error: 'A canary session is already active. Stop it first, then start a new one.' },
          400,
        )
      }
      const codeSalt = randomHex(16)
      const plainCode = randomHex(6) // 12 hex chars
      const codeHash = await sha256Hex(`${codeSalt}:${plainCode}`)
      const sessionNonce = randomHex(16)
      const now = new Date().toISOString()
      const { error: upErr } = await admin
        .from('canary_test_config')
        .update({
          is_active: true,
          code_salt: codeSalt,
          code_hash: codeHash,
          session_nonce: sessionNonce,
          started_at: now,
          started_by_user_id: user.id,
          updated_at: now,
        })
        .eq('id', 1)
      if (upErr) return json({ ok: false, error: 'Could not start canary session.' }, 500)
      return json({
        ok: true,
        test_code: plainCode,
        started_at: now,
        hint: 'Share this code with testers. It is not shown again after you leave this page.',
      })
    }

    if (action === 'staff_stop') {
      const sessionNonce = randomHex(16)
      const now = new Date().toISOString()
      const { error: upErr } = await admin
        .from('canary_test_config')
        .update({
          is_active: false,
          code_salt: null,
          code_hash: null,
          session_nonce: sessionNonce,
          started_at: null,
          started_by_user_id: null,
          updated_at: now,
        })
        .eq('id', 1)
      if (upErr) return json({ ok: false, error: 'Could not stop canary session.' }, 500)
      return json({ ok: true })
    }
  }

  if (action === 'verify_token' || action === 'validate_code') {
    const sr = await resolveCanarySigningSecret(serviceKey)
    if (!sr.ok) return json({ ok: false, error: sr.error }, 500)
    const signingSecret = sr.secret

    if (action === 'verify_token') {
      const token = typeof body.token === 'string' ? body.token.trim() : ''
      if (!token || !token.includes('.')) return json({ ok: true, valid: false })
      const [payloadPart, sigHex] = token.split('.', 2)
      if (!payloadPart || !sigHex) return json({ ok: true, valid: false })
      let payload: { exp?: number; n?: string }
      try {
        payload = JSON.parse(base64UrlDecode(payloadPart)) as { exp?: number; n?: string }
      } catch {
        return json({ ok: true, valid: false })
      }
      const exp = typeof payload.exp === 'number' ? payload.exp : 0
      const n = typeof payload.n === 'string' ? payload.n : ''
      if (!n || exp < Date.now()) return json({ ok: true, valid: false })
      const row = await loadConfig(admin)
      if (!row?.is_active || !row.session_nonce || row.session_nonce !== n) {
        return json({ ok: true, valid: false })
      }
      const expect = await hmacSha256Hex(signingSecret, `${exp}:${n}`)
      if (expect !== sigHex) return json({ ok: true, valid: false })
      return json({ ok: true, valid: true })
    }

    const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : ''
    if (!code || code.length > 64) return json({ ok: false, error: 'Invalid code.' }, 400)
    const row = await loadConfig(admin)
    if (!row?.is_active || !row.code_salt || !row.code_hash) {
      return json({ ok: false, error: 'No active canary session.' }, 400)
    }
    const attempt = await sha256Hex(`${row.code_salt}:${code}`)
    if (attempt !== row.code_hash) {
      return json({ ok: false, error: 'That code is not valid.' }, 400)
    }
    const exp = Date.now() + TOKEN_TTL_MS
    const n = row.session_nonce
    const payloadJson = JSON.stringify({ exp, n })
    const payloadB64 = base64UrlEncode(payloadJson)
    const sig = await hmacSha256Hex(signingSecret, `${exp}:${n}`)
    const token = `${payloadB64}.${sig}`
    return json({ ok: true, access_token: token, expires_at: new Date(exp).toISOString() })
  }

  return json({ ok: false, error: 'Unknown action.' }, 400)
})
