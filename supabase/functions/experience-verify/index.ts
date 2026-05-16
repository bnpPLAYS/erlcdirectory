import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import { loadDiscordOAuthCredentials, upsertDiscordOAuthCredentials } from '../_shared/discordOAuthCredentials.ts'
import { sendDiscordUserDm } from '../_shared/discordDm.ts'
import { discordIconCdnUrl, enrichDiscordGuildForDirectory } from '../_shared/discordGuildEnrichment.ts'
import { fetchMemberDiscordRolesForGuild } from '../_shared/discordMemberRoles.ts'
import { publicProfileAbsoluteUrl } from '../_shared/publicProfilePath.ts'
import { discordDefaultAvatarCdnUrl } from '../_shared/discordDefaultAvatar.ts'

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
/** Manage Roles — same permission Discord uses for moderators who can assign roles without Administrator. */
const MANAGE_ROLES = 1n << 28n

interface DiscordVerifierUser {
  id: string
  username?: string
  global_name?: string | null
  avatar?: string | null
}

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

async function refreshDiscordAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
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
  const d = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number }
  if (!d.access_token) return null
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_in: Number(d.expires_in ?? 604800),
  }
}

/**
 * Use stored Discord OAuth tokens from the verifier's profile (same Supabase session as the website).
 * Avoids sending verifiers through Discord OAuth again when they are already signed in.
 */
async function tryDiscordViaSupabaseSession(
  authHeader: string,
  supabaseUrl: string,
  anonKey: string,
  admin: SupabaseClient,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; me: DiscordVerifierUser } | null> {
  if (!authHeader.startsWith('Bearer ')) return null
  const jwt = authHeader.slice(7).trim()
  if (!jwt || jwt === anonKey) return null

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt)
  if (userErr || !user) return null

  const { data: row } = await admin
    .from('profiles')
    .select('id, discord_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!row?.id) return null

  const creds = await loadDiscordOAuthCredentials(admin, user.id)
  if (!creds?.refresh_token?.trim() && !creds?.access_token?.trim()) return null

  let accessToken = (creds.access_token ?? '').trim()
  const expMs = creds.expires_at ? new Date(creds.expires_at).getTime() : 0
  const stale = !accessToken || Date.now() > expMs - 90_000

  if (stale && creds.refresh_token) {
    const refreshed = await refreshDiscordAccessToken(creds.refresh_token, clientId, clientSecret)
    if (!refreshed?.access_token) return null
    accessToken = refreshed.access_token
    const expireIso = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    await upsertDiscordOAuthCredentials(admin, user.id, {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? creds.refresh_token,
      expires_at: expireIso,
    })
  }

  if (!accessToken) return null

  const meRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const me = (await meRes.json()) as DiscordVerifierUser
  if (!me?.id) return null
  if (row.discord_id && String(row.discord_id) !== String(me.id)) return null

  return { accessToken, me }
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
    .select('discord_id, discord_username, dm_experience_status_updates')
    .eq('id', params.profileId)
    .maybeSingle()

  if (!row?.discord_id || !row.dm_experience_status_updates) return

  const profileUrl = publicProfileAbsoluteUrl(siteUrl, params.profileId, row.discord_username ?? null)
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
      .select('id, display_name, discord_username, discord_avatar, discord_id')
      .eq('id', vr.profile_id)
      .maybeSingle()

    let discordRoles: { id: string; name: string }[] = []
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN')?.trim()
    if (botToken && profile?.discord_id && vr.guild_id) {
      try {
        const { roles } = await fetchMemberDiscordRolesForGuild(
          botToken,
          String(vr.guild_id),
          String(profile.discord_id),
        )
        discordRoles = roles
      } catch (e) {
        console.error('[experience-verify] discord_roles_lookup_failed', e)
      }
    }

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
        member: profile
          ? {
              ...profile,
              discord_roles: discordRoles,
            }
          : null,
      })
    }

    // Decision actions: OAuth redirect callback OR signed-in directory session (stored Discord tokens)
    if (action !== 'approve' && action !== 'reject') {
      return json({ error: 'Unsupported action.' }, 400)
    }

    if (status !== 'pending') {
      return json({ error: `This request is already ${status}.` }, 400)
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

    const authHeader = req.headers.get('Authorization') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const code = (body.code ?? '').toString().trim()
    const redirectUri = (body.redirectUri ?? '').toString().trim()

    let tokenData: { access_token: string; refresh_token?: string; expires_in?: number }
    let me: DiscordVerifierUser

    if (code && redirectUri) {
      if (!isAllowedVerifierRedirectUri(redirectUri)) {
        return json(
          {
            error:
              'Invalid OAuth redirect. Use the site Discord callback only — add https://www.erlc.directory/discord/callback in Discord Developer Portal (not a separate URL per verification link).',
          },
          400,
        )
      }
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
      tokenData = (await tokenRes.json()) as typeof tokenData
      if (!tokenRes.ok) return json({ error: 'Discord rejected the sign-in.', details: tokenData }, 400)
      if (!tokenData.access_token) return json({ error: 'Discord rejected the sign-in.' }, 400)

      me = (await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }).then((r) => r.json())) as DiscordVerifierUser
      if (!me?.id) return json({ error: 'Could not read Discord account.' }, 400)
    } else {
      if (!anonKey) return json({ error: 'Server misconfigured.' }, 500)
      const sess = await tryDiscordViaSupabaseSession(authHeader, supabaseUrl, anonKey, admin, clientId, clientSecret)
      if (!sess) {
        return json(
          {
            error:
              'Discord authorization required. Sign in to erlc.directory with Discord in this browser first, or use Continue with Discord below.',
          },
          401,
        )
      }
      tokenData = { access_token: sess.accessToken }
      me = sess.me
    }

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
    try {
      perms = BigInt(target.permissions ?? '0')
    } catch {
      /* ignore */
    }
    const canVerify =
      !!target.owner ||
      (perms & ADMIN) === ADMIN ||
      (perms & MANAGE_ROLES) === MANAGE_ROLES
    if (!canVerify) {
      return json(
        {
          error: `You need Administrator or Manage Roles permission in "${target.name}" to approve or reject this verification.`,
        },
        403,
      )
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
      const avHash = me.avatar ? String(me.avatar) : ''
      const avExt = avHash.startsWith('a_') ? 'gif' : 'png'
      const verifierAvatarUrl =
        avHash && verifierDiscordId
          ? `https://cdn.discordapp.com/avatars/${verifierDiscordId}/${avHash}.${avExt}?size=128`
          : discordDefaultAvatarCdnUrl(verifierDiscordId)

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

      const oauthAccessToken =
        typeof tokenData.access_token === 'string' ? tokenData.access_token : undefined

      let enriched: Awaited<ReturnType<typeof enrichDiscordGuildForDirectory>>
      try {
        enriched = await enrichDiscordGuildForDirectory(guildIdStr, target.banner ?? null, {
          userAccessToken: oauthAccessToken,
        })
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
  } catch {
    return json({ error: 'Verification request failed.' }, 500)
  }
})
