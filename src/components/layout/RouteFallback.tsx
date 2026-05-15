import { Loader2 } from 'lucide-react';

/** Shown while lazy route chunks load (keeps layout stable). */
export function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin opacity-80" aria-hidden />
      <p className="text-sm">Loading…</p>
    </div>
  );
}
