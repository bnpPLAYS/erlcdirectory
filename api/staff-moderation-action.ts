export const config = { runtime: 'edge' };

import { createClient } from '@supabase/supabase-js';

/** Must match `is_site_owner()` / `isSiteOwnerDiscordUsername` in the app. */
function isSiteOwnerDiscordUsername(username: string | null | undefined): boolean {
  if (username == null || typeof username !== 'string') return false;
  const normalized = username.trim().toLowerCase().replace(/\.+$/u, '');
  return normalized === 'pixelnovaa';
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Action = 'delete_message' | 'delete_review' | 'remove_server' | 'warn' | 'ban';

async function assertStaff(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ ok: true; staffProfileId: string } | { ok: false; error: string }> {
  const { data: actor, error } = await admin
    .from('profiles')
    .select('id, discord_username')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !actor?.id) return { ok: false, error: 'Staff profile not found.' };
  if (isSiteOwnerDiscordUsername(actor.discord_username)) return { ok: true, staffProfileId: actor.id };
  const { data: role } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (!role) return { ok: false, error: 'Not authorized.' };
  return { ok: true, staffProfileId: actor.id };
}

async function subjectProfileIdForReport(
  admin: ReturnType<typeof createClient>,
  report: {
    kind: string;
    message_id: string | null;
    review_id: string | null;
    server_id: string | null;
  },
): Promise<string | null> {
  if (report.kind === 'message' && report.message_id) {
    const { data: m } = await admin.from('messages').select('sender_id').eq('id', report.message_id).maybeSingle();
    return m?.sender_id ?? null;
  }
  if (report.kind === 'review' && report.review_id) {
    const { data: r } = await admin.from('reviews').select('reviewer_id').eq('id', report.review_id).maybeSingle();
    return r?.reviewer_id ?? null;
  }
  if (report.kind === 'server' && report.server_id) {
    const { data: s } = await admin.from('servers').select('owner_id').eq('id', report.server_id).maybeSingle();
    return s?.owner_id ?? null;
  }
  return null;
}

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
    report_id?: string;
    action?: string;
    warn_body?: string;
    staff_notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const reportId = (body.report_id ?? '').toString().trim();
  const action = (body.action ?? '').toString().trim() as Action;
  const warnBody = (body.warn_body ?? '').toString().trim();
  const staffNotes = (body.staff_notes ?? '').toString().trim().slice(0, 2000) || null;

  const allowed: Action[] = ['delete_message', 'delete_review', 'remove_server', 'warn', 'ban'];
  if (!UUID_RE.test(reportId) || !allowed.includes(action)) {
    return json(400, { ok: false, error: 'Invalid request.' });
  }

  if (action === 'warn' && (warnBody.length < 1 || warnBody.length > 2000)) {
    return json(400, { ok: false, error: 'Warning text must be 1–2000 characters.' });
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
  const staff = await assertStaff(admin, user.id);
  if (!staff.ok) return json(403, { ok: false, error: staff.error });

  const { data: report, error: repErr } = await admin
    .from('moderation_reports')
    .select('id, kind, status, message_id, review_id, server_id')
    .eq('id', reportId)
    .maybeSingle();

  if (repErr || !report) {
    return json(404, { ok: false, error: 'Report not found.' });
  }
  if (report.status !== 'open') {
    return json(400, { ok: false, error: 'Report is already closed.' });
  }

  const subjectId = await subjectProfileIdForReport(admin, report);

  try {
    if (action === 'delete_message') {
      if (report.kind !== 'message' || !report.message_id) {
        return json(400, { ok: false, error: 'This report is not a message report.' });
      }
      const { error: delErr } = await admin.from('messages').delete().eq('id', report.message_id);
      if (delErr) return json(400, { ok: false, error: delErr.message });
    } else if (action === 'delete_review') {
      if (report.kind !== 'review' || !report.review_id) {
        return json(400, { ok: false, error: 'This report is not a review report.' });
      }
      const { error: delErr } = await admin.from('reviews').delete().eq('id', report.review_id);
      if (delErr) return json(400, { ok: false, error: delErr.message });
    } else if (action === 'remove_server') {
      if (report.kind !== 'server' || !report.server_id) {
        return json(400, { ok: false, error: 'This report is not a server report.' });
      }
      const { error: delErr } = await admin.from('servers').delete().eq('id', report.server_id);
      if (delErr) return json(400, { ok: false, error: delErr.message });
    } else if (action === 'warn') {
      if (!subjectId) {
        return json(400, { ok: false, error: 'No member linked to this report (nothing to warn).' });
      }
      const { error: wErr } = await admin.from('profile_warnings').insert({
        subject_profile_id: subjectId,
        issued_by_profile_id: staff.staffProfileId,
        body: warnBody,
      } as never);
      if (wErr) return json(400, { ok: false, error: wErr.message });
    } else if (action === 'ban') {
      if (!subjectId) {
        return json(400, { ok: false, error: 'No member linked to this report (nothing to ban).' });
      }
      const { data: sub, error: subErr } = await admin
        .from('profiles')
        .select('user_id')
        .eq('id', subjectId)
        .maybeSingle();
      if (subErr || !sub?.user_id) {
        return json(400, { ok: false, error: 'Subject has no login account to ban.' });
      }
      if (sub.user_id === user.id) {
        return json(400, { ok: false, error: 'You cannot ban your own account.' });
      }
      const bannedAt = new Date().toISOString();
      const { error: banErr } = await admin.auth.admin.updateUserById(sub.user_id, {
        ban_duration: '876000h',
      });
      if (banErr) {
        return json(400, { ok: false, error: banErr.message || 'Auth ban failed.' });
      }
      const { error: profBanErr } = await admin
        .from('profiles')
        .update({ banned_at: bannedAt })
        .eq('id', subjectId);
      if (profBanErr) {
        return json(400, { ok: false, error: profBanErr.message });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Action failed';
    return json(500, { ok: false, error: msg });
  }

  const { error: upErr } = await admin
    .from('moderation_reports')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      staff_notes: staffNotes,
    })
    .eq('id', reportId);

  if (upErr) return json(400, { ok: false, error: upErr.message });

  return json(200, { ok: true });
}
