import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import {
  discordIconCdnUrl,
  enrichDiscordGuildForDirectory,
} from '../_shared/discordGuildEnrichment.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function refreshDiscordAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token?: string
} | null> {
  const clientId = Deno.env.get('DISCORD_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')?.trim()
  if (!clientId || !clientSecret) return null
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) return null
  try {
    const d = (await res.json()) as { access_token?: string; refresh_token?: string }
    if (!d.access_token) return null
    return { access_token: d.access_token, refresh_token: d.refresh_token }
  } catch {
    return null
  }
}

/** OAuth access token for the Supabase user (guilds scope) — enables GET /guilds/:id for servers they're in. */
async function callerDiscordAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: row } = await admin
    .from('profiles')
    .select('discord_access_token, discord_refresh_token')
    .eq('user_id', userId)
    .maybeSingle()
  let access = row?.discord_access_token?.trim() ?? ''
  const refresh = row?.discord_refresh_token?.trim() ?? ''
  if (!access && refresh) {
    const r = await refreshDiscordAccessToken(refresh)
    if (r?.access_token) {
      access = r.access_token
      await admin
        .from('profiles')
        .update({
          discord_access_token: access,
          discord_refresh_token: r.refresh_token ?? refresh,
        })
        .eq('user_id', userId)
    }
  }
  return access || null
}

const MAX_PER_RUN = 40

type EnrichBody = {
  mode?: string
  guild_ids?: string[]
  /** When true, overwrite banner/icon/invite/description if Discord returns values (detail page refresh). */
  refresh_visuals?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const admin = createClient(supabaseUrl, serviceKey)

  let userOAuthForGuild: string | null = null
  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader.includes('Bearer')) {
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const {
      data: { user: authUser },
      error: authErr,
    } = await userClient.auth.getUser(jwt)
    if (!authErr && authUser) {
      userOAuthForGuild = await callerDiscordAccessToken(admin, authUser.id)
    }
  }

  const body = (await req.json().catch(() => ({}))) as EnrichBody
  const mode = body.mode ?? 'missing'
  const refreshVisuals = !!body.refresh_visuals
  const guildFilter = Array.isArray(body.guild_ids)
    ? [...new Set(body.guild_ids.map((g) => String(g).trim()).filter(Boolean))]
    : []

  let query = admin
    .from('servers')
    .select('id, guild_id, discord_invite, banner, description, icon')
    .not('guild_id', 'is', null)

  if (guildFilter.length > 0) {
    query = query.in('guild_id', guildFilter)
  }

  const { data: rows, error: selErr } = await query.order('updated_at', { ascending: true })

  if (selErr) return json({ error: selErr.message }, 500)

  let candidates = (rows ?? []).filter((r) => r.guild_id)

  if (!guildFilter.length && mode === 'missing') {
    candidates = candidates.filter(
      (r) =>
        !(r.discord_invite && String(r.discord_invite).trim()) ||
        !(r.banner && String(r.banner).trim()) ||
        !(r.description && String(r.description).trim()),
    )
  }

  candidates = candidates.slice(0, MAX_PER_RUN)

  let updated = 0
  const errors: string[] = []

  for (const row of candidates) {
    const guildId = String(row.guild_id)
    try {
      const enriched = await enrichDiscordGuildForDirectory(guildId, null, {
        userAccessToken: userOAuthForGuild,
      })

      const patch: Record<string, unknown> = {}

      const shouldPatch = (hasNew: boolean, existing: string | null | undefined) =>
        hasNew && (refreshVisuals || !(existing && String(existing).trim()))

      if (enriched.discordInvite?.trim() && shouldPatch(true, row.discord_invite)) {
        patch.discord_invite = enriched.discordInvite.trim()
      }
      if (enriched.bannerUrl?.trim() && shouldPatch(true, row.banner)) {
        patch.banner = enriched.bannerUrl.trim()
      }
      if (enriched.description?.trim() && shouldPatch(true, row.description)) {
        patch.description = enriched.description.trim()
      }

      const botToken = Deno.env.get('DISCORD_BOT_TOKEN')?.trim()
      if (botToken) {
        const gr = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}`, {
          headers: { Authorization: `Bot ${botToken}` },
        })
        if (gr.ok) {
          try {
            const g = (await gr.json()) as { icon?: string | null }
            const iconUrl = discordIconCdnUrl(guildId, g.icon ?? null)
            if (iconUrl && shouldPatch(true, row.icon)) {
              patch.icon = iconUrl
            }
          } catch {
            /* ignore */
          }
        }
      }

      if (Object.keys(patch).length === 0) continue

      const { error: upErr } = await admin.from('servers').update(patch).eq('id', row.id)
      if (upErr) {
        errors.push(`${guildId}: ${upErr.message}`)
        continue
      }
      updated += 1
    } catch (e) {
      errors.push(`${guildId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return json({
    ok: true,
    processed: candidates.length,
    updated,
    errors: errors.length ? errors : undefined,
  })
})
