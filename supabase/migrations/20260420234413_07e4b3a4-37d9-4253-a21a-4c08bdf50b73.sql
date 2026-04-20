ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discord_access_token text,
ADD COLUMN IF NOT EXISTS discord_refresh_token text,
ADD COLUMN IF NOT EXISTS discord_token_expires_at timestamp with time zone;