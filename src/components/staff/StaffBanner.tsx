import { Link } from 'react-router-dom';
import { ChevronUp, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  visible: boolean;
  /** When true, only a slim “Staff panel” strip is shown. */
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
};

/** Fixed strip for directory staff — quick access to /staff; can collapse to a minimal control. */
export function StaffBanner({ visible, compact, onCompactChange }: Props) {
  if (!visible) return null;

  if (compact) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] h-9 flex items-center justify-center gap-3 px-3 sm:px-5 bg-zinc-950/95 backdrop-blur-md border-b border-amber-500/30 pointer-events-auto">
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="h-7 text-xs shrink-0 rounded-md gap-1.5 px-3 border border-amber-500/25 bg-amber-950/40 text-amber-50 hover:bg-amber-950/60"
        >
          <Link to="/staff" className="inline-flex items-center">
            <Shield className="h-3.5 w-3.5 text-amber-400" aria-hidden />
            Staff panel
          </Link>
        </Button>
        <button
          type="button"
          onClick={() => onCompactChange(false)}
          className="text-[11px] font-medium text-amber-400/90 hover:text-amber-300 transition-colors inline-flex items-center gap-1"
        >
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          Show staff bar
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-10 flex items-center justify-between gap-3 px-4 sm:px-6 bg-gradient-to-r from-zinc-950 via-amber-950/85 to-zinc-950 border-b border-amber-500/35 pointer-events-auto shadow-md">
      <span className="text-xs font-medium text-amber-50/95 flex items-center gap-2 min-w-0">
        <Shield className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
        <span className="truncate">Staff mode — moderation tools available</span>
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-[11px] text-amber-200/90 hover:text-amber-50 hover:bg-white/10"
          onClick={() => onCompactChange(true)}
        >
          Hide
        </Button>
        <Button
          asChild
          size="sm"
          variant="secondary"
          className="h-8 text-xs rounded-md gap-1.5 px-3 border border-white/10"
        >
          <Link to="/staff">Staff panel</Link>
        </Button>
      </div>
    </div>
  );
}

/** Pixel height of the staff strip for layout math (must match Tailwind h-9 / h-10). */
export function staffBannerHeightPx(compact: boolean): number {
  return compact ? 36 : 40;
}
