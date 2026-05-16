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

/** Discord Nitro / animated assets use `a_` hashes and must be requested as `.gif`. */
function fixDiscordAnimatedAssetUrlString(url: string): string {
  try {
    const u = new URL(url)
    const h = u.hostname.toLowerCase()
    if (h !== 'cdn.discordapp.com' && h !== 'cdn.discord.com') return url
    const m = /^\/(avatars|icons|banners)\/(\d+)\/([^/.]+)\.(png|webp|jpe?g)$/i.exec(u.pathname)
    if (!m) return url
    const hash = m[3]
    if (!hash.startsWith('a_')) return url
    const ext = m[4].toLowerCase()
    if (ext === 'gif' || ext === 'webm') return url
    u.pathname = `/${m[1]}/${m[2]}/${hash}.gif`
    return u.toString()
  } catch {
    return url
  }
}

function embedHttpsUrl(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t.startsWith('https://') || t.length > 2048) return null
  return fixDiscordAnimatedAssetUrlString(t)
}

function safeEmbedSnippet(s: string, max: number): string {
  return s
    .replace(/[\n\r]+/g, ' ')
    .replace(/[*_`]/g, '')
    .trim()
    .slice(0, max)
}

/** Safe fragment for webhook `content` (Discord markdown); strips chars that break ** wrapping. */
function safeContentChunk(s: string, max: number): string {
  return safeEmbedSnippet(s, max)
}

function formatCount(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(Number(n))) return null
  const v = Math.max(0, Math.floor(Number(n)))
  try {
    return v.toLocaleString('en-US')
  } catch {
    return String(v)
  }
}

function isDiscordSnowflake(id: string): boolean {
  return /^\d{17,22}$/.test(id.trim())
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
  const { data: meProf } = await admin
    .from('profiles')
    .select('id, display_name, discord_username, discord_avatar, discord_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!meProf?.id) return json({ ok: false, error: 'Profile not found.' }, 400)

  const { data: review, error: rErr } = await admin
    .from('reviews')
    .select('id, server_id, reviewer_id, reviewee_id, rating, content, created_at')
    .eq('id', reviewId)
    .maybeSingle()

  if (rErr || !review) return json({ ok: false, error: 'Review not found.' }, 404)
  if (review.server_id !== serverId) return json({ ok: false, error: 'Review does not belong to this server.' }, 400)
  if (review.reviewer_id !== meProf.id) return json({ ok: false, error: 'You can only notify for your own review.' }, 403)

  const { data: server, error: sErr } = await admin
    .from('servers')
    .select(
      'id, name, icon, banner, description, owner_long_description, member_count, staff_count, is_verified, is_hiring, owner_review_webhook_url, owner_discord_embed_color, owner_discord_embed_footer',
    )
    .eq('id', serverId)
    .maybeSingle()

  if (sErr || !server) return json({ ok: false, error: 'Server not found.' }, 404)

  const hook = typeof server.owner_review_webhook_url === 'string' ? server.owner_review_webhook_url.trim() : ''
  if (!hook) return json({ ok: true, skipped: true, reason: 'no_webhook' })
  if (!discordWebhookOk(hook)) return json({ ok: false, error: 'Server webhook URL is invalid.' }, 400)

  const base = siteBase()
  const serverPageUrl = `${base}/server/${serverId}`
  const reviewsUrl = `${serverPageUrl}#reviews`
  const rating = Math.min(5, Math.max(1, Math.round(Number(review.rating) || 1)))
  const stars = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`
  const who = meProf.display_name || meProf.discord_username || 'Someone'
  const snippetRaw = (review.content as string | null)?.trim() || ''
  const snippet = snippetRaw ? safeEmbedSnippet(snippetRaw, 350) : ''

  const { data: ratingsRows } = await admin.from('reviews').select('rating').eq('server_id', serverId)
  const ratingsList = (ratingsRows ?? []).map((row) => Number(row.rating)).filter((x) => Number.isFinite(x) && x >= 1 && x <= 5)
  const reviewCount = ratingsList.length > 0 ? ratingsList.length : 1
  const avgRating =
    ratingsList.length > 0 ? ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length : rating
  const avgOneDecimal = Math.round(avgRating * 10) / 10
  const avgDisplay = avgOneDecimal.toFixed(1)

  let aboutSuffix = ''
  const rid = review.reviewee_id as string | null | undefined
  if (rid && typeof rid === 'string' && UUID_RE.test(rid)) {
    const { data: aboutProf } = await admin
      .from('profiles')
      .select('display_name, discord_username')
      .eq('id', rid)
      .maybeSingle()
    const nm = (aboutProf?.display_name || aboutProf?.discord_username || '').trim()
    if (nm) {
      aboutSuffix = `\n\n• Review about **${safeEmbedSnippet(nm, 80)}**`
    }
  }

  const rawColor = server.owner_discord_embed_color
  const embedColor =
    typeof rawColor === 'number' &&
    Number.isFinite(rawColor) &&
    rawColor >= 0 &&
    rawColor <= 0xffffff
      ? Math.floor(rawColor)
      : 0x5865f2

  const footerRaw = typeof server.owner_discord_embed_footer === 'string' ? server.owner_discord_embed_footer.trim() : ''
  const footerText = footerRaw ? footerRaw.slice(0, 200) : 'ERLC Directory'

  const serverBannerImg = embedHttpsUrl(typeof server.banner === 'string' ? server.banner : null)
  const serverIcon = embedHttpsUrl(typeof server.icon === 'string' ? server.icon : null)

  const longDesc =
    typeof server.owner_long_description === 'string' ? server.owner_long_description.trim() : ''
  const shortDesc = typeof server.description === 'string' ? server.description.trim() : ''
  const introSource = longDesc || shortDesc
  const intro = introSource
    ? safeEmbedSnippet(introSource, 320)
    : 'Staff directory listing on ERLC Directory — profiles, invites, and reviews.'

  const memberStr = formatCount(server.member_count as number | null | undefined)
  const staffStr = formatCount(server.staff_count as number | null | undefined)

  const bulletLines: string[] = []
  bulletLines.push(`• **${avgDisplay}/5** avg from **${reviewCount}** review${reviewCount === 1 ? '' : 's'}`)
  bulletLines.push(`• This review: ${stars} (**${rating}/5**)`)
  if (memberStr) bulletLines.push(`• **${memberStr}** Discord members (approx.)`)
  if (staffStr) bulletLines.push(`• **${staffStr}** staff listed`)
  if (server.is_verified) bulletLines.push('• **Verified** on ERLC Directory')
  if (server.is_hiring) bulletLines.push('• **Hiring**')

  const descriptionParts = [
    intro,
    '',
    bulletLines.join('\n'),
    '',
    '**Latest review**',
    snippet ? snippet : '_No written comment._',
    aboutSuffix,
  ]
  const description = descriptionParts.join('\n').slice(0, 4096)

  const serverNameSafe = String(server.name).slice(0, 180)
  const embedTitle = `${serverNameSafe} | ERLC Directory`.slice(0, 256)

  const embed: Record<string, unknown> = {
    author: { name: 'ERLC Directory' },
    title: embedTitle,
    url: serverPageUrl,
    description,
    color: embedColor,
    footer: { text: footerText, icon_url: `${base}/favicon.png` },
  }

  if (serverIcon) embed.thumbnail = { url: serverIcon }
  if (serverBannerImg) embed.image = { url: serverBannerImg }

  try {
    const d = new Date(review.created_at as string)
    if (!Number.isNaN(d.getTime())) embed.timestamp = d.toISOString()
  } catch {
    /* omit timestamp */
  }

  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: 'View server',
          url: serverPageUrl,
        },
        {
          type: 2,
          style: 5,
          label: 'Write a review',
          url: reviewsUrl,
        },
      ],
    },
  ]

  const serverChunk = safeContentChunk(String(server.name), 120)
  const discordId = typeof meProf.discord_id === 'string' ? meProf.discord_id.trim() : ''
  let messageContent = ''
  if (discordId && isDiscordSnowflake(discordId)) {
    messageContent = `<@${discordId}> left a **${rating}/5** review on **${serverChunk}** on **ERLC Directory.**`.slice(
      0,
      2000,
    )
  } else {
    messageContent = `**${safeContentChunk(who, 80)}** left a **${rating}/5** review on **${serverChunk}** on **ERLC Directory.**`.slice(
      0,
      2000,
    )
  }

  const whRes = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'ERLC Directory',
      avatar_url: `${base}/favicon.png`,
      content: messageContent,
      embeds: [embed],
      components,
    }),
  })

  if (!whRes.ok) {
    const t = await whRes.text().catch(() => '')
    console.error('[server-review-notify] Discord', whRes.status, t.slice(0, 300))
    return json({ ok: false, error: 'Discord rejected the webhook. Check the URL or regenerate the webhook.' }, 502)
  }

  return json({ ok: true })
})
