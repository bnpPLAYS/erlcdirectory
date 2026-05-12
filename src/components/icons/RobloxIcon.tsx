import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** When true, the inner square is filled solid (looks correct on dark/light backgrounds). */
  title?: string;
};

/**
 * Official Roblox brand mark (tilted square with offset square cut-out).
 * Uses the canonical SimpleIcons SVG path so it matches Roblox's marketing usage.
 */
export function RobloxIcon({ className, title }: Props) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-4 w-4', className)}
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path d="M5.164 15.096 2.188 3.657a1.38 1.38 0 0 1 1.013-1.67L20.31.043a1.38 1.38 0 0 1 1.648 1.036l2.978 11.44a1.38 1.38 0 0 1-1.014 1.67l-17.11 2.945a1.38 1.38 0 0 1-1.648-1.036zm6.06-2.266 3.303-.567-1.04-3.993-3.303.567 1.04 3.993z" />
    </svg>
  );
}
