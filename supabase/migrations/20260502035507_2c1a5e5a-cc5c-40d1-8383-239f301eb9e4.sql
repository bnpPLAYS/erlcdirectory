REVOKE EXECUTE ON FUNCTION public.is_my_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.are_connected(uuid, uuid) FROM PUBLIC, anon, authenticated;