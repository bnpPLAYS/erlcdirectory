/**
 * Persists Discord OAuth tokens from the client session into discord_oauth_credentials (not public.profiles).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import { upsertDiscordOAuthCredentials } from '../_shared/discordOAuthCredentials.ts'

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: 'Server configuration error.' }, 500)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user?.id) return json({ ok: false, error: 'Invalid session.' }, 401)

  let body: { access_token?: string | null; refresh_token?: string | null; expires_in?: number | null }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const access = typeof body.access_token === 'string' ? body.access_token.trim() : null
  const refresh = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : null
  const expIn = typeof body.expires_in === 'number' && Number.isFinite(body.expires_in) ? body.expires_in : null

  if (!access && !refresh) {
    return json({ ok: true, skipped: true })
  }

  let expiresAt: string | null = null
  if (expIn != null && expIn > 0) {
    expiresAt = new Date(Date.now() + expIn * 1000).toISOString()
  }

  const admin = createClient(supabaseUrl, serviceKey)
  await upsertDiscordOAuthCredentials(admin, user.id, {
    access_token: access,
    refresh_token: refresh,
    expires_at: expiresAt,
  })

  return json({ ok: true })
})
