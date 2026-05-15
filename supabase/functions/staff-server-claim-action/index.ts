/**
 * ERLC Directory staff approve or reject server ownership claims.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import { getStaffActor, auditReasonAtLeast10 } from '../_shared/staffActor.ts'

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

async function insertAudit(
  admin: ReturnType<typeof createClient>,
  row: {
    actor_profile_id: string | null
    actor_user_id: string
    action: string
    reason: string
    target_profile_id?: string | null
    target_server_id?: string | null
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
    report_id: null,
    metadata: row.metadata ?? {},
  } as never)
  if (error) return { ok: false, error: error.message || 'Audit log failed.' }
  return { ok: true }
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

  let body: { requestId?: string; decision?: string; staffNotes?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
  const decisionRaw = typeof body.decision === 'string' ? body.decision.trim().toLowerCase() : ''
  const decision = decisionRaw === 'approve' || decisionRaw === 'reject' ? decisionRaw : ''
  const staffNotesRaw = typeof body.staffNotes === 'string' ? body.staffNotes.trim() : ''

  if (!UUID_RE.test(requestId)) return json({ ok: false, error: 'Invalid request.' }, 400)
  if (!decision) return json({ ok: false, error: 'decision must be approve or reject.' }, 400)

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

  if (!actor.isSiteOwner && staffNotesRaw.length < 10) {
    return json({ ok: false, error: 'Staff notes are required (at least 10 characters).' }, 400)
  }

  const effectiveNotes = actor.isSiteOwner
    ? auditReasonAtLeast10(staffNotesRaw, null, 'Site owner server claim decision')
    : staffNotesRaw.slice(0, 2000)

  const { data: row, error: loadErr } = await admin
    .from('server_claim_requests')
    .select('id, server_id, claimant_profile_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (loadErr || !row) return json({ ok: false, error: 'Claim request not found.' }, 404)
  if (row.status !== 'pending') {
    return json({ ok: false, error: 'This request was already decided.' }, 400)
  }

  const now = new Date().toISOString()

  if (decision === 'reject') {
    const { error: upErr } = await admin
      .from('server_claim_requests')
      .update({
        status: 'rejected',
        staff_notes: effectiveNotes,
        decided_at: now,
        decided_by_user_id: user.id,
        updated_at: now,
      } as never)
      .eq('id', requestId)
      .eq('status', 'pending')
    if (upErr) return json({ ok: false, error: upErr.message }, 500)

    const a = await insertAudit(admin, {
      actor_profile_id: actor.staffProfileId,
      actor_user_id: user.id,
      action: 'reject_server_claim',
      reason: effectiveNotes,
      target_profile_id: row.claimant_profile_id as string,
      target_server_id: row.server_id as string,
      metadata: { request_id: requestId },
    })
    if (!a.ok) return json({ ok: false, error: a.error }, 500)
    return json({ ok: true })
  }

  // approve
  const { data: server, error: sErr } = await admin
    .from('servers')
    .select('id, owner_id')
    .eq('id', row.server_id as string)
    .maybeSingle()
  if (sErr || !server?.id) return json({ ok: false, error: 'Server not found.' }, 404)
  if (server.owner_id) {
    return json({ ok: false, error: 'Server was claimed while this request was open.' }, 409)
  }

  const { error: srvErr } = await admin
    .from('servers')
    .update({
      owner_id: row.claimant_profile_id as string,
      claimed_at: now,
      updated_at: now,
    } as never)
    .eq('id', row.server_id as string)
    .is('owner_id', null)

  if (srvErr) return json({ ok: false, error: srvErr.message }, 500)

  const { error: reqErr } = await admin
    .from('server_claim_requests')
    .update({
      status: 'approved',
      staff_notes: effectiveNotes,
      decided_at: now,
      decided_by_user_id: user.id,
      updated_at: now,
    } as never)
    .eq('id', requestId)
    .eq('status', 'pending')

  if (reqErr) {
    await admin
      .from('servers')
      .update({ owner_id: null, claimed_at: null, updated_at: now } as never)
      .eq('id', row.server_id as string)
    return json({ ok: false, error: reqErr.message }, 500)
  }

  await admin
    .from('server_claim_requests')
    .update({
      status: 'rejected',
      staff_notes: 'Superseded by an approved claim for this server.',
      decided_at: now,
      decided_by_user_id: user.id,
      updated_at: now,
    } as never)
    .eq('server_id', row.server_id as string)
    .eq('status', 'pending')
    .neq('id', requestId)

  const a = await insertAudit(admin, {
    actor_profile_id: actor.staffProfileId,
    actor_user_id: user.id,
    action: 'approve_server_claim',
    reason: effectiveNotes,
    target_profile_id: row.claimant_profile_id as string,
    target_server_id: row.server_id as string,
    metadata: { request_id: requestId },
  })
  if (!a.ok) return json({ ok: false, error: a.error }, 500)

  return json({ ok: true })
})
