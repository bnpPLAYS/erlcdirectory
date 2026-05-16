-- Limit how often a reviewer can update or delete their own review (staff + service_role exempt).

CREATE OR REPLACE FUNCTION public.enforce_reviews_mutation_cooldown()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF auth.role() = 'service_role' THEN
      RETURN OLD;
    END IF;
    IF public.is_staff() THEN
      RETURN OLD;
    END IF;
    IF clock_timestamp() - OLD.updated_at < interval '15 minutes' THEN
      RAISE EXCEPTION 'reviews_mutation_cooldown';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF clock_timestamp() - OLD.updated_at < interval '15 minutes' THEN
      RAISE EXCEPTION 'reviews_mutation_cooldown';
    END IF;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS reviews_mutation_cooldown_delete ON public.reviews;
CREATE TRIGGER reviews_mutation_cooldown_delete
  BEFORE DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reviews_mutation_cooldown();

DROP TRIGGER IF EXISTS reviews_mutation_cooldown_update ON public.reviews;
CREATE TRIGGER reviews_mutation_cooldown_update
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reviews_mutation_cooldown();
