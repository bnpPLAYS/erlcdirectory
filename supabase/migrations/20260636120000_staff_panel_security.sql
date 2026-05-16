-- Staff panel security: prevent self-granting staff via spoofed Discord username / identity fields.

-- Site owner must match OAuth provider id on auth.users, not only a client-writable username.
CREATE OR REPLACE FUNCTION public.is_site_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN auth.users u ON u.id = p.user_id
    WHERE p.user_id = auth.uid()
      AND p.discord_id IS NOT NULL
      AND trim(p.discord_id) <> ''
      AND p.discord_id = coalesce(
        nullif(trim(u.raw_user_meta_data->>'provider_id'), ''),
        nullif(trim(u.raw_user_meta_data->>'sub'), ''),
        ''
      )
      AND regexp_replace(lower(trim(coalesce(p.discord_username, ''))), '\.+$', '') = 'pixelnovaa'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_site_owner() TO authenticated;

-- Clients cannot rewrite Discord identity used for staff / owner checks (OAuth sync only).
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

  NEW.discord_id := OLD.discord_id;
  NEW.discord_username := OLD.discord_username;
  NEW.discord_avatar := OLD.discord_avatar;

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

-- Do not expose every admin user_id to signed-in members (enumeration / client UI spoofing aid).
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_staff" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_staff());
