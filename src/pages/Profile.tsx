import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Briefcase, MessageSquare, MapPin, Pencil, Clock, Star, Shield, ShieldCheck, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/layout/Navbar';
import RatingStars from '@/components/ui/rating-stars';
import SkillBadge from '@/components/ui/skill-badge';
import ExperienceCard from '@/components/profile/ExperienceCard';
import ProfileEditor from '@/components/profile/ProfileEditor';
import ReviewsSection from '@/components/profile/ReviewsSection';
import ConnectButton from '@/components/profile/ConnectButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isSiteOwnerDiscordUsername } from '@/lib/siteOwner';
import { profilePath, looksLikeProfileUuid, normalizeDiscordUsernameKey } from '@/lib/profilePath';
import { discordUserProfileUrl } from '@/lib/discordProfileUrl';

interface ProfileData {
  id: string;
  display_name: string | null;
  discord_avatar: string | null;
  discord_id: string | null;
  discord_username: string | null;
  bio: string | null;
  is_verified: boolean;
  is_featured: boolean;
  rating: number;
  review_count: number;
  skills: string[];
  location: string | null;
  timezone: string | null;
  pronouns: string | null;
  status: string | null;
  availability: string | null;
  website: string | null;
  banner_url: string | null;
  accent_color: string | null;
  theme_preset: string | null;
}

interface Experience {
  id: string;
  role: string;
  server_name: string;
  server_icon: string | null;
  department: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  is_verified: boolean;
  guild_id: string | null;
  verifier_stated_position?: string | null;
  verifier_review_text?: string | null;
  verifier_review_rating?: number | null;
  verified_by_discord_username?: string | null;
}

function unwrapRpcProfileRow(data: unknown): ProfileData | null {
  if (data == null) return null;
  if (Array.isArray(data)) {
    const row = data[0];
    if (row && typeof row === 'object' && 'id' in row) return row as ProfileData;
    return null;
  }
  if (typeof data === 'object' && 'id' in (data as object)) return data as ProfileData;
  return null;
}

