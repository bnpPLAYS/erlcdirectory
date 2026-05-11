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

/** Turn cryptic GoTrue messages into something actionable when possible. */
export function friendlyDiscordOAuthError(detail: string): string {
  const d = detail.toLowerCase();
  if (d.includes('error getting user email from external provider')) {
    return [
      detail.trim(),
      'Discord did not provide an email (you may need the email OAuth scope, or your Discord account must have an email on file).',
    ].join(' ');
  }
  return detail;
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
