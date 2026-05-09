import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Users, Server as ServerIcon, CheckCircle2, Briefcase } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import ReviewsSection from '@/components/profile/ReviewsSection';

interface ServerRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  banner: string | null;
  discord_invite: string | null;
  member_count: number;
  staff_count: number;
  is_verified: boolean;
  is_hiring: boolean;
  guild_id: string | null;
  tags: string[];
}

interface CoworkerRow {
  id: string;
  role: string;
  is_current: boolean;
  is_verified: boolean;
  profile: {
    id: string;
    display_name: string | null;
    discord_avatar: string | null;
    discord_id: string | null;
    rating: number;
    review_count: number;
  } | null;
}

const ServerDetail = () => {
  const { id } = useParams();
  const [server, setServer] = useState<ServerRow | null>(null);
  const [coworkers, setCoworkers] = useState<CoworkerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase.from('servers').select('*').eq('id', id).maybeSingle();
      setServer(s as any);
      if (s?.guild_id) {
        const { data: exps } = await supabase
          .from('experiences')
          .select('id, role, is_current, is_verified, profile_id')
          .eq('guild_id', s.guild_id)
          .order('start_date', { ascending: false });
        const profileIds = [...new Set((exps || []).map((e) => e.profile_id))];
        let profilesMap = new Map<string, any>();
        if (profileIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, discord_avatar, discord_id, rating, review_count')
            .in('id', profileIds);
          profilesMap = new Map((profiles || []).map((p) => [p.id, p]));
        }
        setCoworkers(
          (exps || []).map((e) => ({
            id: e.id,
            role: e.role,
            is_current: !!e.is_current,
            is_verified: !!e.is_verified,
            profile: profilesMap.get(e.profile_id) || null,
          }))
        );
      } else {
        setCoworkers([]);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Server not found</h1>
          <Link to="/servers"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to servers</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="relative h-48 md:h-60 w-full overflow-hidden border-b border-white/10">
        {server.banner ? (
          <img src={server.banner} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/15 via-background to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent pointer-events-none" />
      </div>

      <div className="container mx-auto px-4 -mt-16 relative z-10">
        <Link to="/servers">
          <Button variant="ghost" size="sm" className="gap-2 backdrop-blur-sm bg-background/40 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to servers
          </Button>
        </Link>

        <Card className="card-elevated mb-6">
          <CardContent className="p-5 md:p-7">
            <div className="flex flex-col md:flex-row md:items-end gap-5">
              <Avatar className="h-24 w-24 rounded-2xl ring-4 ring-background">
                <AvatarImage src={server.icon || undefined} className="object-cover" />
                <AvatarFallback className="rounded-2xl text-2xl bg-secondary">
                  <ServerIcon className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{server.name}</h1>
                  {server.is_verified && <CheckCircle2 className="h-5 w-5 text-verified" />}
                  {server.is_hiring && <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/5">Hiring</Badge>}
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">{server.description || 'No description yet.'}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {server.member_count} members</span>
                  <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {server.staff_count} listed staff</span>
                </div>
              </div>
              {server.discord_invite && (
                <a href={server.discord_invite} target="_blank" rel="noreferrer">
                  <Button className="gap-2"><ExternalLink className="h-4 w-4" /> Join Discord</Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Members who work here
              <span className="text-xs text-muted-foreground font-normal">({server.staff_count})</span>
            </h2>
            {coworkers.length === 0 ? (
              <Card className="card-elevated">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No verified staff yet. Members who add and verify experience here will show up.
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {coworkers.map((c) => (
                  <Card key={c.id} className="card-interactive">
                    <CardContent className="p-4">
                      <Link to={`/profile/${c.profile?.id}`} className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={c.profile?.discord_avatar || undefined} />
                          <AvatarFallback>{c.profile?.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm truncate">{c.profile?.display_name || 'Member'}</p>
                            {c.is_verified && <CheckCircle2 className="h-3 w-3 text-verified flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{c.role}{c.is_current ? ' • current' : ''}</p>
                        </div>
                        {c.profile?.discord_id && (
                          <a
                            href={`https://discord.com/users/${c.profile.discord_id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-muted-foreground hover:text-foreground"
                            title="Open in Discord"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <ReviewsSection serverId={server.id} serverName={server.name} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerDetail;
