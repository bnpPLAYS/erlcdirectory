/** Keys stored in profiles.social_links (JSON object). */
export const PROFILE_SOCIAL_KEYS = [
  'youtube',
  'x',
  'twitch',
  'tiktok',
  'github',
  'instagram',
  'roblox',
] as const;

export type ProfileSocialKey = (typeof PROFILE_SOCIAL_KEYS)[number];

export const PROFILE_SOCIAL_LABELS: Record<ProfileSocialKey, string> = {
  youtube: 'YouTube',
  x: 'X (Twitter)',
  twitch: 'Twitch',
  tiktok: 'TikTok',
  github: 'GitHub',
  instagram: 'Instagram',
  roblox: 'Roblox',
};

export function parseProfileSocialLinks(raw: unknown): Partial<Record<ProfileSocialKey, string>> {
  const out: Partial<Record<ProfileSocialKey, string>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const key of PROFILE_SOCIAL_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) out[key] = t;
    }
  }
  const legacyTwitter = (raw as Record<string, unknown>)['twitter'];
  if (!out.x && typeof legacyTwitter === 'string' && legacyTwitter.trim()) {
    out.x = legacyTwitter.trim();
  }
  return out;
}

export function serializeProfileSocialLinks(links: Partial<Record<ProfileSocialKey, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of PROFILE_SOCIAL_KEYS) {
    const v = links[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}

/** Normalize user input to an absolute https URL when possible. */
export function normalizeSocialInputUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Short label for tooltips (e.g. youtube.com/channel/…). */
export function socialLinkTooltip(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, '');
    const path = u.pathname + u.search;
    const compact = `${host}${path === '/' ? '' : path}`;
    if (compact.length <= 42) return compact;
    return `${compact.slice(0, 18)}…${compact.slice(-20)}`;
  } catch {
    const s = url.replace(/^https?:\/\//i, '');
    return s.length <= 42 ? s : `${s.slice(0, 18)}…${s.slice(-20)}`;
  }
}
