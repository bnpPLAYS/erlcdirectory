/**
 * Fires a Discord webhook embed when a new review is posted on a server that
 * has a `review_webhook_url` configured by its claimed owner.
 *
 * Called from the client right after a successful review insert. The webhook URL
 * is read with the service role so it never leaves the database in the client.
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

/** Only allow public Discord webhook hosts. */
function isDiscordWebhookUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return null
    if (u.hostname !== 'discord.com' && u.hostname !== 'discordapp.com') return null
    if (!u.pathname.startsWith('/api/webhooks/')) return null
    return u.toString()
  } catch {
    return null
  }
}

function clamp(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function publicSiteOrigin(): string {
  return (
    Deno.env.get('PUBLIC_SITE_URL') ||
    Deno.env.get('VITE_PUBLIC_SITE_URL') ||
    'https://www.erlc.directory'
  )
    .toString()
    .replace(/\/$/, '')
}

function starLine(rating: number): string {
  const r = Math.min(5, Math.max(1, Math.round(rating)))
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Server configuration error.' }, 500)
  }

  let body: { review_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const reviewId = (body.review_id ?? '').toString().trim()
  if (!UUID_RE.test(reviewId)) return json({ ok: false, error: 'Invalid review_id.' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: review } = await admin
    .from('reviews')
    .select('id, rating, content, reviewer_id, server_id, created_at')
    .eq('id', reviewId)
    .maybeSingle()
  if (!review?.server_id) return json({ ok: true, skipped: 'no_server' })

  const { data: server } = await admin
    .from('servers')
    .select('id, name, icon, banner, review_webhook_url, theme')
    .eq('id', review.server_id)
    .maybeSingle()
  const webhookUrl = isDiscordWebhookUrl(server?.review_webhook_url)
  if (!server || !webhookUrl) return json({ ok: true, skipped: 'no_webhook' })

  const { data: reviewer } = await admin
    .from('profiles')
    .select('display_name, discord_username, discord_avatar')
    .eq('id', review.reviewer_id)
    .maybeSingle()

  const accentHex =
    typeof (server.theme as { accent_hex?: unknown })?.accent_hex === 'string'
      ? ((server.theme as { accent_hex: string }).accent_hex || '')
      : ''
  const colorMatch = accentHex.replace('#', '').match(/^[0-9a-f]{6}$/i)
  const color = colorMatch ? parseInt(colorMatch[0], 16) : 0x6366f1

  const directoryUrl = `${publicSiteOrigin()}/servers/${server.id}`

  const embed = {
    title: `New review for ${clamp(server.name, 200)}`,
    description: `${starLine(Number(review.rating) || 0)} • [Open server page](${directoryUrl})${
      review.content ? `\n\n${clamp(review.content, 1500)}` : ''
    }`,
    color,
    timestamp: review.created_at,
    author: {
      name: clamp(reviewer?.display_name || reviewer?.discord_username || 'Member', 200),
      icon_url:
        reviewer?.discord_avatar && /^https:\/\//.test(reviewer.discord_avatar)
          ? reviewer.discord_avatar
          : undefined,
      url: directoryUrl,
    },
    thumbnail: server.icon ? { url: server.icon } : undefined,
    footer: { text: 'ERLC.Directory reviews' },
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ERLC.Directory',
        avatar_url: `${publicSiteOrigin()}/embed.png`,
        allowed_mentions: { parse: [] },
        embeds: [embed],
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return json({ ok: false, error: `Webhook delivery failed (${res.status}): ${clamp(text, 200)}` }, 502)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Webhook delivery failed'
    return json({ ok: false, error: msg }, 502)
  }

  return json({ ok: true })
})
