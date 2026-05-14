/**
 * Primary staff / site owner — must match RLS `is_site_owner()` in Supabase.
 * Client check is for UX only; all staff actions are enforced in Postgres policies.
 */
export function isSiteOwnerDiscordUsername(username: string | null | undefined): boolean {
  if (username == null || typeof username !== 'string') return false;
  const normalized = username.trim().toLowerCase().replace(/\.+$/u, '');
  return normalized === 'pixelnovaa';
}
