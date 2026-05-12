/**
 * Send visitors to the public domain instead of *.vercel.app deployment URLs.
 *
 * - Set `VITE_DISABLE_CANONICAL_HOST_REDIRECT=true` on Vercel **Preview** if you need to test on *.vercel.app.
 * - Optional `VITE_CANONICAL_SITE_URL` overrides the destination (default https://www.erlc.directory).
 */
export function getCanonicalSiteBaseUrl(): string {
  const fromEnv =
    import.meta.env.VITE_CANONICAL_SITE_URL?.trim() ||
    import.meta.env.VITE_PUBLIC_SITE_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'https://www.erlc.directory';
}

/**
 * If Supabase OAuth returns PKCE `code`+`state` on the wrong path (e.g. `/` when redirect URL
 * is misconfigured), rewrite to `/discord/callback` so `DiscordCallback` can run `exchangeCodeForSession`.
 * Call synchronously in main.tsx before React boot.
 */
export function normalizeOAuthCallbackPath(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let search = url.search;
  let hash = url.hash;

  if ((!url.searchParams.get('code') || !url.searchParams.get('state')) && url.hash.length > 1) {
    const hp = new URLSearchParams(url.hash.slice(1));
    const codeH = hp.get('code');
    const stateH = hp.get('state');
    if (codeH && stateH) {
      search = `?${hp.toString()}`;
      hash = '';
    }
  }

  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (!sp.get('code') || !sp.get('state')) return;
  if (url.pathname === '/discord/callback' || url.pathname.endsWith('/discord/callback')) return;

  url.pathname = '/discord/callback';
  url.search = search.startsWith('?') ? search : `?${search}`;
  url.hash = hash;
  window.location.replace(url.toString());
}

/** Full URL to send the browser to, or null if the current host is already correct. */
export function getCanonicalRedirectUrl(): string | null {
  if (typeof window === 'undefined') return null;
  if (import.meta.env.VITE_DISABLE_CANONICAL_HOST_REDIRECT === 'true') return null;

  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return null;

  const base = getCanonicalSiteBaseUrl();
  let canonicalHost: string;
  try {
    canonicalHost = new URL(base).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (host === canonicalHost) return null;

  if (canonicalHost === 'www.erlc.directory' && host === 'erlc.directory') {
    return `${base}${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  if (host.endsWith('.vercel.app')) {
    return `${base}${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  return null;
}

/**
 * Avoid redirecting away from `/discord/callback` while OAuth params are present.
 * Otherwise PKCE code_verifier (in localStorage) and the callback host can mismatch
 * (e.g. *.vercel.app → www), and the session is never established.
 */
export function shouldDeferCanonicalRedirectForOAuthCallback(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  if (path !== '/discord/callback' && !path.endsWith('/discord/callback')) return false;

  const q = window.location.search;
  const hash = window.location.hash.length > 1 ? window.location.hash.slice(1) : '';
  return (
    q.includes('code=') ||
    q.includes('error=') ||
    hash.includes('code=') ||
    hash.includes('access_token=') ||
    hash.includes('error=')
  );
}
