/**
 * Discord stores animated avatars, guild icons, and Nitro banners with an `a_` hash.
 * Those assets must be requested with `.gif` (not `.png` / `.webp`), or the CDN returns a broken image.
 */
function fixDiscordAnimatedAssetUrl(u: URL): void {
  const h = u.hostname.toLowerCase();
  if (h !== 'cdn.discordapp.com' && h !== 'cdn.discord.com') return;

  const m =
    /^\/(avatars|icons|banners)\/(\d+)\/([^/.]+)\.(png|webp|jpe?g)$/i.exec(u.pathname);
  if (!m) return;
  const hash = m[3];
  if (!hash.startsWith('a_')) return;
  const ext = m[4].toLowerCase();
  if (ext === 'gif' || ext === 'webm') return;
  u.pathname = `/${m[1]}/${m[2]}/${hash}.gif`;
}

/**
 * Fix Discord CDN URLs for display (animated `a_*` hashes → `.gif`).
 * Safe for non-Discord URLs and data: URLs (returns input if not parseable).
 */
export function normalizeDiscordCdnMediaUrl(src: string | null | undefined): string | undefined {
  if (src == null) return undefined;
  const s = String(src).trim();
  if (!s) return undefined;
  try {
    const u = new URL(s);
    fixDiscordAnimatedAssetUrl(u);
    return u.toString();
  } catch {
    return s;
  }
}

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
      fixDiscordAnimatedAssetUrl(u);
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
