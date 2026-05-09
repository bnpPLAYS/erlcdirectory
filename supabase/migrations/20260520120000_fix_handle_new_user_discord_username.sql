-- Fix profile bootstrap: discord_username must be the Discord login/handle (preferred_username),
-- not display/full_name. The previous mapping broke /@username lookups.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  disc_id text;
  disc_username text;
  avatar text;
  disp text;
BEGIN
  disc_id := COALESCE(
    NULLIF(trim(meta->>'provider_id'), ''),
    NULLIF(trim(meta->>'sub'), '')
  );

  disc_username := COALESCE(
    NULLIF(trim(meta->>'preferred_username'), ''),
    NULLIF(trim(meta->>'user_name'), ''),
    NULLIF(trim(meta->>'name'), ''),
    NULLIF(trim(meta->>'full_name'), ''),
    'Discord User'
  );

  avatar := COALESCE(
    NULLIF(trim(meta->>'avatar_url'), ''),
    NULLIF(trim(meta->>'picture'), '')
  );

  disp := COALESCE(
    NULLIF(trim(meta->>'full_name'), ''),
    NULLIF(trim(meta->>'name'), ''),
    NULLIF(trim(meta->>'global_name'), ''),
    disc_username
  );

  INSERT INTO public.profiles (user_id, discord_id, discord_username, discord_avatar, display_name)
  VALUES (NEW.id, disc_id, disc_username, avatar, disp)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Repair existing profiles: refresh Discord identity fields from auth.users metadata.
UPDATE public.profiles p
SET
  discord_username = COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'preferred_username'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'user_name'), ''),
    p.discord_username
  ),
  discord_id = COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'provider_id'), ''),
    p.discord_id
  ),
  discord_avatar = COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'avatar_url'), ''),
    p.discord_avatar
  ),
  updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id;
