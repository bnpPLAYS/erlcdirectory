import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Fixed strip for directory staff — quick access to /staff. */
export function StaffBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-10 flex items-center justify-between px-4 sm:px-6 bg-gradient-to-r from-zinc-900 via-amber-950/90 to-zinc-900 border-b border-amber-500/35 pointer-events-auto shadow-md">
      <span className="text-xs font-medium text-amber-50/95 flex items-center gap-2 min-w-0">
        <Shield className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
        <span className="truncate">Staff mode — moderation tools available</span>
      </span>
      <Button asChild size="sm" variant="secondary" className="h-8 text-xs shrink-0 rounded-full gap-1.5 px-3">
        <Link to="/staff">Staff panel</Link>
      </Button>
    </div>
  );
}
