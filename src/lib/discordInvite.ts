/**
 * Normalize stored Discord invite values (full URL, discord.gg/…, or bare code) for use in href.
 */
export function normalizeDiscordInvite(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const noLeadingSlash = t.replace(/^\/+/, '');
  const lower = noLeadingSlash.toLowerCase();
  if (lower.startsWith('discord.gg/') || lower.startsWith('discord.com/invite/')) {
    return `https://${noLeadingSlash}`;
  }
  // Typical invite codes: alphanumeric + hyphen
  if (/^[a-zA-Z0-9-]{2,40}$/.test(noLeadingSlash)) {
    return `https://discord.gg/${noLeadingSlash}`;
  }
  return `https://${noLeadingSlash}`;
}
