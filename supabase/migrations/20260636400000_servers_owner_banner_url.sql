-- Custom server page banner (stored in server-custom bucket); overrides Discord banner on display.

ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS owner_banner_url text;

COMMENT ON COLUMN public.servers.owner_banner_url IS
  'Optional owner-uploaded banner URL (server-custom storage). Shown instead of Discord banner when set.';
