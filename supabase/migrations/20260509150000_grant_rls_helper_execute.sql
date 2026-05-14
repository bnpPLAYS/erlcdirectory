-- Connection and messaging RLS policies call is_my_profile() / are_connected().
-- A prior migration revoked EXECUTE from authenticated, which makes Postgres reject
-- policy evaluation with: permission denied for function is_my_profile
GRANT EXECUTE ON FUNCTION public.is_my_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_connected(uuid, uuid) TO authenticated;
