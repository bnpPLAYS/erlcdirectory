import { useId } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** Optional accessible name (also sets `aria-hidden` off when set). */
  title?: string;
};

/**
 * Roblox “tilt” mark: outer square rotated counter‑clockwise with a square cutout,
 * drawn with `currentColor` so it reads as white on dark UI and matches site branding.
 */
export function RobloxIcon({ className, title }: Props) {
  const maskId = `roblox-tilt-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-4 w-4 shrink-0', className)}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <g transform="rotate(-12 12 12)">
            <rect x="3" y="3" width="18" height="18" fill="white" />
            <rect x="8.35" y="8.35" width="7.3" height="7.3" fill="black" />
          </g>
        </mask>
      </defs>
      <rect width="24" height="24" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}
