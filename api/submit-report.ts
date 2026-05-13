export const config = { runtime: 'edge' };

import { createClient } from '@supabase/supabase-js';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
]);

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { ok: false, error: 'Unauthorized' });
  const jwt = authHeader.slice(7).trim();

  const ref = process.env.VITE_SUPABASE_PROJECT_ID?.trim();
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    (ref ? `https://${ref}.supabase.co` : '')
  )
    .trim()
    .replace(/\/$/, '');
  const anonKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { ok: false, error: 'Server missing Supabase configuration.' });
  }

  let body: {
    kind?: string;
    reason?: string;
    report_category?: string;
    review_id?: string | null;
    message_id?: string | null;
    conversation_id?: string | null;
    server_id?: string | null;
    page_path?: string | null;
    user_agent?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const kindRaw = (body.kind ?? '').toString();
  const kind =
    kindRaw === 'message'
      ? 'message'
      : kindRaw === 'review'
        ? 'review'
        : kindRaw === 'server'
          ? 'server'
          : kindRaw === 'bug'
            ? 'bug'
            : '';
  if (kind !== 'review' && kind !== 'message' && kind !== 'server' && kind !== 'bug') {
    return json(400, { ok: false, error: 'Invalid kind' });
  }

  const catRaw = (body.report_category ?? (kind === 'bug' ? 'bug' : 'other')).toString().trim();
  const report_category = REPORT_CATEGORIES.has(catRaw) ? catRaw : null;
  if (!report_category) {
    return json(400, { ok: false, error: 'Invalid report category' });
  }
  if (kind === 'bug' && report_category !== 'bug') {
    return json(400, { ok: false, error: 'Bug reports must use report_category bug.' });
  }

  const reason = (body.reason ?? '').toString().trim();
  const minLen = kind === 'bug' ? 12 : report_category === 'other' ? 8 : 3;
  if (reason.length < minLen || reason.length > 2000) {
    return json(400, {
      ok: false,
      error:
        kind === 'bug'
          ? 'Describe the bug in at least 12 characters (what broke, what you expected).'
          : report_category === 'other'
            ? 'Please explain the issue (8–2000 characters) when you choose Other.'
            : 'Details must be 3–2000 characters.',
    });
  }

  const reviewId = body.review_id?.toString().trim() || '';
  const messageId = body.message_id?.toString().trim() || '';
  const conversationId = body.conversation_id?.toString().trim() || '';
  const serverId = body.server_id?.toString().trim() || '';
  const pagePath = (body.page_path ?? '').toString().trim().slice(0, 2000);
  const userAgent = (body.user_agent ?? '').toString().trim().slice(0, 800);

  if (kind === 'review' && !UUID_RE.test(reviewId)) {
    return json(400, { ok: false, error: 'Invalid review_id' });
  }
  if (kind === 'message' && !UUID_RE.test(messageId)) {
    return json(400, { ok: false, error: 'Invalid message_id' });
  }
  if (kind === 'server' && !UUID_RE.test(serverId)) {
    return json(400, { ok: false, error: 'Invalid server_id' });
  }
  if (conversationId && !UUID_RE.test(conversationId)) {
    return json(400, { ok: false, error: 'Invalid conversation_id' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt);
  if (userErr || !user) return json(401, { ok: false, error: 'Invalid session' });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profErr || !profile?.id) {
    return json(400, { ok: false, error: 'Profile not found for this account.' });
  }

  const row: Record<string, unknown> = {
    reporter_profile_id: profile.id,
    kind,
    reason,
    report_category,
    status: 'open',
  };
  if (kind === 'review') row.review_id = reviewId;
  if (kind === 'message') {
    row.message_id = messageId;
    if (conversationId) row.conversation_id = conversationId;
  }
  if (kind === 'server') row.server_id = serverId;
  if (kind === 'bug') {
    if (pagePath) row.page_path = pagePath;
    if (userAgent) row.user_agent = userAgent;
  }

  const { error: insErr } = await admin.from('moderation_reports').insert(row as never);
  if (insErr) {
    const msg = insErr.message || '';
    if (/relation|does not exist|schema cache|report_category|server_id|page_path|user_agent|moderation_reports_kind/i.test(msg)) {
      return json(503, {
        ok: false,
        error:
          'Reporting schema is behind this build. In Supabase SQL Editor, apply migrations through 20260628140000_moderation_reports_bug_context.sql (and earlier moderation_reports migrations).',
      });
    }
    return json(400, { ok: false, error: msg });
  }

  return json(200, { ok: true });
}
