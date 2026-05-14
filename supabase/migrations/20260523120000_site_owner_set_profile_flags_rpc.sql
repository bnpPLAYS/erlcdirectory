-- Let the site owner update profiles.is_verified / is_featured via a SECURITY DEFINER RPC.
-- Direct client UPDATE can fail RLS evaluation edge cases across policies; this matches staff-only UX.

CREATE OR REPLACE FUNCTION public.site_owner_set_profile_flags(
  p_profile_id uuid,
  p_is_verified boolean,
  p_is_featured boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_site_owner() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    is_verified = p_is_verified,
    is_featured = p_is_featured
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.site_owner_set_profile_flags(uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_owner_set_profile_flags(uuid, boolean, boolean) TO authenticated;
