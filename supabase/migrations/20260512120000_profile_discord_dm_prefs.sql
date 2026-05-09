-- Opt-in Discord DM notifications (requires DISCORD_BOT_TOKEN + bot shared with users).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dm_website_updates BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dm_experience_status_updates BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.dm_website_updates IS 'User opted in to occasional website update DMs from the directory bot.';
COMMENT ON COLUMN public.profiles.dm_experience_status_updates IS 'User opted in to Discord DMs when experience verification is approved/rejected.';
