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

export type ProPreviewLayoutMode = 'blocks' | 'custom';

export interface ProfileLinkPreviewConfig {
  enabled?: boolean;
  /** Preset: reorder segments/blocks. Custom: free-form strings with `{placeholder}` tokens. */
  layout_mode?: ProPreviewLayoutMode;
  title?: string[];
  description?: string[];
  image?: string;
  custom_title?: string;
  custom_description?: string;
}

export const DEFAULT_PROFILE_LINK_PREVIEW: Required<
  Pick<ProfileLinkPreviewConfig, 'title' | 'description' | 'image'>
> & { enabled: boolean } = {
  enabled: false,
  title: ['display_name', 'site'],
  description: ['verified', 'rating', 'bio', 'skills', 'top_experience'],
  image: 'auto',
};

/** Normalized shape after `normalizeProfileLinkPreviewConfig` (middleware + editor). */
export interface NormalizedProfileLinkPreview {
  enabled: boolean;
  layout_mode: ProPreviewLayoutMode;
  title: ProPreviewTitlePart[];
  description: ProPreviewDescBlock[];
  image: ProPreviewImageMode;
  custom_title: string;
  custom_description: string;
}

export const DEFAULT_NORMALIZED_PROFILE_LINK_PREVIEW: NormalizedProfileLinkPreview = {
  enabled: DEFAULT_PROFILE_LINK_PREVIEW.enabled,
  layout_mode: 'blocks',
  title: [...(DEFAULT_PROFILE_LINK_PREVIEW.title as ProPreviewTitlePart[])],
  description: [...(DEFAULT_PROFILE_LINK_PREVIEW.description as ProPreviewDescBlock[])],
  image: DEFAULT_PROFILE_LINK_PREVIEW.image as ProPreviewImageMode,
  custom_title: '',
  custom_description: '',
};

const TITLE_SET = new Set<string>(PRO_PREVIEW_TITLE_PARTS);
const DESC_SET = new Set<string>(PRO_PREVIEW_DESC_BLOCKS);

function isTitlePart(s: string): s is ProPreviewTitlePart {
  return TITLE_SET.has(s);
}

function isDescBlock(s: string): s is ProPreviewDescBlock {
  return DESC_SET.has(s);
}

export function normalizeProfileLinkPreviewConfig(raw: unknown): NormalizedProfileLinkPreview {
  const base: NormalizedProfileLinkPreview = {
    enabled: DEFAULT_NORMALIZED_PROFILE_LINK_PREVIEW.enabled,
    layout_mode: DEFAULT_NORMALIZED_PROFILE_LINK_PREVIEW.layout_mode,
    title: [...DEFAULT_NORMALIZED_PROFILE_LINK_PREVIEW.title],
    description: [...DEFAULT_NORMALIZED_PROFILE_LINK_PREVIEW.description],
    image: DEFAULT_NORMALIZED_PROFILE_LINK_PREVIEW.image,
    custom_title: '',
    custom_description: '',
  };
  if (raw == null || typeof raw !== 'object') return base;

  const o = raw as Record<string, unknown>;
  if (typeof o.enabled === 'boolean') base.enabled = o.enabled;

  if (o.layout_mode === 'custom' || o.layout_mode === 'blocks') {
    base.layout_mode = o.layout_mode;
  }

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

  if (typeof o.custom_title === 'string') {
    base.custom_title = o.custom_title.replace(/\r/g, '').slice(0, 280);
  }
  if (typeof o.custom_description === 'string') {
    base.custom_description = o.custom_description.replace(/\r/g, '').slice(0, 4200);
  }

  if (base.layout_mode === 'blocks' && base.enabled && !base.title.includes('site')) {
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

function buildOgPlaceholderMap(
  profile: ProfileOgRow,
  topExp: ExperienceOgMini | null,
  siteSuffix: string,
): Record<string, string> {
  return {
    display_name: titleSegment('display_name', profile, siteSuffix) ?? '',
    discord_username: titleSegment('discord_username', profile, siteSuffix) ?? '',
    pro_badge: titleSegment('pro_badge', profile, siteSuffix) ?? '',
    site: siteSuffix,
    verified: descBlock('verified', profile, topExp, siteSuffix) ?? '',
    rating: descBlock('rating', profile, topExp, siteSuffix) ?? '',
    bio: descBlock('bio', profile, topExp, siteSuffix) ?? '',
    skills: descBlock('skills', profile, topExp, siteSuffix) ?? '',
    experience: descBlock('top_experience', profile, topExp, siteSuffix) ?? '',
    location: descBlock('location', profile, topExp, siteSuffix) ?? '',
    pronouns: descBlock('pronouns', profile, topExp, siteSuffix) ?? '',
  };
}

function expandOgTemplateString(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '',
  );
}

function expandOgCustomTemplates(args: {
  customTitle: string;
  customDescription: string;
  profile: ProfileOgRow;
  topExperience: ExperienceOgMini | null;
  siteSuffix: string;
}): BuiltProfileOg {
  const vars = buildOgPlaceholderMap(args.profile, args.topExperience, args.siteSuffix);

  let title = expandOgTemplateString(args.customTitle, vars)
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (title.length > 250) title = `${title.slice(0, 249)}…`;

  const description = expandOgTemplateString(args.customDescription, vars)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 3800);

  return { title, description };
}

