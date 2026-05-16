-- Pro server owners: advanced Discord review webhook templates (JSON).

ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS owner_review_embed_config jsonb;

COMMENT ON COLUMN public.servers.owner_review_embed_config IS
  'Pro-only JSON: review webhook activity line + embed templates (placeholders), webhook username/avatar overrides, media/button toggles. Cleared when owner is not Pro.';

CREATE OR REPLACE FUNCTION public.servers_guard_owner_review_embed_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_pro boolean;
BEGIN
  IF NEW.owner_review_embed_config IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS NULL THEN
    NEW.owner_review_embed_config := NULL;
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.is_pro, false) INTO owner_pro
  FROM public.profiles p
  WHERE p.id = NEW.owner_id;

  IF NOT COALESCE(owner_pro, false) THEN
    NEW.owner_review_embed_config := NULL;
    RETURN NEW;
  END IF;

  IF pg_column_size(NEW.owner_review_embed_config) > 16384 THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.owner_review_embed_config := OLD.owner_review_embed_config;
    ELSE
      NEW.owner_review_embed_config := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS servers_guard_owner_review_embed_config ON public.servers;
CREATE TRIGGER servers_guard_owner_review_embed_config
  BEFORE INSERT OR UPDATE ON public.servers
  FOR EACH ROW
  EXECUTE FUNCTION public.servers_guard_owner_review_embed_config();

CREATE OR REPLACE FUNCTION public.clear_owned_servers_review_embed_on_pro_off()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.is_pro, false) IS TRUE AND COALESCE(NEW.is_pro, false) IS NOT TRUE THEN
    UPDATE public.servers
    SET owner_review_embed_config = NULL
    WHERE owner_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_clear_owned_servers_review_embed ON public.profiles;
CREATE TRIGGER profiles_clear_owned_servers_review_embed
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_owned_servers_review_embed_on_pro_off();
