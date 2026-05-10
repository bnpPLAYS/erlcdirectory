import { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  SITE_CHANGELOG_VERSION,
  readChangelogDismissedVersion,
  writeChangelogDismissed,
} from '@/lib/siteUiPreferences';

const ENTRIES: string[] = [
  'ERLC Directory Pro (800 Robux): verify on /pro for bonus themes, directory boost, and a Pro badge.',
  'New full-width header — navigation is now a sticky site bar (no floating pill).',
  'Staff: you can minimize the top moderation strip to a single “Staff panel” control.',
  'Profile editor: platform link badges, directory “Recent work” picks, and safer Discord avatars.',
  'Bug reports still live in the bottom-left; this log sits in the bottom-right.',
];

/** One-time dismissible panel announcing recent product updates. */
export function SiteUpdateLog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = readChangelogDismissedVersion();
    setOpen(dismissed !== SITE_CHANGELOG_VERSION);
  }, []);

  const dismiss = () => {
    writeChangelogDismissed(SITE_CHANGELOG_VERSION);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-[45] w-[min(calc(100vw-2rem),20rem)] max-h-[min(70vh,24rem)] overflow-hidden rounded-xl border border-white/12',
        'bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300',
      )}
      role="dialog"
      aria-labelledby="site-update-log-title"
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-200">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p id="site-update-log-title" className="text-sm font-semibold text-foreground leading-tight truncate">
              What&apos;s new
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums">Update · Feb 2026</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={dismiss}
          aria-label="Dismiss update log"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="max-h-[min(50vh,18rem)] overflow-y-auto overscroll-contain px-3 py-3 space-y-2.5 text-xs text-muted-foreground leading-relaxed">
        {ENTRIES.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400/80" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 px-3 py-2">
        <Button type="button" variant="secondary" size="sm" className="w-full h-8 text-xs" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
