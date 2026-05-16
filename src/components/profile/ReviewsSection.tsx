import { useEffect, useState } from 'react';
import { Star, MessageSquareText, Server as ServerIcon, X, Flag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { filterPlaintext } from '@/lib/chatFilter';
import { Link } from 'react-router-dom';
import { profilePath } from '@/lib/profilePath';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SubmitReportDialog } from '@/components/moderation/SubmitReportDialog';
import { notifyServerReview } from '@/lib/callServerOwnerApi';
import { normalizeDiscordCdnMediaUrl, avatarReferrerPolicy } from '@/lib/safeAvatarUrl';
import { publicErrorMessage } from '@/lib/clientErrorHandling';

type ProfileChip = {
  id: string;
  display_name: string | null;
  discord_avatar: string | null;
  discord_username: string | null;
  banner_url: string | null;
};

const REVIEW_MUTATION_COOLDOWN_MS = 15 * 60 * 1000;

function reviewsCooldownRemainingMs(updatedAtIso: string): number {
  const t = new Date(updatedAtIso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, REVIEW_MUTATION_COOLDOWN_MS - (Date.now() - t));
}

function reviewsCooldownHuman(remainingMs: number): string {
  const m = Math.max(1, Math.ceil(remainingMs / 60000));
  return m === 1 ? '1 minute' : `${m} minutes`;
}

function isReviewsMutationCooldownError(err: unknown): boolean {
  const m =
    err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
  return m.includes('reviews_mutation_cooldown');
}

interface ReviewRow {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  updated_at: string;
  reviewer_id: string;
  server_id: string | null;
  reviewee_id: string | null;
  reviewer?: ProfileChip | null;
  /** Present when this review is about a specific member (server context). */
  reviewee?: ProfileChip | null;
  server?: { id: string; name: string; icon: string | null } | null;
}

interface MemberServer {
  id: string;
  name: string;
  icon: string | null;
}

const Stars = ({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(n)}
        className={cn('transition-transform', onChange && 'hover:scale-110')}
        aria-label={`${n} stars`}
      >
        <Star
          style={{ width: size, height: size }}
          className={cn(n <= value ? 'fill-foreground text-foreground' : 'text-muted-foreground/40')}
        />
      </button>
    ))}
  </div>
);

/** Members listed on the server page — used to post reviews about a specific person. */
export type ServerReviewTarget = {
  profileId: string;
  display_name: string | null;
  discord_avatar: string | null;
  discord_username: string | null;
};

interface Props {
  profileId?: string;
  serverId?: string;
  serverName?: string;
  /** Coworkers on this server; enables “review about [member]” on the server reviews card. */
  serverReviewTargets?: ServerReviewTarget[];
  /** Directory staff: remove inappropriate reviews from this list. */
  staffTools?: boolean;
}

const GENERAL_SERVER_REVIEW = '__general__';

