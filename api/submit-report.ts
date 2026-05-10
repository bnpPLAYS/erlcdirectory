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
    review_id?: string | null;
    message_id?: string | null;
    conversation_id?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const kind = body.kind === 'message' ? 'message' : body.kind === 'review' ? 'review' : '';
  if (kind !== 'review' && kind !== 'message') {
    return json(400, { ok: false, error: 'Invalid kind' });
  }

  const reason = (body.reason ?? '').toString().trim();
  if (reason.length < 3 || reason.length > 2000) {
    return json(400, { ok: false, error: 'Reason must be 3–2000 characters.' });
  }

  const reviewId = body.review_id?.toString().trim() || '';
  const messageId = body.message_id?.toString().trim() || '';
  const conversationId = body.conversation_id?.toString().trim() || '';

  if (kind === 'review' && !UUID_RE.test(reviewId)) {
    return json(400, { ok: false, error: 'Invalid review_id' });
  }
  if (kind === 'message' && !UUID_RE.test(messageId)) {
    return json(400, { ok: false, error: 'Invalid message_id' });
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
    status: 'open',
  };
  if (kind === 'review') row.review_id = reviewId;
  if (kind === 'message') {
    row.message_id = messageId;
    if (conversationId) row.conversation_id = conversationId;
  }

  const { error: insErr } = await admin.from('moderation_reports').insert(row as never);
  if (insErr) {
    const msg = insErr.message || '';
    if (/relation|does not exist|schema cache/i.test(msg)) {
      return json(503, {
        ok: false,
        error:
          'moderation_reports table is missing. Run the SQL migration from supabase/migrations/20260530120000_staff_warnings_reports.sql in Supabase SQL Editor.',
      });
    }
    return json(400, { ok: false, error: msg });
  }

  return json(200, { ok: true });
}
