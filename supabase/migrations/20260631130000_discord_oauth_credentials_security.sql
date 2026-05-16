-- Move Discord OAuth tokens off public.profiles (they were readable via PostgREST + open SELECT RLS).
-- Tokens live in discord_oauth_credentials with no client-readable policies (service_role / Edge only).

CREATE TABLE IF NOT EXISTS public.discord_oauth_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.discord_oauth_credentials IS
  'Discord OAuth tokens for guilds/media/verify flows — never exposed to PostgREST clients; Edge Functions use service role.';

ALTER TABLE public.discord_oauth_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.discord_oauth_credentials FROM PUBLIC;
GRANT ALL ON TABLE public.discord_oauth_credentials TO service_role;

INSERT INTO public.discord_oauth_credentials (user_id, access_token, refresh_token, expires_at, updated_at)
SELECT
  p.user_id,
  p.discord_access_token,
  p.discord_refresh_token,
  p.discord_token_expires_at,
  now()
FROM public.profiles p
WHERE p.discord_access_token IS NOT NULL
   OR p.discord_refresh_token IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  access_token = COALESCE(EXCLUDED.access_token, public.discord_oauth_credentials.access_token),
  refresh_token = COALESCE(EXCLUDED.refresh_token, public.discord_oauth_credentials.refresh_token),
  expires_at = COALESCE(EXCLUDED.expires_at, public.discord_oauth_credentials.expires_at),
  updated_at = now();

ALTER TABLE public.profiles DROP COLUMN IF EXISTS discord_access_token;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS discord_refresh_token;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS discord_token_expires_at;

-- Staff panel: list members without relying on broad profiles SELECT (spoofed client UI still gets no rows server-side).
CREATE OR REPLACE FUNCTION public.staff_admin_list_profiles(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  display_name text,
  discord_username text,
  discord_avatar text,
  is_verified boolean,
  is_featured boolean,
  is_pro boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.user_id,
    p.display_name,
    p.discord_username,
    p.discord_avatar,
    p.is_verified,
    p.is_featured,
    p.is_pro,
    p.created_at
  FROM public.profiles p
  WHERE public.is_staff()
  ORDER BY p.created_at DESC NULLS LAST
  LIMIT LEAST(COALESCE(NULLIF(p_limit, 0), 200), 500);
$$;

REVOKE ALL ON FUNCTION public.staff_admin_list_profiles(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_admin_list_profiles(integer) TO authenticated;

COMMENT ON FUNCTION public.staff_admin_list_profiles(integer) IS
  'Returns directory profile rows for the staff panel only when is_staff() is true for the caller.';

-- Server-owned Discord review embed customization (webhook embeds from Edge Function).
ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS owner_discord_embed_color integer,
  ADD COLUMN IF NOT EXISTS owner_discord_embed_footer text;

COMMENT ON COLUMN public.servers.owner_discord_embed_color IS
  'Optional Discord embed color (0–16777215 decimal). Used for review webhook embeds.';
COMMENT ON COLUMN public.servers.owner_discord_embed_footer IS
  'Optional short footer text on Discord review webhook embeds (max length enforced in app).';

ALTER TABLE public.servers
  DROP CONSTRAINT IF EXISTS servers_owner_discord_embed_color_check;
ALTER TABLE public.servers
  ADD CONSTRAINT servers_owner_discord_embed_color_check
  CHECK (
    owner_discord_embed_color IS NULL
    OR (
      owner_discord_embed_color >= 0
      AND owner_discord_embed_color <= 16777215
    )
  );
