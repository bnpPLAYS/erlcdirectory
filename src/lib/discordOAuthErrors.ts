/** Supabase Auth redirects here with error_description when GoTrue fails the Discord token exchange. */

export function getSupabaseDiscordCallbackUrl(): string {
  const ref = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim();
  if (ref && ref !== 'YOUR_PROJECT_REF') {
    return `https://${ref}.supabase.co/auth/v1/callback`;
  }
  return 'https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback';
}

export function parseOAuthErrorDescription(raw: string | null): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

export type DiscordOAuthFailureSource = 'redirect' | 'exchange';

/**
 * Short, user-facing copy only — raw provider errors are logged in DiscordCallback.
 */
export function getPublicDiscordSignInMessage(params: {
  oauthErrorCode: string | null;
  rawDescription: string;
  source: DiscordOAuthFailureSource;
}): string {
  const raw = params.rawDescription.trim();
  const d = raw.toLowerCase();

  if (params.source === 'exchange' && d.includes('code verifier')) {
    return 'That sign-in link expired. Start over from the site.';
  }

  if (
    d.includes('error getting user email') ||
    d.includes('email from external provider') ||
    d.includes('unable to get email')
  ) {
    return 'Discord sign-in bailed. Close this tab and hit Sign in on the site again.';
  }

  if (params.oauthErrorCode === 'access_denied' || d === 'access_denied' || d.includes('access denied')) {
    return 'Cancelled.';
  }

  if (isDiscordTokenExchangeFailure(raw)) {
    return 'Discord connection failed. Try again in a bit.';
  }

  if (params.oauthErrorCode === 'server_error' || d.includes('server_error')) {
    return 'Discord had a hiccup. Try again.';
  }

  return 'Sign-in failed. Try again from the site.';
}

/** Messages Supabase returns when Discord client secret / redirect URIs are misconfigured. */
export function isDiscordTokenExchangeFailure(detail: string): boolean {
  const d = detail.toLowerCase();
  return (
    d.includes('unable to exchange external code') ||
    d.includes('exchange external code') ||
    d.includes('invalid_grant')
  );
}
