/**
 * Staff moderation actions on a moderation_reports row (delete content, warn, ban, etc.).
 * Mirrors api/staff-moderation-action.ts so it runs on Supabase where SUPABASE_SERVICE_ROLE_KEY is auto-injected.
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

type Action = 'delete_message' | 'delete_review' | 'remove_server' | 'warn' | 'ban'

function isSiteOwnerDiscordUsername(username: string | null | undefined): boolean {
  if (typeof username !== 'string') return false
  const normalized = username.trim().toLowerCase().replace(/\.+$/u, '')
  return normalized === 'pixelnovaa'
}

async function assertStaff(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ ok: true; staffProfileId: string } | { ok: false; error: string }> {
  const { data: actor, error } = await admin
    .from('profiles')
    .select('id, discord_username')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !actor?.id) return { ok: false, error: 'Staff profile not found.' }
  if (isSiteOwnerDiscordUsername(actor.discord_username as string | null)) {
    return { ok: true, staffProfileId: actor.id as string }
  }
  const { data: role } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  if (!role) return { ok: false, error: 'Not authorized.' }
  return { ok: true, staffProfileId: actor.id as string }
}

async function subjectProfileIdForReport(
  admin: ReturnType<typeof createClient>,
  report: {
    kind: string
    message_id: string | null
    review_id: string | null
    server_id: string | null
  },
): Promise<string | null> {
  if (report.kind === 'message' && report.message_id) {
    const { data: m } = await admin
      .from('messages')
      .select('sender_id')
      .eq('id', report.message_id)
      .maybeSingle()
    return (m?.sender_id as string | null) ?? null
  }
  if (report.kind === 'review' && report.review_id) {
    const { data: r } = await admin
      .from('reviews')
      .select('reviewer_id')
      .eq('id', report.review_id)
      .maybeSingle()
    return (r?.reviewer_id as string | null) ?? null
  }
  if (report.kind === 'server' && report.server_id) {
    const { data: s } = await admin
      .from('servers')
      .select('owner_id')
      .eq('id', report.server_id)
      .maybeSingle()
    return (s?.owner_id as string | null) ?? null
  }
  return null
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

  let body: {
    report_id?: string
    action?: string
    warn_body?: string
    staff_notes?: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const reportId = (body.report_id ?? '').toString().trim()
  const action = (body.action ?? '').toString().trim() as Action
  const warnBody = (body.warn_body ?? '').toString().trim()
  const staffNotes = (body.staff_notes ?? '').toString().trim().slice(0, 2000) || null

  const allowed: Action[] = ['delete_message', 'delete_review', 'remove_server', 'warn', 'ban']
  if (!UUID_RE.test(reportId) || !allowed.includes(action)) {
    return json({ ok: false, error: 'Invalid request.' }, 400)
  }

  if (action === 'warn' && (warnBody.length < 1 || warnBody.length > 2000)) {
    return json({ ok: false, error: 'Warning text must be 1–2000 characters.' }, 400)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt)
  if (userErr || !user) return json({ ok: false, error: 'Invalid session' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const staff = await assertStaff(admin, user.id)
  if (!staff.ok) return json({ ok: false, error: staff.error }, 403)

  const { data: report, error: repErr } = await admin
    .from('moderation_reports')
    .select('id, kind, status, message_id, review_id, server_id')
    .eq('id', reportId)
    .maybeSingle()

  if (repErr || !report) {
    return json({ ok: false, error: 'Report not found.' }, 404)
  }
  if ((report.status as string) !== 'open') {
    return json({ ok: false, error: 'Report is already closed.' }, 400)
  }

  const subjectId = await subjectProfileIdForReport(admin, {
    kind: report.kind as string,
    message_id: (report.message_id as string | null) ?? null,
    review_id: (report.review_id as string | null) ?? null,
    server_id: (report.server_id as string | null) ?? null,
  })

  try {
    if (action === 'delete_message') {
      if (report.kind !== 'message' || !report.message_id) {
        return json({ ok: false, error: 'This report is not a message report.' }, 400)
      }
      const { error: delErr } = await admin
        .from('messages')
        .delete()
        .eq('id', report.message_id as string)
      if (delErr) return json({ ok: false, error: delErr.message }, 400)
    } else if (action === 'delete_review') {
      if (report.kind !== 'review' || !report.review_id) {
        return json({ ok: false, error: 'This report is not a review report.' }, 400)
      }
      const { error: delErr } = await admin
        .from('reviews')
        .delete()
        .eq('id', report.review_id as string)
      if (delErr) return json({ ok: false, error: delErr.message }, 400)
    } else if (action === 'remove_server') {
      if (report.kind !== 'server' || !report.server_id) {
        return json({ ok: false, error: 'This report is not a server report.' }, 400)
      }
      const { error: delErr } = await admin
        .from('servers')
        .delete()
        .eq('id', report.server_id as string)
      if (delErr) return json({ ok: false, error: delErr.message }, 400)
    } else if (action === 'warn') {
      if (!subjectId) {
        return json({ ok: false, error: 'No member linked to this report (nothing to warn).' }, 400)
      }
      const { error: wErr } = await admin.from('profile_warnings').insert({
        subject_profile_id: subjectId,
        issued_by_profile_id: staff.staffProfileId,
        body: warnBody,
      } as never)
      if (wErr) return json({ ok: false, error: wErr.message }, 400)
    } else if (action === 'ban') {
      if (!subjectId) {
        return json({ ok: false, error: 'No member linked to this report (nothing to ban).' }, 400)
      }
      const { data: sub, error: subErr } = await admin
        .from('profiles')
        .select('user_id')
        .eq('id', subjectId)
        .maybeSingle()
      if (subErr || !sub?.user_id) {
        return json({ ok: false, error: 'Subject has no login account to ban.' }, 400)
      }
      if (sub.user_id === user.id) {
        return json({ ok: false, error: 'You cannot ban your own account.' }, 400)
      }
      const bannedAt = new Date().toISOString()
      const { error: banErr } = await admin.auth.admin.updateUserById(sub.user_id as string, {
        ban_duration: '876000h',
      })
      if (banErr) {
        return json({ ok: false, error: banErr.message || 'Auth ban failed.' }, 400)
      }
      const { error: profBanErr } = await admin
        .from('profiles')
        .update({ banned_at: bannedAt })
        .eq('id', subjectId)
      if (profBanErr) {
        return json({ ok: false, error: profBanErr.message }, 400)
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Action failed'
    return json({ ok: false, error: msg }, 500)
  }

  const { error: upErr } = await admin
    .from('moderation_reports')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      staff_notes: staffNotes,
    })
    .eq('id', reportId)

  if (upErr) return json({ ok: false, error: upErr.message }, 400)

  return json({ ok: true })
})