function composeProfileOgFromBlocks(args: {
  profile: ProfileOgRow;
  topExperience: ExperienceOgMini | null;
  siteSuffix: string;
  titleParts: ProPreviewTitlePart[];
  descBlocks: ProPreviewDescBlock[];
}): BuiltProfileOg {
  const titleChunks = args.titleParts
    .map((p) => titleSegment(p, args.profile, args.siteSuffix))
    .filter(Boolean) as string[];

  let title =
    titleChunks.join(' · ') ||
    `${titleSegment('display_name', args.profile, args.siteSuffix) ?? 'Member'} · ${args.siteSuffix}`;
  title = stripOgText(title, 250);

  const descLines = args.descBlocks
    .map((b) => descBlock(b, args.profile, args.topExperience, args.siteSuffix))
    .filter(Boolean) as string[];

  let description =
    descLines.join('\n\n') ||
    stripOgText((args.profile.bio ?? '').trim(), 400) ||
    `Profile on ${args.siteSuffix}`;

  description = description.slice(0, 3800);

  return { title, description };
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

  const defaultTitleParts = DEFAULT_PROFILE_LINK_PREVIEW.title as ProPreviewTitlePart[];
  const defaultDescBlocks = DEFAULT_PROFILE_LINK_PREVIEW.description as ProPreviewDescBlock[];

  const titleParts =
    args.useProCustomization && cfg.enabled && cfg.title.length > 0 ? cfg.title : defaultTitleParts;

  const descBlocks =
    args.useProCustomization && cfg.enabled && cfg.description.length > 0 ? cfg.description : defaultDescBlocks;

  const fromBlocks = (): BuiltProfileOg =>
    composeProfileOgFromBlocks({
      profile: args.profile,
      topExperience: args.topExperience,
      siteSuffix,
      titleParts,
      descBlocks,
    });

  if (
    args.useProCustomization &&
    cfg.enabled &&
    cfg.layout_mode === 'custom' &&
    (cfg.custom_title.trim().length > 0 || cfg.custom_description.trim().length > 0)
  ) {
    const customBuilt = expandOgCustomTemplates({
      customTitle: cfg.custom_title,
      customDescription: cfg.custom_description,
      profile: args.profile,
      topExperience: args.topExperience,
      siteSuffix,
    });
    const fallback = fromBlocks();
    const title = customBuilt.title.trim() ? customBuilt.title : fallback.title;
    const description = customBuilt.description.trim() ? customBuilt.description : fallback.description;
    return {
      title: sanitizeDiscordOgPlaintext(title),
      description: sanitizeDiscordOgPlaintext(description),
    };
  }

  const built = fromBlocks();
  return {
    title: sanitizeDiscordOgPlaintext(built.title),
    description: sanitizeDiscordOgPlaintext(built.description),
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
