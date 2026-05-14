-- Ensure authenticated users can invoke RLS helpers used by connection_requests / messages policies.
-- Without EXECUTE, Postgres raises: permission denied for function is_my_profile
-- (see 20260502035507 revoke + 20260509150000 grant — this migration repeats the grant safely for any DB that missed it).
GRANT EXECUTE ON FUNCTION public.is_my_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_connected(uuid, uuid) TO authenticated;
