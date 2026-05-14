import { isCanarySiteHost } from '@/lib/canaryHost';
import { getPublicSiteOrigin } from '@/lib/publicSiteUrl';

/**
 * Discord OAuth uses **one** redirect URL per environment: `{origin}/discord/callback`.
 * It must match Discord Developer Portal exactly — never vary by `/verify/:token` or other paths.
 *
 * - **Canary** (`canary.erlc.directory`, or `VITE_FORCE_CANARY_GATE` for local gate testing): always uses
 *   the current browser origin. This ignores `VITE_DISCORD_REDIRECT_URI`, which is often set to production
 *   `www` on Vercel and would otherwise make Discord reject the authorize request (“Invalid OAuth2 redirect_uri”).
 * - Optional `VITE_DISCORD_REDIRECT_URI` overrides on **other** hosts (must match Portal).
 * - Otherwise we use the same canonical origin as public links (`getPublicSiteOrigin`), so preview
 *   hosts (*.vercel.app) still OAuth against `https://www.erlc.directory/discord/callback` — no extra
 *   Discord redirects per deployment URL.
 * - If `VITE_DISABLE_CANONICAL_HOST_REDIRECT=true` on a Vercel preview, we keep OAuth on the preview
 *   origin so sessionStorage and PKCE stay same-origin (add that preview `/discord/callback` once in Discord).
 */
export function getDiscordRedirectUri(): string {
  if (typeof window !== 'undefined' && isCanarySiteHost()) {
    return `${window.location.origin.replace(/\/+$/, '')}/discord/callback`;
  }

  const explicit = import.meta.env.VITE_DISCORD_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/+$/, '');
    const host = window.location.hostname.toLowerCase();

    if (
      import.meta.env.VITE_DISABLE_CANONICAL_HOST_REDIRECT === 'true' &&
      host.endsWith('.vercel.app')
    ) {
      return `${origin}/discord/callback`;
    }

    // Discord matches redirect_uri exactly. Use the same origin the user is on for apex vs www so it
    // matches Developer Portal entries (many teams only register one of erlc.directory / www.erlc.directory).
    if (host === 'erlc.directory' || host === 'www.erlc.directory') {
      return `${origin}/discord/callback`;
    }

    if (host.endsWith('.vercel.app')) {
      const pub = getPublicSiteOrigin();
      if (pub) return `${pub}/discord/callback`;
    }

    const pub = getPublicSiteOrigin();
    if (pub) {
      return `${pub}/discord/callback`;
    }

    return `${origin}/discord/callback`;
  }

  return 'http://localhost:5173/discord/callback';
}

const PROD_SITE_HOSTS = new Set(['www.erlc.directory', 'erlc.directory']);

/**
 * Supabase `generateLink` magic URLs include `redirect_to`. If that URL is only allowed as production
 * www/apex, Supabase may still emit www even when sign-in started on canary. Rewrite `redirect_to` to
 * the current origin when we are on the canary host so the browser returns to canary after the magic link.
 */
export function rewriteDiscordMagicLinkRedirectToCurrentOrigin(actionLink: string): string {
  if (typeof window === 'undefined') return actionLink;
  if (!isCanarySiteHost()) return actionLink;
  try {
    const u = new URL(actionLink);
    const raw = u.searchParams.get('redirect_to');
    if (!raw) return actionLink;
    let host = '';
    try {
      host = new URL(raw).hostname.toLowerCase();
    } catch {
      return actionLink;
    }
    if (!PROD_SITE_HOSTS.has(host)) return actionLink;
    const origin = window.location.origin.replace(/\/+$/, '');
    u.searchParams.set('redirect_to', `${origin}/`);
    return u.toString();
  } catch {
    return actionLink;
  }
}

/** Must be the same Discord application as DISCORD_CLIENT_ID in Supabase Edge Function secrets. */
export function getDiscordClientId(): string {
  return import.meta.env.VITE_DISCORD_CLIENT_ID?.trim() || '1495931923237703792';
}

const DISCORD_SIGNIN_MAX_AGE_MS = 15 * 60 * 1000;

export function isFreshDiscordSignInState(decoded: unknown): decoded is { kind: 'signin'; ts: number } {
  if (!decoded || typeof decoded !== 'object') return false;
  const o = decoded as { kind?: unknown; ts?: unknown };
  if (o.kind !== 'signin') return false;
  const ts = typeof o.ts === 'number' ? o.ts : NaN;
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= DISCORD_SIGNIN_MAX_AGE_MS;
}

/** Directory sign-in: Discord identify + guilds only (no email scope; matches experience verification). */
export function buildDiscordNativeSignInUrl(): string {
  const redirectUri = getDiscordRedirectUri();
  const clientId = getDiscordClientId();
  const state = btoa(JSON.stringify({ kind: 'signin' as const, ts: Date.now() }));
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  return `https://discord.com/oauth2/authorize?${q.toString()}`;
}
