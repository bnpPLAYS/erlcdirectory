import { Link, useLocation } from 'react-router-dom';
import { Bug } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Beta: quick link to staff moderation / reports (staff-only; others see the access notice on /staff). */
export function BetaBugReportLink() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/staff')) return null;

  return (
    <Link
      to="/staff?tab=reports"
      className={cn(
        'fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-white/12',
        'bg-zinc-950/90 px-3 py-2 text-xs font-medium text-zinc-200 shadow-lg backdrop-blur-md',
        'hover:border-white/20 hover:bg-zinc-900/95 hover:text-white transition-colors',
        'max-w-[calc(100vw-2rem)] sm:max-w-none',
      )}
    >
      <Bug className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="truncate">Report a bug</span>
      <span className="hidden sm:inline text-[10px] font-normal text-zinc-500">Beta</span>
    </Link>
  );
}
