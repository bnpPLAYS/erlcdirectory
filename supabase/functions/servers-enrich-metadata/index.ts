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

const MAX_PER_RUN = 25

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.includes('Bearer')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser()
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)

  const body = await req.json().catch(() => ({})) as { mode?: string }
  const mode = body.mode ?? 'missing'

  const { data: rows, error: selErr } = await admin
    .from('servers')
    .select('id, guild_id, discord_invite, banner, description, icon')
    .not('guild_id', 'is', null)
    .order('updated_at', { ascending: true })

  if (selErr) return json({ error: selErr.message }, 500)

  let candidates = (rows ?? []).filter((r) => r.guild_id)

  if (mode === 'missing') {
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
      const enriched = await enrichDiscordGuildForDirectory(guildId, null, {})

      const patch: Record<string, unknown> = {}

      if (enriched.discordInvite?.trim() && !(row.discord_invite && String(row.discord_invite).trim())) {
        patch.discord_invite = enriched.discordInvite.trim()
      }
      if (enriched.bannerUrl?.trim() && !(row.banner && String(row.banner).trim())) {
        patch.banner = enriched.bannerUrl.trim()
      }
      if (enriched.description?.trim() && !(row.description && String(row.description).trim())) {
        patch.description = enriched.description.trim()
      }

      const botToken = Deno.env.get('DISCORD_BOT_TOKEN')?.trim()
      if (botToken && !(row.icon && String(row.icon).trim())) {
        const gr = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}`, {
          headers: { Authorization: `Bot ${botToken}` },
        })
        if (gr.ok) {
          try {
            const g = (await gr.json()) as { icon?: string | null }
            const iconUrl = discordIconCdnUrl(guildId, g.icon ?? null)
            if (iconUrl) patch.icon = iconUrl
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
