export const config = { runtime: 'edge' };

import { createClient } from '@supabase/supabase-js';

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

type StaffActor =
  | { ok: true; staffProfileId: string; isSiteOwner: boolean }
  | { ok: false; error: string };

async function getStaffActor(
  admin: ReturnType<typeof createClient>,
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
  admin: ReturnType<typeof createClient>,
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

async function assertMemberActionRateOk(
  admin: ReturnType<typeof createClient>,
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

async function loadProfile(admin: ReturnType<typeof createClient>, id: string) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, user_id, discord_username')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; user_id: string | null; discord_username: string | null };
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
    action?: string;
    reason?: string;
    profile_id?: string;
    server_id?: string;
    profile_patch?: { is_verified?: boolean; is_featured?: boolean; is_pro?: boolean };
    is_verified?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const action = (body.action ?? '').toString().trim();
  const rawReason = (body.reason ?? '').toString().trim();
  const profileId = (body.profile_id ?? '').toString().trim();
  const serverId = (body.server_id ?? '').toString().trim();

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt);
  if (userErr || !user) return json(401, { ok: false, error: 'Invalid session' });

  const admin = createClient(supabaseUrl, serviceKey);
  const actor = await getStaffActor(admin, user.id);
  if (!actor.ok) return json(403, { ok: false, error: actor.error });

  if (!actor.isSiteOwner && rawReason.length < 10) {
    return json(400, { ok: false, error: 'Provide a reason (at least 10 characters) for this action.' });
  }

  const effectiveReason = actor.isSiteOwner
    ? auditReasonAtLeast10(rawReason, null, 'Site owner action via staff panel')
    : rawReason.slice(0, 2000);

  const allowed = [
    'delete_server',
    'ban_profile',
    'remove_profile',
    'set_profile_flags',
    'set_server_verified',
  ] as const;
  if (!allowed.includes(action as (typeof allowed)[number])) {
    return json(400, { ok: false, error: 'Invalid action.' });
  }

  const assertNotTargetOwner = async (pid: string | null | undefined) => {
    if (!pid || !UUID_RE.test(pid)) return { ok: true as const };
    const p = await loadProfile(admin, pid);
    if (p && isSiteOwnerDiscordUsername(p.discord_username)) {
      return { ok: false as const, error: 'This action cannot target the site owner account.' };
    }
    return { ok: true as const };
  };

  try {
    if (action === 'delete_server') {
      if (!UUID_RE.test(serverId)) return json(400, { ok: false, error: 'Invalid server.' });
      const { error: delErr } = await admin.from('servers').delete().eq('id', serverId);
      if (delErr) return json(400, { ok: false, error: delErr.message });
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'delete_server',
        reason: effectiveReason,
        target_server_id: null,
        metadata: { deleted_server_id: serverId },
      });
      if (!a.ok) return json(400, { ok: false, error: a.error });
      return json(200, { ok: true });
    }

    if (action === 'ban_profile') {
      if (!UUID_RE.test(profileId)) return json(400, { ok: false, error: 'Invalid profile.' });
      const nt = await assertNotTargetOwner(profileId);
      if (!nt.ok) return json(403, { ok: false, error: nt.error });
      const sub = await loadProfile(admin, profileId);
      if (!sub?.user_id) return json(400, { ok: false, error: 'Member has no login to ban.' });
      if (sub.user_id === user.id) return json(400, { ok: false, error: 'You cannot ban your own account.' });
      const rate = await assertMemberActionRateOk(admin, user.id, actor.isSiteOwner);
      if (!rate.ok) return json(429, { ok: false, error: rate.error });
      const { error: banErr } = await admin.auth.admin.updateUserById(sub.user_id, { ban_duration: '876000h' });
      if (banErr) return json(400, { ok: false, error: banErr.message || 'Auth ban failed.' });
      const bannedAt = new Date().toISOString();
      const { error: profBanErr } = await admin.from('profiles').update({ banned_at: bannedAt }).eq('id', profileId);
      if (profBanErr) return json(400, { ok: false, error: profBanErr.message });
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'ban_member',
        reason: effectiveReason,
        target_profile_id: profileId,
        metadata: { source: 'staff_directory' },
      });
      if (!a.ok) return json(400, { ok: false, error: a.error });
      return json(200, { ok: true });
    }

    if (action === 'remove_profile') {
      if (!UUID_RE.test(profileId)) return json(400, { ok: false, error: 'Invalid profile.' });
      const nt = await assertNotTargetOwner(profileId);
      if (!nt.ok) return json(403, { ok: false, error: nt.error });
      const rate = await assertMemberActionRateOk(admin, user.id, actor.isSiteOwner);
      if (!rate.ok) return json(429, { ok: false, error: rate.error });
      const { error: delErr } = await admin.from('profiles').delete().eq('id', profileId);
      if (delErr) return json(400, { ok: false, error: delErr.message });
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'remove_profile',
        reason: effectiveReason,
        target_profile_id: null,
        metadata: { deleted_profile_id: profileId },
      });
      if (!a.ok) return json(400, { ok: false, error: a.error });
      return json(200, { ok: true });
    }

    if (action === 'set_profile_flags') {
      if (!UUID_RE.test(profileId)) return json(400, { ok: false, error: 'Invalid profile.' });
      const nt = await assertNotTargetOwner(profileId);
      if (!nt.ok) return json(403, { ok: false, error: nt.error });
      const patch = body.profile_patch ?? {};
      const has =
        typeof patch.is_verified === 'boolean' ||
        typeof patch.is_featured === 'boolean' ||
        typeof patch.is_pro === 'boolean';
      if (!has) return json(400, { ok: false, error: 'profile_patch must include at least one flag.' });
      const row: Record<string, unknown> = {};
      if (typeof patch.is_verified === 'boolean') row.is_verified = patch.is_verified;
      if (typeof patch.is_featured === 'boolean') row.is_featured = patch.is_featured;
      if (typeof patch.is_pro === 'boolean') {
        row.is_pro = patch.is_pro;
        row.pro_verified_at = patch.is_pro ? new Date().toISOString() : null;
      }
      const { error: upErr } = await admin.from('profiles').update(row).eq('id', profileId);
      if (upErr) return json(400, { ok: false, error: upErr.message });
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'set_profile_flags',
        reason: effectiveReason,
        target_profile_id: profileId,
        metadata: { patch },
      });
      if (!a.ok) return json(400, { ok: false, error: a.error });
      return json(200, { ok: true });
    }

    if (action === 'set_server_verified') {
      if (!UUID_RE.test(serverId)) return json(400, { ok: false, error: 'Invalid server.' });
      const v = body.is_verified;
      if (typeof v !== 'boolean') return json(400, { ok: false, error: 'is_verified boolean required.' });
      const { error: upErr } = await admin.from('servers').update({ is_verified: v }).eq('id', serverId);
      if (upErr) return json(400, { ok: false, error: upErr.message });
      const a = await insertAudit(admin, {
        actor_profile_id: actor.staffProfileId,
        actor_user_id: user.id,
        action: 'set_server_verified',
        reason: effectiveReason,
        target_server_id: serverId,
        metadata: { is_verified: v },
      });
      if (!a.ok) return json(400, { ok: false, error: a.error });
      return json(200, { ok: true });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Action failed';
    return json(500, { ok: false, error: msg });
  }

  return json(500, { ok: false, error: 'Unhandled.' });
}
