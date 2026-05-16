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

export function httpsOgImageUrl(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t.startsWith('https://') || t.length > 2048) return null;
  return fixDiscordAnimatedAssetUrlString(t);
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
