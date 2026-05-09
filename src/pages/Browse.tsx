import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';
import ProfileCard from '@/components/profile/ProfileCard';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

type SortMode = 'newest' | 'top_rated' | 'most_members' | 'most_experience' | 'az';

interface Profile {
  id: string;
  display_name: string | null;
  discord_avatar: string | null;
  bio: string | null;
  is_verified: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  skills: string[];
  created_at: string;
  experiences?: Array<{
    id: string;
    role: string;
    server_name: string;
    server_icon: string | null;
    is_verified: boolean;
    guild_id: string | null;
    start_date: string;
    member_count?: number | null;
  }>;
  total_members?: number;
}

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'top_rated', label: 'Top Rated' },
  { id: 'most_members', label: 'Most Members' },
  { id: 'most_experience', label: 'Most Experience' },
  { id: 'az', label: 'A–Z' },
];

function sortProfiles(list: Profile[], mode: SortMode): Profile[] {
  const copy = [...list];
  switch (mode) {
    case 'newest':
      return copy.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case 'top_rated':
      return copy.sort((a, b) => {
        if (!!a.is_featured !== !!b.is_featured) return a.is_featured ? -1 : 1;
        if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
        return (b.review_count || 0) - (a.review_count || 0);
      });
    case 'most_members':
      return copy.sort((a, b) => (b.total_members ?? 0) - (a.total_members ?? 0));
    case 'most_experience':
      return copy.sort(
        (a, b) => (b.experiences?.length ?? 0) - (a.experiences?.length ?? 0),
      );
    case 'az':
      return copy.sort((a, b) =>
        (a.display_name || 'zzz').localeCompare(b.display_name || 'zzz', undefined, {
          sensitivity: 'base',
        }),
      );
    default:
      return copy;
  }
}

const Browse = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, display_name, discord_avatar, bio, is_verified, is_featured, rating, review_count, skills, created_at',
      )
      .limit(150);

    if (error || !data) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    const ids = data.map((p) => p.id);
    const { data: exps } = await supabase
      .from('experiences')
      .select(
        'id, profile_id, role, server_name, server_icon, is_verified, guild_id, start_date',
      )
      .in('profile_id', ids);

    const guildIds = [...new Set((exps || []).map((e) => e.guild_id).filter(Boolean) as string[])];
    const { data: serverRows } = guildIds.length
      ? await supabase.from('servers').select('guild_id, member_count').in('guild_id', guildIds)
      : { data: [] as { guild_id: string; member_count: number | null }[] };

    const memberByGuild = new Map<string, number>();
    (serverRows || []).forEach((s) => {
      if (s.guild_id) memberByGuild.set(s.guild_id, s.member_count ?? 0);
    });

    const enriched: Profile[] = data.map((p) => {
      let userExps = (exps || []).filter((e) => e.profile_id === p.id);
      userExps.sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
      );

      const total = userExps.reduce(
        (sum, e) => sum + (e.guild_id ? memberByGuild.get(e.guild_id) ?? 0 : 0),
        0,
      );

      return {
        ...p,
        created_at: p.created_at,
        experiences: userExps.map((e) => ({
          id: e.id,
          role: e.role,
          server_name: e.server_name,
          server_icon: e.server_icon,
          is_verified: e.is_verified,
          guild_id: e.guild_id,
          start_date: e.start_date,
          member_count: e.guild_id ? memberByGuild.get(e.guild_id) ?? 0 : 0,
        })),
        total_members: total,
      };
    });

    setProfiles(enriched);
    setLoading(false);
  };

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = profiles;

    if (verifiedOnly) {
      list = list.filter((p) => p.is_verified);
    }

    if (q) {
      list = list.filter((profile) => {
        const nameMatch = profile.display_name?.toLowerCase().includes(q);
        const bioMatch = profile.bio?.toLowerCase().includes(q);
        const skillMatch = profile.skills?.some((s) => s.toLowerCase().includes(q));
        const expMatch = profile.experiences?.some(
          (e) =>
            e.role.toLowerCase().includes(q) || e.server_name.toLowerCase().includes(q),
        );
        return !!(nameMatch || bioMatch || skillMatch || expMatch);
      });
    }

    return sortProfiles(list, sortMode);
  }, [profiles, searchQuery, verifiedOnly, sortMode]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="relative z-10">
        <div className="min-h-screen pt-20 lg:pt-32 pb-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {/* Hero */}
            <header className="text-center mb-10 lg:mb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <img
                src={logo}
                alt=""
                className="logo-mark mx-auto mb-6 h-14 w-14 object-contain sm:h-16 sm:w-16"
                width={64}
                height={64}
                decoding="async"
                aria-hidden
              />
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
                Browse Professionals
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
                Discover talented staff, developers, and designers in the ER:LC community.
              </p>
            </header>

            {/* Search */}
            <div className="max-w-4xl mx-auto mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by name, skills, or experience…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 pl-12 rounded-xl border-white/10 bg-white/[0.04] text-base placeholder:text-muted-foreground/70 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            {/* Sort pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {SORT_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSortMode(id)}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    sortMode === id
                      ? 'bg-white text-black shadow-sm'
                      : 'border border-white/12 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Verified only */}
            <div className="flex items-center justify-center gap-3 mb-10">
              <Switch id="verified-only" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
              <Label htmlFor="verified-only" className="text-sm text-muted-foreground cursor-pointer">
                Verified only
              </Label>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="h-72 animate-pulse border-white/10 bg-white/[0.03]" />
                ))}
              </div>
            ) : filteredAndSorted.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                {filteredAndSorted.map((profile) => (
                  <ProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-white/15 max-w-2xl mx-auto bg-white/[0.02]">
                <CardContent className="p-12 text-center">
                  <User className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-2">No members match</h3>
                  <p className="text-muted-foreground mb-6">
                    Try another search or turn off filters.
                  </p>
                  <Link to="/auth">
                    <Button>Create profile</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Browse;
