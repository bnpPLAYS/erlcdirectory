-- Track when Roblox user id was verified via Open Cloud (Pro or account-link flow).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roblox_verified_at timestamptz;

COMMENT ON COLUMN public.profiles.roblox_verified_at IS 'Set when Roblox user id is verified via inventory (Pro pass or account link item).';

UPDATE public.profiles
SET roblox_verified_at = pro_verified_at
WHERE roblox_verified_at IS NULL
  AND pro_verified_at IS NOT NULL
  AND roblox_user_id IS NOT NULL;

-- Clients cannot set roblox_user_id or roblox_verified_at; only service_role (Edge Functions) can.
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
  NEW.roblox_verified_at := OLD.roblox_verified_at;

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

COMMENT ON COLUMN public.profiles.roblox_user_id IS 'Roblox user id set by verify-roblox-pro or verify-roblox-account-link (service role only).';
