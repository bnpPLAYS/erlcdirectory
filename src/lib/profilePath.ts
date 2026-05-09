/**
 * Public profile URLs: `https://www.erlc.directory/{username}` when possible,
 * else `/profile/{uuid}` (no Discord username or username collides with a reserved path).
 */

/** First path segment is reserved for site routes — profile slugs cannot use these (case-insensitive). */
export const RESERVED_PROFILE_SLUGS = new Set([
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
  'profile',
  'me',
  'settings',
  'admin',
  'api',
  'login',
  'logout',
  'signup',
]);

export function isReservedProfileSlug(s: string): boolean {
  return RESERVED_PROFILE_SLUGS.has(s.trim().toLowerCase());
}

/** Normalize Discord username for URL slug (match lookup RPC). */
export function slugFromDiscordUsername(username: string | null | undefined): string | null {
  if (username == null || typeof username !== 'string') return null;
  const t = username.trim();
  if (!t) return null;
  const slug = t.toLowerCase().replace(/\.+$/u, '');
  if (!slug || isReservedProfileSlug(slug)) return null;
  return slug;
}

export function profilePath(profile: { id: string; discord_username?: string | null }): string {
  const slug = slugFromDiscordUsername(profile.discord_username ?? null);
  if (slug) return `/${slug}`;
  return `/profile/${profile.id}`;
}

export function profileEditorPath(
  profile: { id: string; discord_username?: string | null },
  opts?: { tab?: string; addExperience?: boolean },
): string {
  const base = profilePath(profile);
  const q = new URLSearchParams();
  q.set('edit', '1');
  if (opts?.tab) q.set('tab', opts.tab);
  if (opts?.addExperience) q.set('add', '1');
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeProfileUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}
