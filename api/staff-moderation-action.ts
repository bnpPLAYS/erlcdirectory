export const config = { runtime: 'edge' };

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Edge route: no generated Database generic; `ReturnType<typeof createClient>` breaks under `tsc --strict`. */
type SbClient = SupabaseClient<any, 'public', any>;

function isSiteOwnerDiscordUsername(username: string | null | undefined): boolean {
  if (username == null || typeof username !== 'string') return false;
  const normalized = username.trim().toLowerCase().replace(/\.+$/u, '');
  return normalized === 'pixelnovaa';
}

function auditReasonAtLeast10(
  primary: string | null | undefined,
  fallback: string | null | undefined,
  tail: string,
): string {
  const a = (primary ?? '').trim();
  const b = (fallback ?? '').trim();
  const base =
    a.length >= 10 ? a : a.length > 0 ? `${a} — ${tail}` : b.length >= 10 ? b : b.length > 0 ? `${b} — ${tail}` : tail;
  const out = base.trim().slice(0, 2000);
  return out.length >= 10 ? out : `${out} (record)`.slice(0, 2000);
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

type StaffActor =
  | { ok: true; staffProfileId: string; isSiteOwner: boolean }
  | { ok: false; error: string };

async function getStaffActor(
  admin: SbClient,
  userId: string,
): Promise<StaffActor> {
  const { data: actor, error } = await admin
    .from('profiles')
    .select('id, discord_username')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !actor?.id) return { ok: false, error: 'Staff profile not found.' };
  const du = (actor.discord_username as string | null) ?? null;
  if (isSiteOwnerDiscordUsername(du)) {
    return { ok: true, staffProfileId: actor.id as string, isSiteOwner: true };
  }
  const { data: role } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (!role) return { ok: false, error: 'Not authorized.' };
  return { ok: true, staffProfileId: actor.id as string, isSiteOwner: false };
}

async function insertAudit(
  admin: SbClient,
  row: {
    actor_profile_id: string | null;
    actor_user_id: string;
    action: string;
    reason: string;
    target_profile_id?: string | null;
    target_server_id?: string | null;
    report_id?: string | null;
    metadata?: Record<string, unknown>;
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
  } as never);
  if (error) return { ok: false, error: error.message || 'Audit log failed.' };
  return { ok: true };
}

async function assertBanRateOk(
  admin: SbClient,
  actorUserId: string,
  isSiteOwner: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isSiteOwner) return { ok: true };
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from('staff_audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('actor_user_id', actorUserId)
    .in('action', ['ban_member', 'remove_profile'])
    .gte('created_at', since);
  if (error) return { ok: false, error: error.message || 'Rate check failed.' };
  if ((count ?? 0) >= 2) {
    return {
      ok: false,
      error:
        'You can perform at most two member bans or profile removals combined per hour. Try again later or ask the site owner.',
    };
  }
  return { ok: true };
}

