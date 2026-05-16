-- Pro members: customize Discord / social Open Graph preview (title segments, description blocks, image).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_link_preview_config jsonb;

COMMENT ON COLUMN public.profiles.pro_link_preview_config IS
  'Pro-only JSON: enabled flag, ordered title keys, ordered description block keys, image mode (auto|banner|avatar). Cleared when Pro is off.';

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

  IF OLD.deactivated_at IS NOT NULL THEN
    NEW.deactivated_at := OLD.deactivated_at;
  END IF;

  NEW.is_pro := COALESCE(OLD.is_pro, false);
  NEW.pro_verified_at := OLD.pro_verified_at;
  NEW.roblox_user_id := OLD.roblox_user_id;

  IF COALESCE(NEW.is_pro, false) IS NOT TRUE THEN
    NEW.show_pro_avatar_decor := false;
  END IF;

  IF COALESCE(OLD.is_pro, false) IS NOT TRUE THEN
    NEW.pro_badge_label := OLD.pro_badge_label;
    NEW.pro_link_preview_config := NULL;
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

    IF NEW.pro_link_preview_config IS NOT NULL THEN
      IF pg_column_size(NEW.pro_link_preview_config) > 8192 THEN
        NEW.pro_link_preview_config := OLD.pro_link_preview_config;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
