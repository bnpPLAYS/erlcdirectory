/** Profile Discord / Open Graph link preview — shared rules with Edge middleware (`proLinkPreviewOg.ts`). */

export {
  buildProfileOpenGraph,
  DEFAULT_PROFILE_LINK_PREVIEW,
  normalizeProfileLinkPreviewConfig,
  pickProfileOgImageUrl,
  PROFILE_LINK_PREVIEW_SITE_SUFFIX,
  PRO_PREVIEW_DESC_BLOCKS,
  PRO_PREVIEW_IMAGE_MODES,
  PRO_PREVIEW_TITLE_PARTS,
  type ExperienceOgMini,
  type ProfileOgRow,
  type ProfileLinkPreviewConfig,
  type ProPreviewDescBlock,
  type ProPreviewImageMode,
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
