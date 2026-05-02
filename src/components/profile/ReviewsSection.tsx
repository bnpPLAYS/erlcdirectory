import { useEffect, useState } from 'react';
import { Star, MessageSquareText } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface ReviewRow {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  reviewer_id: string;
  reviewer?: {
    id: string;
    display_name: string | null;
    discord_avatar: string | null;
    discord_username: string | null;
  } | null;
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

const ReviewsSection = ({ profileId }: { profileId: string }) => {
  const { profile: me } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isOwn = me?.id === profileId;
  const myReview = reviews.find((r) => r.reviewer_id === me?.id);

  useEffect(() => {
    fetchReviews();
  }, [profileId]);

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setContent(myReview.content || '');
    }
  }, [myReview?.id]);

  const fetchReviews = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reviews')
      .select('id, rating, content, created_at, reviewer_id')
      .eq('reviewee_id', profileId)
      .order('created_at', { ascending: false });

    if (data && data.length) {
      const ids = [...new Set(data.map((r) => r.reviewer_id))];
      const { data: reviewers } = await supabase
        .from('profiles')
        .select('id, display_name, discord_avatar, discord_username')
        .in('id', ids);
      const map = new Map(reviewers?.map((r) => [r.id, r]) || []);
      setReviews(data.map((r) => ({ ...r, reviewer: map.get(r.reviewer_id) || null })));
    } else {
      setReviews([]);
    }
    setLoading(false);
  };

  const submit = async () => {
    if (!me) return;
    setSubmitting(true);
    const { error } = await supabase.from('reviews').upsert(
      {
        reviewee_id: profileId,
        reviewer_id: me.id,
        rating,
        content: content.trim() || null,
      },
      { onConflict: 'reviewee_id,reviewer_id' }
    );
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not save review', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: myReview ? 'Review updated' : 'Review posted' });
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

  return (
    <Card className="card-elevated">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquareText className="h-4 w-4" />
          <h3 className="font-semibold">Reviews</h3>
          <span className="text-xs text-muted-foreground ml-auto">{reviews.length} total</span>
        </div>

        {me && !isOwn && (
          <div className="glass rounded-xl p-4 mb-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-muted-foreground">Your rating</span>
              <Stars value={rating} onChange={setRating} size={18} />
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your honest experience working with this member…"
              rows={3}
              className="bg-background/40 border-white/10 mb-3"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{content.length}/500</span>
              <div className="flex gap-2">
                {myReview && (
                  <Button variant="ghost" size="sm" onClick={remove}>
                    Delete
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
