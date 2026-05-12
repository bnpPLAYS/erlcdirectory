import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchRobloxPublicUserInfo, type RobloxPublicUserInfo } from '@/lib/fetchRobloxPublicUserInfo';
import { robloxHeadshotImageUrl, robloxWebProfileUrl } from '@/lib/robloxProfileUrl';

type Props = {
  robloxUserId: string;
  /** `compact` fits the Pro section; `default` is the main Roblox card. */
  variant?: 'default' | 'compact';
  className?: string;
};

export function RobloxLinkedPreview({ robloxUserId, variant = 'default', className }: Props) {
  const [info, setInfo] = useState<RobloxPublicUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [headshotBroken, setHeadshotBroken] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setInfo(null);
    setHeadshotBroken(false);
    void (async () => {
      try {
        const d = await fetchRobloxPublicUserInfo(robloxUserId, ac.signal);
        if (!cancelled) setInfo(d);
      } catch {
        if (!cancelled) setInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [robloxUserId]);

  const profileHref = robloxWebProfileUrl(robloxUserId);
  const headshotSrc = robloxHeadshotImageUrl(robloxUserId, variant === 'compact' ? 96 : 180);

  const showName = info?.displayName?.trim() || info?.name;
  const showHandle =
    info && info.name && info.displayName.trim() !== info.name ? `@${info.name}` : null;

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3 min-w-0', className)}>
        {headshotSrc && !headshotBroken ? (
          <img
            src={headshotSrc}
            alt={showName ? `Roblox avatar for ${showName}` : 'Roblox avatar'}
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full border border-white/15 bg-black/40 object-cover"
            onError={() => setHeadshotBroken(true)}
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full border border-dashed border-white/20 bg-white/[0.04]" />
        )}
        <div className="min-w-0 flex-1">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading Roblox profile…</p>
          ) : showName ? (
            <p className="text-xs text-zinc-200 truncate">
              <span className="font-medium">{showName}</span>
              {showHandle ? <span className="text-muted-foreground"> {showHandle}</span> : null}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Linked id <span className="font-mono text-zinc-300">{robloxUserId}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 min-w-0',
        className,
      )}
    >
      {headshotSrc && !headshotBroken ? (
        <img
          src={headshotSrc}
          alt={showName ? `Roblox avatar for ${showName}` : 'Roblox avatar'}
          width={80}
          height={80}
          className="h-20 w-20 shrink-0 rounded-2xl border border-white/12 bg-black/40 object-cover"
          onError={() => setHeadshotBroken(true)}
        />
      ) : (
        <div className="h-20 w-20 shrink-0 rounded-2xl border border-dashed border-white/15 bg-white/[0.04]" />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading Roblox profile…</p>
        ) : showName ? (
          <>
            <p className="text-base font-semibold text-zinc-100 leading-snug truncate">{showName}</p>
            {showHandle ? <p className="text-sm text-muted-foreground truncate">{showHandle}</p> : null}
          </>
        ) : (
          <p className="text-sm text-zinc-200">Could not load display name — id is still linked.</p>
        )}
        <p className="text-xs text-muted-foreground font-mono tabular-nums">User id {robloxUserId}</p>
        {profileHref ? (
          <a
            href={profileHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-200 underline-offset-2 hover:text-white hover:underline mt-1"
          >
            Open Roblox profile
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}
