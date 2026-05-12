import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'

/** Mirror `public.is_site_owner()` — Discord username pixelnovaa (optional trailing dots). */
export function isSiteOwnerDiscordUsername(username: string | null | undefined): boolean {
  if (username == null || typeof username !== 'string') return false
  const normalized = username.trim().toLowerCase().replace(/\.+$/u, '')
  return normalized === 'pixelnovaa'
}

export type StaffActor =
  | { ok: true; staffProfileId: string; discordUsername: string | null; isSiteOwner: boolean }
  | { ok: false; error: string }

export async function getStaffActor(
  admin: SupabaseClient,
  userId: string,
): Promise<StaffActor> {
  const { data: actor, error } = await admin
    .from('profiles')
    .select('id, discord_username')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !actor?.id) return { ok: false, error: 'Staff profile not found.' }
  const du = (actor.discord_username as string | null) ?? null
  const isSiteOwner = isSiteOwnerDiscordUsername(du)
  if (isSiteOwner) {
    return { ok: true, staffProfileId: actor.id as string, discordUsername: du, isSiteOwner: true }
  }
  const { data: role } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  if (!role) return { ok: false, error: 'Not authorized.' }
  return { ok: true, staffProfileId: actor.id as string, discordUsername: du, isSiteOwner: false }
}

export function auditReasonAtLeast10(
  primary: string | null | undefined,
  fallback: string | null | undefined,
  tail: string,
): string {
  const a = (primary ?? '').trim()
  const b = (fallback ?? '').trim()
  const base =
    a.length >= 10 ? a : a.length > 0 ? `${a} — ${tail}` : b.length >= 10 ? b : b.length > 0 ? `${b} — ${tail}` : tail
  const out = base.trim().slice(0, 2000)
  return out.length >= 10 ? out : `${out} (record)`.slice(0, 2000)
}
