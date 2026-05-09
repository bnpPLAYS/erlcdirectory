/**
 * Discord OAuth for this app uses redirect `/discord/callback` on the same origin
 * as the site, unless VITE_DISCORD_REDIRECT_URI is set (must match Discord Portal exactly).
 *
 * Experience verification uses the same redirect as Supabase sign-in so one URL can be whitelisted.
 */
export function getDiscordRedirectUri(): string {
  const explicit = import.meta.env.VITE_DISCORD_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/discord/callback`;
  }
  return 'http://localhost:5173/discord/callback';
}

/** Must be the same Discord application as DISCORD_CLIENT_ID in Supabase Edge Function secrets. */
export function getDiscordClientId(): string {
  return import.meta.env.VITE_DISCORD_CLIENT_ID?.trim() || '1495931923237703792';
}
