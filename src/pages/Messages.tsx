import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, Search, Send, ArrowLeft, User, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import { useAuth } from '@/hooks/useAuth';
import { filterPlaintext } from '@/lib/chatFilter';
import { toast } from 'sonner';
import { pageHeroEnter } from '@/lib/pageHero';
import { supabase } from '@/integrations/supabase/client';
import { orderedParticipantIds } from '@/lib/conversationPair';
import { profilePath } from '@/lib/profilePath';
import { SubmitReportDialog } from '@/components/moderation/SubmitReportDialog';
import { cn } from '@/lib/utils';
import { publicErrorMessage, devWarn } from '@/lib/clientErrorHandling';
import logo from '@/assets/logo.png';

interface Participant {
  id: string;
  display_name: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  is_verified: boolean;
}

interface Conversation {
  id: string;
  participant: Participant;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_read: boolean | null;
}

interface SelectedThread {
  conversationId: string;
  other: Participant;
}

function formatShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function displayName(p: Pick<Participant, 'display_name' | 'discord_username'>): string {
  return (p.display_name || p.discord_username || 'Member').trim();
}

const Messages = () => {
  const { user, profile, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const composeWith = searchParams.get('with') ?? searchParams.get('user');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<SelectedThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadMessagesForPair = useCallback(async (meId: string, otherId: string) => {
    setMsgLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, sender_id, receiver_id, created_at, is_read')
      .or(`and(sender_id.eq.${meId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${meId})`)
      .order('created_at', { ascending: true });
    setMsgLoading(false);
    if (error) {
      toast.error(publicErrorMessage('Could not load messages.', error));
      setMessages([]);
      return;
    }
    setMessages((data as Message[]) ?? []);
  }, []);

  const markThreadRead = useCallback(async (meId: string, otherId: string) => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', meId)
      .eq('sender_id', otherId)
      .eq('is_read', false);
  }, []);

  const loadConversations = useCallback(async () => {
    if (!profile?.id) return;
    const meId = profile.id;
    setListLoading(true);
    try {
      const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('id, last_message_at, participant_one, participant_two')
        .or(`participant_one.eq.${meId},participant_two.eq.${meId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (convErr) throw convErr;

      if (!(convs ?? []).length) {
        setConversations([]);
        return;
      }

      const others = (convs ?? []).map((c) =>
        c.participant_one === meId ? c.participant_two : c.participant_one,
      );

      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('id, display_name, discord_username, discord_avatar, is_verified')
        .in('id', others);
      if (pErr) throw pErr;

      const pmap = new Map((profs ?? []).map((p) => [p.id, p as Participant]));

      const { data: recentMsgs } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
        .order('created_at', { ascending: false })
        .limit(400);

      const lastByPeer = new Map<string, { content: string; created_at: string }>();
      for (const m of recentMsgs ?? []) {
        const peer = m.sender_id === meId ? m.receiver_id : m.sender_id;
        if (!lastByPeer.has(peer)) {
          lastByPeer.set(peer, { content: m.content, created_at: m.created_at });
        }
      }

      const unreadBySender = new Map<string, number>();
      const { data: unreadRows } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', meId)
        .eq('is_read', false);
      for (const r of unreadRows ?? []) {
        unreadBySender.set(r.sender_id, (unreadBySender.get(r.sender_id) ?? 0) + 1);
      }

      const rows: Conversation[] = (convs ?? []).map((c) => {
        const oid = c.participant_one === meId ? c.participant_two : c.participant_one;
        const p = pmap.get(oid);
        const last = lastByPeer.get(oid);
        const fallbackTime = c.last_message_at ?? last?.created_at ?? '';
        const participant: Participant = {
          id: oid,
          display_name: p?.display_name ?? null,
          discord_username: p?.discord_username ?? null,
          discord_avatar: p?.discord_avatar ?? null,
          is_verified: !!p?.is_verified,
        };
        return {
          id: c.id,
          participant,
          lastMessage: last?.content ?? 'No messages yet',
          lastMessageAt: formatShort(last?.created_at ?? fallbackTime),
          unreadCount: unreadBySender.get(oid) ?? 0,
        };
      });

      setConversations(rows);
    } catch (e: unknown) {
      devWarn('[Messages] loadConversations', e);
      toast.error(publicErrorMessage('Inbox failed to load.', e));
      setConversations([]);
    } finally {
      setListLoading(false);
    }
  }, [profile?.id]);

  const assertConnected = useCallback(async (meId: string, otherId: string) => {
    const { data } = await supabase
      .from('connection_requests')
      .select('id')
      .eq('status', 'accepted')
      .or(`and(sender_id.eq.${meId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${meId})`)
      .maybeSingle();
    return !!data;
  }, []);

  const ensureConversationRow = useCallback(async (meId: string, otherId: string): Promise<string> => {
    const [p1, p2] = orderedParticipantIds(meId, otherId);
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_one', p1)
      .eq('participant_two', p2)
      .maybeSingle();
    if (existing?.id) return existing.id;

    const { data: inserted, error } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single();

    if (!error && inserted?.id) return inserted.id;

    if (error?.code === '23505') {
      const { data: retry } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_one', p1)
        .eq('participant_two', p2)
        .maybeSingle();
      if (retry?.id) return retry.id;
    }

    throw new Error(error?.message || 'Conversation failed to create');
  }, []);

  const openThread = useCallback(
    async (otherId: string) => {
      if (!profile?.id || otherId === profile.id) return;
      const connected = await assertConnected(profile.id, otherId);
      if (!connected) {
        toast.error('Messages only work with people you are connected to.');
        return;
      }

      let conversationId: string;
      try {
        conversationId = await ensureConversationRow(profile.id, otherId);
      } catch (e: unknown) {
        devWarn('[Messages] openThread', e);
        toast.error(publicErrorMessage('Could not start that chat.', e));
        return;
      }

      const { data: p, error: pe } = await supabase
        .from('profiles')
        .select('id, display_name, discord_username, discord_avatar, is_verified')
        .eq('id', otherId)
        .maybeSingle();

      if (pe || !p) {
        toast.error(publicErrorMessage('Profile failed to load.', pe));
        return;
      }

      const other: Participant = {
        id: p.id,
        display_name: p.display_name,
        discord_username: p.discord_username,
        discord_avatar: p.discord_avatar,
        is_verified: !!p.is_verified,
      };

      setSelected({ conversationId, other });
      await loadMessagesForPair(profile.id, otherId);
      await markThreadRead(profile.id, otherId);
      void loadConversations();
    },
    [
      profile?.id,
      assertConnected,
      ensureConversationRow,
      loadMessagesForPair,
      markThreadRead,
      loadConversations,
    ],
  );

  useEffect(() => {
    if (!user || !profile?.id) return;
    void loadConversations();
  }, [user, profile?.id, loadConversations]);

  useEffect(() => {
    if (!composeWith || !profile?.id || composeWith === profile.id) return;
    let cancelled = false;
    void (async () => {
      await openThread(composeWith);
      if (cancelled) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('with');
          next.delete('user');
          return next;
        },
        { replace: true },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [composeWith, profile?.id, openThread, setSearchParams]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selected?.conversationId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selected || !profile?.id) return;
    const { text, blockedHits } = filterPlaintext(newMessage.trim());
    if (!text) return;
    if (blockedHits) toast.info('Message wording was adjusted to meet community guidelines.');

    const receiverId = selected.other.id;
    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      receiver_id: receiverId,
      content: text,
    });

    if (error) {
      toast.error(publicErrorMessage('Message did not send.', error));
      return;
    }

    const now = new Date().toISOString();
    await supabase.from('conversations').update({ last_message_at: now }).eq('id', selected.conversationId);

    setNewMessage('');
    await loadMessagesForPair(profile.id, receiverId);
    await loadConversations();
  };

  const selectFromList = async (conv: Conversation) => {
    if (!profile?.id) return;
    setSelected({
      conversationId: conv.id,
      other: conv.participant,
    });
    await loadMessagesForPair(profile.id, conv.participant.id);
    await markThreadRead(profile.id, conv.participant.id);
    await loadConversations();
  };

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const name = displayName(c.participant).toLowerCase();
    const handle = (c.participant.discord_username || '').toLowerCase();
    return name.includes(q) || handle.includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">Loading…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className={`text-center mb-10 ${pageHeroEnter}`}>
              <img
                src={logo}
                alt=""
                className="logo-mark mx-auto mb-6 h-14 w-14 object-contain sm:h-16 sm:w-16"
                width={64}
                height={64}
                decoding="async"
                aria-hidden
              />
              <h1 className="text-3xl md:text-4xl font-bold mb-3">Messages</h1>
              <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Private inbox for people you have already connected with on ERLC Directory. Accept a connection request
                first, then open a thread here or from their profile.
              </p>
            </div>

            <Card className="border-white/10 bg-white/[0.02] card-elevated">
              <CardContent className="p-10 sm:p-12 text-center">
                <MessageSquare className="h-14 w-14 mx-auto mb-5 text-muted-foreground/50" />
                <h2 className="text-xl font-semibold mb-2">Sign in to message</h2>
                <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto leading-relaxed">
                  Use Discord sign-in to access your inbox and reply to connections.
                </p>
                <Link to="/auth">
                  <Button className="gap-2">
                    <User className="h-4 w-4" />
                    Sign in with Discord
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <div className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {composeWith && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground">
            Opening a conversation…{' '}
            <Link
              to={profilePath({ id: composeWith, discord_username: null })}
              className="text-foreground underline-offset-4 hover:underline"
            >
              View profile
            </Link>
          </div>
        )}

        <header className="mb-6 md:hidden">
          <h1 className="text-xl font-bold tracking-tight">Messages</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Connections only</p>
        </header>

        <div className="grid gap-4 md:gap-5 md:grid-cols-[minmax(260px,320px)_1fr]">
          {/* Conversation list */}
          <Card
            className={cn(
              'flex flex-col border-white/10 bg-zinc-950/40 overflow-hidden min-h-[min(420px,70vh)] md:min-h-[calc(100vh-140px)]',
              selected ? 'hidden md:flex' : 'flex',
            )}
          >
            <div className="p-4 border-b border-white/10 shrink-0">
              <h2 className="font-semibold text-sm tracking-tight mb-3 hidden md:block">Inbox</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-white/12 bg-black/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {listLoading ? (
                <div className="p-10 text-center text-muted-foreground text-sm">Loading conversations…</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  <MessageSquare className="h-11 w-11 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-foreground/90">No conversations yet</p>
                  <p className="text-xs mt-2 max-w-[14rem] mx-auto leading-relaxed">
                    Send a connection request from a profile. After they accept, you can message them here.
                  </p>
                  <Button variant="outline" size="sm" className="mt-5 border-white/15" asChild>
                    <Link to="/connections">Go to Connections</Link>
                  </Button>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    className={cn(
                      'w-full text-left p-4 border-b border-white/[0.06] transition-colors hover:bg-white/[0.04]',
                      selected?.conversationId === conv.id && 'bg-white/[0.07]',
                    )}
                    onClick={() => void selectFromList(conv)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-1 ring-white/10">
                        <AvatarImage src={conv.participant.discord_avatar || undefined} />
                        <AvatarFallback>{displayName(conv.participant)[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{displayName(conv.participant)}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                            {conv.lastMessageAt}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-white text-black text-[11px] font-semibold flex items-center justify-center shrink-0">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Thread */}
          <Card
            className={cn(
              'flex flex-col border-white/10 bg-zinc-950/40 overflow-hidden min-h-[min(480px,75vh)] md:min-h-[calc(100vh-140px)]',
              selected ? 'flex' : 'hidden md:flex',
            )}
          >
            {selected ? (
              <>
                <div className="p-3 sm:p-4 border-b border-white/10 flex items-center gap-3 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden shrink-0 -ml-1"
                    onClick={() => setSelected(null)}
                    aria-label="Back to inbox"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Link
                    to={profilePath(selected.other)}
                    className="flex items-center gap-3 min-w-0 flex-1 rounded-lg hover:bg-white/[0.04] -mx-1 px-1 py-0.5 transition-colors"
                  >
                    <Avatar className="h-10 w-10 ring-1 ring-white/10">
                      <AvatarImage src={selected.other.discord_avatar || undefined} />
                      <AvatarFallback>{displayName(selected.other)[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 text-left">
                      <h2 className="font-semibold text-sm truncate">{displayName(selected.other)}</h2>
                      <p className="text-[11px] text-muted-foreground">View profile</p>
                    </div>
                  </Link>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
                  {msgLoading ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                      Loading messages…
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full min-h-[12rem] flex flex-col items-center justify-center text-center text-muted-foreground px-4">
                      <p className="text-sm">No messages yet</p>
                      <p className="text-xs mt-2 max-w-xs leading-relaxed">
                        Say hello — your messages stay between you and this connection.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const mine = msg.sender_id === profile?.id;
                      return (
                        <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                          <div
                            className={cn(
                              'max-w-[min(85%,28rem)] rounded-2xl px-3.5 py-2.5 shadow-sm',
                              mine
                                ? 'bg-white text-zinc-950 rounded-br-md'
                                : 'bg-white/[0.06] text-foreground border border-white/10 rounded-bl-md',
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                            <div className="flex items-center justify-between gap-3 mt-1.5">
                              <span
                                className={cn(
                                  'text-[10px] tabular-nums',
                                  mine ? 'text-zinc-600' : 'text-muted-foreground',
                                )}
                              >
                                {new Date(msg.created_at).toLocaleTimeString(undefined, {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                              {profile?.id && !mine && selected?.conversationId && (
                                <button
                                  type="button"
                                  className="text-[10px] inline-flex items-center gap-1 opacity-80 hover:opacity-100 underline-offset-2 hover:underline shrink-0"
                                  onClick={() => setReportMessageId(msg.id)}
                                >
                                  <Flag className="h-3 w-3" aria-hidden />
                                  Report
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={threadEndRef} />
                </div>

                <div className="p-3 sm:p-4 border-t border-white/10 shrink-0 bg-black/25">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <Textarea
                      placeholder="Write a message…"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      rows={2}
                      className="min-h-[3.25rem] max-h-32 resize-y border-white/12 bg-black/40 text-sm sm:flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      className="sm:self-stretch shrink-0 gap-2 bg-white text-black hover:bg-white/90"
                      onClick={() => void handleSendMessage()}
                      disabled={!newMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Enter to send · Shift+Enter for a new line</p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground min-h-[280px] p-8 text-center">
                <MessageSquare className="h-12 w-12 mb-4 opacity-35" />
                <p className="text-sm font-medium text-foreground/80">Select a conversation</p>
                <p className="text-xs mt-2 max-w-sm leading-relaxed">
                  Choose someone from your inbox, or open Messages from a connected profile.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <SubmitReportDialog
        open={!!reportMessageId}
        onOpenChange={(o) => {
          if (!o) setReportMessageId(null);
        }}
        kind="message"
        messageId={reportMessageId}
        conversationId={selected?.conversationId ?? null}
      />

      <SiteFooter />
    </div>
  );
};

export default Messages;
