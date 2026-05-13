/**
 * Submits a moderation report on behalf of the signed-in user.
 * Mirrors api/submit-report.ts but runs on Supabase where SUPABASE_SERVICE_ROLE_KEY is auto-injected.
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

const REPORT_CATEGORIES = new Set([
  'harassment',
  'spam',
  'hate',
  'impersonation',
  'scam',
  'nsfw',
  'copyright',
  'other',
  'bug',
])

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
    kind?: string
    reason?: string
    report_category?: string
    review_id?: string | null
    message_id?: string | null
    conversation_id?: string | null
    server_id?: string | null
    page_path?: string | null
    user_agent?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const kindRaw = (body.kind ?? '').toString()
  const kind =
    kindRaw === 'message'
      ? 'message'
      : kindRaw === 'review'
        ? 'review'
        : kindRaw === 'server'
          ? 'server'
          : kindRaw === 'bug'
            ? 'bug'
            : ''
  if (kind !== 'review' && kind !== 'message' && kind !== 'server' && kind !== 'bug') {
    return json({ ok: false, error: 'Invalid kind' }, 400)
  }

  const catRaw = (body.report_category ?? (kind === 'bug' ? 'bug' : 'other')).toString().trim()
  const report_category = REPORT_CATEGORIES.has(catRaw) ? catRaw : null
  if (!report_category) {
    return json({ ok: false, error: 'Invalid report category' }, 400)
  }
  if (kind === 'bug' && report_category !== 'bug') {
    return json({ ok: false, error: 'Bug reports must use report_category bug.' }, 400)
  }

  const reason = (body.reason ?? '').toString().trim()
  const minLen =
    kind === 'bug' ? 12 : report_category === 'other' ? 8 : 3
  if (reason.length < minLen || reason.length > 2000) {
    return json(
      {
        ok: false,
        error:
          kind === 'bug'
            ? 'Describe the bug in at least 12 characters (what broke, what you expected).'
            : report_category === 'other'
              ? 'Please explain the issue (8–2000 characters) when you choose Other.'
              : 'Details must be 3–2000 characters.',
      },
      400,
    )
  }

  const reviewId = body.review_id?.toString().trim() || ''
  const messageId = body.message_id?.toString().trim() || ''
  const conversationId = body.conversation_id?.toString().trim() || ''
  const serverId = body.server_id?.toString().trim() || ''
  const pagePath = (body.page_path ?? '').toString().trim().slice(0, 2000)
  const userAgent = (body.user_agent ?? '').toString().trim().slice(0, 800)

  if (kind === 'review' && !UUID_RE.test(reviewId)) {
    return json({ ok: false, error: 'Invalid review_id' }, 400)
  }
  if (kind === 'message' && !UUID_RE.test(messageId)) {
    return json({ ok: false, error: 'Invalid message_id' }, 400)
  }
  if (kind === 'server' && !UUID_RE.test(serverId)) {
    return json({ ok: false, error: 'Invalid server_id' }, 400)
  }
  if (conversationId && !UUID_RE.test(conversationId)) {
    return json({ ok: false, error: 'Invalid conversation_id' }, 400)
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
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profErr || !profile?.id) {
    return json({ ok: false, error: 'Profile not found for this account.' }, 400)
  }

  const row: Record<string, unknown> = {
    reporter_profile_id: profile.id,
    kind,
    reason,
    report_category,
    status: 'open',
  }
  if (kind === 'review') row.review_id = reviewId
  if (kind === 'message') {
    row.message_id = messageId
    if (conversationId) row.conversation_id = conversationId
  }
  if (kind === 'server') row.server_id = serverId
  if (kind === 'bug') {
    if (pagePath) row.page_path = pagePath
    if (userAgent) row.user_agent = userAgent
  }

  const { error: insErr } = await admin.from('moderation_reports').insert(row as never)
  if (insErr) {
    const msg = insErr.message || ''
    if (/relation|does not exist|schema cache|report_category|server_id|page_path|user_agent|moderation_reports_kind/i.test(msg)) {
      return json(
        {
          ok: false,
          error:
            'Reporting schema is behind this build. In Supabase SQL Editor, apply migrations through 20260628140000_moderation_reports_bug_context.sql (and earlier moderation_reports migrations).',
        },
        503,
      )
    }
    return json({ ok: false, error: msg }, 400)
  }

  return json({ ok: true })
})
