/**
 * Staff directory actions: delete servers, ban/remove members, grant flags / Pro,
 * force server verification — with mandatory audit reasons and hourly rate limits
 * for non–site-owner staff (ban + profile removal combined, max 2/hour).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import { getStaffActor, isSiteOwnerDiscordUsername, auditReasonAtLeast10 } from '../_shared/staffActor.ts'

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

type Body = {
  action?: string
  reason?: string
  profile_id?: string
  server_id?: string
  profile_patch?: {
    is_verified?: boolean
    is_featured?: boolean
    is_pro?: boolean
  }
  is_verified?: boolean
}

async function insertAudit(
  admin: ReturnType<typeof createClient>,
  row: {
    actor_profile_id: string | null
    actor_user_id: string
    action: string
    reason: string
    target_profile_id?: string | null
    target_server_id?: string | null
    report_id?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.from('staff_audit_logs').insert({
    actor_profile_id: row.actor_profile_id,
    actor_user_id: row.actor_user_id,
    action: row.action,
    reason: row.reason.trim().slice(0, 2000),
    target_profile_id: row.target_profile_id ?? null,
    target_server_id: row.target_server_id ?? null,
    report_id: row.report_id ?? null,
    metadata: row.metadata ?? {},
  } as never)
  if (error) return { ok: false, error: error.message || 'Audit log failed.' }
  return { ok: true }
}

async function assertMemberActionRateOk(
  admin: ReturnType<typeof createClient>,
  actorUserId: string,
  isSiteOwner: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isSiteOwner) return { ok: true }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await admin
    .from('staff_audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('actor_user_id', actorUserId)
    .in('action', ['ban_member', 'remove_profile'])
    .gte('created_at', since)
  if (error) return { ok: false, error: error.message || 'Rate check failed.' }
  if ((count ?? 0) >= 2) {
    return {
      ok: false,
      error:
        'You can perform at most two member bans or profile removals combined per hour. Try again later or ask the site owner.',
    }
  }
  return { ok: true }
}

async function loadProfile(admin: ReturnType<typeof createClient>, id: string) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, user_id, discord_username')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as { id: string; user_id: string | null; discord_username: string | null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ ok: false, error: 'Unauthorized' }, 401)
  const jwt = authHeader.slice(7).trim()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim().replace(/\/$/, '') || ''
  const anonKey =
    Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim() ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: 'Server configuration error.' }, 500)
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const action = (body.action ?? '').toString().trim()
  const rawReason = (body.reason ?? '').toString().trim()

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt)
  if (userErr || !user) return json({ ok: false, error: 'Invalid session' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const actor = await getStaffActor(admin, user.id)
  if (!actor.ok) return json({ ok: false, error: actor.error }, 403)

  if (!actor.isSiteOwner && rawReason.length < 10) {
    return json({ ok: false, error: 'Provide a reason (at least 10 characters) for this action.' }, 400)
  }

  const effectiveReason = actor.isSiteOwner
    ? auditReasonAtLeast10(rawReason, null, 'Site owner action via staff panel')
    : rawReason.trim().slice(0, 2000)

  const allowed = [
    'delete_server',
    'ban_profile',
    'remove_profile',
    'set_profile_flags',
    'set_server_verified',
  ] as const
  if (!allowed.includes(action as (typeof allowed)[number])) {
    return json({ ok: false, error: 'Invalid action.' }, 400)
  }

  const profileId = (body.profile_id ?? '').toString().trim()
  const serverId = (body.server_id ?? '').toString().trim()

  const assertNotTargetOwner = async (pid: string | null | undefined) => {
    if (!pid || !UUID_RE.test(pid)) return { ok: true as const }
    const p = await loadProfile(admin, pid)
    if (p && isSiteOwnerDiscordUsername(p.discord_username)) {
      return { ok: false as const, error: 'This action cannot target the site owner account.' }
    }
    return { ok: true as const }
  }

  try {
    if (action === 'delete_server') {
      if (!UUID_RE.test(serverId)) return json({ ok: false, error: 'Invalid server.' }, 400)
      const { error: delErr } = await admin.from('servers').delete().eq('id', serverId)
      if (delErr) return json({ ok: false, error: delErr.message }, 400)
      // Cannot reference servers(id) after delete — FK would reject insert. Keep id in metadata.
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'delete_server',
        reason: effectiveReason,
        target_server_id: null,
        metadata: { deleted_server_id: serverId },
      })
      if (!a.ok) return json({ ok: false, error: a.error }, 400)
      return json({ ok: true })
    }

    if (action === 'ban_profile') {
      if (!UUID_RE.test(profileId)) return json({ ok: false, error: 'Invalid profile.' }, 400)
      const nt = await assertNotTargetOwner(profileId)
      if (!nt.ok) return json({ ok: false, error: nt.error }, 403)
      const sub = await loadProfile(admin, profileId)
      if (!sub?.user_id) return json({ ok: false, error: 'Member has no login to ban.' }, 400)
      if (sub.user_id === user.id) return json({ ok: false, error: 'You cannot ban your own account.' }, 400)
      const rate = await assertMemberActionRateOk(admin, user.id, actor.isSiteOwner)
      if (!rate.ok) return json({ ok: false, error: rate.error }, 429)
      const { error: banErr } = await admin.auth.admin.updateUserById(sub.user_id, {
        ban_duration: '876000h',
      })
      if (banErr) return json({ ok: false, error: banErr.message || 'Auth ban failed.' }, 400)
      const bannedAt = new Date().toISOString()
      const { error: profBanErr } = await admin.from('profiles').update({ banned_at: bannedAt }).eq('id', profileId)
      if (profBanErr) return json({ ok: false, error: profBanErr.message }, 400)
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'ban_member',
        reason: effectiveReason,
        target_profile_id: profileId,
        metadata: { source: 'staff_directory' },
      })
      if (!a.ok) return json({ ok: false, error: a.error }, 400)
      return json({ ok: true })
    }

    if (action === 'remove_profile') {
      if (!UUID_RE.test(profileId)) return json({ ok: false, error: 'Invalid profile.' }, 400)
      const nt = await assertNotTargetOwner(profileId)
      if (!nt.ok) return json({ ok: false, error: nt.error }, 403)
      const rate = await assertMemberActionRateOk(admin, user.id, actor.isSiteOwner)
      if (!rate.ok) return json({ ok: false, error: rate.error }, 429)
      const { error: delErr } = await admin.from('profiles').delete().eq('id', profileId)
      if (delErr) return json({ ok: false, error: delErr.message }, 400)
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'remove_profile',
        reason: effectiveReason,
        target_profile_id: null,
        metadata: { deleted_profile_id: profileId },
      })
      if (!a.ok) return json({ ok: false, error: a.error }, 400)
      return json({ ok: true })
    }

    if (action === 'set_profile_flags') {
      if (!UUID_RE.test(profileId)) return json({ ok: false, error: 'Invalid profile.' }, 400)
      const nt = await assertNotTargetOwner(profileId)
      if (!nt.ok) return json({ ok: false, error: nt.error }, 403)
      const patch = body.profile_patch ?? {}
      const has =
        typeof patch.is_verified === 'boolean' ||
        typeof patch.is_featured === 'boolean' ||
        typeof patch.is_pro === 'boolean'
      if (!has) return json({ ok: false, error: 'profile_patch must include at least one flag.' }, 400)
      const row: Record<string, unknown> = {}
      if (typeof patch.is_verified === 'boolean') row.is_verified = patch.is_verified
      if (typeof patch.is_featured === 'boolean') row.is_featured = patch.is_featured
      if (typeof patch.is_pro === 'boolean') {
        row.is_pro = patch.is_pro
        row.pro_verified_at = patch.is_pro ? new Date().toISOString() : null
      }
      const { error: upErr } = await admin.from('profiles').update(row).eq('id', profileId)
      if (upErr) return json({ ok: false, error: upErr.message }, 400)
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'set_profile_flags',
        reason: effectiveReason,
        target_profile_id: profileId,
        metadata: { patch },
      })
      if (!a.ok) return json({ ok: false, error: a.error }, 400)
      return json({ ok: true })
    }

    if (action === 'set_server_verified') {
      if (!UUID_RE.test(serverId)) return json({ ok: false, error: 'Invalid server.' }, 400)
      const v = body.is_verified
      if (typeof v !== 'boolean') return json({ ok: false, error: 'is_verified boolean required.' }, 400)
      const { error: upErr } = await admin.from('servers').update({ is_verified: v }).eq('id', serverId)
      if (upErr) return json({ ok: false, error: upErr.message }, 400)
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'set_server_verified',
        reason: effectiveReason,
        target_server_id: serverId,
        metadata: { is_verified: v },
      })
      if (!a.ok) return json({ ok: false, error: a.error }, 400)
      return json({ ok: true })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Action failed'
    return json({ ok: false, error: msg }, 500)
  }

  return json({ ok: false, error: 'Unhandled.' }, 500)
})
