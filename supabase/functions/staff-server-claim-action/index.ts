/**
 * Staff approves / rejects / cancels a server claim request.
 * On approve, sets `servers.owner_id` and `servers.claimed_at` and writes an audit row.
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

  let body: { request_id?: string; decision?: string; staff_notes?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const requestId = (body.request_id ?? '').toString().trim()
  const decisionRaw = (body.decision ?? '').toString().trim().toLowerCase()
  const staffNotes = (body.staff_notes ?? '').toString().trim().slice(0, 2000) || null

  if (!UUID_RE.test(requestId)) return json({ ok: false, error: 'Invalid request id.' }, 400)
  if (decisionRaw !== 'approve' && decisionRaw !== 'reject') {
    return json({ ok: false, error: 'decision must be approve or reject.' }, 400)
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
  const actor = await getStaffActor(admin, user.id)
  if (!actor.ok) return json({ ok: false, error: actor.error }, 403)

  if (!actor.isSiteOwner && (!staffNotes || staffNotes.length < 10)) {
    return json(
      { ok: false, error: 'Staff notes (at least 10 characters) are required to decide a claim.' },
      400,
    )
  }

  const { data: reqRow } = await admin
    .from('server_claim_requests')
    .select('id, server_id, claimant_profile_id, status')
    .eq('id', requestId)
    .maybeSingle()
  if (!reqRow) return json({ ok: false, error: 'Claim request not found.' }, 404)
  if (reqRow.status !== 'pending') return json({ ok: false, error: 'Claim is already closed.' }, 400)

  const decision = decisionRaw === 'approve' ? 'approved' : 'rejected'
  const nowIso = new Date().toISOString()

  if (decision === 'approved') {
    const { data: srv } = await admin
      .from('servers')
      .select('id, owner_id')
      .eq('id', reqRow.server_id)
      .maybeSingle()
    if (!srv) return json({ ok: false, error: 'Server no longer exists.' }, 404)
    if (srv.owner_id) {
      // Cancel this request and surface the conflict to staff.
      await admin
        .from('server_claim_requests')
        .update({
          status: 'cancelled',
          staff_notes: 'Server already claimed at decision time.',
          decided_at: nowIso,
          decided_by_user_id: user.id,
        } as never)
        .eq('id', requestId)
      return json({ ok: false, error: 'Server is already claimed.' }, 409)
    }

    const { error: srvErr } = await admin
      .from('servers')
      .update({ owner_id: reqRow.claimant_profile_id, claimed_at: nowIso } as never)
      .eq('id', reqRow.server_id)
    if (srvErr) return json({ ok: false, error: srvErr.message }, 400)
  }

  const { error: updErr } = await admin
    .from('server_claim_requests')
    .update({
      status: decision,
      staff_notes: staffNotes,
      decided_at: nowIso,
      decided_by_user_id: user.id,
    } as never)
    .eq('id', requestId)
  if (updErr) return json({ ok: false, error: updErr.message }, 400)

  // Auto-reject any other pending claims for the same server when approved.
  if (decision === 'approved') {
    await admin
      .from('server_claim_requests')
      .update({
        status: 'cancelled',
        staff_notes: 'Another claim was approved for this server.',
        decided_at: nowIso,
        decided_by_user_id: user.id,
      } as never)
      .eq('server_id', reqRow.server_id)
      .eq('status', 'pending')
      .neq('id', requestId)
  }

  const auditReason = auditReasonAtLeast10(
    staffNotes,
    null,
    decision === 'approved' ? 'Approved server claim' : 'Rejected server claim',
  )
  await admin.from('staff_audit_logs').insert({
    actor_profile_id: actor.staffProfileId,
    actor_user_id: user.id,
    action: decision === 'approved' ? 'approve_server_claim' : 'reject_server_claim',
    reason: auditReason,
    target_profile_id: reqRow.claimant_profile_id,
    target_server_id: reqRow.server_id,
    metadata: { request_id: requestId, decision },
  } as never)

  return json({ ok: true })
})
