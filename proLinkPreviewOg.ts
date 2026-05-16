/**
 * Pure helpers for profile Open Graph / Discord link previews (middleware + editor preview).
 * No framework imports — safe for Vercel Edge bundling.
 */

import { sanitizeDiscordOgPlaintext } from './discordOgSanitize.ts';

export const PROFILE_LINK_PREVIEW_SITE_SUFFIX = 'ERLC Directory';

/** Title segments joined with " · " */
export const PRO_PREVIEW_TITLE_PARTS = ['display_name', 'discord_username', 'pro_badge', 'site'] as const;
export type ProPreviewTitlePart = (typeof PRO_PREVIEW_TITLE_PARTS)[number];

export const PRO_PREVIEW_DESC_BLOCKS = [
  'verified',
  'rating',
  'bio',
  'skills',
  'top_experience',
  'location',
  'pronouns',
] as const;
export type ProPreviewDescBlock = (typeof PRO_PREVIEW_DESC_BLOCKS)[number];

export const PRO_PREVIEW_IMAGE_MODES = ['auto', 'banner', 'avatar'] as const;
export type ProPreviewImageMode = (typeof PRO_PREVIEW_IMAGE_MODES)[number];

export interface ProfileLinkPreviewConfig {
  enabled?: boolean;
  title?: string[];
  description?: string[];
  image?: string;
}

export const DEFAULT_PROFILE_LINK_PREVIEW: Required<
  Pick<ProfileLinkPreviewConfig, 'title' | 'description' | 'image'>
> & { enabled: boolean } = {
  enabled: false,
  title: ['display_name', 'site'],
  description: ['verified', 'rating', 'bio', 'skills', 'top_experience'],
  image: 'auto',
};

const TITLE_SET = new Set<string>(PRO_PREVIEW_TITLE_PARTS);
const DESC_SET = new Set<string>(PRO_PREVIEW_DESC_BLOCKS);

function isTitlePart(s: string): s is ProPreviewTitlePart {
  return TITLE_SET.has(s);
}

function isDescBlock(s: string): s is ProPreviewDescBlock {
  return DESC_SET.has(s);
}

export function normalizeProfileLinkPreviewConfig(raw: unknown): typeof DEFAULT_PROFILE_LINK_PREVIEW {
  const base: typeof DEFAULT_PROFILE_LINK_PREVIEW = {
    enabled: DEFAULT_PROFILE_LINK_PREVIEW.enabled,
    title: [...DEFAULT_PROFILE_LINK_PREVIEW.title],
    description: [...DEFAULT_PROFILE_LINK_PREVIEW.description],
    image: DEFAULT_PROFILE_LINK_PREVIEW.image,
  };
  if (raw == null || typeof raw !== 'object') return base;

  const o = raw as Record<string, unknown>;
  if (typeof o.enabled === 'boolean') base.enabled = o.enabled;

  if (Array.isArray(o.title)) {
    const t = o.title.filter((x): x is string => typeof x === 'string').filter(isTitlePart);
    const uniq: ProPreviewTitlePart[] = [];
    const seen = new Set<string>();
    for (const x of t) {
      if (seen.has(x)) continue;
      seen.add(x);
      uniq.push(x);
    }
    if (uniq.length > 0) base.title = uniq;
  }

  if (Array.isArray(o.description)) {
    const d = o.description.filter((x): x is string => typeof x === 'string').filter(isDescBlock);
    const uniq: ProPreviewDescBlock[] = [];
    const seen = new Set<string>();
    for (const x of d) {
      if (seen.has(x)) continue;
      seen.add(x);
      uniq.push(x);
    }
    if (uniq.length > 0) base.description = uniq;
  }

  if (typeof o.image === 'string' && PRO_PREVIEW_IMAGE_MODES.includes(o.image as ProPreviewImageMode)) {
    base.image = o.image as ProPreviewImageMode;
  }

  if (base.enabled && !(base.title as string[]).includes('site')) {
    base.title = [...base.title, 'site'];
  }

  return base;
}

export interface ProfileOgRow {
  id: string;
  display_name: string | null;
  discord_username: string | null;
  bio: string | null;
  banner_url: string | null;
  discord_avatar: string | null;
  is_verified: boolean;
  is_pro: boolean;
  rating: number | null;
  review_count: number | null;
  skills: string[] | null;
  location: string | null;
  pronouns: string | null;
  pro_badge_label: string | null;
  pro_link_preview_config: unknown;
}

export interface ExperienceOgMini {
  role: string;
  server_name: string;
  is_verified: boolean;
  guild_id: string | null;
}

const PENDING_ROLE = 'Pending verification';

export function experienceAwaitingForOg(exp: ExperienceOgMini): boolean {
  if (exp.is_verified) return false;
  const role = (exp.role ?? '').trim();
  if (role === PENDING_ROLE) return true;
  return !!exp.guild_id;
}

