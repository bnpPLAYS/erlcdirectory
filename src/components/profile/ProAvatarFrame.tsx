import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Ring offsets tuned per surface so orbits read clearly at different avatar sizes. */
const ORBIT: Record<
  'nav' | 'card' | 'hero' | 'editor' | 'preview',
  { inner: string; outer: string; spark: string }
> = {
  nav: { inner: '-inset-[2px]', outer: '-inset-[4px]', spark: '-inset-[5px]' },
  card: { inner: '-inset-[3px]', outer: '-inset-[5px]', spark: '-inset-[6px]' },
  hero: { inner: '-inset-[4px] md:-inset-[5px]', outer: '-inset-[6px] md:-inset-[8px]', spark: '-inset-[7px] md:-inset-[9px]' },
  editor: { inner: '-inset-[3px]', outer: '-inset-[5px]', spark: '-inset-[6px]' },
  preview: { inner: '-inset-[2px]', outer: '-inset-[3px]', spark: '-inset-[4px]' },
};

type ProAvatarFrameProps = {
  /** When true, show orbit animation (e.g. Pro member who opted in). */
  active: boolean;
  /** Where the avatar is shown — controls orbit radius. */
  orbit?: keyof typeof ORBIT;
  children: ReactNode;
  className?: string;
};

/**
 * Animated monochrome rings around an avatar when `active` is true.
 * Subtle dual counter-rotating accent rings plus a slow “spark” segment.
 * CSS respects `prefers-reduced-motion`.
 */
export function ProAvatarFrame({ active, orbit = 'card', children, className }: ProAvatarFrameProps) {
  const o = ORBIT[orbit];

  return (
    <div className={cn('relative inline-flex items-center justify-center shrink-0', className)}>
      {active ? (
        <>
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute rounded-full border border-white/[0.08]',
              o.inner,
            )}
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute rounded-full border-2 border-transparent border-t-white/35 border-r-white/12 pro-avatar-orbit-cw',
              o.inner,
            )}
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute rounded-full border border-transparent border-b-white/22 border-l-white/8 pro-avatar-orbit-ccw',
              o.outer,
            )}
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute rounded-full border-2 border-transparent border-t-white/22 border-r-transparent border-b-transparent border-l-transparent pro-avatar-orbit-spark',
              o.spark,
            )}
          />
        </>
      ) : null}
      <div className={cn(active && 'relative z-[1]')}>{children}</div>
    </div>
  );
}
