import { useEffect, useState, useLayoutEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Users,
  Server as ServerIcon,
  CheckCircle2,
  Briefcase,
  Shield,
  Flag,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import { profilePath } from '@/lib/profilePath';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import ReviewsSection from '@/components/profile/ReviewsSection';
import { discordInviteLooksValid, normalizeDiscordInvite } from '@/lib/discordInvite';
import { useAuth } from '@/hooks/useAuth';
import { isSiteOwnerDiscordUsername } from '@/lib/siteOwner';
import { DIRECTORY_STAFF_VERIFIED_TITLE } from '@/lib/directoryVerified';
import { normalizeDiscordCdnMediaUrl } from '@/lib/safeAvatarUrl';
import { SubmitReportDialog } from '@/components/moderation/SubmitReportDialog';
import { ServerClaimDialog } from '@/components/server/ServerClaimDialog';
import { ServerOwnerPanel } from '@/components/server/ServerOwnerPanel';
import { extractYouTubeId, youtubeEmbedSrc } from '@/lib/youtubeEmbed';
import { cn } from '@/lib/utils';

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

function hiddenStaffIdSet(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map((x) => String(x)).filter(Boolean));
}

function galleryUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter((u) => u.startsWith('http'));
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
  owner_id: string | null;
  claim_open?: boolean | null;
  owner_long_description?: string | null;
  owner_accent_hex?: string | null;
  owner_theme_preset?: string | null;
  owner_gallery_urls?: unknown;
  owner_review_webhook_url?: string | null;
  owner_hidden_staff_profile_ids?: unknown;
  owner_show_staff_section?: boolean | null;
  owner_show_reviews_section?: boolean | null;
  owner_hero_video_url?: string | null;
  owner_discord_embed_color?: number | null;
  owner_discord_embed_footer?: string | null;
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
  const { profile: meProfile, user } = useAuth();
  const [reportServerOpen, setReportServerOpen] = useState(false);
  const isStaffSiteOwner = isSiteOwnerDiscordUsername(meProfile?.discord_username ?? null);
  const [server, setServer] = useState<ServerRow | null>(null);
  const [coworkers, setCoworkers] = useState<CoworkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEnrichBusy, setInviteEnrichBusy] = useState(false);
  const [inviteRetryTick, setInviteRetryTick] = useState(0);
  const [staffInviteValue, setStaffInviteValue] = useState('');
  const [staffInviteBusy, setStaffInviteBusy] = useState(false);
  const [claimDlgOpen, setClaimDlgOpen] = useState(false);
  const [myPendingClaimId, setMyPendingClaimId] = useState<string | null>(null);
  const [ownerPreview, setOwnerPreview] = useState<{
    id: string;
    display_name: string | null;
    discord_username: string | null;
    is_pro?: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    setServer(null);
    setCoworkers([]);
    setLoading(true);
    setInviteRetryTick(0);
    setStaffInviteValue('');
    setClaimDlgOpen(false);
    setMyPendingClaimId(null);
    setOwnerPreview(null);
  }, [id]);

  useEffect(() => {
    if (!server?.id || !server.guild_id) {
      setInviteEnrichBusy(false);
      return;
    }
    let cancelled = false;
    setInviteEnrichBusy(true);
    void (async () => {
      try {
        // Uses caller JWT when logged in so Discord OAuth (guilds scope) can resolve vanity invites for members.
        const { data: enrichData, error: enrichErr } = await supabase.functions.invoke('servers-enrich-metadata', {
          body: { guild_ids: [server.guild_id], refresh_visuals: true },
        });
        if (cancelled) return;
        if (enrichErr) {
          const fromBody =
            enrichData &&
            typeof enrichData === 'object' &&
            'error' in enrichData &&
            typeof (enrichData as { error?: unknown }).error === 'string'
              ? String((enrichData as { error: string }).error).trim()
              : '';
          toast.error(fromBody || enrichErr.message || 'Invite lookup failed.');
          return;
        }
        if (
          enrichData &&
          typeof enrichData === 'object' &&
          Array.isArray((enrichData as { errors?: unknown }).errors) &&
          ((enrichData as { errors: string[] }).errors?.length ?? 0) > 0
        ) {
          const first = (enrichData as { errors: string[] }).errors[0];
          if (first) toast.warning(first);
        }
        const { data: s } = await supabase.from('servers').select('*').eq('id', server.id).maybeSingle();
        if (s && !cancelled) setServer(s as ServerRow);
      } finally {
        if (!cancelled) setInviteEnrichBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [server?.id, server?.guild_id, user?.id, inviteRetryTick]);

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

      if (s?.owner_id) {
        const { data: op } = await supabase
          .from('profiles')
          .select('id, display_name, discord_username, is_pro')
          .eq('id', s.owner_id)
          .maybeSingle();
        setOwnerPreview(op ?? null);
      } else {
        setOwnerPreview(null);
      }

      if (meProfile?.id && s?.id && !s.owner_id) {
        const { data: pend } = await supabase
          .from('server_claim_requests')
          .select('id')
          .eq('server_id', s.id)
          .eq('claimant_profile_id', meProfile.id)
          .eq('status', 'pending')
          .maybeSingle();
        setMyPendingClaimId(typeof pend?.id === 'string' ? pend.id : null);
      } else {
        setMyPendingClaimId(null);
      }

      setLoading(false);
    })();
  }, [id, meProfile?.id]);

  const hiddenStaff = hiddenStaffIdSet(server?.owner_hidden_staff_profile_ids);
  const visibleCoworkers = coworkers.filter(
    (c) => !c.profile?.id || !hiddenStaff.has(c.profile.id),
  );
  const galleryUrls = galleryUrlList(server?.owner_gallery_urls);
  const staffListedCount = !server
    ? 0
    : server.guild_id
      ? visibleCoworkers.length
      : server.staff_count;

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
  const inviteLooksValid = discordInviteLooksValid(server.discord_invite);
  const joinHrefSafe = inviteLooksValid ? joinHref : null;

  const meIsOwner = !!(meProfile?.id && server.owner_id && meProfile.id === server.owner_id);
  const ownerIsPro = !!ownerPreview?.is_pro;

  const displayDescription =
    (server.owner_long_description && server.owner_long_description.trim().length > 0
      ? server.owner_long_description.trim()
      : null) || server.description || 'No description yet.';

  const accentHex = server.owner_accent_hex && /^#[0-9A-Fa-f]{6}$/.test(server.owner_accent_hex)
    ? server.owner_accent_hex
    : null;

  const preset = server.owner_theme_preset || 'zinc';
  const presetSurface =
    preset === 'slate'
      ? 'from-slate-500/10'
      : preset === 'neutral'
        ? 'from-neutral-500/10'
        : preset === 'rose'
          ? 'from-rose-500/12'
          : preset === 'cyan'
            ? 'from-cyan-500/12'
            : preset === 'amber'
              ? 'from-amber-500/12'
              : preset === 'violet'
                ? 'from-violet-500/12'
                : 'from-zinc-500/10';

  const heroYt = ownerIsPro ? extractYouTubeId(server.owner_hero_video_url) : null;

  const showStaffBlock = server.owner_show_staff_section !== false;
  const showReviewsBlock = server.owner_show_reviews_section !== false;

  const meVerifiedHere = !!(
    meProfile?.id &&
    coworkers.some((c) => c.profile?.id === meProfile.id && c.is_verified)
  );

  const serverClaimable =
    !server.owner_id &&
    server.claim_open !== false &&
    !!user &&
    !!server.guild_id &&
    meVerifiedHere &&
    !myPendingClaimId;

  const canAddInviteAsVerifiedStaff =
    !!user && !!server.guild_id && meVerifiedHere && !inviteLooksValid && !server.owner_id;

  const saveStaffInvite = async () => {
    if (!server) return;
    const trimmed = staffInviteValue.trim();
    if (!trimmed) {
      toast.error('Paste a Discord invite link or code.');
      return;
    }
    if (!discordInviteLooksValid(trimmed)) {
      toast.error('Use a discord.gg link, discord.com/invite/…, or the invite code.');
      return;
    }
    setStaffInviteBusy(true);
    try {
      const { error } = await supabase.rpc('verified_staff_set_server_discord_invite', {
        p_server_id: server.id,
        p_invite: trimmed,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Invite saved for this server.');
      setServer({ ...server, discord_invite: trimmed });
      setStaffInviteValue('');
    } finally {
      setStaffInviteBusy(false);
    }
  };

  const toggleDirectoryVerified = async () => {
    if (!server) return;
    const next = !server.is_verified;
    let { error } = await supabase.rpc('site_owner_set_server_verified', {
      p_server_id: server.id,
      p_is_verified: next,
    });
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
          <img
            src={normalizeDiscordCdnMediaUrl(server.banner) ?? server.banner}
            alt=""
            draggable={false}
            className="w-full h-full object-cover no-image-drag"
          />
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

        {meIsOwner ? (
          <ServerOwnerPanel
            server={server}
            ownerIsPro={ownerIsPro}
            coworkers={coworkers
              .filter((c) => c.profile?.id)
              .map((c) => ({
                profileId: c.profile!.id,
                label: c.profile?.display_name || c.profile?.discord_username || 'Member',
                isVerified: c.is_verified,
              }))}
            onPatch={(patch) => setServer((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        ) : null}

        <Card
          className={cn(
            'card-elevated mb-6 border border-white/10 bg-gradient-to-br to-transparent',
            presetSurface,
          )}
          style={accentHex ? { borderColor: `${accentHex}66` } : undefined}
        >
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
                  {!server.owner_id ? (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 shrink-0 border-amber-500/40 text-amber-200/90">
                      Unclaimed
                    </Badge>
                  ) : null}
                  {server.is_hiring && <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/5">Hiring</Badge>}
                </div>
                {server.owner_id && ownerPreview ? (
                  <p className="text-sm text-muted-foreground mb-1">
                    Claimed by{' '}
                    <Link
                      to={profilePath(ownerPreview)}
                      className="text-foreground font-medium underline-offset-4 hover:underline"
                    >
                      {ownerPreview.display_name || ownerPreview.discord_username || 'Member'}
                    </Link>
                  </p>
                ) : null}
                {myPendingClaimId ? (
                  <p className="text-xs text-amber-200/85 mb-1">Ownership request pending ERLC staff review.</p>
                ) : null}
                <p className="text-sm text-muted-foreground max-w-2xl whitespace-pre-wrap">{displayDescription}</p>
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
                {joinHrefSafe ? (
                  <a href={joinHrefSafe} target="_blank" rel="noopener noreferrer" className="inline-flex">
                    <Button className="gap-2 w-full sm:w-auto">
                      <ExternalLink className="h-4 w-4" /> Join Discord
                    </Button>
                  </a>
                ) : server.guild_id ? (
                  inviteEnrichBusy ? (
                    <Button type="button" disabled variant="secondary" className="gap-2 w-full sm:w-auto">
                      <Loader2 className="h-4 w-4 animate-spin" /> Looking up invite…
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-3 items-stretch sm:items-end w-full sm:max-w-sm">
                      <div className="flex flex-col gap-1 items-stretch sm:items-end">
                        <Button
                          type="button"
                          variant="secondary"
                          className="gap-2 w-full sm:w-auto"
                          onClick={() => setInviteRetryTick((t) => t + 1)}
                        >
                          <RefreshCw className="h-4 w-4" /> Find join link
                        </Button>
                        <p className="text-xs text-muted-foreground text-right leading-snug">
                          If this stays empty, enable the server widget, add the directory bot with invite permissions,
                          or sync from Discord under Edit profile → Customize.
                        </p>
                      </div>
                      {canAddInviteAsVerifiedStaff && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2 w-full text-left">
                          <p className="text-xs font-medium text-foreground">Verified staff — add invite</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            If there is no valid join link yet, paste a working Discord invite (only when you have
                            verified experience here).
                          </p>
                          <Input
                            value={staffInviteValue}
                            onChange={(e) => setStaffInviteValue(e.target.value)}
                            placeholder="https://discord.gg/… or invite code"
                            className="h-9 text-sm bg-background/80 border-white/10"
                            disabled={staffInviteBusy}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="w-full sm:w-auto"
                            disabled={staffInviteBusy || !staffInviteValue.trim()}
                            onClick={() => void saveStaffInvite()}
                          >
                            {staffInviteBusy ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" aria-hidden />
                                Saving…
                              </>
                            ) : (
                              'Save invite'
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                ) : null}
                {serverClaimable && (
                  <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={() => setClaimDlgOpen(true)}>
                    Request ownership
                  </Button>
                )}
                {user && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-white/15"
                    onClick={() => setReportServerOpen(true)}
                  >
                    <Flag className="h-4 w-4" /> Report
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {heroYt ? (
          <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 aspect-video bg-black">
            <iframe
              title="Server highlight video"
              src={youtubeEmbedSrc(heroYt)}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : null}

        {galleryUrls.length > 0 ? (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-2">
            {galleryUrls.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]"
              >
                <img src={u} alt="" className="w-full h-40 object-cover hover:opacity-90 transition-opacity" />
              </a>
            ))}
          </div>
        ) : null}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {showStaffBlock ? (
              <>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Members who work here
                  <span className="text-xs text-muted-foreground font-normal">({staffListedCount})</span>
                </h2>
                {visibleCoworkers.length === 0 ? (
                  <Card className="card-elevated">
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                      No one listed yet. Members who add experience for this server will appear here.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {visibleCoworkers.map((c) => (
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
                              <p className="text-xs text-muted-foreground truncate">
                                {c.role}
                                {c.is_current ? ' • current' : ''}
                              </p>
                            </div>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">The owner has hidden the member list for this page.</p>
            )}
          </div>

          <div id="reviews" className="scroll-mt-28">
            {showReviewsBlock ? (
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
            ) : (
              <Card className="card-elevated">
                <CardContent className="p-6 text-sm text-muted-foreground">Reviews are hidden for this page.</CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <SubmitReportDialog
        open={reportServerOpen}
        onOpenChange={setReportServerOpen}
        kind="server"
        serverId={server.id}
      />
      <ServerClaimDialog
        open={claimDlgOpen}
        onOpenChange={setClaimDlgOpen}
        serverId={server.id}
        serverName={server.name}
        onSubmitted={() => {
          void (async () => {
            if (!meProfile?.id) return;
            const { data: pend } = await supabase
              .from('server_claim_requests')
              .select('id')
              .eq('server_id', server.id)
              .eq('claimant_profile_id', meProfile.id)
              .eq('status', 'pending')
              .maybeSingle();
            setMyPendingClaimId(typeof pend?.id === 'string' ? pend.id : null);
          })();
        }}
      />
    </div>
  );
};

export default ServerDetail;
