-- Staff powers (manage roles, moderate directory) are restricted to the Discord account
-- whose username normalizes to "pixelnovaa" (Pixelnovaa., pixelnovaa, etc.).
-- Replaces broad `has_role(..., 'admin')` checks so granting yourself `admin` in user_roles cannot bypass.

CREATE OR REPLACE FUNCTION public.is_site_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND regexp_replace(lower(trim(coalesce(p.discord_username, ''))), '\.+$', '') = 'pixelnovaa'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_site_owner() TO authenticated;

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Site owner manages roles" ON public.user_roles FOR ALL
  USING (public.is_site_owner())
  WITH CHECK (public.is_site_owner());

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Site owner can update any profile" ON public.profiles FOR UPDATE
  USING (public.is_site_owner())
  WITH CHECK (public.is_site_owner());

DROP POLICY IF EXISTS "Admins can delete posts" ON public.posts;
CREATE POLICY "Site owner can delete posts" ON public.posts FOR DELETE USING (public.is_site_owner());

DROP POLICY IF EXISTS "Admins can delete servers" ON public.servers;
CREATE POLICY "Site owner can delete servers" ON public.servers FOR DELETE USING (public.is_site_owner());

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Site owner can delete profiles" ON public.profiles FOR DELETE USING (public.is_site_owner());

DROP POLICY IF EXISTS "Admins can update servers" ON public.servers;
CREATE POLICY "Site owner can update servers" ON public.servers FOR UPDATE
  USING (public.is_site_owner())
  WITH CHECK (public.is_site_owner());

DROP POLICY IF EXISTS "Admins can update posts" ON public.posts;
CREATE POLICY "Site owner can update posts" ON public.posts FOR UPDATE
  USING (public.is_site_owner())
  WITH CHECK (public.is_site_owner());

-- Remove stale admin rows for accounts that are not the site owner Discord identity
DELETE FROM public.user_roles ur
WHERE ur.role = 'admin'::public.app_role
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = ur.user_id
      AND regexp_replace(lower(trim(coalesce(p.discord_username, ''))), '\.+$', '') = 'pixelnovaa'
  );

-- Ensure the site owner keeps an admin row if they have a profile (optional compatibility)
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::public.app_role
FROM public.profiles p
WHERE regexp_replace(lower(trim(coalesce(p.discord_username, ''))), '\.+$', '') = 'pixelnovaa'
ON CONFLICT (user_id, role) DO NOTHING;
