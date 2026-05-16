/**
 * Shared helpers: Discord/link previews for `/server/:uuid` (middleware + Node crawler serve).
 * Reads public server row via Supabase REST (anon; SELECT policy allows everyone).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseServerPageId(pathname: string): string | null {
  const m = pathname.match(/^\/server\/([^/]+)\/?$/);
  if (!m) return null;
  const id = m[1];
  return UUID_RE.test(id) ? id : null;
}

/** Discord Nitro / animated assets use `a_` hashes and must be requested as `.gif`. */
export function fixDiscordAnimatedAssetUrlString(url: string): string {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h !== 'cdn.discordapp.com' && h !== 'cdn.discord.com') return url;
    const m = /^\/(avatars|icons|banners)\/(\d+)\/([^/.]+)\.(png|webp|jpe?g)$/i.exec(u.pathname);
    if (!m) return url;
    const hash = m[3];
    if (!hash.startsWith('a_')) return url;
    const ext = m[4].toLowerCase();
    if (ext === 'gif' || ext === 'webm') return url;
    u.pathname = `/${m[1]}/${m[2]}/${hash}.gif`;
    return u.toString();
  } catch {
    return url;
  }
}

/** Break Discord mention / ping tokens in plain-text OG titles and descriptions (embed previews). */
export function sanitizeDiscordOgPlaintext(input: string): string {
  const zw = '\u200b';
  let s = input;
  s = s.replace(/<@!?[0-9]{5,25}>/g, `${zw}user`);
  s = s.replace(/<@&[0-9]{5,25}>/g, `${zw}role`);
  s = s.replace(/<#[0-9]{5,25}>/g, `${zw}channel`);
  s = s.replace(/@everyone\b/gi, `@${zw}everyone`);
  s = s.replace(/@here\b/gi, `@${zw}here`);
  s = s.replace(/@channel\b/gi, `@${zw}channel`);
  return s;
}

function isTrustedOgImageHost(hostname: string, pathname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'cdn.discordapp.com' || h === 'cdn.discord.com' || h === 'media.discordapp.net') return true;
  if (h.endsWith('.supabase.co') && /^\/storage\/v1\/object\//.test(pathname)) return true;
  return false;
}

/** HTTPS image URLs allowed in og:image — Discord CDNs and Supabase Storage only (no arbitrary hosts). */
export function httpsOgImageUrl(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t.startsWith('https://') || t.length > 2048) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:') return null;
    if (!isTrustedOgImageHost(u.hostname, u.pathname)) return null;
    return fixDiscordAnimatedAssetUrlString(t);
  } catch {
    return null;
  }
}

export type ServerOgRow = { name: string; description: string | null; banner: string | null };

export async function fetchPublicServerOgRow(
  supabaseUrl: string,
  anonKey: string,
  serverId: string,
): Promise<ServerOgRow | null> {
  const base = supabaseUrl.replace(/\/$/, '');
  const restUrl = `${base}/rest/v1/servers?id=eq.${encodeURIComponent(serverId)}&select=name,description,banner`;
  const res = await fetch(restUrl, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!res.ok) return null;
  let rows: unknown;
  try {
    rows = await res.json();
  } catch {
    return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name : '';
  if (!name) return null;
  const description = typeof row.description === 'string' ? row.description : null;
  const banner = typeof row.banner === 'string' ? row.banner : null;
  return { name, description, banner };
}

export function truncateOgDescription(s: string | null, max: number): string {
  if (!s) return '';
  const oneLine = s.replace(/[\n\r]+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

/** Server listing embed copy — truncated then mention-safe for Discord unfurls. */
export function sanitizeServerOgFields(opts: {
  name: string;
  description: string | null;
  descriptionMax: number;
  siteFallbackDescription: string;
}): { title: string; description: string } {
  const title = sanitizeDiscordOgPlaintext(`${opts.name.trim().slice(0, 200)} — ERLC.Directory`);
  const fromDesc = sanitizeDiscordOgPlaintext(truncateOgDescription(opts.description, opts.descriptionMax));
  const description = fromDesc.trim() ? fromDesc : sanitizeDiscordOgPlaintext(opts.siteFallbackDescription);
  return { title, description };
}
