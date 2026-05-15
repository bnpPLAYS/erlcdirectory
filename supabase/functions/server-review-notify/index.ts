/**
 * Posts a Discord embed to the server owner's review webhook (if configured).
 * Caller must be the reviewer who created the review.
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

function discordWebhookOk(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (h !== 'discord.com' && h !== 'discordapp.com') return false
    return /^\/api\/webhooks\/\d+\/[\w-]+$/.test(u.pathname)
  } catch {
    return false
  }
}

function siteBase(): string {
  return (Deno.env.get('SITE_PUBLIC_ORIGIN') || 'https://www.erlc.directory').trim().replace(/\/$/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: 'Server configuration error.' }, 500)

  let body: { server_id?: string; review_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const serverId = String(body.server_id ?? '').trim()
  const reviewId = String(body.review_id ?? '').trim()
  if (!UUID_RE.test(serverId) || !UUID_RE.test(reviewId)) return json({ ok: false, error: 'Invalid ids.' }, 400)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) return json({ ok: false, error: 'Invalid session.' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: meProf } = await admin.from('profiles').select('id, display_name, discord_username').eq('user_id', user.id).maybeSingle()
  if (!meProf?.id) return json({ ok: false, error: 'Profile not found.' }, 400)

  const { data: review, error: rErr } = await admin
    .from('reviews')
    .select('id, server_id, reviewer_id, rating, content, created_at')
    .eq('id', reviewId)
    .maybeSingle()

  if (rErr || !review) return json({ ok: false, error: 'Review not found.' }, 404)
  if (review.server_id !== serverId) return json({ ok: false, error: 'Review does not belong to this server.' }, 400)
  if (review.reviewer_id !== meProf.id) return json({ ok: false, error: 'You can only notify for your own review.' }, 403)

  const { data: server, error: sErr } = await admin
    .from('servers')
    .select('id, name, owner_review_webhook_url')
    .eq('id', serverId)
    .maybeSingle()

  if (sErr || !server) return json({ ok: false, error: 'Server not found.' }, 404)

  const hook = typeof server.owner_review_webhook_url === 'string' ? server.owner_review_webhook_url.trim() : ''
  if (!hook) return json({ ok: true, skipped: true, reason: 'no_webhook' })
  if (!discordWebhookOk(hook)) return json({ ok: false, error: 'Server webhook URL is invalid.' }, 400)

  const base = siteBase()
  const serverUrl = `${base}/servers/${serverId}`
  const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating) || 1)))
  const stars = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`
  const who = meProf.display_name || meProf.discord_username || 'Someone'
  const snippet = (review.content as string | null)?.trim()?.slice(0, 350) || '(no text)'

  const embed = {
    title: `New review — ${server.name}`,
    url: serverUrl,
    description: `**${who}** left ${stars}\n\n${snippet}`,
    color: 0x5865f2,
    footer: { text: 'ERLC Directory' },
  }

  const whRes = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'ERLC Directory',
      embeds: [embed],
    }),
  })

  if (!whRes.ok) {
    const t = await whRes.text().catch(() => '')
    console.error('[server-review-notify] Discord', whRes.status, t.slice(0, 300))
    return json({ ok: false, error: 'Discord rejected the webhook. Check the URL or regenerate the webhook.' }, 502)
  }

  return json({ ok: true })
})
