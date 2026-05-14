-- Case-insensitive profile lookup by Discord username (trailing dots ignored), for /@username routes.

CREATE OR REPLACE FUNCTION public.get_profile_by_username_lookup(lookup text)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.profiles
  WHERE discord_username IS NOT NULL
    AND trim(discord_username) <> ''
    AND lower(regexp_replace(trim(discord_username), '\.+$', ''))
        = lower(regexp_replace(trim(COALESCE(lookup, '')), '\.+$', ''))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_by_username_lookup(text) TO anon, authenticated;