async function subjectProfileIdForReport(
  admin: SbClient,
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
    reason?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const reportId = (body.report_id ?? '').toString().trim();
  const action = (body.action ?? '').toString().trim() as Action;
  const warnBody = (body.warn_body ?? '').toString().trim();
  const staffNotes = (body.staff_notes ?? '').toString().trim().slice(0, 2000) || null;
  const extraReason = (body.reason ?? '').toString().trim();

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
  const staff = await getStaffActor(admin, user.id);
  if (!staff.ok) return json(403, { ok: false, error: staff.error });

  const { data: report, error: repErr } = await admin
    .from('moderation_reports')
    .select('id, kind, status, message_id, review_id, server_id, reason')
    .eq('id', reportId)
    .maybeSingle();

  if (repErr || !report) {
    return json(404, { ok: false, error: 'Report not found.' });
  }
  if (report.status !== 'open') {
    return json(400, { ok: false, error: 'Report is already closed.' });
  }

  const reportReason = (report.reason as string | null) ?? null;

  if (!staff.isSiteOwner && action === 'ban' && extraReason.length < 10) {
    return json(400, {
      ok: false,
      error: 'Provide reason (at least 10 characters) when banning from a report.',
    });
  }
  if (!staff.isSiteOwner && action === 'remove_server' && extraReason.length < 10) {
    return json(400, {
      ok: false,
      error: 'Provide reason (at least 10 characters) when removing a server from a report.',
    });
  }

  const subjectId = await subjectProfileIdForReport(admin, report);

  let auditAction = '';
  let auditReason = '';
  const targetProfile: string | null = subjectId;
  const targetServer: string | null = (report.server_id as string | null) ?? null;

  try {
    if (action === 'delete_message') {
      auditAction = 'mod_delete_message';
      auditReason = auditReasonAtLeast10(extraReason, staffNotes, reportReason ?? 'Message report');
      if (report.kind !== 'message' || !report.message_id) {
        return json(400, { ok: false, error: 'This report is not a message report.' });
      }
      const { error: delErr } = await admin.from('messages').delete().eq('id', report.message_id);
      if (delErr) return json(400, { ok: false, error: delErr.message });
    } else if (action === 'delete_review') {
      auditAction = 'mod_delete_review';
      auditReason = auditReasonAtLeast10(extraReason, staffNotes, reportReason ?? 'Review report');
      if (report.kind !== 'review' || !report.review_id) {
        return json(400, { ok: false, error: 'This report is not a review report.' });
      }
      const { error: delErr } = await admin.from('reviews').delete().eq('id', report.review_id);
      if (delErr) return json(400, { ok: false, error: delErr.message });
    } else if (action === 'remove_server') {
      auditAction = 'mod_remove_server';
      auditReason = staff.isSiteOwner
        ? auditReasonAtLeast10(extraReason, staffNotes, reportReason ?? 'Server report')
        : extraReason.slice(0, 2000);
      if (report.kind !== 'server' || !report.server_id) {
        return json(400, { ok: false, error: 'This report is not a server report.' });
      }
      const { error: delErr } = await admin.from('servers').delete().eq('id', report.server_id);
      if (delErr) return json(400, { ok: false, error: delErr.message });
    } else if (action === 'warn') {
      auditAction = 'mod_warn';
      auditReason = auditReasonAtLeast10(warnBody, staffNotes, reportReason ?? 'Warning issued');
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
      auditAction = 'ban_member';
      auditReason = staff.isSiteOwner
        ? auditReasonAtLeast10(extraReason, staffNotes, reportReason ?? 'Ban from report')
        : extraReason.slice(0, 2000);
      if (!subjectId) {
        return json(400, { ok: false, error: 'No member linked to this report (nothing to ban).' });
      }
      const { data: sub, error: subErr } = await admin
        .from('profiles')
        .select('user_id, discord_username')
        .eq('id', subjectId)
        .maybeSingle();
      if (subErr || !sub?.user_id) {
        return json(400, { ok: false, error: 'Subject has no login account to ban.' });
      }
      if (isSiteOwnerDiscordUsername(sub.discord_username as string | null)) {
        return json(403, { ok: false, error: 'Cannot ban the site owner account.' });
      }
      if (sub.user_id === user.id) {
        return json(400, { ok: false, error: 'You cannot ban your own account.' });
      }
      const rate = await assertBanRateOk(admin, user.id, staff.isSiteOwner);
      if (!rate.ok) return json(429, { ok: false, error: rate.error });
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

  const log = await insertAudit(admin, {
    actor_profile_id: staff.staffProfileId,
    actor_user_id: user.id,
    action: auditAction,
    reason: auditReason,
    target_profile_id: targetProfile,
    target_server_id: null,
    report_id: reportId,
    metadata:
      action === 'remove_server' && targetServer
        ? { moderation_action: action, deleted_server_id: targetServer }
        : { moderation_action: action },
  });
  if (!log.ok) return json(400, { ok: false, error: log.error });

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
