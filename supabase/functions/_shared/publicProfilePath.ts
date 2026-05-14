/** Mirror src/lib/profilePath.ts for Edge Functions (absolute profile URLs in DMs, etc.). */

const RESERVED = new Set([
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
])

function slugFromDiscordUsername(username: string | null | undefined): string | null {
  if (username == null || typeof username !== 'string') return null
  const t = username.trim()
  if (!t) return null
  const slug = t.toLowerCase().replace(/\.+$/u, '')
  if (!slug || RESERVED.has(slug)) return null
  return slug
}

export function publicProfilePath(profileId: string, discordUsername: string | null | undefined): string {
  const slug = slugFromDiscordUsername(discordUsername)
  if (slug) return `/${slug}`
  return `/profile/${profileId}`
}

export function publicProfileAbsoluteUrl(
  siteOrigin: string,
  profileId: string,
  discordUsername: string | null | undefined,
): string {
  const base = siteOrigin.replace(/\/+$/, '')
  return `${base}${publicProfilePath(profileId, discordUsername)}`
}
