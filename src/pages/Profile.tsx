import { useState, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  MessageSquare,
  MapPin,
  Pencil,
  Clock,
  Star,
  Shield,
  ShieldCheck,
  Crown,
  AlertTriangle,
  Gem,
} from 'lucide-react';
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
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { isSiteOwnerDiscordUsername } from '@/lib/siteOwner';
import { ProfileStaffTools } from '@/components/staff/ProfileStaffTools';
import { profilePath, looksLikeProfileUuid, normalizeDiscordUsernameKey } from '@/lib/profilePath';
import { discordUserProfileUrl } from '@/lib/discordProfileUrl';
import { DIRECTORY_STAFF_VERIFIED_TITLE } from '@/lib/directoryVerified';
import { getProfileLocationDisplay } from '@/lib/profileLocationDisplay';
import { ProfileSocialBadges } from '@/components/profile/ProfileSocialBadges';
import { safeAvatarUrl, avatarReferrerPolicy, normalizeDiscordCdnMediaUrl } from '@/lib/safeAvatarUrl';
import { showsProAvatarDecor } from '@/lib/proAvatarDecor';
import { ProAvatarFrame } from '@/components/profile/ProAvatarFrame';
import type { Json } from '@/integrations/supabase/types';
import { isExperienceAwaitingVerification } from '@/lib/experienceConstants';

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
  social_links?: Json | null;
  is_pro?: boolean;
  pro_badge_label?: string | null;
  show_pro_avatar_decor?: boolean;
  roblox_user_id?: string | null;
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
  const { isStaff } = useStaffAccess();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileWarnings, setProfileWarnings] = useState<
    { id: string; body: string; created_at: string; issued_by_profile_id: string }[]
  >([]);
  const [warningIssuerLabels, setWarningIssuerLabels] = useState<Record<string, string>>({});
  const [bannerLoadFailed, setBannerLoadFailed] = useState(false);

  /** Clear previous member’s data before paint so route changes never flash stale profile. */
  useLayoutEffect(() => {
    setProfile(null);
    setExperiences([]);
    setLoading(true);
    setEditMode(false);
    setProfileWarnings([]);
    setWarningIssuerLabels({});
    setBannerLoadFailed(false);
  }, [profileSlug]);

  useEffect(() => {
    setBannerLoadFailed(false);
  }, [profile?.banner_url]);

  const isOwner = !!(meProfile && profile && meProfile.id === profile.id);
  const discordProfileHref = discordUserProfileUrl(profile?.discord_id);
  const heroAvatarSrc = profile ? safeAvatarUrl(profile.discord_avatar) : undefined;

  const publicExperiences = useMemo(
    () => experiences.filter((e) => !isExperienceAwaitingVerification(e)),
    [experiences],
  );
  const hasOnlyPendingExperience =
    !!isOwner && experiences.length > 0 && publicExperiences.length === 0;

  useEffect(() => {
    setIsAdmin(isSiteOwnerDiscordUsername(meProfile?.discord_username ?? null));
  }, [meProfile?.discord_username]);

  useEffect(() => {
    if (!profile?.id || !(isOwner || (isStaff && !isOwner))) {
      setProfileWarnings([]);
      setWarningIssuerLabels({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('profile_warnings')
        .select('id, body, created_at, issued_by_profile_id')
        .eq('subject_profile_id', profile.id)
        .order('created_at', { ascending: false });
      if (cancelled || error) return;
      const rows = data ?? [];
      setProfileWarnings(rows);
      const issuerIds = [...new Set(rows.map((w) => w.issued_by_profile_id))];
      if (issuerIds.length === 0) {
        setWarningIssuerLabels({});
        return;
      }
      const { data: issuers } = await supabase
        .from('profiles')
        .select('id, display_name, discord_username')
        .in('id', issuerIds);
      if (cancelled) return;
      const map: Record<string, string> = {};
      (issuers ?? []).forEach((p) => {
        map[p.id] = (p.display_name || p.discord_username || 'Staff').trim();
      });
      setWarningIssuerLabels(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, isOwner, isStaff]);

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
    const p_is_verified = field === 'is_verified' ? newVal : profile.is_verified;
    const p_is_featured = field === 'is_featured' ? newVal : profile.is_featured;

    let { error } = await supabase.rpc('site_owner_set_profile_flags', {
      p_profile_id: profile.id,
      p_is_verified,
      p_is_featured,
    });

    const msg = error?.message ?? '';
    const rpcUnavailable =
      !!error &&
      (/Could not find the function|schema cache|PGRST202|42883/i.test(msg) ||
        /site_owner_set_profile_flags/i.test(msg));

    if (rpcUnavailable) {
      ({ error } = await supabase
        .from('profiles')
        .update(field === 'is_verified' ? { is_verified: newVal } : { is_featured: newVal })
        .eq('id', profile.id));
    }

    if (error) {
      toast.error(error.message || 'Profile failed to load');
      return;
    }
    toast.success(`${field === 'is_verified' ? 'Verified' : 'Featured'} ${newVal ? 'granted' : 'removed'}`);
    setProfile({ ...profile, is_verified: p_is_verified, is_featured: p_is_featured });
  };

  useEffect(() => {
    if (isOwner && searchParams.get('edit') === '1') {
      setEditMode(true);
    }
  }, [isOwner, searchParams]);

  useEffect(() => {
    if (searchParams.get('roblox_linked') !== '1') return;
    void fetchProfile();
    const next = new URLSearchParams(searchParams);
    next.delete('roblox_linked');
    setSearchParams(next, { replace: true });
  }, [searchParams, fetchProfile, setSearchParams]);

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
        {profile.banner_url && !bannerLoadFailed ? (
          <img
            src={normalizeDiscordCdnMediaUrl(profile.banner_url) ?? profile.banner_url}
            alt=""
            draggable={false}
            className="w-full h-full object-cover no-image-drag"
            onError={() => setBannerLoadFailed(true)}
          />
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
            onDiscordMediaSynced={() => void fetchProfile()}
            onProVerified={() => void fetchProfile()}
          />
        ) : (
          <>
            {/* HERO — Identity */}
            <Card className="card-elevated liquid-edge overflow-hidden mb-7 border-white/[0.09] shadow-xl shadow-black/20">
              <CardContent className="p-5 md:p-8">
                <div className="flex flex-col md:flex-row md:items-end gap-5">
                  <div className="relative shrink-0">
                    <div
                      className="absolute -inset-1.5 rounded-full blur-xl opacity-60"
                      style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
                      aria-hidden
                    />
                    <ProAvatarFrame active={showsProAvatarDecor(profile)} orbit="hero" className="relative">
                      <Avatar
                        className="relative h-28 w-28 md:h-32 md:w-32 ring-4 ring-background"
                        style={{ boxShadow: `0 0 0 3px ${accent}66, 0 8px 30px ${accent}33` }}
                      >
                        <AvatarImage
                          src={heroAvatarSrc}
                          loading="eager"
                          fetchPriority="high"
                          referrerPolicy={avatarReferrerPolicy(heroAvatarSrc)}
                        />
                        <AvatarFallback className="text-3xl bg-secondary">{initial}</AvatarFallback>
                      </Avatar>
                    </ProAvatarFrame>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate text-balance">
                        {profile.display_name || 'Discord member'}
                      </h1>
                      {profile.is_verified && (
                        <Badge className="badge-verified text-[10px] px-2 py-0.5" title={DIRECTORY_STAFF_VERIFIED_TITLE}>
                          Verified
                        </Badge>
                      )}
                      {profile.is_featured && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5" style={{ background: `${accent}22`, color: accent, borderColor: `${accent}55` }}>
                          Featured
                        </Badge>
                      )}
                      {profile.is_pro && (
                        <Badge
                          className="text-[10px] px-2 py-0.5 gap-1 rounded-md border border-white/22 bg-white/[0.08] text-zinc-100"
                          title="ERLC Directory Pro"
                        >
                          <Gem className="h-3 w-3 text-white/85" aria-hidden />
                          Pro
                        </Badge>
                      )}
                      {profile.is_pro && profile.pro_badge_label && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-white/20 text-muted-foreground">
                          {profile.pro_badge_label}
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
                      {profile.location &&
                        (() => {
                          const loc = getProfileLocationDisplay(profile.location);
                          if (loc) {
                            return (
                              <span
                                className="flex items-center gap-1.5"
                                title={loc.fullLabel}
                              >
                                <span className="text-base leading-none" aria-hidden>
                                  {loc.flag}
                                </span>
                                <span className="font-medium text-foreground/90 tabular-nums">{loc.code}</span>
                              </span>
                            );
                          }
                          return (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" /> {profile.location}
                            </span>
                          );
                        })()}
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

                    <ProfileSocialBadges
                      socialLinks={profile.social_links}
                      discordHref={discordProfileHref}
                      robloxUserId={profile.roblox_user_id}
                      className="mt-3"
                    />
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
                {isStaff && !isOwner && profile && (
                  <ProfileStaffTools subjectProfileId={profile.id} subjectDisplayName={profile.display_name} />
                )}
                {(isOwner || (isStaff && !isOwner)) && profileWarnings.length > 0 && (
                  <Card className="border-amber-500/35 bg-amber-950/10 liquid-edge">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2 text-amber-100">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider">Staff notices</h3>
                      </div>
                      <ul className="space-y-3">
                        {profileWarnings.map((w) => (
                          <li key={w.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{w.body}</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-2">
                              {warningIssuerLabels[w.issued_by_profile_id] ?? 'Staff'} ·{' '}
                              {new Date(w.created_at).toLocaleString()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {isStaff && !isOwner && profile && profileWarnings.length === 0 && (
                  <Card className="border-white/10 bg-white/[0.02]">
                    <CardContent className="p-4 text-xs text-muted-foreground">
                      No warnings on file for this member yet.
                    </CardContent>
                  </Card>
                )}
                <Card className="card-elevated liquid-edge border-white/[0.08]">
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2.5">
                        About
                      </h3>
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
                  <TabsList className="glass mb-5 w-full sm:w-auto rounded-xl border border-white/10 bg-black/25 p-1 h-auto">
                    <TabsTrigger value="experience" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-white/10">
                      <Briefcase className="h-4 w-4" /> Experience
                      {publicExperiences.length > 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                          ({publicExperiences.length})
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="gap-1.5 text-sm rounded-lg data-[state=active]:bg-white/10">
                      <Star className="h-4 w-4" /> Reviews
                      {profile.review_count > 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground">({profile.review_count})</span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="experience" className="space-y-3">
                    {publicExperiences.length > 0 ? (
                      <div className="grid md:grid-cols-2 gap-4">
                        {publicExperiences.map((exp) => (
                          <ExperienceCard key={exp.id} experience={exp} />
                        ))}
                      </div>
                    ) : hasOnlyPendingExperience ? (
                      <Card className="card-elevated border-dashed border-white/15">
                        <CardContent className="p-10 text-center">
                          <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                          <h3 className="font-semibold mb-1">Verification in progress</h3>
                          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                            Your server experience will show here after an admin approves it. You can track or resend the
                            verification link from <span className="text-foreground/90">Edit profile</span> → Experience.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="card-elevated border-white/[0.07]">
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
                    <ReviewsSection profileId={profile.id} staffTools={isStaff && !isOwner} />
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
