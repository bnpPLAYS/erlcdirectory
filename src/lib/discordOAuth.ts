import { getPublicSiteOrigin } from '@/lib/publicSiteUrl';

/**
 * Discord OAuth uses **one** redirect URL per environment: `{origin}/discord/callback`.
 * It must match Discord Developer Portal exactly — never vary by `/verify/:token` or other paths.
 *
 * - Optional `VITE_DISCORD_REDIRECT_URI` overrides everything (must match Portal).
 * - Otherwise we use the same canonical origin as public links (`getPublicSiteOrigin`), so preview
 *   hosts (*.vercel.app) still OAuth against `https://www.erlc.directory/discord/callback` — no extra
 *   Discord redirects per deployment URL.
 * - If `VITE_DISABLE_CANONICAL_HOST_REDIRECT=true` on a Vercel preview, we keep OAuth on the preview
 *   origin so sessionStorage and PKCE stay same-origin (add that preview `/discord/callback` once in Discord).
 */
export function getDiscordRedirectUri(): string {
  const explicit = import.meta.env.VITE_DISCORD_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    if (
      import.meta.env.VITE_DISABLE_CANONICAL_HOST_REDIRECT === 'true' &&
      window.location.hostname.endsWith('.vercel.app')
    ) {
      return `${window.location.origin}/discord/callback`;
    }

    const origin = getPublicSiteOrigin();
    if (origin) {
      return `${origin}/discord/callback`;
    }
  }

  return 'http://localhost:5173/discord/callback';
}

/** Must be the same Discord application as DISCORD_CLIENT_ID in Supabase Edge Function secrets. */
export function getDiscordClientId(): string {
  return import.meta.env.VITE_DISCORD_CLIENT_ID?.trim() || '1495931923237703792';
}
