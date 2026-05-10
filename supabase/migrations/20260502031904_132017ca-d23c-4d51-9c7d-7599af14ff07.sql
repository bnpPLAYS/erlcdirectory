-- Reviews table for profile reputation (idempotent for preview / re-run)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewee_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (reviewee_id, reviewer_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create their own reviews" ON public.reviews;
CREATE POLICY "Users can create their own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (reviewer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE
  USING (reviewer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
CREATE POLICY "Users can delete their own reviews"
  ON public.reviews FOR DELETE
  USING (reviewer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);

-- Recompute aggregate rating on the reviewee profile
CREATE OR REPLACE FUNCTION public.recompute_profile_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target UUID;
BEGIN
  target := COALESCE(NEW.reviewee_id, OLD.reviewee_id);
  UPDATE public.profiles p
  SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE reviewee_id = target), 0),
      review_count = (SELECT COUNT(*) FROM public.reviews WHERE reviewee_id = target)
  WHERE p.id = target;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reviews_recompute_rating ON public.reviews;
CREATE TRIGGER reviews_recompute_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_profile_rating();

-- Helpful column on posts so we can show server-tagged openings nicely
-- (no schema change needed; posts.server_id already exists)
