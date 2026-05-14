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
import { pageHeroEnter } from '@/lib/pageHero';
import { isExperienceAwaitingVerification } from '@/lib/experienceConstants';

type SortMode = 'newest' | 'top_rated' | 'most_members' | 'most_experience' | 'az';

interface Profile {
  id: string;
  discord_username?: string | null;
  display_name: string | null;
  discord_avatar: string | null;
  bio: string | null;
  is_verified: boolean;
  is_featured: boolean;
  is_pro: boolean;
  pro_badge_label?: string | null;
  show_pro_avatar_decor?: boolean;
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
  /** Sum of directory server member counts for guilds where this member has verified experience only. */
  total_members?: number;
  /** Verified experience rows (for search & sorting). */
  experience_search_meta?: Array<{ role: string; server_name: string }>;
  verified_experience_count?: number;
}

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'top_rated', label: 'Top Rated' },
  { id: 'most_members', label: 'Most Members' },
  { id: 'most_experience', label: 'Most Experience' },
  { id: 'az', label: 'A–Z' },
];

function finiteNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function createdTime(iso: string | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Tie-break so sort never returns NaN (which makes Array.prototype.sort a no-op in practice). */
function idCmp(a: Profile, b: Profile): number {
  return a.id.localeCompare(b.id);
}

function displaySortKey(p: Profile): string {
  return (p.display_name || p.discord_username || 'zzz').trim() || 'zzz';
}

/** Staff-pinned featured profiles stay at the top for every sort mode and filter result. */
function featuredFirstCmp(a: Profile, b: Profile): number {
  const af = !!a.is_featured;
  const bf = !!b.is_featured;
  if (af === bf) return 0;
  return af ? -1 : 1;
}

/** How many Pro profiles get a random “spotlight” row directly under featured members. */
const DIRECTORY_PRO_SPOTLIGHT_COUNT = 2;

/** Uniform random sample without replacement (small n). */
function pickRandomProfiles(profiles: Profile[], n: number): Profile[] {
  if (n <= 0 || profiles.length === 0) return [];
  const bag = [...profiles];
  const out: Profile[] = [];
  const take = Math.min(n, bag.length);
  for (let k = 0; k < take; k++) {
    const idx = Math.floor(Math.random() * bag.length);
    out.push(bag[idx]!);
    bag.splice(idx, 1);
  }
  return out;
}

/**
 * After sort: featured first (unchanged), then up to two random Pro members (not featured),
 * then everyone else in sort order. Re-runs when filters/sort/data change so the pair is not fixed.
 */
function applyProDirectorySpotlights(sorted: Profile[]): Profile[] {
  const featured = sorted.filter((p) => p.is_featured);
  const nonFeatured = sorted.filter((p) => !p.is_featured);
  const proPool = nonFeatured.filter((p) => p.is_pro);
  const spotlights = pickRandomProfiles(proPool, DIRECTORY_PRO_SPOTLIGHT_COUNT);
  const spotlightIds = new Set(spotlights.map((p) => p.id));
  const tail = nonFeatured.filter((p) => !spotlightIds.has(p.id));
  return [...featured, ...spotlights, ...tail];
}

function sortProfiles(list: Profile[], mode: SortMode): Profile[] {
  const copy = [...list];
  switch (mode) {
    case 'newest':
      return copy.sort((a, b) => {
        const f = featuredFirstCmp(a, b);
        if (f !== 0) return f;
        const d = createdTime(b.created_at) - createdTime(a.created_at);
        if (d !== 0) return d;
        return idCmp(a, b);
      });
    case 'top_rated':
      return copy.sort((a, b) => {
        const f = featuredFirstCmp(a, b);
        if (f !== 0) return f;
        const rd = finiteNum(b.rating) - finiteNum(a.rating);
        if (rd !== 0) return rd;
        const rc = finiteNum(b.review_count) - finiteNum(a.review_count);
        if (rc !== 0) return rc;
        return idCmp(a, b);
      });
    case 'most_members':
      return copy.sort((a, b) => {
        const f = featuredFirstCmp(a, b);
        if (f !== 0) return f;
        const m = finiteNum(b.total_members) - finiteNum(a.total_members);
        if (m !== 0) return m;
        return idCmp(a, b);
      });
    case 'most_experience':
      return copy.sort((a, b) => {
        const f = featuredFirstCmp(a, b);
        if (f !== 0) return f;
        const e =
          finiteNum(b.verified_experience_count) - finiteNum(a.verified_experience_count);
        if (e !== 0) return e;
        return idCmp(a, b);
      });
    case 'az':
      return copy.sort((a, b) => {
        const f = featuredFirstCmp(a, b);
        if (f !== 0) return f;
        const c = displaySortKey(a).localeCompare(displaySortKey(b), undefined, {
          sensitivity: 'base',
        });
        if (c !== 0) return c;
        return idCmp(a, b);
      });
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
        'id, discord_username, display_name, discord_avatar, bio, is_verified, is_featured, is_pro, pro_badge_label, show_pro_avatar_decor, rating, review_count, skills, created_at',
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
        'id, profile_id, role, server_name, server_icon, is_verified, guild_id, start_date, show_on_directory_card',
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
      userExps.sort((a, b) => {
        const d = createdTime(b.start_date) - createdTime(a.start_date);
        return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
      });

      const dirExps = userExps.filter(
        (e) => e.show_on_directory_card !== false && !isExperienceAwaitingVerification(e),
      );
      const verifiedExps = userExps.filter((e) => e.is_verified === true);

      const total = verifiedExps.reduce(
        (sum, e) => sum + (e.guild_id ? memberByGuild.get(e.guild_id) ?? 0 : 0),
        0,
      );

      return {
        ...p,
        is_verified: !!p.is_verified,
        is_featured: !!p.is_featured,
        is_pro: !!p.is_pro,
        pro_badge_label: p.pro_badge_label ?? null,
        show_pro_avatar_decor: !!p.show_pro_avatar_decor,
        rating: finiteNum(p.rating),
        review_count: finiteNum(p.review_count),
        created_at: p.created_at,
        experiences: dirExps.map((e) => ({
          id: e.id,
          role: e.role,
          server_name: e.server_name,
          server_icon: e.server_icon,
          is_verified: !!e.is_verified,
          guild_id: e.guild_id,
          start_date: e.start_date,
          member_count: e.guild_id ? memberByGuild.get(e.guild_id) ?? 0 : 0,
        })),
        experience_search_meta: userExps.map((e) => ({
          role: e.role,
          server_name: e.server_name,
        })),
        verified_experience_count: verifiedExps.length,
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
      list = list.filter((p) => p.is_verified === true);
    }

    if (q) {
      list = list.filter((profile) => {
        const nameMatch = profile.display_name?.toLowerCase().includes(q);
        const bioMatch = profile.bio?.toLowerCase().includes(q);
        const skillMatch = profile.skills?.some((s) => s.toLowerCase().includes(q));
        const expMatch = profile.experience_search_meta?.some(
          (e) =>
            e.role.toLowerCase().includes(q) || e.server_name.toLowerCase().includes(q),
        );
        return !!(nameMatch || bioMatch || skillMatch || expMatch);
      });
    }

    return applyProDirectorySpotlights(sortProfiles(list, sortMode));
  }, [profiles, searchQuery, verifiedOnly, sortMode]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="relative z-10">
        <div className="min-h-screen pt-20 lg:pt-32 pb-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {/* Hero */}
            <header className={`text-center mb-10 lg:mb-12 ${pageHeroEnter}`}>
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
                Member Directory
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
                Find ER:LC staff, applicants, and server owners with real profile details.
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
              <Switch
                id="verified-only"
                checked={verifiedOnly}
                onCheckedChange={(v) => setVerifiedOnly(v === true)}
              />
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
              <div className="stagger-enter grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
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
