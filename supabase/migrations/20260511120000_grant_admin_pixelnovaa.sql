-- Grant site admin (Staff panel) to Pixelnovaa by Discord username on profiles.
-- Safe if the user has not signed up yet (inserts zero rows until a matching profile exists).
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::public.app_role
FROM public.profiles p
WHERE lower(btrim(p.discord_username)) IN ('pixelnovaa', 'pixelnovaa.')
ON CONFLICT (user_id, role) DO NOTHING;
