/** Profile Discord / Open Graph link preview — shared rules with Edge middleware (`proLinkPreviewOg.ts`). */

export {
  buildProfileOpenGraph,
  DEFAULT_PROFILE_LINK_PREVIEW,
  DEFAULT_NORMALIZED_PROFILE_LINK_PREVIEW,
  normalizeProfileLinkPreviewConfig,
  pickProfileOgImageUrl,
  PROFILE_LINK_PREVIEW_SITE_SUFFIX,
  PRO_PREVIEW_DESC_BLOCKS,
  PRO_PREVIEW_IMAGE_MODES,
  PRO_PREVIEW_TITLE_PARTS,
  type ExperienceOgMini,
  type NormalizedProfileLinkPreview,
  type ProfileOgRow,
  type ProfileLinkPreviewConfig,
  type ProPreviewDescBlock,
  type ProPreviewImageMode,
  type ProPreviewLayoutMode,
  type ProPreviewTitlePart,
} from '../../proLinkPreviewOg.ts';

import type { ProPreviewDescBlock, ProPreviewTitlePart } from '../../proLinkPreviewOg.ts';

export const PRO_PREVIEW_TITLE_LABELS: Record<ProPreviewTitlePart, string> = {
  display_name: 'Display name',
  discord_username: 'Discord @username',
  pro_badge: 'Pro badge text',
  site: 'Site name (ERLC Directory)',
};

export const PRO_PREVIEW_DESC_LABELS: Record<ProPreviewDescBlock, string> = {
  verified: 'Verified staff line',
  rating: 'Star rating & review count',
  bio: 'Bio',
  skills: 'Skills list',
  top_experience: 'Latest listed role · server',
  location: 'Location',
  pronouns: 'Pronouns',
};

/** Tokens for “Custom text” link preview mode (`{token}` in title/description). */
export const PRO_PREVIEW_PLACEHOLDER_HINTS: { token: string; label: string }[] = [
  { token: '{display_name}', label: 'Directory display name' },
  { token: '{discord_username}', label: 'Discord @username' },
  { token: '{pro_badge}', label: 'Pro badge label (if Pro)' },
  { token: '{site}', label: 'Site line (ERLC Directory)' },
  { token: '{verified}', label: 'Verified staff paragraph (if verified)' },
  { token: '{rating}', label: 'Stars & review count line' },
  { token: '{bio}', label: 'Bio text' },
  { token: '{skills}', label: 'Skills line' },
  { token: '{experience}', label: 'Latest experience role · server' },
  { token: '{location}', label: 'Location line' },
  { token: '{pronouns}', label: 'Pronouns line' },
];
