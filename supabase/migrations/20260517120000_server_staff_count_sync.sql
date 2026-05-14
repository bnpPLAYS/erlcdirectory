-- Keep servers.staff_count aligned with distinct profiles that have an experience row for that Discord guild.

CREATE OR REPLACE FUNCTION public.refresh_server_staff_for_guild(guild_id_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF guild_id_param IS NULL OR guild_id_param = '' THEN
    RETURN;
  END IF;

  UPDATE public.servers s
  SET staff_count = COALESCE(sub.cnt, 0)
  FROM (
    SELECT COUNT(DISTINCT e.profile_id)::integer AS cnt
    FROM public.experiences e
    WHERE e.guild_id IS NOT NULL
      AND e.guild_id <> ''
      AND e.guild_id = guild_id_param
  ) sub
  WHERE s.guild_id = guild_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.experiences_touch_server_staff_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_server_staff_for_guild(OLD.guild_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.guild_id IS DISTINCT FROM NEW.guild_id THEN
      PERFORM public.refresh_server_staff_for_guild(OLD.guild_id);
    END IF;
    PERFORM public.refresh_server_staff_for_guild(NEW.guild_id);
    RETURN NEW;
  END IF;

  PERFORM public.refresh_server_staff_for_guild(NEW.guild_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experiences_refresh_server_staff ON public.experiences;

CREATE TRIGGER experiences_refresh_server_staff
AFTER INSERT OR UPDATE OR DELETE ON public.experiences
FOR EACH ROW EXECUTE FUNCTION public.experiences_touch_server_staff_count();

UPDATE public.servers s
SET staff_count = COALESCE((
  SELECT COUNT(DISTINCT e.profile_id)::integer
  FROM public.experiences e
  WHERE e.guild_id IS NOT NULL
    AND e.guild_id <> ''
    AND e.guild_id = s.guild_id
), 0);

-- When a server row is created after experiences already exist (verification flow), sync counts immediately.
CREATE OR REPLACE FUNCTION public.server_row_refresh_staff_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.guild_id IS NOT NULL AND NEW.guild_id <> '' THEN
    PERFORM public.refresh_server_staff_for_guild(NEW.guild_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS servers_refresh_staff_on_insert ON public.servers;

CREATE TRIGGER servers_refresh_staff_on_insert
AFTER INSERT ON public.servers
FOR EACH ROW EXECUTE FUNCTION public.server_row_refresh_staff_count();
