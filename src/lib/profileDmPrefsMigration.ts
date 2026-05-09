/**
 * Supabase/PostgREST returns this when `profiles.dm_website_updates` /
 * `dm_experience_status_updates` are missing (migration
 * `20260512120000_profile_discord_dm_prefs.sql` not applied).
 */
export function isProfileDmPrefsSchemaError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    /dm_website_updates|dm_experience_status_updates/i.test(message) ||
    (/schema cache/i.test(message) && /dm_/i.test(message))
  );
}
