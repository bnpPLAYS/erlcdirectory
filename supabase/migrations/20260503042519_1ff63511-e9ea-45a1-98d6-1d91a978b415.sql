
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS guild_id text;
CREATE UNIQUE INDEX IF NOT EXISTS servers_guild_id_unique
  ON public.servers(guild_id) WHERE guild_id IS NOT NULL;

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS server_id uuid;
ALTER TABLE public.reviews ALTER COLUMN reviewee_id DROP NOT NULL;
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_target_check;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_target_check
  CHECK (reviewee_id IS NOT NULL OR server_id IS NOT NULL);

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_reviewee_id_reviewer_id_key;
DROP INDEX IF EXISTS reviews_unique_per_target;
CREATE UNIQUE INDEX reviews_unique_per_target
  ON public.reviews (
    reviewer_id,
    COALESCE(reviewee_id::text, '_'),
    COALESCE(server_id::text, '_')
  );

-- Update rating recompute to ignore rows without a reviewee
CREATE OR REPLACE FUNCTION public.recompute_profile_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target UUID;
BEGIN
  target := COALESCE(NEW.reviewee_id, OLD.reviewee_id);
  IF target IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.profiles p
  SET rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE reviewee_id = target), 0),
      review_count = (SELECT COUNT(*) FROM public.reviews WHERE reviewee_id = target)
  WHERE p.id = target;
  RETURN NULL;
END;
$function$;
