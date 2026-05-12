-- Hiring posts: optional gate that applicants must have linked Roblox via OAuth (profiles.roblox_verified_at).
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS require_roblox_verified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.posts.require_roblox_verified IS
  'When true, the client apply flow checks the signed-in user has roblox_verified_at before opening application_url.';
