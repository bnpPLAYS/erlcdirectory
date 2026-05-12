import { Bell, MessageSquare, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserNotifications, type NotificationItem } from '@/hooks/useUserNotifications';
import { cn } from '@/lib/utils';
import { safeAvatarUrl, avatarReferrerPolicy } from '@/lib/safeAvatarUrl';

function formatRelativeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return 'now';
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

function NotificationRow({ item, onClose }: { item: NotificationItem; onClose: () => void }) {
  const navigate = useNavigate();
  const avatar = safeAvatarUrl(item.fromAvatar);
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        navigate(item.href);
      }}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
    >
      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
        <AvatarImage src={avatar} referrerPolicy={avatarReferrerPolicy(avatar)} />
        <AvatarFallback className="text-xs bg-zinc-800">
          {item.fromName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          {item.kind === 'connection_request' ? (
            <UserPlus className="h-3.5 w-3.5 text-emerald-300/90 shrink-0" aria-hidden />
          ) : (
            <MessageSquare className="h-3.5 w-3.5 text-sky-300/90 shrink-0" aria-hidden />
          )}
          <p className="text-sm font-medium text-foreground truncate">{item.fromName}</p>
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0">
            {formatRelativeShort(item.createdAt)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
          {item.kind === 'connection_request'
            ? item.preview
              ? `Sent a request: “${item.preview}”`
              : 'Sent you a connection request.'
            : item.preview
              ? item.preview
              : 'Sent you a message.'}
        </p>
      </div>
    </button>
  );
}

export function NotificationsBell() {
  const { counts, items } = useUserNotifications();
  const total = counts.incomingRequests + counts.unreadMessages;
  const visibleItems = items.slice(0, 8);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={total > 0 ? `${total} new notifications` : 'Notifications'}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] hover:text-white transition-colors"
        >
          <Bell className="h-4 w-4" />
          {total > 0 ? (
            <span
              className={cn(
                'absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                'bg-rose-500 text-white shadow-sm shadow-rose-500/40 tabular-nums',
              )}
            >
              {total > 9 ? '9+' : total}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-[min(92vw,22rem)] bg-zinc-950 border-white/10 p-2"
      >
        <DropdownMenuLabel className="px-3 py-2 flex items-center justify-between">
          <span className="text-sm">Notifications</span>
          {total > 0 ? (
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
              {counts.incomingRequests} requests · {counts.unreadMessages} messages
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {visibleItems.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            You’re all caught up.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {visibleItems.map((it) => (
              <NotificationRow key={it.id} item={it} onClose={() => undefined} />
            ))}
          </div>
        )}
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="grid grid-cols-2 gap-1 p-1">
          <DropdownMenuItem asChild className="justify-center text-xs">
            <Link to="/connections?tab=incoming">Connection requests</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="justify-center text-xs">
            <Link to="/messages">Messages</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
