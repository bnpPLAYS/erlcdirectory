-- Site owner can grant/revoke directory verification on servers (badge shown across directory UI).

CREATE OR REPLACE FUNCTION public.site_owner_set_server_verified(p_server_id uuid, p_is_verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_site_owner() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.servers
  SET is_verified = p_is_verified,
      updated_at = now()
  WHERE id = p_server_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'server not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.site_owner_set_server_verified(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_owner_set_server_verified(uuid, boolean) TO authenticated;
