/**
 * Origin for user-facing absolute URLs (e.g. verification links).
 * - Optional `VITE_PUBLIC_SITE_ORIGIN` overrides everything (staging, etc.).
 * - On Vercel preview hosts, links point at production so admins always get www.erlc.directory.
 * - Local dev keeps the current origin.
 */
export function getPublicSiteOrigin(): string {
  const explicit = import.meta.env.VITE_PUBLIC_SITE_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  if (typeof window === 'undefined') return '';

  const host = window.location.hostname.toLowerCase();

  if (host === 'www.erlc.directory' || host === 'erlc.directory') {
    return 'https://www.erlc.directory';
  }

  if (host === 'canary.erlc.directory') {
    return 'https://canary.erlc.directory';
  }

  if (host.endsWith('.vercel.app')) {
    return 'https://www.erlc.directory';
  }

  return window.location.origin.replace(/\/+$/, '');
}

export function buildVerifyExperienceUrl(token: string): string {
  return `${getPublicSiteOrigin()}/verify/${token}`;
}
