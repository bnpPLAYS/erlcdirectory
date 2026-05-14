-- Staff panel lists admins via PostgREST on `user_roles`. A site-owner-only FOR ALL policy can block
-- SELECT for everyone else, so non-owner admins see empty lists / failed hydration.
-- Gate logic uses `is_staff()` RPC (SECURITY DEFINER); this policy restores readable role rows for clients.

DROP POLICY IF EXISTS "Roles viewable by everyone" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;

CREATE POLICY "user_roles_select_authenticated" ON public.user_roles FOR SELECT USING (true);
