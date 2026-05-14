import type { CSSProperties, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  PROFILE_SOCIAL_KEYS,
  PROFILE_SOCIAL_LABELS,
  type ProfileSocialKey,
  parseProfileSocialLinks,
  socialLinkTooltip,
} from '@/lib/profileSocialLinks';
import { robloxWebProfileUrl } from '@/lib/robloxProfileUrl';
import { RobloxIcon } from '@/components/icons/RobloxIcon';

const DISCORD_BRAND = '#5865F2';
const YOUTUBE_BRAND = '#FF0000';
const TWITCH_BRAND = '#9146FF';
const TIKTOK_BRAND = '#25F4EE';
const GITHUB_BRAND = '#f0f6fc';
const INSTAGRAM_BRAND = '#f58529';
const ROBLOX_BRAND = '#ffffff';

function badgeShell(children: ReactNode, className?: string, style?: CSSProperties) {
  return (
    <span
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 shadow-sm transition-transform hover:scale-105 hover:border-white/20',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

function IconDiscord() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.918 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconTwitch() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function IconGitHub() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

const ICONS: Record<ProfileSocialKey, React.FC> = {
  youtube: IconYouTube,
  x: IconX,
  twitch: IconTwitch,
  tiktok: IconTikTok,
  github: IconGitHub,
  instagram: IconInstagram,
  roblox: RobloxIcon,
};

const BRAND_BG: Record<ProfileSocialKey, string> = {
  youtube: YOUTUBE_BRAND,
  x: '#0a0a0a',
  twitch: TWITCH_BRAND,
  tiktok: '#010101',
  github: '#24292f',
  instagram: `linear-gradient(135deg, ${INSTAGRAM_BRAND}, #dd2a7b, #8134af)`,
  roblox: '#242424',
};

type Props = {
  socialLinks: unknown;
  discordHref: string | null;
  /** Verified Roblox user id — canonical profile link (manual roblox URL in social_links is ignored when set). */
  robloxUserId?: string | null;
  className?: string;
};

export function ProfileSocialBadges({ socialLinks, discordHref, robloxUserId, className }: Props) {
  const links = parseProfileSocialLinks(socialLinks);
  const robloxHref = robloxWebProfileUrl(robloxUserId);
  const entries = PROFILE_SOCIAL_KEYS.map((key) => ({ key, url: links[key] })).filter((e) => {
    if (!e.url) return false;
    if (e.key === 'roblox' && robloxHref) return false;
    return true;
  }) as { key: ProfileSocialKey; url: string }[];

  if (!discordHref && !robloxHref && entries.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {discordHref ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={discordHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              aria-label="Discord profile"
            >
              {badgeShell(<IconDiscord />, 'text-white', { backgroundColor: DISCORD_BRAND })}
            </a>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] text-xs">
            Discord profile
          </TooltipContent>
        </Tooltip>
      ) : null}
      {robloxHref ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={robloxHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              aria-label={PROFILE_SOCIAL_LABELS.roblox}
            >
              {badgeShell(<RobloxIcon />, 'text-white', { backgroundColor: BRAND_BG.roblox })}
            </a>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[min(90vw,280px)] break-all text-xs">
            Roblox profile (verified)
          </TooltipContent>
        </Tooltip>
      ) : null}
      {entries.map(({ key, url }) => {
        const Icon = ICONS[key];
        const bg = BRAND_BG[key];
        const isGradient = bg.includes('gradient');
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                aria-label={PROFILE_SOCIAL_LABELS[key]}
              >
                {badgeShell(<Icon />, 'text-white', isGradient ? { background: bg } : { backgroundColor: bg })}
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[min(90vw,280px)] break-all text-xs">
              {socialLinkTooltip(url)}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