const Profile = () => {
  const { profileSlug } = useParams<{ profileSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile: meProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const isOwner = !!(meProfile && profile && meProfile.id === profile.id);
  const discordProfileHref = discordUserProfileUrl(profile?.discord_id);

  useEffect(() => {
    setIsAdmin(isSiteOwnerDiscordUsername(meProfile?.discord_username ?? null));
  }, [meProfile?.discord_username]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setProfile(null);
    setExperiences([]);
    const slugRaw = profileSlug ? decodeURIComponent(profileSlug) : '';
    const slug = slugRaw.trim();
    if (!slug) {
      setLoading(false);
      return;
    }

    let profileData: ProfileData | null = null;

    if (slug.toLowerCase() === 'me') {
      if (authLoading) {
        return;
      }
      const mid = meProfile?.id;
      if (!mid) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', mid).single();
      if (data) profileData = data as ProfileData;
    } else if (looksLikeProfileUuid(slug)) {
      const { data } = await supabase.from('profiles').select('*').eq('id', slug).maybeSingle();
      if (data) profileData = data as ProfileData;
    } else {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_profile_by_username_lookup', {
        lookup: slug,
      });
      if (rpcError && import.meta.env.DEV) {
        console.warn('[Profile] get_profile_by_username_lookup:', rpcError.message);
      }
      profileData = unwrapRpcProfileRow(rpcData);

      const urlKey = normalizeDiscordUsernameKey(slug);
      if (!profileData && meProfile?.id && urlKey) {
        const myKey = normalizeDiscordUsernameKey(meProfile.discord_username);
        if (myKey && myKey === urlKey) {
          const { data } = await supabase.from('profiles').select('*').eq('id', meProfile.id).single();
          if (data) profileData = data as ProfileData;
        }
      }

      if (!profileData) {
        const variants = Array.from(
          new Set([slug, slug.endsWith('.') ? slug : `${slug}.`, slug.replace(/\.$/u, '')]),
        ).filter(Boolean);
        for (const v of variants) {
          const { data } = await supabase.from('profiles').select('*').ilike('discord_username', v).maybeSingle();
          if (data) {
            profileData = data as ProfileData;
            break;
          }
        }
      }
    }

    if (profileData) {
      setProfile(profileData);
      const { data: expData } = await supabase
        .from('experiences')
        .select('*')
        .eq('profile_id', profileData.id)
        .order('start_date', { ascending: false });
      if (expData) setExperiences(expData);
    }
    setLoading(false);
  }, [profileSlug, meProfile?.id, meProfile?.discord_username, authLoading]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!profile || loading) return;
    const canon = profilePath(profile);
    if (location.pathname !== canon) {
      navigate({ pathname: canon, search: location.search, hash: location.hash }, { replace: true });
    }
  }, [profile, loading, location.pathname, location.search, location.hash, navigate]);

  const toggleAdminFlag = async (field: 'is_verified' | 'is_featured') => {
    if (!profile) return;
    const newVal = !profile[field];
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: newVal })
      .eq('id', profile.id);
    if (error) {
      toast.error('Failed: ' + error.message);
      return;
    }
    toast.success(`${field === 'is_verified' ? 'Verified' : 'Featured'} ${newVal ? 'granted' : 'removed'}`);
    setProfile({ ...profile, [field]: newVal });
  };

  useEffect(() => {
    if (isOwner && searchParams.get('edit') === '1') {
      setEditMode(true);
    }
  }, [isOwner, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="animate-pulse">Loading…</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Profile not found</h1>
          <Link to="/browse">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to members
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const accent = profile.accent_color || '#ffffff';
  const initial = (profile.display_name || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Banner — taller, accent-aware */}
      <div className="relative h-56 md:h-72 w-full overflow-hidden border-b border-white/10">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `radial-gradient(900px 320px at 18% 0%, ${accent}33, transparent 60%), radial-gradient(700px 260px at 92% 100%, ${accent}22, transparent 60%), linear-gradient(180deg, hsl(0 0% 9%), hsl(0 0% 4%))`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />
      </div>

      <div className="container mx-auto px-4 -mt-20 md:-mt-24 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <Link to="/browse">
            <Button variant="ghost" size="sm" className="gap-2 backdrop-blur-sm bg-background/40">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && !isOwner && profile && (
              <>
                <Button
                  size="sm"
                  variant={profile.is_verified ? 'default' : 'outline'}
                  onClick={() => toggleAdminFlag('is_verified')}
                  className="gap-2"
                  title="Admin: toggle verified badge"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {profile.is_verified ? 'Remove verified' : 'Grant verified'}
                </Button>
                <Button
                  size="sm"
                  variant={profile.is_featured ? 'default' : 'outline'}
                  onClick={() => toggleAdminFlag('is_featured')}
                  className="gap-2"
                  title="Admin: toggle featured"
                >
                  <Crown className="h-4 w-4" />
                  {profile.is_featured ? 'Unfeature' : 'Feature'}
                </Button>
              </>
            )}
            {isOwner && !editMode && (
              <Button size="sm" onClick={() => setEditMode(true)} className="gap-2">
                <Pencil className="h-4 w-4" /> Edit profile
              </Button>
            )}
          </div>
        </div>

        {editMode && isOwner ? (
          <ProfileEditor
            profile={profile as any}
            experiences={experiences}
            initialTab={searchParams.get('tab') ?? undefined}
            openAddExperienceOnMount={searchParams.get('add') === '1'}
            onConsumedAddDeepLink={() => {
              if (searchParams.get('add') === '1') {
                const next = new URLSearchParams(searchParams);
                next.delete('add');
                setSearchParams(next, { replace: true });
              }
            }}
            onSaved={() => {
              setEditMode(false);
              const next = new URLSearchParams(searchParams);
              next.delete('edit');
              next.delete('tab');
              next.delete('add');
              setSearchParams(next, { replace: true });
              fetchProfile();
            }}
            onCancel={() => {
              setEditMode(false);
              const next = new URLSearchParams(searchParams);
              next.delete('edit');
              next.delete('tab');
              next.delete('add');
              setSearchParams(next, { replace: true });
            }}
          />
        ) : (
          <>
            {/* HERO — Identity */}
            <Card className="card-elevated liquid-edge overflow-hidden mb-6">
              <CardContent className="p-5 md:p-7">
                <div className="flex flex-col md:flex-row md:items-end gap-5">
                  <div className="relative shrink-0">
                    <div
                      className="absolute -inset-1.5 rounded-full blur-xl opacity-60"
                      style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
                      aria-hidden
                    />
                    <Avatar
                      className="relative h-28 w-28 md:h-32 md:w-32 ring-4 ring-background"
                      style={{ boxShadow: `0 0 0 3px ${accent}66, 0 8px 30px ${accent}33` }}
                    >
                      <AvatarImage src={profile.discord_avatar || undefined} loading="eager" fetchPriority="high" />
                      <AvatarFallback className="text-3xl bg-secondary">{initial}</AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
                        {profile.display_name || 'Discord member'}
                      </h1>
                      {profile.is_verified && (
                        <Badge className="badge-verified text-[10px] px-2 py-0.5">Verified</Badge>
                      )}
                      {profile.is_featured && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5" style={{ background: `${accent}22`, color: accent, borderColor: `${accent}55` }}>
                          Featured
                        </Badge>
                      )}
                      {profile.pronouns && (
                        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full glass">
                          {profile.pronouns}
                        </span>
                      )}
                    </div>

                    {profile.status && (
                      <p className="text-base md:text-lg italic mt-1.5 leading-snug" style={{ color: accent }}>
                        “{profile.status}”
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-sm text-muted-foreground">
                      {profile.availability && (
                        <Badge variant="outline" className="border-white/20 gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                          {profile.availability}
                        </Badge>
                      )}
                      {profile.location && (
                        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {profile.location}</span>
                      )}
                      {profile.timezone && (
                        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {profile.timezone}</span>
                      )}
                      {profile.discord_username &&
                        (discordProfileHref ? (
                          <a
                            href={discordProfileHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Discord profile"
                            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                          >
                            @{profile.discord_username}
                          </a>
                        ) : (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            @{profile.discord_username}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="flex md:flex-col md:items-end gap-3 md:min-w-[180px]">
                    {profile.rating > 0 && (
                      <div className="md:text-right">
                        <RatingStars rating={profile.rating} count={profile.review_count} size="sm" />
                      </div>
                    )}
                    {!isOwner && (
                      <ConnectButton
                        targetProfileId={profile.id}
                        targetName={profile.display_name}
                        className="md:w-full"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-6">
              <aside className="lg:col-span-1 space-y-4">
                <Card className="card-elevated liquid-edge">
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h3>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {profile.bio || (
                          <span className="text-muted-foreground italic">
                            {isOwner ? 'Add a bio in Edit profile.' : 'This member has not added a bio yet.'}
                          </span>
                        )}
                      </p>
                    </div>

                    {profile.skills?.length > 0 && (
                      <div className="pt-4 border-t border-white/10">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Skills</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {profile.skills.map((skill) => (
                            <SkillBadge key={skill} skill={skill} />
                          ))}
                        </div>
                      </div>
                    )}

                  </CardContent>
                </Card>
              </aside>

              <div className="lg:col-span-2">
                <Tabs defaultValue="experience" className="w-full">
                  <TabsList className="glass mb-4">
                    <TabsTrigger value="experience" className="gap-1.5 text-sm">
                      <Briefcase className="h-4 w-4" /> Experience
                      {experiences.length > 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground">({experiences.length})</span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="gap-1.5 text-sm">
                      <Star className="h-4 w-4" /> Reviews
                      {profile.review_count > 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground">({profile.review_count})</span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="experience" className="space-y-3">
                    {experiences.length > 0 ? (
                      <div className="grid md:grid-cols-2 gap-3">
                        {experiences.map((exp) => (
                          <ExperienceCard key={exp.id} experience={exp} />
                        ))}
                      </div>
                    ) : (
                      <Card className="card-elevated">
                        <CardContent className="p-10 text-center">
                          <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                          <h3 className="font-semibold mb-1">No experience yet</h3>
                          <p className="text-sm text-muted-foreground">
                            {isOwner ? 'Hit Edit profile to add your first role.' : 'This member has not added experience yet.'}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="reviews">
                    <ReviewsSection profileId={profile.id} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
