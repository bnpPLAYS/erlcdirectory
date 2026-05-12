import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 60_000;

export type NotificationItem = {
  id: string;
  kind: 'connection_request' | 'message';
  /** Other party id (sender). */
  fromProfileId: string;
  /** Display name / username for the toast and dropdown. */
  fromName: string;
  fromAvatar: string | null;
  /** Pre-built path the user should be sent to. */
  href: string;
  createdAt: string;
  /** Short snippet (message preview / connection note). */
  preview?: string | null;
};

type Counts = { incomingRequests: number; unreadMessages: number };

const ZERO: Counts = { incomingRequests: 0, unreadMessages: 0 };

/**
 * Reactive unread + pending counts and recent notification items for the signed-in user.
 * - Polls every 60s.
 * - Subscribes to Supabase realtime channels (`connection_requests`, `messages`) when available.
 * - Toasts on new in-session arrivals.
 */
export function useUserNotifications() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<Counts>(ZERO);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const myId = profile?.id ?? null;

  const refresh = useCallback(async () => {
    if (!myId) {
      setCounts(ZERO);
      setItems([]);
      seenRef.current = new Set();
      initialLoadRef.current = true;
      return;
    }

    const [reqRes, msgRes] = await Promise.all([
      supabase
        .from('connection_requests')
        .select('id, sender_id, message, created_at')
        .eq('receiver_id', myId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('receiver_id', myId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const reqRows = reqRes.data ?? [];
    const msgRows = msgRes.data ?? [];

    const senderIds = Array.from(
      new Set([...reqRows.map((r) => r.sender_id), ...msgRows.map((m) => m.sender_id)]),
    );

    const senderMap = new Map<
      string,
      { display_name: string | null; discord_username: string | null; discord_avatar: string | null }
    >();
    if (senderIds.length) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, display_name, discord_username, discord_avatar')
        .in('id', senderIds);
      (people ?? []).forEach((p) => {
        senderMap.set(p.id, {
          display_name: p.display_name,
          discord_username: p.discord_username,
          discord_avatar: p.discord_avatar,
        });
      });
    }

    const requestItems: NotificationItem[] = reqRows.map((r) => {
      const s = senderMap.get(r.sender_id);
      const name = s?.display_name?.trim() || s?.discord_username || 'Member';
      return {
        id: `req:${r.id}`,
        kind: 'connection_request',
        fromProfileId: r.sender_id,
        fromName: name,
        fromAvatar: s?.discord_avatar ?? null,
        href: '/connections?tab=incoming',
        createdAt: r.created_at,
        preview: r.message ?? null,
      };
    });

    const messageItems: NotificationItem[] = msgRows.map((m) => {
      const s = senderMap.get(m.sender_id);
      const name = s?.display_name?.trim() || s?.discord_username || 'Member';
      return {
        id: `msg:${m.id}`,
        kind: 'message',
        fromProfileId: m.sender_id,
        fromName: name,
        fromAvatar: s?.discord_avatar ?? null,
        href: `/messages?with=${m.sender_id}`,
        createdAt: m.created_at,
        preview: m.content,
      };
    });

    const merged = [...requestItems, ...messageItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (!initialLoadRef.current) {
      for (const it of merged) {
        if (seenRef.current.has(it.id)) continue;
        seenRef.current.add(it.id);
        if (it.kind === 'connection_request') {
          toast.info(`${it.fromName} sent you a connection request`, {
            description: it.preview ? `“${it.preview.slice(0, 120)}”` : undefined,
            action: { label: 'Open', onClick: () => (window.location.href = it.href) },
          });
        } else {
          toast.info(`New message from ${it.fromName}`, {
            description: it.preview ? it.preview.slice(0, 140) : undefined,
            action: { label: 'Open', onClick: () => (window.location.href = it.href) },
          });
        }
      }
    } else {
      for (const it of merged) seenRef.current.add(it.id);
      initialLoadRef.current = false;
    }

    setItems(merged);
    setCounts({ incomingRequests: requestItems.length, unreadMessages: messageItems.length });
  }, [myId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!myId) return;
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [myId, refresh]);

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`notifications:${myId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'connection_requests', filter: `receiver_id=eq.${myId}` },
        () => {
          void refresh();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${myId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, refresh]);

  return { counts, items, refresh };
}
