import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, MessageSquare, UserPlus, Search, Inbox, Send, Check, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import VerifiedBadge from '@/components/ui/verified-badge';
import { toast } from 'sonner';
import { pageHeroEnter } from '@/lib/pageHero';
import { profilePath } from '@/lib/profilePath';

interface Person {
  id: string;
  display_name: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  bio: string | null;
  is_verified: boolean;
}

interface Request {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  message: string | null;
  created_at: string;
  other: Person;
}

interface Connection extends Person {
  request_id: string;
  connected_at: string;
}

const VALID_TABS = ['connections', 'incoming', 'sent'] as const;
type ConnectionsTab = (typeof VALID_TABS)[number];

function readTabParam(value: string | null): ConnectionsTab {
  return (VALID_TABS as readonly string[]).includes(value || '') ? (value as ConnectionsTab) : 'connections';
}

const Connections = () => {
  const { user, profile, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = readTabParam(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState<ConnectionsTab>(initialTab);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const next = readTabParam(searchParams.get('tab'));
    setActiveTab((cur) => (cur === next ? cur : next));
  }, [searchParams]);
  const [fetching, setFetching] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [sent, setSent] = useState<Request[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const myId = profile?.id;

  const load = async () => {
    if (!myId) return;
    setFetching(true);
    try {
      const { data: rows } = await supabase
        .from('connection_requests')
        .select('id, sender_id, receiver_id, status, message, created_at, responded_at')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false });

      const otherIds = Array.from(
        new Set(
          (rows || []).map((r) => (r.sender_id === myId ? r.receiver_id : r.sender_id)),
        ),
      );

      let peopleMap = new Map<string, Person>();
      if (otherIds.length) {
        const { data: people } = await supabase
          .from('profiles')
          .select('id, display_name, discord_username, discord_avatar, bio, is_verified')
          .in('id', otherIds);
        (people || []).forEach((p) => peopleMap.set(p.id, p as Person));
      }

      const conns: Connection[] = [];
      const inReq: Request[] = [];
      const outReq: Request[] = [];

      (rows || []).forEach((r) => {
        const otherId = r.sender_id === myId ? r.receiver_id : r.sender_id;
        const other = peopleMap.get(otherId);
        if (!other) return;
        if (r.status === 'accepted') {
          conns.push({
            ...other,
            request_id: r.id,
            connected_at: (r as any).responded_at || r.created_at,
          });
        } else if (r.status === 'pending') {
          const item: Request = {
            id: r.id,
            sender_id: r.sender_id,
            receiver_id: r.receiver_id,
            status: r.status,
            message: r.message,
            created_at: r.created_at,
            other,
          };
          if (r.receiver_id === myId) inReq.push(item);
          else outReq.push(item);
        }
      });

      setConnections(conns);
      setIncoming(inReq);
      setSent(outReq);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    load();
  }, [myId]);

  const respond = async (id: string, accept: boolean) => {
    setRespondingId(id);
    const { error } = await supabase
      .from('connection_requests')
      .update({
        status: accept ? 'accepted' : 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('id', id);
    setRespondingId(null);
    if (error) {
      toast.error('Could not respond');
      return;
    }
    toast.success(accept ? 'Connection accepted' : 'Request declined');
    load();
  };

  const cancel = async (id: string) => {
    setRespondingId(id);
    const { error } = await supabase.from('connection_requests').delete().eq('id', id);
    setRespondingId(null);
    if (error) {
      toast.error('Could not cancel');
      return;
    }
    toast.success('Request cancelled');
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 text-center text-muted-foreground animate-pulse">Loading…</div>
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
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/10 grid place-items-center">
                <Users className="h-7 w-7" />
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">Connections</h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Sign in to send and accept connection requests.
              </p>
            </div>
            <div className="max-w-xl mx-auto">
              <Card className="card-elevated liquid-edge">
                <CardContent className="p-10 text-center">
                  <Link to="/auth">
                    <Button className="gap-2"><UserPlus className="h-4 w-4" /> Sign in</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const filteredConns = connections.filter(
    (c) =>
      !search ||
      c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.discord_username?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className={`text-center mb-8 ${pageHeroEnter}`}>
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/10 grid place-items-center">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">Your network</h1>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Manage your connections and respond to incoming requests.
            </p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              const next = readTabParam(v);
              setActiveTab(next);
              const sp = new URLSearchParams(searchParams);
              if (next === 'connections') sp.delete('tab');
              else sp.set('tab', next);
              setSearchParams(sp, { replace: true });
            }}
            className="w-full"
          >
            <TabsList className="glass mx-auto flex w-fit mb-6">
              <TabsTrigger value="connections" className="gap-2">
                <Users className="h-4 w-4" />
                Connections
                {connections.length > 0 && <span className="text-[10px] text-muted-foreground">({connections.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="incoming" className="gap-2">
                <Inbox className="h-4 w-4" />
                Incoming
                {incoming.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{incoming.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-2">
                <Send className="h-4 w-4" />
                Sent
                {sent.length > 0 && <span className="text-[10px] text-muted-foreground">({sent.length})</span>}
              </TabsTrigger>
            </TabsList>

            {/* CONNECTIONS */}
            <TabsContent value="connections">
              <div className="mb-5 max-w-xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search your connections…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-11 bg-white/[0.04] border-white/10"
                  />
                </div>
              </div>

              {fetching ? (
                <p className="text-center text-sm text-muted-foreground animate-pulse">Loading…</p>
              ) : filteredConns.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredConns.map((c) => (
                    <Card key={c.id} className="card-elevated liquid-edge hover:border-white/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Link to={profilePath({ id: c.id, discord_username: c.discord_username })} className="shrink-0">
                            <Avatar className="h-12 w-12 ring-1 ring-white/10">
                              <AvatarImage src={c.discord_avatar || undefined} />
                              <AvatarFallback>{c.display_name?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                          </Link>
                          <Link to={profilePath({ id: c.id, discord_username: c.discord_username })} className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate">{c.display_name || c.discord_username || 'Member'}</span>
                              {c.is_verified && <VerifiedBadge size="sm" />}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {c.discord_username ? `@${c.discord_username}` : c.bio || 'No bio yet'}
                            </p>
                          </Link>
                          <Link to={`/messages?with=${c.id}`}>
                            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Message">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Users className="h-12 w-12 mx-auto mb-5 text-muted-foreground/60" />}
                  title="No connections yet"
                  desc="Send a connection request from someone's profile to start your network."
                  cta={<Link to="/browse"><Button className="gap-2"><Search className="h-4 w-4" /> Browse members</Button></Link>}
                />
              )}
            </TabsContent>

            {/* INCOMING */}
            <TabsContent value="incoming">
              {incoming.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="h-12 w-12 mx-auto mb-5 text-muted-foreground/60" />}
                  title="No incoming requests"
                  desc="When someone requests to connect, it'll show up here."
                />
              ) : (
                <div className="space-y-3 max-w-2xl mx-auto">
                  {incoming.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      busy={respondingId === r.id}
                      actions={
                        <>
                          <Button size="sm" onClick={() => respond(r.id, true)} disabled={respondingId === r.id} className="gap-2">
                            <Check className="h-4 w-4" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => respond(r.id, false)} disabled={respondingId === r.id} className="gap-2">
                            <X className="h-4 w-4" /> Decline
                          </Button>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* SENT */}
            <TabsContent value="sent">
              {sent.length === 0 ? (
                <EmptyState
                  icon={<Send className="h-12 w-12 mx-auto mb-5 text-muted-foreground/60" />}
                  title="No pending sent requests"
                  desc="Requests you send will appear here until they're accepted or declined."
                />
              ) : (
                <div className="space-y-3 max-w-2xl mx-auto">
                  {sent.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      busy={respondingId === r.id}
                      pendingLabel
                      actions={
                        <Button size="sm" variant="outline" onClick={() => cancel(r.id)} disabled={respondingId === r.id} className="gap-2">
                          <X className="h-4 w-4" /> Cancel
                        </Button>
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
};

const RequestCard = ({
  request,
  actions,
  busy,
  pendingLabel,
}: {
  request: Request;
  actions: React.ReactNode;
  busy: boolean;
  pendingLabel?: boolean;
}) => {
  const p = request.other;
  return (
    <Card className="card-elevated liquid-edge">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link to={profilePath({ id: p.id, discord_username: p.discord_username })} className="shrink-0">
            <Avatar className="h-12 w-12 ring-1 ring-white/10">
              <AvatarImage src={p.discord_avatar || undefined} />
              <AvatarFallback>{p.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Link to={profilePath({ id: p.id, discord_username: p.discord_username })} className="font-medium truncate hover:underline">
                {p.display_name || p.discord_username || 'Member'}
              </Link>
              {p.is_verified && <VerifiedBadge size="sm" />}
              {pendingLabel && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-1">
                  <Clock className="h-3 w-3" /> Pending
                </span>
              )}
            </div>
            {p.discord_username && (
              <p className="text-xs text-muted-foreground">@{p.discord_username}</p>
            )}
            {request.message && (
              <p className="text-sm mt-2 glass rounded-lg px-3 py-2 border border-white/5">
                "{request.message}"
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0" aria-busy={busy}>
            {actions}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyState = ({
  icon,
  title,
  desc,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta?: React.ReactNode;
}) => (
  <Card className="card-elevated liquid-edge max-w-xl mx-auto">
    <CardContent className="p-10 text-center">
      {icon}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-muted-foreground mb-6 text-sm">{desc}</p>
      {cta}
    </CardContent>
  </Card>
);

export default Connections;
