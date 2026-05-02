import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, UserPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import VerifiedBadge from '@/components/ui/verified-badge';

interface Connection {
  id: string;
  display_name: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  bio: string | null;
  is_verified: boolean;
  last_message_at: string | null;
}

const Connections = () => {
  const { user, profile, loading } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;
      setFetching(true);
      try {
        const { data: convos } = await supabase
          .from('conversations')
          .select('id, participant_one, participant_two, last_message_at')
          .or(`participant_one.eq.${profile.id},participant_two.eq.${profile.id}`)
          .order('last_message_at', { ascending: false });

        const otherIds = (convos || [])
          .map((c) => (c.participant_one === profile.id ? c.participant_two : c.participant_one))
          .filter(Boolean);

        if (otherIds.length === 0) {
          setConnections([]);
          return;
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, discord_username, discord_avatar, bio, is_verified')
          .in('id', otherIds);

        const lastMap = new Map<string, string | null>();
        (convos || []).forEach((c) => {
          const other = c.participant_one === profile.id ? c.participant_two : c.participant_one;
          if (other && !lastMap.has(other)) lastMap.set(other, c.last_message_at);
        });

        setConnections(
          (profiles || []).map((p) => ({
            id: p.id,
            display_name: p.display_name,
            discord_username: p.discord_username,
            discord_avatar: p.discord_avatar,
            bio: p.bio,
            is_verified: !!p.is_verified,
            last_message_at: lastMap.get(p.id) ?? null,
          })),
        );
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [profile?.id]);

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
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/10 grid place-items-center">
                <Users className="h-7 w-7" />
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">Connections</h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Keep track of ER:LC members you want to work with.
              </p>
            </div>

            <div className="max-w-xl mx-auto">
              <Card className="card-elevated liquid-edge">
                <CardContent className="p-10 text-center">
                  <Users className="h-12 w-12 mx-auto mb-5 text-muted-foreground/60" />
                  <h3 className="text-lg font-semibold mb-1">Sign in to manage your network</h3>
                  <p className="text-muted-foreground mb-6 text-sm">
                    Sign in with Discord to message members and grow your contacts.
                  </p>
                  <Link to="/auth">
                    <Button className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Sign in
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

  const filtered = connections.filter(
    (c) =>
      !searchQuery ||
      c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.discord_username?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-white/10 grid place-items-center">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">Your network</h1>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Members you've messaged. Pick up where you left off.
            </p>
          </div>

          <div className="mb-6 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search your network…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 bg-white/[0.04] border-white/10"
              />
            </div>
          </div>

          {fetching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="card-elevated">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-white/10 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                        <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((c) => (
                <Card key={c.id} className="card-elevated liquid-edge hover:border-white/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Link to={`/profile/${c.id}`} className="shrink-0">
                        <Avatar className="h-12 w-12 ring-1 ring-white/10">
                          <AvatarImage src={c.discord_avatar || undefined} />
                          <AvatarFallback>{c.display_name?.[0] || c.discord_username?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <Link to={`/profile/${c.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate">{c.display_name || c.discord_username || 'Member'}</span>
                          {c.is_verified && <VerifiedBadge size="sm" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.discord_username ? `@${c.discord_username}` : c.bio || 'No bio yet'}
                        </p>
                      </Link>
                      <Link to={`/messages?user=${c.id}`}>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card-elevated liquid-edge max-w-xl mx-auto">
              <CardContent className="p-10 text-center">
                <Users className="h-12 w-12 mx-auto mb-5 text-muted-foreground/60" />
                <h3 className="text-lg font-semibold mb-1">No connections yet</h3>
                <p className="text-muted-foreground mb-6 text-sm">
                  Browse members and start a conversation. They'll show up here.
                </p>
                <Link to="/browse">
                  <Button className="gap-2">
                    <Search className="h-4 w-4" />
                    Browse members
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
};

export default Connections;
