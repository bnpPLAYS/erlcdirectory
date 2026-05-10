-- ERLC Directory Pro (Roblox game pass verification via Open Cloud API on the web backend).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roblox_user_id text,
  ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pro_badge_label text;

COMMENT ON COLUMN public.profiles.roblox_user_id IS 'Roblox user ID linked after successful game pass verification.';
COMMENT ON COLUMN public.profiles.is_pro IS 'True when Roblox Pro game pass ownership was verified server-side.';
COMMENT ON COLUMN public.profiles.pro_verified_at IS 'Last successful Open Cloud verification timestamp.';
COMMENT ON COLUMN public.profiles.pro_badge_label IS 'Optional short custom label shown next to Pro (max 28 chars), editable by Pro members only.';

CREATE INDEX IF NOT EXISTS idx_profiles_is_pro ON public.profiles (is_pro) WHERE is_pro;

-- Clients cannot self-grant Pro; only service_role updates bypass this trigger.
CREATE OR REPLACE FUNCTION public.profiles_strip_client_pro_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(auth.role()::text, '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  NEW.is_pro := COALESCE(OLD.is_pro, false);
  NEW.pro_verified_at := OLD.pro_verified_at;
  NEW.roblox_user_id := OLD.roblox_user_id;

  IF COALESCE(OLD.is_pro, false) IS NOT TRUE THEN
    NEW.pro_badge_label := OLD.pro_badge_label;
  ELSE
    IF NEW.pro_badge_label IS NOT NULL THEN
      NEW.pro_badge_label := trim(NEW.pro_badge_label);
      IF length(NEW.pro_badge_label) > 28 THEN
        NEW.pro_badge_label := left(NEW.pro_badge_label, 28);
      END IF;
      IF NEW.pro_badge_label = '' THEN
        NEW.pro_badge_label := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_strip_client_pro_fields_trigger ON public.profiles;
CREATE TRIGGER profiles_strip_client_pro_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_strip_client_pro_fields();
