import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, Search, Send, ArrowLeft, User, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { filterPlaintext } from '@/lib/chatFilter';
import { toast } from 'sonner';
import { pageHeroEnter } from '@/lib/pageHero';
import { supabase } from '@/integrations/supabase/client';
import { orderedParticipantIds } from '@/lib/conversationPair';
import { profilePath } from '@/lib/profilePath';
import { SubmitReportDialog } from '@/components/moderation/SubmitReportDialog';

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

  const loadMessagesForPair = useCallback(async (meId: string, otherId: string) => {
    setMsgLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, sender_id, receiver_id, created_at, is_read')
      .or(`and(sender_id.eq.${meId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${meId})`)
      .order('created_at', { ascending: true });
    setMsgLoading(false);
    if (error) {
      toast.error(error.message);
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
      toast.error(e instanceof Error ? e.message : 'Could not load conversations');
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

    throw new Error(error?.message || 'Could not create conversation');
  }, []);

  const openThread = useCallback(
    async (otherId: string) => {
      if (!profile?.id || otherId === profile.id) return;
      const connected = await assertConnected(profile.id, otherId);
      if (!connected) {
        toast.error('You can only message people you have connected with.');
        return;
      }

      let conversationId: string;
      try {
        conversationId = await ensureConversationRow(profile.id, otherId);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Could not open conversation');
        return;
      }

      const { data: p, error: pe } = await supabase
        .from('profiles')
        .select('id, display_name, discord_username, discord_avatar, is_verified')
        .eq('id', otherId)
        .maybeSingle();

      if (pe || !p) {
        toast.error('Could not load profile');
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
      toast.error(error.message || 'Could not send message');
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
            <div className="animate-pulse text-muted-foreground">Loading...</div>
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
          <div className="container mx-auto px-4">
            <div className={`text-center mb-10 ${pageHeroEnter}`}>
              <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary-foreground" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">Messages</h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Message ER:LC members and server teams directly.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-2">Sign in to message</h3>
                  <p className="text-muted-foreground mb-6">
                    Connect Discord to start private conversations with members.
                  </p>
                  <Link to="/auth">
                    <Button className="gap-2">
                      <User className="h-4 w-4" />
                      Sign In with Discord
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-6">
        {composeWith && (
          <div className="mb-4 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground">
            Opening a conversation…{' '}
            <Link
              to={profilePath({ id: composeWith, discord_username: null })}
              className="text-foreground underline-offset-4 hover:underline"
            >
              View profile
            </Link>
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          <Card className="md:col-span-1 flex flex-col">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold mb-3">Messages</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {listLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Loading conversations…</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Connect with someone on their profile, then open Messages.</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${
                      selected?.conversationId === conv.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => void selectFromList(conv)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={conv.participant.discord_avatar || undefined} />
                        <AvatarFallback>{displayName(conv.participant)[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{displayName(conv.participant)}</span>
                          <span className="text-xs text-muted-foreground">{conv.lastMessageAt}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </Card>

          <Card className="md:col-span-2 flex flex-col">
            {selected ? (
              <>
                <div className="p-4 border-b border-border flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelected(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Link to={profilePath(selected.other)} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90">
                    <Avatar>
                      <AvatarImage src={selected.other.discord_avatar || undefined} />
                      <AvatarFallback>{displayName(selected.other)[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{displayName(selected.other)}</h3>
                      <p className="text-xs text-muted-foreground">View profile</p>
                    </div>
                  </Link>
                </div>

                <ScrollArea className="flex-1 p-4">
                  {msgLoading ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading messages…</div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <p className="text-sm">Send the first message</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_id === profile?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              msg.sender_id === profile?.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-xs opacity-70">
                                {new Date(msg.created_at).toLocaleTimeString(undefined, {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                              {profile?.id && msg.sender_id !== profile.id && selected?.conversationId && (
                                <button
                                  type="button"
                                  className="text-[11px] opacity-80 hover:opacity-100 inline-flex items-center gap-1 underline-offset-2 hover:underline"
                                  onClick={() => setReportMessageId(msg.id)}
                                >
                                  <Flag className="h-3 w-3" aria-hidden />
                                  Report
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                    />
                    <Button type="button" onClick={() => void handleSendMessage()} disabled={!newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground min-h-[280px]">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Choose a conversation</p>
                </div>
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
    </div>
  );
};

export default Messages;
