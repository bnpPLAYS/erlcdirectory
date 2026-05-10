/**
 * Returns a URL suitable for <img src>, or undefined so the avatar fallback shows.
 * Filters garbage strings and obviously invalid URLs (common cause of broken Discord avatars).
 */
export function safeAvatarUrl(url: string | null | undefined): string | undefined {
  if (url == null) return undefined;
  const s = String(url).trim();
  if (!s || s === 'null' || s === 'undefined') return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    // Discord CDN — require a path that looks like an asset
    const h = u.hostname.toLowerCase();
    if (h === 'cdn.discordapp.com' || h === 'cdn.discord.com') {
      if (!u.pathname || u.pathname.length < 8) return undefined;
    }
    return u.toString();
  } catch {
    return undefined;
  }
}

/** referrerPolicy that avoids some Discord CDN hotlink quirks when opening embedded images. */
export function avatarReferrerPolicy(url: string | undefined): 'no-referrer' | undefined {
  if (!url) return undefined;
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h === 'cdn.discordapp.com' || h === 'cdn.discord.com') return 'no-referrer';
  } catch {
    /* ignore */
  }
  return undefined;
}
