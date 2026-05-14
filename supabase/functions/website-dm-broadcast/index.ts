import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import { sendDiscordUserDm } from '../_shared/discordDm.ts'
import { isSiteOwnerDiscordUsername } from '../_shared/siteOwner.ts'

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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN')?.trim()

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing session.' }, 401)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized.' }, 401)

    const adminDb = createClient(supabaseUrl, serviceKey)
    const { data: callerProfile } = await adminDb
      .from('profiles')
      .select('discord_username')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!isSiteOwnerDiscordUsername(callerProfile?.discord_username ?? null)) {
      return json({ error: 'Staff only.' }, 403)
    }

    if (!botToken) return json({ error: 'DISCORD_BOT_TOKEN is not configured.' }, 500)

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const message = (body.message ?? '').toString().trim()
    if (!message || message.length > 1800) {
      return json({ error: 'Message required (max 1800 characters).' }, 400)
    }

    const { data: rows, error: selErr } = await adminDb
      .from('profiles')
      .select('discord_id')
      .eq('dm_website_updates', true)
      .not('discord_id', 'is', null)

    if (selErr) return json({ error: selErr.message }, 500)

    const prefix = '**ERLC Directory — site update**\n\n'
    const fullMessage = `${prefix}${message}`

    let sent = 0
    const targets = rows || []
    for (const row of targets) {
      if (!row.discord_id) continue
      const r = await sendDiscordUserDm(botToken, String(row.discord_id), fullMessage)
      if (r.ok) sent++
      else console.error('[website-dm-broadcast]', row.discord_id, r.error)
      await new Promise((res) => setTimeout(res, 350))
    }

    return json({ ok: true, sent, attempted: targets.length })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
