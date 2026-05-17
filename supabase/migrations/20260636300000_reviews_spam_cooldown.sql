-- Replace fixed 15-minute edit lock with spam detection: rapid mutations trigger a 15-minute block.

CREATE TABLE IF NOT EXISTS public.review_reviewer_cooldowns (
  reviewer_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  blocked_until timestamptz,
  burst_count integer NOT NULL DEFAULT 0,
  last_mutation_at timestamptz,
  window_mutation_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_reviewer_cooldowns ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.review_reviewer_cooldowns IS
  'Tracks review edit/delete/post bursts per reviewer; sets blocked_until when spam is detected.';

CREATE OR REPLACE FUNCTION public.enforce_review_reviewer_spam_limit(p_reviewer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.review_reviewer_cooldowns%ROWTYPE;
  now_ts timestamptz := clock_timestamp();
  new_burst integer;
  new_window integer;
BEGIN
  IF p_reviewer_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.review_reviewer_cooldowns (reviewer_id)
  VALUES (p_reviewer_id)
  ON CONFLICT (reviewer_id) DO NOTHING;

  SELECT * INTO row
  FROM public.review_reviewer_cooldowns
  WHERE reviewer_id = p_reviewer_id
  FOR UPDATE;

  IF row.blocked_until IS NOT NULL AND row.blocked_until > now_ts THEN
    RAISE EXCEPTION 'reviews_mutation_cooldown';
  END IF;

  IF now_ts - row.window_started_at > interval '15 minutes' THEN
    new_window := 1;
  ELSE
    new_window := row.window_mutation_count + 1;
  END IF;

  IF row.last_mutation_at IS NULL OR now_ts - row.last_mutation_at > interval '2 minutes' THEN
    new_burst := 1;
  ELSE
    new_burst := row.burst_count + 1;
  END IF;

  -- 4+ mutations within 2 minutes, or 10+ within 15 minutes → 15-minute cooldown
  IF new_burst >= 4 OR new_window >= 10 THEN
    UPDATE public.review_reviewer_cooldowns
    SET
      blocked_until = now_ts + interval '15 minutes',
      burst_count = new_burst,
      last_mutation_at = now_ts,
      window_mutation_count = new_window,
      window_started_at = CASE
        WHEN now_ts - row.window_started_at > interval '15 minutes' THEN now_ts
        ELSE row.window_started_at
      END
    WHERE reviewer_id = p_reviewer_id;

    RAISE EXCEPTION 'reviews_mutation_cooldown';
  END IF;

  UPDATE public.review_reviewer_cooldowns
  SET
    burst_count = new_burst,
    last_mutation_at = now_ts,
    window_mutation_count = new_window,
    window_started_at = CASE
      WHEN now_ts - row.window_started_at > interval '15 minutes' THEN now_ts
      ELSE row.window_started_at
    END,
    blocked_until = NULL
  WHERE reviewer_id = p_reviewer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_reviews_mutation_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer uuid;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF public.is_staff() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    reviewer := NEW.reviewer_id;
    PERFORM public.enforce_review_reviewer_spam_limit(reviewer);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    reviewer := OLD.reviewer_id;
    PERFORM public.enforce_review_reviewer_spam_limit(reviewer);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.rating IS NOT DISTINCT FROM OLD.rating
      AND NEW.content IS NOT DISTINCT FROM OLD.content THEN
      RETURN NEW;
    END IF;
    reviewer := OLD.reviewer_id;
    PERFORM public.enforce_review_reviewer_spam_limit(reviewer);
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS reviews_mutation_cooldown_insert ON public.reviews;
CREATE TRIGGER reviews_mutation_cooldown_insert
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reviews_mutation_cooldown();

DROP TRIGGER IF EXISTS reviews_mutation_cooldown_delete ON public.reviews;
CREATE TRIGGER reviews_mutation_cooldown_delete
  BEFORE DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reviews_mutation_cooldown();

DROP TRIGGER IF EXISTS reviews_mutation_cooldown_update ON public.reviews;
CREATE TRIGGER reviews_mutation_cooldown_update
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reviews_mutation_cooldown();
