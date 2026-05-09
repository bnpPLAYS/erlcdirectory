import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import { sendDiscordUserDm } from '../_shared/discordDm.ts'
import { discordIconCdnUrl, enrichDiscordGuildForDirectory } from '../_shared/discordGuildEnrichment.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const ADMIN = 0x8n

/** Must match the authorize URL — one stable `/discord/callback` per site, not per /verify/:token. */
function isAllowedVerifierRedirectUri(uri: string): boolean {
  const raw = uri.trim()
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  const path = url.pathname.replace(/\/+$/, '') || '/'
  if (path !== '/discord/callback') return false

  const host = url.hostname.toLowerCase()

  if (host === 'localhost' || host === '127.0.0.1') return true

  if (host === 'www.erlc.directory' || host === 'erlc.directory') return true

  if (host.endsWith('.vercel.app')) return true

  const site = (Deno.env.get('PUBLIC_SITE_URL') || '').trim().replace(/\/+$/, '')
  if (site) {
    try {
      const base = new URL(site.startsWith('http') ? site : `https://${site}`)
      if (host === base.hostname.toLowerCase()) return true
    } catch {
      /* ignore */
    }
  }

  return false
}

async function notifyExperienceDecisionDm(
  db: SupabaseClient,
  params: {
    profileId: string
    guildName: string
    decision: 'approved' | 'rejected'
    approverLabel: string
  },
) {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN')?.trim()
  if (!botToken) return

  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') || 'https://www.erlc.directory').replace(/\/$/, '')

  const { data: row } = await db
    .from('profiles')
    .select('discord_id, dm_experience_status_updates')
    .eq('id', params.profileId)
    .maybeSingle()

  if (!row?.discord_id || !row.dm_experience_status_updates) return

  const profileUrl = `${siteUrl}/profile/${params.profileId}`
  const guild = params.guildName || 'your server'
  const who = params.approverLabel || 'a server admin'

  const text =
    params.decision === 'approved'
      ? `**ERLC Directory** — Your experience for **${guild}** was **approved** by @${who}.\n\nOpen your profile: ${profileUrl}`
      : `**ERLC Directory** — Your experience verification for **${guild}** was **not approved** by @${who}. You can generate a new verification link from your profile editor.\n\n${profileUrl}`

  const r = await sendDiscordUserDm(botToken, String(row.discord_id), text)
  if (!r.ok) console.error('[experience-verify] discord_dm_failed', r.error)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const clientId = Deno.env.get('DISCORD_CLIENT_ID')!
    const clientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')!

    const admin = createClient(supabaseUrl, serviceKey)
    const url = new URL(req.url)
    const action = url.searchParams.get('action') ?? 'lookup'
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const tokenParam = (body.token ?? url.searchParams.get('token') ?? '').toString().trim()

    if (!tokenParam || tokenParam.length > 128) return json({ error: 'Missing or invalid token.' }, 400)

    // Load the request and the experience + member it points to
    const { data: vr } = await admin
      .from('experience_verification_requests')
      .select('*')
      .eq('token', tokenParam)
      .maybeSingle()

    if (!vr) return json({ error: 'This verification link is not valid.' }, 404)

    // Auto-expire
    let status = vr.status as string
    if (status === 'pending' && new Date(vr.expires_at).getTime() < Date.now()) {
      await admin
        .from('experience_verification_requests')
        .update({ status: 'expired' })
        .eq('id', vr.id)
      status = 'expired'
    }

    const { data: experience } = await admin
      .from('experiences')
      .select('id, role, server_name, server_icon, department, start_date, end_date, is_current, is_verified, profile_id')
      .eq('id', vr.experience_id)
      .maybeSingle()

    const { data: profile } = await admin
      .from('profiles')
      .select('id, display_name, discord_username, discord_avatar')
      .eq('id', vr.profile_id)
      .maybeSingle()

    // Lookup-only request: just return state
    if (action === 'lookup') {
      return json({
        request: {
          id: vr.id,
          guild_id: vr.guild_id,
          guild_name: vr.guild_name,
          guild_icon: vr.guild_icon,
          status,
          expires_at: vr.expires_at,
          decided_at: vr.decided_at,
          approver_discord_username: vr.approver_discord_username,
        },
        experience,
        member: profile,
      })
    }

    // Decision actions require a Discord OAuth code from the verifier
    if (action !== 'approve' && action !== 'reject') {
      return json({ error: 'Unsupported action.' }, 400)
    }

    if (status !== 'pending') {
      return json({ error: `This request is already ${status}.` }, 400)
    }

    const code = (body.code ?? '').toString()
    const redirectUri = (body.redirectUri ?? '').toString()
    if (!code || !redirectUri) return json({ error: 'Missing Discord authorization.' }, 400)
    if (!isAllowedVerifierRedirectUri(redirectUri)) {
      return json(
        {
          error:
            'Invalid OAuth redirect. Use the site Discord callback only — add https://www.erlc.directory/discord/callback in Discord Developer Portal (not a separate URL per verification link).',
        },
        400,
      )
    }

    let memberRole = ''
    let verifierPosition = ''
    let verifierReviewText = ''
    let verifierRating: number | null = null
    if (action === 'approve') {
      memberRole = (body.memberRole ?? '').toString().trim()
      verifierPosition = (body.verifierPosition ?? '').toString().trim()
      verifierReviewText = (body.verifierReviewText ?? '').toString().trim()
      const rawRating = body.verifierRating
      if (rawRating !== undefined && rawRating !== null && rawRating !== '') {
        const n = Number(rawRating)
        if (!Number.isFinite(n) || n < 1 || n > 5 || Math.round(n) !== n) {
          return json({ error: 'Rating must be a whole number from 1 to 5.' }, 400)
        }
        verifierRating = n
      }
      if (verifierReviewText.length > 2000) return json({ error: 'Review text is too long (2000 max).' }, 400)
      if (!memberRole || memberRole.length > 80) {
        return json({ error: 'The member\'s verified role/title is required (1–80 characters).' }, 400)
      }
      if (!verifierPosition || verifierPosition.length > 160) {
        return json({ error: 'Your position in this Discord server is required (1–160 characters).' }, 400)
      }
    }

    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) return json({ error: 'Discord rejected the sign-in.', details: tokenData }, 400)

    const me = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }).then((r) => r.json())
    if (!me?.id) return json({ error: 'Could not read Discord account.' }, 400)

    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds?with_counts=true', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    if (!guildsRes.ok) return json({ error: 'Could not read your servers from Discord.' }, 400)
    const guilds = (await guildsRes.json()) as any[]

    const target = guilds.find((g) => String(g.id) === String(vr.guild_id))
    if (!target) {
      return json({
        error: `You are not in the server "${vr.guild_name ?? vr.guild_id}", so you cannot verify this experience.`,
      }, 403)
    }
    let perms = 0n
    try { perms = BigInt(target.permissions ?? '0') } catch { /* ignore */ }
    const isAdmin = !!target.owner || (perms & ADMIN) === ADMIN
    if (!isAdmin) {
      return json({
        error: `You don't have Administrator permission in "${target.name}". Only an admin can approve this.`,
      }, 403)
    }

    const decidedAt = new Date().toISOString()

    if (action === 'approve') {
      await admin
        .from('experience_verification_requests')
        .update({
          status: 'approved',
          approver_discord_id: me.id,
          approver_discord_username: me.username,
          decided_at: decidedAt,
          approver_stated_position: verifierPosition,
          approver_review_text: verifierReviewText || null,
          approver_review_rating: verifierRating,
        })
        .eq('id', vr.id)

      await admin
        .from('experiences')
        .update({
          role: memberRole,
          is_verified: true,
          guild_id: vr.guild_id,
          verified_by_discord_id: me.id,
          verified_by_discord_username: me.username,
          verified_at: decidedAt,
          verifier_stated_position: verifierPosition,
          verifier_review_text: verifierReviewText || null,
          verifier_review_rating: verifierRating,
        })
        .eq('id', vr.experience_id)

      const approveeProfileId = experience?.profile_id as string | undefined

      let { data: verifierProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('discord_id', String(me.id))
        .maybeSingle()

      const skipVerifierMirror = !!(
        approveeProfileId &&
        verifierProfile?.id &&
        verifierProfile.id === approveeProfileId
      )

      const verifierDiscordId = String(me.id)
      const verifierUsername = typeof me.username === 'string' ? me.username : 'staff'
      const verifierDisplay =
        (typeof me.global_name === 'string' && me.global_name.trim()) || verifierUsername
      const verifierAvatarUrl =
        me.avatar && verifierDiscordId
          ? `https://cdn.discordapp.com/avatars/${verifierDiscordId}/${me.avatar}.png?size=128`
          : null

      if (!verifierProfile && !skipVerifierMirror) {
        const syntheticEmail = `discord-${verifierDiscordId}@verifier.erlc.directory`
        const randomPassword =
          crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
        const { data: createdAuth, error: createAuthErr } = await admin.auth.admin.createUser({
          email: syntheticEmail,
          password: randomPassword,
          email_confirm: true,
          user_metadata: {
            name: verifierDisplay,
            avatar_url: verifierAvatarUrl,
            discord_id: verifierDiscordId,
            discord_username: verifierUsername,
          },
        })
        if (!createAuthErr && createdAuth.user) {
          const { data: newProf, error: newProfErr } = await admin
            .from('profiles')
            .insert({
              user_id: createdAuth.user.id,
              discord_id: verifierDiscordId,
              discord_username: verifierUsername,
              discord_avatar: verifierAvatarUrl,
              display_name: verifierDisplay,
              is_verified: true,
            })
            .select('id')
            .single()
          if (!newProfErr && newProf) verifierProfile = newProf
        } else {
          const { data: retryProfile } = await admin
            .from('profiles')
            .select('id')
            .eq('discord_id', verifierDiscordId)
            .maybeSingle()
          verifierProfile = retryProfile ?? verifierProfile
        }
      } else if (verifierProfile && !skipVerifierMirror) {
        await admin
          .from('profiles')
          .update({
            discord_username: verifierUsername,
            discord_avatar: verifierAvatarUrl,
            display_name: verifierDisplay,
            is_verified: true,
          })
          .eq('id', verifierProfile.id)
      }

      if (
        verifierRating &&
        approveeProfileId &&
        verifierProfile?.id &&
        verifierProfile.id !== approveeProfileId
      ) {
        await admin.from('reviews').upsert(
          {
            reviewee_id: approveeProfileId,
            reviewer_id: verifierProfile.id,
            rating: verifierRating,
            content: verifierReviewText || null,
            updated_at: decidedAt,
          },
          { onConflict: 'reviewee_id,reviewer_id' },
        )
      }

      // Auto-create / refresh server row: Discord description, banner, invite (bot → widget → preview)
      const memberCount = Number(target.approximate_member_count ?? 0) || 0
      const guildIdStr = String(vr.guild_id)
      const iconFromTarget =
        target.icon && target.id
          ? discordIconCdnUrl(String(target.id), String(target.icon))
          : null
      const iconUrl = (vr.guild_icon as string | null) ?? iconFromTarget

      let enriched: Awaited<ReturnType<typeof enrichDiscordGuildForDirectory>>
      try {
        enriched = await enrichDiscordGuildForDirectory(guildIdStr, target.banner ?? null)
      } catch (e) {
        console.error('[experience-verify] guild_enrich_failed', e)
        enriched = { description: null, bannerUrl: null, discordInvite: null }
      }

      const { data: existingServer } = await admin
        .from('servers')
        .select('id, member_count')
        .eq('guild_id', vr.guild_id)
        .maybeSingle()

      const serverName = vr.guild_name ?? target.name ?? 'Discord server'

      if (!existingServer) {
        await admin.from('servers').insert({
          name: serverName,
          icon: iconUrl,
          guild_id: guildIdStr,
          description: enriched.description,
          banner: enriched.bannerUrl,
          discord_invite: enriched.discordInvite,
          member_count: memberCount,
        })
      } else {
        const patch: Record<string, unknown> = { name: serverName }
        if (memberCount > 0) patch.member_count = memberCount
        if (iconUrl) patch.icon = iconUrl
        if (enriched.description) patch.description = enriched.description
        if (enriched.bannerUrl) patch.banner = enriched.bannerUrl
        if (enriched.discordInvite) patch.discord_invite = enriched.discordInvite
        await admin.from('servers').update(patch).eq('id', existingServer.id)
      }

      // Verified staff experience for the approving admin on this server (directory account may be new)
      if (verifierProfile?.id && !skipVerifierMirror) {
        const serverLabel =
          (typeof target.name === 'string' && target.name) || vr.guild_name || 'Discord server'
        const iconFromDiscord =
          target.icon && target.id
            ? `https://cdn.discordapp.com/icons/${target.id}/${target.icon}.png?size=128`
            : null
        const serverIcon = (iconFromDiscord || vr.guild_icon) as string | null
        const day = decidedAt.slice(0, 10)

        const { data: existingVx } = await admin
          .from('experiences')
          .select('id')
          .eq('profile_id', verifierProfile.id)
          .eq('guild_id', String(vr.guild_id))
          .maybeSingle()

        if (existingVx?.id) {
          await admin
            .from('experiences')
            .update({
              role: verifierPosition,
              server_name: serverLabel,
              server_icon: serverIcon,
              guild_id: String(vr.guild_id),
              is_verified: true,
              is_current: true,
              verified_at: decidedAt,
              verified_by_discord_id: null,
              verified_by_discord_username: null,
              verifier_stated_position: null,
              verifier_review_text: null,
              verifier_review_rating: null,
            })
            .eq('id', existingVx.id)
        } else {
          await admin.from('experiences').insert({
            profile_id: verifierProfile.id,
            role: verifierPosition,
            server_name: serverLabel,
            server_icon: serverIcon,
            guild_id: String(vr.guild_id),
            start_date: day,
            end_date: null,
            is_current: true,
            is_verified: true,
            verified_at: decidedAt,
            verified_by_discord_id: null,
            verified_by_discord_username: null,
            department: null,
            description: null,
          })
        }
      }

      await notifyExperienceDecisionDm(admin, {
        profileId: vr.profile_id,
        guildName: (vr.guild_name || experience?.server_name || 'Discord server') as string,
        decision: 'approved',
        approverLabel: String(me.username || 'admin'),
      })

      return json({ ok: true, status: 'approved', approver: me.username })
    } else {
      await admin
        .from('experience_verification_requests')
        .update({
          status: 'rejected',
          approver_discord_id: me.id,
          approver_discord_username: me.username,
          decided_at: decidedAt,
        })
        .eq('id', vr.id)

      await notifyExperienceDecisionDm(admin, {
        profileId: vr.profile_id,
        guildName: (vr.guild_name || experience?.server_name || 'Discord server') as string,
        decision: 'rejected',
        approverLabel: String(me.username || 'admin'),
      })

      return json({ ok: true, status: 'rejected', approver: me.username })
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