const ReviewsSection = ({ profileId, serverId, serverName, serverReviewTargets, staffTools }: Props) => {
  const { profile: me } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // For profile reviews: optional server tag
  const [tagServerId, setTagServerId] = useState<string>('none');
  /** Server reviews: general feedback vs a specific member profile id. */
  const [reviewAboutId, setReviewAboutId] = useState<string>(GENERAL_SERVER_REVIEW);
  const [memberServers, setMemberServers] = useState<MemberServer[]>([]);
  const [reportReviewId, setReportReviewId] = useState<string | null>(null);
  /** Forces re-render so review edit cooldown countdown stays accurate while the tab is open. */
  const [, setCooldownTick] = useState(0);

  const isOwn = !!profileId && me?.id === profileId;

  useEffect(() => {
    fetchReviews();
  }, [profileId, serverId]);

  // Load servers the reviewee works in (for profile reviews)
  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const { data: exps } = await supabase
        .from('experiences')
        .select('guild_id')
        .eq('profile_id', profileId)
        .not('guild_id', 'is', null);
      const guildIds = [...new Set((exps || []).map((e) => e.guild_id))].filter(Boolean) as string[];
      if (!guildIds.length) {
        setMemberServers([]);
        return;
      }
      const { data: servers } = await supabase
        .from('servers')
        .select('id, name, icon, guild_id')
        .in('guild_id', guildIds);
      setMemberServers((servers || []) as MemberServer[]);
    })();
  }, [profileId]);

  useEffect(() => {
    setReviewAboutId(GENERAL_SERVER_REVIEW);
  }, [serverId]);

  const fetchReviews = async () => {
    setLoading(true);
    let query = supabase
      .from('reviews')
      .select('id, rating, content, created_at, updated_at, reviewer_id, server_id, reviewee_id')
      .order('created_at', { ascending: false });
    if (serverId) query = query.eq('server_id', serverId);
    else if (profileId) query = query.eq('reviewee_id', profileId);

    const { data } = await query;
    if (data && data.length) {
      const reviewerIds = [...new Set(data.map((r) => r.reviewer_id))];
      const revieweeIds = [...new Set(data.map((r) => r.reviewee_id).filter(Boolean) as string[])];
      const serverIds = [...new Set(data.map((r) => r.server_id).filter(Boolean) as string[])];
      const [{ data: reviewers }, { data: reviewees }, serversRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, discord_avatar, discord_username, banner_url')
          .in('id', reviewerIds),
        revieweeIds.length
          ? supabase
              .from('profiles')
              .select('id, display_name, discord_avatar, discord_username, banner_url')
              .in('id', revieweeIds)
          : Promise.resolve({ data: [] as ProfileChip[] }),
        serverIds.length
          ? supabase.from('servers').select('id, name, icon').in('id', serverIds)
          : Promise.resolve({ data: [] as { id: string; name: string; icon: string | null }[] }),
      ]);
      const rmap = new Map((reviewers || []).map((r) => [r.id, r as ProfileChip]));
      const emap = new Map((reviewees || []).map((r) => [r.id, r as ProfileChip]));
      const smap = new Map((serversRes.data || []).map((s) => [s.id, s]));
      setReviews(
        data.map((r) => ({
          ...r,
          reviewer: rmap.get(r.reviewer_id) || null,
          reviewee: r.reviewee_id ? emap.get(r.reviewee_id) || null : null,
          server: r.server_id ? smap.get(r.server_id) || null : null,
        }))
      );
    } else {
      setReviews([]);
    }
    setLoading(false);
  };

  const myReview = reviews.find(
    (r) =>
      r.reviewer_id === me?.id &&
      (serverId
        ? r.server_id === serverId &&
          (reviewAboutId === GENERAL_SERVER_REVIEW
            ? !r.reviewee_id
            : r.reviewee_id === reviewAboutId)
        : profileId
        ? r.reviewee_id === profileId &&
          ((tagServerId === 'none' && !r.server_id) || r.server_id === tagServerId)
        : false)
  );

  const myReviewCooldownMs = myReview ? reviewsCooldownRemainingMs(myReview.updated_at) : 0;

  useEffect(() => {
    if (!myReview) return;
    const id = window.setInterval(() => setCooldownTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [myReview?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- timer keyed to review row id only

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setContent(myReview.content || '');
    } else {
      setContent('');
      setRating(5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReview?.id, tagServerId, reviewAboutId]);

  const submit = async () => {
    if (!me) return;
    setSubmitting(true);
    const contentF = filterPlaintext(content.trim());
    if (contentF.blockedHits) {
      toast({ title: 'Review wording was adjusted to meet community guidelines.' });
    }
    const payload: Record<string, unknown> = {
      reviewer_id: me.id,
      rating,
      content: contentF.text || null,
    };
    if (serverId) {
      payload.server_id = serverId;
      payload.reviewee_id =
        reviewAboutId !== GENERAL_SERVER_REVIEW && reviewAboutId ? reviewAboutId : null;
    } else if (profileId) {
      payload.reviewee_id = profileId;
      payload.server_id = tagServerId !== 'none' ? tagServerId : null;
    }

    // Find existing match to update, otherwise insert
    const existing = reviews.find(
      (r) =>
        r.reviewer_id === me.id &&
        (r.reviewee_id || null) === (payload.reviewee_id || null) &&
        (r.server_id || null) === (payload.server_id || null)
    );

    if (existing && reviewsCooldownRemainingMs(existing.updated_at) > 0) {
      const rem = reviewsCooldownRemainingMs(existing.updated_at);
      toast({
        title: 'Please wait',
        description: `You can change this review again in ${reviewsCooldownHuman(rem)}.`,
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('reviews')
        .update({ rating: payload.rating, content: payload.content })
        .eq('id', existing.id));
    } else {
      const ins = await supabase.from('reviews').insert(payload).select('id').maybeSingle();
      error = ins.error;
      if (!error && serverId && ins.data?.id) {
        void notifyServerReview(serverId, ins.data.id);
      }
    }
    setSubmitting(false);
    if (error) {
      if (isReviewsMutationCooldownError(error)) {
        toast({
          title: 'Please wait',
          description: 'You can edit or delete this review once every 15 minutes.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Could not save review', description: publicErrorMessage('Please try again.', error), variant: 'destructive' });
      return;
    }
    toast({ title: existing ? 'Review updated' : 'Review posted' });
    fetchReviews();
  };

  const remove = async () => {
    if (!myReview) return;
    if (reviewsCooldownRemainingMs(myReview.updated_at) > 0) {
      const rem = reviewsCooldownRemainingMs(myReview.updated_at);
      toast({
        title: 'Please wait',
        description: `You can delete this review again in ${reviewsCooldownHuman(rem)}.`,
        variant: 'destructive',
      });
      return;
    }
    const { error } = await supabase.from('reviews').delete().eq('id', myReview.id);
    if (error) {
      if (isReviewsMutationCooldownError(error)) {
        toast({
          title: 'Please wait',
          description: 'You can edit or delete this review once every 15 minutes.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Could not delete', description: publicErrorMessage('Please try again.', error), variant: 'destructive' });
      return;
    }
    setContent('');
    setRating(5);
    fetchReviews();
  };

  const staffRemoveReview = async (reviewId: string) => {
    if (!staffTools) return;
    if (!window.confirm('Remove this review permanently?')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
    if (error) {
      toast({ title: 'Could not remove review', description: publicErrorMessage('Please try again.', error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Review removed' });
    fetchReviews();
  };

  const targetMemberLabel =
    serverId && reviewAboutId !== GENERAL_SERVER_REVIEW
      ? serverReviewTargets?.find((t) => t.profileId === reviewAboutId)?.display_name ||
        serverReviewTargets?.find((t) => t.profileId === reviewAboutId)?.discord_username ||
        'this member'
      : null;

  const composerLabel = serverId
    ? reviewAboutId !== GENERAL_SERVER_REVIEW && targetMemberLabel
      ? `Review about ${targetMemberLabel}`
      : `Review ${serverName || 'this server'}`
    : 'Your review';

  return (
    <Card className="card-elevated">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquareText className="h-4 w-4" />
          <h3 className="font-semibold">Reviews</h3>
          <span className="text-xs text-muted-foreground ml-auto">{reviews.length} total</span>
        </div>

        {me && !isOwn && (
          <div className="glass rounded-xl p-4 mb-5 space-y-3">
            <p className="text-xs text-muted-foreground">{composerLabel}</p>

            {serverId && (serverReviewTargets?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Who is this about?</p>
                <Select value={reviewAboutId} onValueChange={setReviewAboutId}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GENERAL_SERVER_REVIEW}>This server (general)</SelectItem>
                    {(serverReviewTargets ?? []).map((t) => (
                      <SelectItem key={t.profileId} value={t.profileId}>
                        {t.display_name || t.discord_username || 'Member'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {profileId && memberServers.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Context</p>
                <Select value={tagServerId} onValueChange={setTagServerId}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General feedback</SelectItem>
                    {memberServers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        Working at {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Rating</span>
              <Stars
                value={rating}
                onChange={myReview && myReviewCooldownMs > 0 ? undefined : setRating}
                size={18}
              />
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              readOnly={!!myReview && myReviewCooldownMs > 0}
              placeholder={
                serverId
                  ? reviewAboutId !== GENERAL_SERVER_REVIEW && targetMemberLabel
                    ? `Share your experience with ${targetMemberLabel}…`
                    : 'What is it like to work / be in this server?'
                  : 'Share your honest experience with this member…'
              }
              rows={3}
              className="bg-background/40 border-white/10"
              maxLength={500}
            />
            {myReview && myReviewCooldownMs > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Edits and deletes unlock in {reviewsCooldownHuman(myReviewCooldownMs)} (once every 15 minutes).
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{content.length}/500</span>
              <div className="flex gap-2">
                {myReview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void remove()}
                    disabled={myReviewCooldownMs > 0}
                  >
                    <X className="h-3 w-3 mr-1" /> Delete
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => void submit()}
                  disabled={submitting || (!!myReview && myReviewCooldownMs > 0)}
                >
                  {myReview ? 'Update review' : 'Post review'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.03] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No reviews yet. Be the first to leave one.
          </p>
        ) : (
          <div className="space-y-2.5">
            {reviews.map((r) => {
              const bannerSrc = normalizeDiscordCdnMediaUrl(r.reviewer?.banner_url) ?? r.reviewer?.banner_url ?? undefined;
              return (
                <div
                  key={r.id}
                  className="glass overflow-hidden rounded-xl border border-white/[0.06] shadow-sm"
                >
                  <div className="relative h-[76px] w-full overflow-hidden bg-muted/25">
                    {bannerSrc ? (
                      <img
                        src={bannerSrc}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy={avatarReferrerPolicy(bannerSrc)}
                      />
                    ) : (
                      <div
                        className="h-full w-full bg-gradient-to-br from-primary/15 via-muted/30 to-muted/5"
                        aria-hidden
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card from-[35%] via-card/40 to-transparent" />
                  </div>
                  <div className="relative px-3.5 pb-3.5 pt-0">
                    <div className="flex items-start gap-3 -mt-6">
                      <Link
                        to={r.reviewer ? profilePath(r.reviewer) : '/browse'}
                        className="shrink-0 rounded-full ring-2 ring-card ring-offset-0"
                      >
                        <Avatar className="h-11 w-11 border-2 border-card shadow-md">
                          <AvatarImage src={r.reviewer?.discord_avatar || undefined} />
                          <AvatarFallback className="text-sm bg-secondary">
                            {r.reviewer?.display_name?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="min-w-0 flex-1 pt-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={r.reviewer ? profilePath(r.reviewer) : '/browse'}
                            className="truncate text-sm font-semibold hover:underline"
                          >
                            {r.reviewer?.display_name || 'Member'}
                          </Link>
                          <Stars value={r.rating} size={12} />
                          {r.server && profileId && (
                            <Link
                              to={`/server/${r.server.id}`}
                              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] bg-white/5 hover:bg-white/10"
                            >
                              {r.server.icon ? (
                                <img src={r.server.icon} alt="" className="h-3 w-3 rounded-sm" />
                              ) : (
                                <ServerIcon className="h-3 w-3" />
                              )}
                              {r.server.name}
                            </Link>
                          )}
                        </div>
                        {serverId && r.reviewee && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="shrink-0 text-muted-foreground/70">Review for</span>
                            <Link
                              to={profilePath(r.reviewee)}
                              className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 hover:bg-white/10"
                            >
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={r.reviewee.discord_avatar || undefined} />
                                <AvatarFallback className="bg-secondary text-[9px]">
                                  {r.reviewee.display_name?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate font-medium text-foreground/90">
                                {r.reviewee.display_name || r.reviewee.discord_username || 'Member'}
                              </span>
                            </Link>
                          </div>
                        )}
                        {r.content && (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground/90">
                            {r.content}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                          <p className="text-[11px] text-muted-foreground/60">
                            {new Date(r.created_at).toLocaleDateString()}
                          </p>
                          <div className="flex items-center gap-1">
                            {me && r.reviewer_id !== me.id && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                onClick={() => setReportReviewId(r.id)}
                              >
                                <Flag className="h-3 w-3" />
                                Report
                              </Button>
                            )}
                            {staffTools && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                                onClick={() => void staffRemoveReview(r.id)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <SubmitReportDialog
          open={!!reportReviewId}
          onOpenChange={(o) => {
            if (!o) setReportReviewId(null);
          }}
          kind="review"
          reviewId={reportReviewId}
        />
      </CardContent>
    </Card>
  );
};

export default ReviewsSection;
