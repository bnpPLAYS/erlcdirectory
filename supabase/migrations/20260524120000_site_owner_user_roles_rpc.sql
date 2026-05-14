-- Inserts/deletes on user_roles were failing RLS for some site owners (INSERT + FOR ALL policies).
-- SECURITY DEFINER RPCs gate on is_site_owner() and apply changes as the migration owner (bypasses RLS).

CREATE OR REPLACE FUNCTION public.site_owner_grant_admin_role(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_site_owner() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.site_owner_revoke_admin_role(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_site_owner() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_target_user_id AND role = 'admin'::public.app_role;
END;
$$;

REVOKE ALL ON FUNCTION public.site_owner_grant_admin_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.site_owner_revoke_admin_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_owner_grant_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.site_owner_revoke_admin_role(uuid) TO authenticated;
