-- Run profile-by-username lookup as SECURITY DEFINER so public /@username resolution is not
-- affected by subtle caller/RLS interactions when invoking the RPC.

CREATE OR REPLACE FUNCTION public.get_profile_by_username_lookup(lookup text)
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
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
