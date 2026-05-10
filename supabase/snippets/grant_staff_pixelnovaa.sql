-- Give Pixelnovaa. staff (Staff panel). Run in Supabase SQL Editor as postgres.
-- Requirement: that Discord account has signed into the site once (row in public.profiles).

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::public.app_role
FROM public.profiles p
WHERE lower(btrim(p.discord_username)) IN ('pixelnovaa', 'pixelnovaa.')
ON CONFLICT (user_id, role) DO NOTHING;

-- If 0 rows: open the site, sign in with Discord as Pixelnovaa, run this again.
