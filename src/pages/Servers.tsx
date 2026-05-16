import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Navbar from '@/components/layout/Navbar';
import ServerCard from '@/components/server/ServerCard';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import { pageHeroEnter } from '@/lib/pageHero';
import SiteFooter from '@/components/layout/SiteFooter';
import { distinctStaffCountByGuild } from '@/lib/serverStaffCount';
import { useAuth } from '@/hooks/useAuth';
import {
  ServerOwnerPanel,
  type ServerOwnerPanelCoworker,
  type ServerOwnerPanelServer,
} from '@/components/server/ServerOwnerPanel';

interface ServerData {
  id: string;
  guild_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  banner: string | null;
  member_count: number;
  staff_count: number;
  is_verified: boolean;
  is_featured: boolean;
  is_hiring: boolean;
  tags: string[];
  discord_invite: string | null;
  owner_id: string | null;
  owner_profile?: { display_name: string | null; discord_username: string | null } | null;
}

interface GuildExperienceRow {
  id: string;
  role: string;
  is_current: boolean;
  is_verified: boolean;
  profile_id: string;
  start_date: string;
}

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

const Servers = () => {
  const { profile: meProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [filterHiring, setFilterHiring] = useState(false);
  const enrichOnceRef = useRef(false);

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelServer, setPanelServer] = useState<ServerOwnerPanelServer | null>(null);
  const [panelOwnerIsPro, setPanelOwnerIsPro] = useState(false);
  const [panelCoworkers, setPanelCoworkers] = useState<ServerOwnerPanelCoworker[]>([]);

  const fetchServers = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);
    try {
      let query = supabase.from('servers').select(
        'id, guild_id, name, description, icon, banner, member_count, staff_count, is_verified, is_featured, is_hiring, tags, discord_invite, owner_id, owner_profile:profiles!servers_owner_id_fkey(display_name, discord_username)',
      );

      if (sortBy === 'featured') {
        query = query.order('is_featured', { ascending: false }).order('member_count', { ascending: false });
      } else if (sortBy === 'members') {
        query = query.order('member_count', { ascending: false });
      } else if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(50);

      if (error || !data) {
        return;
      }

      const guildIds = [...new Set(data.map((s) => s.guild_id?.trim()).filter(Boolean))] as string[];

      if (guildIds.length === 0) {
        setServers(data as unknown as ServerData[]);
        return;
      }

      let counts: Map<string, number> | null = null;

      const { data: rpcRows, error: rpcErr } = await supabase.rpc('staff_counts_for_discord_guilds', {
        p_guild_ids: guildIds,
      });

      if (!rpcErr && rpcRows) {
        counts = new Map(
          (rpcRows as { guild_id: string; cnt: number }[]).map((r) => [r.guild_id.trim(), Number(r.cnt) || 0]),
        );
      } else {
        const { data: expRows, error: expErr } = await supabase
          .from('experiences')
          .select('guild_id, profile_id')
          .in('guild_id', guildIds);

        if (!expErr && expRows) counts = distinctStaffCountByGuild(expRows);
      }

      const merged = (data as ServerData[]).map((s) => {
        const gid = s.guild_id?.trim();
        if (!gid) return { ...s, staff_count: s.staff_count ?? 0 };
        if (counts !== null) return { ...s, staff_count: counts.get(gid) ?? 0 };
        return { ...s, staff_count: s.staff_count ?? 0 };
      });

      setServers(merged);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sortBy]);

  const loadCustomizePanel = useCallback(
    async (serverId: string) => {
      if (!meProfile?.id) return;
      setPanelLoading(true);
      setPanelServer(null);
      setPanelCoworkers([]);
      try {
        const { data: s, error: sErr } = await supabase.from('servers').select('*').eq('id', serverId).maybeSingle();
        if (sErr || !s) {
          toast.error(sErr?.message || 'Server not found.');
          setCustomizeOpen(false);
          return;
        }
        if (s.owner_id !== meProfile.id) {
          toast.error('You can only customize servers you own.');
          setCustomizeOpen(false);
          return;
        }
        setPanelServer(s as ServerOwnerPanelServer);

        const { data: op } = await supabase.from('profiles').select('is_pro').eq('id', s.owner_id).maybeSingle();
        setPanelOwnerIsPro(!!op?.is_pro);

        const guildId = typeof s.guild_id === 'string' ? s.guild_id.trim() : '';
        if (!guildId) {
          setPanelCoworkers([]);
          return;
        }

        const { data: expsRaw } = await supabase
          .from('experiences')
          .select('id, role, is_current, is_verified, profile_id, start_date')
          .eq('guild_id', guildId);
        const exps = dedupeExperiencesOnePerProfile((expsRaw || []) as GuildExperienceRow[]);
        const profileIds = exps.map((e) => e.profile_id).filter(Boolean);
        let profilesMap = new Map<string, { id: string; discord_username: string | null; display_name: string | null }>();
        if (profileIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, discord_username, display_name')
            .in('id', profileIds);
          profilesMap = new Map((profiles || []).map((p) => [p.id, p]));
        }
        const coworkers: ServerOwnerPanelCoworker[] = exps
          .map((e) => {
            const p = profilesMap.get(e.profile_id);
            if (!p?.id) return null;
            return {
              profileId: p.id,
              label: p.display_name || p.discord_username || 'Member',
              isVerified: !!e.is_verified,
            };
          })
          .filter((x): x is ServerOwnerPanelCoworker => x !== null);
        setPanelCoworkers(coworkers);
      } finally {
        setPanelLoading(false);
      }
    },
    [meProfile?.id],
  );

  const openCustomize = useCallback(
    (serverId: string) => {
      setCustomizeOpen(true);
      void loadCustomizePanel(serverId);
    },
    [loadCustomizePanel],
  );

  useEffect(() => {
    const id = searchParams.get('customize');
    if (!id || !meProfile?.id) return;
    setCustomizeOpen(true);
    void loadCustomizePanel(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('customize');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, meProfile?.id, loadCustomizePanel, setSearchParams]);

  useEffect(() => {
    void fetchServers();
  }, [fetchServers]);

  /** Backfill Discord invite + banner for rows missing data (bot token / widget / preview APIs). */
  useEffect(() => {
    if (enrichOnceRef.current) return;
    enrichOnceRef.current = true;
    void (async () => {
      const { data, error } = await supabase.functions.invoke('servers-enrich-metadata', {
        body: { mode: 'missing' },
      });
      if (error) {
        console.warn('[servers] servers-enrich-metadata failed:', error.message, data);
        enrichOnceRef.current = false;
        return;
      }
      if (
        data &&
        typeof data === 'object' &&
        Array.isArray((data as { errors?: unknown }).errors) &&
        ((data as { errors: string[] }).errors?.length ?? 0) > 0
      ) {
        console.warn('[servers] servers-enrich-metadata partial errors:', (data as { errors: string[] }).errors);
      }
      await fetchServers({ silent: true });
    })();
  }, [fetchServers]);

  const filteredServers = servers.filter(server => {
    const matchesSearch = !searchQuery || 
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesHiring = !filterHiring || server.is_hiring;
    
    return matchesSearch && matchesHiring;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
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
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Servers</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Browse active communities, hiring status, and Discord links in one place.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by server name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-48">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="members">Largest</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
              
            </div>

            {/* Quick filters */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge
                variant={!filterHiring ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilterHiring(false)}
              >
                All
              </Badge>
              <Badge
                variant={filterHiring ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilterHiring(true)}
              >
                Hiring now
              </Badge>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="h-48 animate-pulse bg-muted" />
              ))}
            </div>
          ) : filteredServers.length > 0 ? (
            <div className="stagger-enter grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredServers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  currentProfileId={meProfile?.id ?? null}
                  onCustomize={openCustomize}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed max-w-2xl mx-auto card-elevated">
              <CardContent className="p-12 text-center">
                <img
                  src={logo}
                  alt=""
                  className="logo-mark h-16 w-16 mx-auto mb-6 object-contain opacity-40"
                  width={64}
                  height={64}
                  aria-hidden
                />
                <h3 className="text-xl font-semibold mb-2">No servers listed yet</h3>
                <p className="text-muted-foreground">
                  Servers appear automatically once a member's experience is verified by a Discord admin.
                </p>

              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <Dialog
        open={customizeOpen}
        onOpenChange={(open) => {
          setCustomizeOpen(open);
          if (!open) {
            setPanelServer(null);
            setPanelCoworkers([]);
            setPanelOwnerIsPro(false);
          }
        }}
      >
        <DialogContent
          fullscreen
          className="flex max-h-[100dvh] flex-col gap-0 overflow-hidden border-0 bg-background p-0 shadow-none"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border bg-card/80 px-4 py-4 text-left sm:px-6 sm:py-5 sm:pr-14">
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold tracking-tight">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-border bg-muted/40">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              </span>
              Customize server
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {panelServer?.name ? `Editing “${panelServer.name}”.` : 'Invite, page copy, theme, gallery, and review notifications.'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
            <div className="mx-auto w-full max-w-5xl">
              {panelLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Loading settings…</span>
                </div>
              ) : panelServer ? (
                <ServerOwnerPanel
                  server={panelServer}
                  ownerIsPro={panelOwnerIsPro}
                  coworkers={panelCoworkers}
                  onPatch={(patch) => {
                    setPanelServer((prev) => (prev ? { ...prev, ...patch } : prev));
                    void fetchServers({ silent: true });
                  }}
                />
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">Could not load this server.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
};

export default Servers;
