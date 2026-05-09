import { useEffect, useState } from 'react';
import { Star, MessageSquareText, Server as ServerIcon, X } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReviewRow {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  reviewer_id: string;
  server_id: string | null;
  reviewee_id: string | null;
  reviewer?: {
    id: string;
    display_name: string | null;
    discord_avatar: string | null;
    discord_username: string | null;
  } | null;
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

interface Props {
  profileId?: string;
  serverId?: string;
  serverName?: string;
}

const ReviewsSection = ({ profileId, serverId, serverName }: Props) => {
  const { profile: me } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // For profile reviews: optional server tag
  const [tagServerId, setTagServerId] = useState<string>('none');
  const [memberServers, setMemberServers] = useState<MemberServer[]>([]);

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
      setMemberServers((servers || []) as any);
    })();
  }, [profileId]);

  const fetchReviews = async () => {
    setLoading(true);
    let query = supabase
      .from('reviews')
      .select('id, rating, content, created_at, reviewer_id, server_id, reviewee_id')
      .order('created_at', { ascending: false });
    if (serverId) query = query.eq('server_id', serverId);
    else if (profileId) query = query.eq('reviewee_id', profileId);

    const { data } = await query;
    if (data && data.length) {
      const reviewerIds = [...new Set(data.map((r) => r.reviewer_id))];
      const serverIds = [...new Set(data.map((r) => r.server_id).filter(Boolean) as string[])];
      const [{ data: reviewers }, serversRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, discord_avatar, discord_username')
          .in('id', reviewerIds),
        serverIds.length
          ? supabase.from('servers').select('id, name, icon').in('id', serverIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const rmap = new Map((reviewers || []).map((r) => [r.id, r]));
      const smap = new Map(((serversRes as any).data || []).map((s: any) => [s.id, s]));
      setReviews(
        data.map((r) => ({
          ...r,
          reviewer: rmap.get(r.reviewer_id) || null,
          server: r.server_id ? (smap.get(r.server_id) as any) || null : null,
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
        ? r.server_id === serverId && !r.reviewee_id
        : profileId
        ? r.reviewee_id === profileId &&
          ((tagServerId === 'none' && !r.server_id) || r.server_id === tagServerId)
        : false)
  );

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setContent(myReview.content || '');
    } else {
      setContent('');
      setRating(5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReview?.id, tagServerId]);

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
      payload.reviewee_id = null;
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

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('reviews')
        .update({ rating: payload.rating, content: payload.content })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('reviews').insert(payload));
    }
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not save review', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: existing ? 'Review updated' : 'Review posted' });
    fetchReviews();
  };

  const remove = async () => {
    if (!myReview) return;
    const { error } = await supabase.from('reviews').delete().eq('id', myReview.id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    setContent('');
    setRating(5);
    fetchReviews();
  };

  const composerLabel = serverId
    ? `Review ${serverName || 'this server'}`
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
              <Stars value={rating} onChange={setRating} size={18} />
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                serverId
                  ? 'What is it like to work / be in this server?'
                  : 'Share your honest experience with this member…'
              }
              rows={3}
              className="bg-background/40 border-white/10"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{content.length}/500</span>
              <div className="flex gap-2">
                {myReview && (
                  <Button variant="ghost" size="sm" onClick={remove}>
                    <X className="h-3 w-3 mr-1" /> Delete
                  </Button>
                )}
                <Button size="sm" onClick={submit} disabled={submitting}>
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
            {reviews.map((r) => (
              <div key={r.id} className="glass rounded-xl p-3.5">
                <div className="flex items-start gap-3">
                  <Link to={`/profile/${r.reviewer?.id}`}>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={r.reviewer?.discord_avatar || undefined} />
                      <AvatarFallback className="text-xs bg-secondary">
                        {r.reviewer?.display_name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/profile/${r.reviewer?.id}`}
                        className="text-sm font-semibold hover:underline truncate"
                      >
                        {r.reviewer?.display_name || 'Member'}
                      </Link>
                      <Stars value={r.rating} size={12} />
                      {r.server && profileId && (
                        <Link
                          to={`/server/${r.server.id}`}
                          className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
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
                    {r.content && (
                      <p className="text-sm text-muted-foreground/90 mt-1 whitespace-pre-wrap">{r.content}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewsSection;
