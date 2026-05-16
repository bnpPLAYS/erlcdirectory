/**
 * Pure helpers for profile Open Graph / Discord link previews (middleware + crawler).
 * No framework imports — safe for Vercel Edge bundling.
 */

import { sanitizeDiscordOgPlaintext } from './discordOgSanitize.ts';

export const PROFILE_LINK_PREVIEW_SITE_SUFFIX = 'ERLC Directory';

const DEFAULT_TITLE_PARTS = ['display_name', 'site'] as const;
type TitlePart = (typeof DEFAULT_TITLE_PARTS)[number];

const DEFAULT_DESC_BLOCKS = ['verified', 'rating', 'bio', 'skills', 'top_experience'] as const;
type DescBlock = (typeof DEFAULT_DESC_BLOCKS)[number];

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

function titleSegment(part: TitlePart, profile: ProfileOgRow, siteSuffix: string): string | null {
  switch (part) {
    case 'display_name': {
      const n = (profile.display_name || profile.discord_username || '').trim();
      return n ? stripOgText(n, 80) : null;
    }
    case 'site':
      return siteSuffix;
    default:
      return null;
  }
}

function descBlock(block: DescBlock, profile: ProfileOgRow, topExp: ExperienceOgMini | null, siteSuffix: string): string | null {
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
}): BuiltProfileOg {
  const siteSuffix = args.siteSuffix ?? PROFILE_LINK_PREVIEW_SITE_SUFFIX;

  const titleChunks = [...DEFAULT_TITLE_PARTS]
    .map((p) => titleSegment(p, args.profile, siteSuffix))
    .filter(Boolean) as string[];

  let title =
    titleChunks.join(' · ') ||
    `${titleSegment('display_name', args.profile, siteSuffix) ?? 'Member'} · ${siteSuffix}`;
  title = stripOgText(title, 250);

  const descLines = [...DEFAULT_DESC_BLOCKS]
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

/** Large image: banner if present, else avatar, else fallback (site default OG asset). */
export function pickProfileOgImageUrl(args: {
  bannerHttps: string | null;
  avatarHttps: string | null;
  fallbackUrl: string;
  /** Declared width when `fallbackUrl` is chosen (matches og:image meta). */
  fallbackWidth?: number;
  fallbackHeight?: number;
}): { url: string; width: number; height: number } {
  const fbW = args.fallbackWidth ?? 1156;
  const fbH = args.fallbackHeight ?? 810;
  const banner = args.bannerHttps;
  const avatar = args.avatarHttps;
  const chosen = banner || avatar || args.fallbackUrl;

  let w = fbW;
  let h = fbH;

  if (chosen === avatar && avatar) {
    w = 512;
    h = 512;
  } else if (chosen === banner && banner) {
    w = 960;
    h = 540;
  }

  return { url: chosen, width: w, height: h };
}