function stripOgText(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1)}…`;
}

function titleSegment(
  part: ProPreviewTitlePart,
  profile: ProfileOgRow,
  siteSuffix: string,
): string | null {
  switch (part) {
    case 'display_name': {
      const n = (profile.display_name || profile.discord_username || '').trim();
      return n ? stripOgText(n, 80) : null;
    }
    case 'discord_username': {
      const u = (profile.discord_username ?? '').trim();
      return u ? `@${stripOgText(u.replace(/^@+/, ''), 60)}` : null;
    }
    case 'pro_badge': {
      if (!profile.is_pro) return null;
      const b = (profile.pro_badge_label ?? '').trim();
      return b ? stripOgText(b, 40) : null;
    }
    case 'site':
      return siteSuffix;
    default:
      return null;
  }
}

function descBlock(
  block: ProPreviewDescBlock,
  profile: ProfileOgRow,
  topExp: ExperienceOgMini | null,
  siteSuffix: string,
): string | null {
  switch (block) {
    case 'verified':
      return profile.is_verified ? `✓ Verified ER:LC staff · ${siteSuffix}` : null;
    case 'rating': {
      const rc = Number(profile.review_count) || 0;
      const r = Number(profile.rating);
      if (!rc && !Number.isFinite(r)) return null;
      const stars = Number.isFinite(r) ? `${Math.round(r * 10) / 10}/5` : '';
      if (rc > 0 && stars) return `★ ${stars} · ${rc} review${rc === 1 ? '' : 's'}`;
      if (rc > 0) return `★ ${rc} review${rc === 1 ? '' : 's'}`;
      return stars ? `★ ${stars}` : null;
    }
    case 'bio': {
      const b = (profile.bio ?? '').trim();
      return b ? stripOgText(b, 420) : null;
    }
    case 'skills': {
      const sk = (profile.skills ?? []).filter(Boolean);
      if (!sk.length) return null;
      return `Skills: ${stripOgText(sk.slice(0, 12).join(', '), 360)}`;
    }
    case 'top_experience': {
      if (!topExp || experienceAwaitingForOg(topExp)) return null;
      const role = stripOgText((topExp.role ?? '').trim(), 80);
      const sn = stripOgText((topExp.server_name ?? '').trim(), 80);
      if (!role && !sn) return null;
      if (role && sn) return `Experience: ${role} · ${sn}`;
      return `Experience: ${role || sn}`;
    }
    case 'location': {
      const loc = (profile.location ?? '').trim();
      return loc ? `Location: ${stripOgText(loc, 120)}` : null;
    }
    case 'pronouns': {
      const pr = (profile.pronouns ?? '').trim();
      return pr ? `Pronouns: ${stripOgText(pr, 40)}` : null;
    }
    default:
      return null;
  }
}

export interface BuiltProfileOg {
  title: string;
  description: string;
}

export function buildProfileOpenGraph(args: {
  profile: ProfileOgRow;
  topExperience: ExperienceOgMini | null;
  siteSuffix?: string;
  /** When true, apply saved Pro layout if enabled */
  useProCustomization: boolean;
}): BuiltProfileOg {
  const siteSuffix = args.siteSuffix ?? PROFILE_LINK_PREVIEW_SITE_SUFFIX;
  const cfg = normalizeProfileLinkPreviewConfig(args.profile.pro_link_preview_config);

  const titleParts: ProPreviewTitlePart[] =
    args.useProCustomization && cfg.enabled && cfg.title.length > 0
      ? cfg.title
      : (DEFAULT_PROFILE_LINK_PREVIEW.title as ProPreviewTitlePart[]);

  const descBlocks: ProPreviewDescBlock[] =
    args.useProCustomization && cfg.enabled && cfg.description.length > 0
      ? cfg.description
      : (DEFAULT_PROFILE_LINK_PREVIEW.description as ProPreviewDescBlock[]);

  const titleChunks = titleParts
    .map((p) => titleSegment(p, args.profile, siteSuffix))
    .filter(Boolean) as string[];

  let title = titleChunks.join(' · ') || `${titleSegment('display_name', args.profile, siteSuffix) ?? 'Member'} · ${siteSuffix}`;
  title = stripOgText(title, 250);

  const descLines = descBlocks
    .map((b) => descBlock(b, args.profile, args.topExperience, siteSuffix))
    .filter(Boolean) as string[];

  let description =
    descLines.join('\n\n') ||
    stripOgText((args.profile.bio ?? '').trim(), 400) ||
    `Profile on ${siteSuffix}`;

  description = description.slice(0, 3800);

  return {
    title: sanitizeDiscordOgPlaintext(title),
    description: sanitizeDiscordOgPlaintext(description),
  };
}

export function pickProfileOgImageUrl(args: {
  bannerHttps: string | null;
  avatarHttps: string | null;
  fallbackUrl: string;
  mode: ProPreviewImageMode;
}): { url: string; width: number; height: number } {
  const banner = args.bannerHttps;
  const avatar = args.avatarHttps;

  let chosen: string | null = null;
  let w = 1200;
  let h = 630;

  switch (args.mode) {
    case 'banner':
      chosen = banner || avatar || args.fallbackUrl;
      break;
    case 'avatar':
      chosen = avatar || banner || args.fallbackUrl;
      break;
    case 'auto':
    default:
      chosen = banner || avatar || args.fallbackUrl;
      break;
  }

  if (chosen === avatar && avatar) {
    w = 512;
    h = 512;
  } else if (chosen === banner && banner) {
    w = 960;
    h = 540;
  }

  return { url: chosen, width: w, height: h };
}
