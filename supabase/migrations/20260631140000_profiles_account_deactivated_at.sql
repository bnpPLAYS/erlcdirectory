-- Self-service account deactivation: profile hidden from directory/username lookup; user is signed out in the app.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

COMMENT ON COLUMN public.profiles.deactivated_at IS
  'When set, the member is treated as inactive: hidden from browse and username resolution; client signs out. Only staff viewing others may still load the row for moderation.';

CREATE INDEX IF NOT EXISTS idx_profiles_active_for_directory
  ON public.profiles (created_at DESC)
  WHERE deactivated_at IS NULL;

-- Once deactivated, clients cannot clear this timestamp (reactivation is staff/support only).
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

CREATE OR REPLACE FUNCTION public.deactivate_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    deactivated_at = now(),
    updated_at = now()
  WHERE user_id = auth.uid()
    AND deactivated_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_own_account() TO authenticated;

COMMENT ON FUNCTION public.deactivate_own_account() IS
  'Sets profiles.deactivated_at for the current user once; idempotent if already inactive.';

CREATE OR REPLACE FUNCTION public.get_profile_by_username_lookup(lookup text)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.profiles
  WHERE deactivated_at IS NULL
    AND discord_username IS NOT NULL
    AND trim(discord_username) <> ''
    AND lower(regexp_replace(trim(discord_username), '\.+$', ''))
        = lower(regexp_replace(trim(COALESCE(lookup, '')), '\.+$', ''))
  LIMIT 1;
$$;
