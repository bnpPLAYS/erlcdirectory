-- Staff counts and server member lists should only include verified directory experiences.

CREATE OR REPLACE FUNCTION public.staff_counts_for_discord_guilds(p_guild_ids text[])
RETURNS TABLE (guild_id text, cnt integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH wanted AS (
    SELECT DISTINCT TRIM(t) AS gid
    FROM unnest(COALESCE(p_guild_ids, ARRAY[]::text[])) AS t
    WHERE t IS NOT NULL AND TRIM(t) <> ''
  )
  SELECT
    w.gid AS guild_id,
    COALESCE((
      SELECT COUNT(DISTINCT e.profile_id)::integer
      FROM public.experiences e
      WHERE TRIM(e.guild_id) = w.gid
        AND e.is_verified = true
    ), 0) AS cnt
  FROM wanted w;
$$;

CREATE OR REPLACE FUNCTION public.refresh_server_staff_for_guild(guild_id_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gid text := NULLIF(TRIM(COALESCE(guild_id_param, '')), '');
BEGIN
  IF gid IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.servers s
  SET staff_count = COALESCE(sub.cnt, 0)
  FROM (
    SELECT COUNT(DISTINCT e.profile_id)::integer AS cnt
    FROM public.experiences e
    WHERE NULLIF(TRIM(e.guild_id), '') IS NOT NULL
      AND TRIM(e.guild_id) = gid
      AND e.is_verified = true
  ) sub
  WHERE NULLIF(TRIM(s.guild_id), '') IS NOT NULL
    AND TRIM(s.guild_id) = gid;
END;
$$;

UPDATE public.servers s
SET staff_count = COALESCE((
  SELECT COUNT(DISTINCT e.profile_id)::integer
  FROM public.experiences e
  WHERE NULLIF(TRIM(e.guild_id), '') IS NOT NULL
    AND TRIM(e.guild_id) = TRIM(s.guild_id)
    AND e.is_verified = true
), 0)
WHERE NULLIF(TRIM(s.guild_id), '') IS NOT NULL;
