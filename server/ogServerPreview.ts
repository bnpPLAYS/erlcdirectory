/**
 * Shared helpers: Discord/link previews for `/server/:uuid` (middleware + Node crawler serve).
 * Reads public server row via Supabase REST (anon; SELECT policy allows everyone).
 */

import type { ExperienceOgMini, ProfileOgRow } from '../proLinkPreviewOg.ts';
import { experienceAwaitingForOg } from '../proLinkPreviewOg.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Profile route UUID (variant nibble allows published profiles). */
const PROFILE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/** Mirrors `RESERVED_PROFILE_SLUGS` for OG routing (avoid catching site routes). */
const RESERVED_PROFILE_SLUGS_FOR_OG = new Set([
  'browse',
  'servers',
  'server',
  'posts',
  'connections',
  'messages',
  'auth',
  'discord',
  'verify',
  'staff',
  'terms',
  'privacy',
  'contact',
  'docs',
  'pro',
  'roblox',
  'profile',
  'me',
  'settings',
  'admin',
  'api',
  'login',
  'logout',
  'signup',
]);

export type ProfileOgLookup = { kind: 'id'; id: string } | { kind: 'slug'; slug: string };

export function parsePublicProfileOgRoute(pathname: string): ProfileOgLookup | null {
  const rawPath = pathname.trim();
  const pathNorm =
    rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;

  const profilePrefixed = /^\/profile\/([^/]+)$/i.exec(pathNorm);
  if (profilePrefixed) {
    const id = decodeURIComponent(profilePrefixed[1]);
    if (!PROFILE_UUID_RE.test(id)) return null;
    return { kind: 'id', id };
  }

  const single = /^\/([^/]+)$/i.exec(pathNorm);
  if (!single) return null;
  const seg = decodeURIComponent(single[1]);
  const low = seg.toLowerCase();
  if (RESERVED_PROFILE_SLUGS_FOR_OG.has(low)) return null;
  if (PROFILE_UUID_RE.test(seg)) return { kind: 'id', id: seg };
  return { kind: 'slug', slug: seg };
}

const PROFILE_OG_SELECT =
  'id,display_name,discord_username,bio,banner_url,discord_avatar,is_verified,is_pro,rating,review_count,skills,location,pronouns,pro_badge_label,pro_link_preview_config';

function mapProfileOgRow(row: Record<string, unknown>): ProfileOgRow | null {
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) return null;
  const skillsRaw = row.skills;
  const skills =
    Array.isArray(skillsRaw) ? skillsRaw.filter((x): x is string => typeof x === 'string') : [];
  return {
    id,
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
    discord_username: typeof row.discord_username === 'string' ? row.discord_username : null,
    bio: typeof row.bio === 'string' ? row.bio : null,
    banner_url: typeof row.banner_url === 'string' ? row.banner_url : null,
    discord_avatar: typeof row.discord_avatar === 'string' ? row.discord_avatar : null,
    is_verified: row.is_verified === true,
    is_pro: row.is_pro === true,
    rating: typeof row.rating === 'number' ? row.rating : Number(row.rating) || null,
    review_count: typeof row.review_count === 'number' ? row.review_count : Number(row.review_count) || null,
    skills,
    location: typeof row.location === 'string' ? row.location : null,
    pronouns: typeof row.pronouns === 'string' ? row.pronouns : null,
    pro_badge_label: typeof row.pro_badge_label === 'string' ? row.pro_badge_label : null,
    pro_link_preview_config: row.pro_link_preview_config,
  };
}

async function fetchProfileOgRowById(
  base: string,
  anonKey: string,
  id: string,
): Promise<ProfileOgRow | null> {
  const restUrl = `${base}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&deactivated_at=is.null&select=${PROFILE_OG_SELECT}`;
  const res = await fetch(restUrl, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) return null;
  let rows: unknown;
  try {
    rows = await res.json();
  } catch {
    return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return mapProfileOgRow(rows[0] as Record<string, unknown>);
}

async function fetchProfileOgRowBySlug(
  base: string,
  anonKey: string,
  slug: string,
): Promise<ProfileOgRow | null> {
  const rpcUrl = `${base}/rest/v1/rpc/get_profile_by_username_lookup`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lookup: slug }),
  });
  if (!res.ok) return null;
  let rows: unknown;
  try {
    rows = await res.json();
  } catch {
    return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return mapProfileOgRow(rows[0] as Record<string, unknown>);
}

export async function fetchTopExperienceOgMini(
  supabaseUrl: string,
  anonKey: string,
  profileId: string,
): Promise<ExperienceOgMini | null> {
  const base = supabaseUrl.replace(/\/$/, '');
  const restUrl = `${base}/rest/v1/experiences?profile_id=eq.${encodeURIComponent(profileId)}&select=role,server_name,is_verified,guild_id,start_date&order=start_date.desc&limit=15`;
  const res = await fetch(restUrl, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) return null;
  let rows: unknown;
  try {
    rows = await res.json();
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const mini: ExperienceOgMini = {
      role: typeof o.role === 'string' ? o.role : '',
      server_name: typeof o.server_name === 'string' ? o.server_name : '',
      is_verified: o.is_verified === true,
      guild_id: typeof o.guild_id === 'string' ? o.guild_id : null,
    };
    if (!experienceAwaitingForOg(mini)) return mini;
  }
  return null;
}

export async function fetchPublicProfileOgBundle(
  supabaseUrl: string,
  anonKey: string,
  lookup: ProfileOgLookup,
): Promise<{ profile: ProfileOgRow; topExperience: ExperienceOgMini | null } | null> {
  const base = supabaseUrl.replace(/\/$/, '');
  const profile =
    lookup.kind === 'id'
      ? await fetchProfileOgRowById(base, anonKey, lookup.id)
      : await fetchProfileOgRowBySlug(base, anonKey, lookup.slug);
  if (!profile) return null;
  const topExperience = await fetchTopExperienceOgMini(supabaseUrl, anonKey, profile.id);
  return { profile, topExperience };
}
