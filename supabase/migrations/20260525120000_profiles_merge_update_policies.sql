-- Single UPDATE policy so own-profile edits OR site-owner moderation share one WITH CHECK.
-- Avoids edge cases where multiple permissive policies disagreed on INSERT-like UPDATE checks.

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Site owner can update any profile" ON public.profiles;

CREATE POLICY "profiles_update_own_or_site_owner" ON public.profiles
FOR UPDATE
USING (
  (SELECT auth.uid()) = user_id
  OR public.is_site_owner()
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  OR public.is_site_owner()
);
