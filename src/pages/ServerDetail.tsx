import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Users, Server as ServerIcon, CheckCircle2, Briefcase, Shield } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import { profilePath } from '@/lib/profilePath';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import ReviewsSection from '@/components/profile/ReviewsSection';
import { normalizeDiscordInvite } from '@/lib/discordInvite';
import { useAuth } from '@/hooks/useAuth';
import { isSiteOwnerDiscordUsername } from '@/lib/siteOwner';
import { DIRECTORY_STAFF_VERIFIED_TITLE } from '@/lib/directoryVerified';

interface GuildExperienceRow {
  id: string;
  role: string;
  is_current: boolean;
  is_verified: boolean;
  profile_id: string;
  start_date: string;
}

/** One card per member — duplicate experience rows for the same guild skewed counts vs the list. */
function dedupeExperiencesOnePerProfile(exps: GuildExperienceRow[]): GuildExperienceRow[] {
  const sorted = [...exps].sort((a, b) => {
    if (a.is_verified !== b.is_verified) return (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0);
    if (a.is_current !== b.is_current) return (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0);
    return new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime();
  });
  const seen = new Set<string>();
  const out: GuildExperienceRow[] = [];
  for (const e of sorted) {
    if (!e.profile_id || seen.has(e.profile_id)) continue;
    seen.add(e.profile_id);
    out.push(e);
  }
  return out;
}

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
    discord_username: string | null;
    display_name: string | null;
    discord_avatar: string | null;
    discord_id: string | null;
    rating: number;
    review_count: number;
  } | null;
}

const ServerDetail = () => {
  const { id } = useParams();
  const { profile: meProfile } = useAuth();
  const isStaffSiteOwner = isSiteOwnerDiscordUsername(meProfile?.discord_username ?? null);
  const [server, setServer] = useState<ServerRow | null>(null);
  const [coworkers, setCoworkers] = useState<CoworkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const detailBannerRefreshRef = useRef<string | null>(null);

  useEffect(() => {
    detailBannerRefreshRef.current = null;
  }, [id]);

  useEffect(() => {
    if (!server?.id || !server.guild_id) return;
    if (detailBannerRefreshRef.current === server.id) return;
    detailBannerRefreshRef.current = server.id;
    let cancelled = false;
    void (async () => {
      await supabase.functions.invoke('servers-enrich-metadata', {
        body: { guild_ids: [server.guild_id], refresh_visuals: true },
      });
      if (cancelled) return;
      const { data: s } = await supabase.from('servers').select('*').eq('id', server.id).maybeSingle();
      if (s && !cancelled) setServer(s as ServerRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [server?.id, server?.guild_id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase.from('servers').select('*').eq('id', id).maybeSingle();
      setServer((s as ServerRow | null) ?? null);
      if (s?.guild_id) {
        const { data: expsRaw } = await supabase
          .from('experiences')
          .select('id, role, is_current, is_verified, profile_id, start_date')
          .eq('guild_id', s.guild_id);
        const exps = dedupeExperiencesOnePerProfile((expsRaw || []) as GuildExperienceRow[]);
        const profileIds = exps.map((e) => e.profile_id).filter(Boolean);
        let profilesMap = new Map<
          string,
          {
            id: string;
            discord_username: string | null;
            display_name: string | null;
            discord_avatar: string | null;
            discord_id: string | null;
            rating: number;
            review_count: number;
          }
        >();
        if (profileIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, discord_username, display_name, discord_avatar, discord_id, rating, review_count')
            .in('id', profileIds);
          profilesMap = new Map((profiles || []).map((p) => [p.id, p]));
        }
        setCoworkers(
          exps.map((e) => ({
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

  const joinHref = normalizeDiscordInvite(server.discord_invite);
  const staffListedCount = server.guild_id ? coworkers.length : server.staff_count;

  const toggleDirectoryVerified = async () => {
    if (!server) return;
    const next = !server.is_verified;
    let { error } = await supabase.rpc('site_owner_set_server_verified', {
      p_server_id: server.id,
      p_is_verified: next,
    });
    const msg = error?.message ?? '';
    const rpcUnavailable =
      !!error &&
      (/Could not find the function|schema cache|PGRST202|42883/i.test(msg) ||
        /site_owner_set_server_verified/i.test(msg));
    if (rpcUnavailable) {
      ({ error } = await supabase.from('servers').update({ is_verified: next }).eq('id', server.id));
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? 'Verify badge granted' : 'Verify badge removed');
    setServer({ ...server, is_verified: next });
  };

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
                  {server.is_verified && (
                    <Badge className="badge-verified text-[10px] px-2 py-0.5 shrink-0" title={DIRECTORY_STAFF_VERIFIED_TITLE}>
                      Verified
                    </Badge>
                  )}
                  {server.is_hiring && <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/5">Hiring</Badge>}
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">{server.description || 'No description yet.'}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {server.member_count} members</span>
                  <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {staffListedCount} work here</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0 md:self-end">
                {isStaffSiteOwner && (
                  <Button
                    type="button"
                    size="sm"
                    variant={server.is_verified ? 'outline' : 'secondary'}
                    className="gap-2"
                    onClick={() => void toggleDirectoryVerified()}
                  >
                    <Shield className="h-4 w-4" />
                    {server.is_verified ? 'Remove verify badge' : 'Grant verify badge'}
                  </Button>
                )}
                {joinHref && (
                  <a href={joinHref} target="_blank" rel="noopener noreferrer" className="inline-flex">
                    <Button className="gap-2 w-full sm:w-auto">
                      <ExternalLink className="h-4 w-4" /> Join Discord
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Members who work here
              <span className="text-xs text-muted-foreground font-normal">({staffListedCount})</span>
            </h2>
            {coworkers.length === 0 ? (
              <Card className="card-elevated">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No one listed yet. Members who add experience for this server will appear here.
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {coworkers.map((c) => (
                  <Card key={c.id} className="card-interactive">
                    <CardContent className="p-4">
                      <Link
                        to={c.profile ? profilePath(c.profile) : '/browse'}
                        className="flex items-center gap-3"
                      >
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
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <ReviewsSection
              serverId={server.id}
              serverName={server.name}
              serverReviewTargets={coworkers
                .filter((c) => c.profile?.id)
                .map((c) => ({
                  profileId: c.profile!.id,
                  display_name: c.profile!.display_name ?? null,
                  discord_avatar: c.profile!.discord_avatar ?? null,
                  discord_username: c.profile!.discord_username ?? null,
                }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerDetail;
