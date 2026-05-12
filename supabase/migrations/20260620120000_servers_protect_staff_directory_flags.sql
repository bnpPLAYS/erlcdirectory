-- Prevent non–site-owner writers from setting servers.is_verified / is_featured (directory staff badges).
-- RLS still allows server owners to UPDATE their rows for name, invite, etc.; this trigger strips privilege
-- escalations that were possible via the client while keeping site_owner + SECURITY DEFINER RPC updates.

CREATE OR REPLACE FUNCTION public.servers_enforce_staff_directory_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(auth.role()::text, '') = 'service_role' OR public.is_site_owner() THEN
      RETURN NEW;
    END IF;
    NEW.is_verified := false;
    NEW.is_featured := false;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(auth.role()::text, '') = 'service_role' OR public.is_site_owner() THEN
      RETURN NEW;
    END IF;
    NEW.is_verified := OLD.is_verified;
    NEW.is_featured := OLD.is_featured;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS servers_enforce_staff_directory_flags ON public.servers;
CREATE TRIGGER servers_enforce_staff_directory_flags
  BEFORE INSERT OR UPDATE ON public.servers
  FOR EACH ROW
  EXECUTE FUNCTION public.servers_enforce_staff_directory_flags();

COMMENT ON FUNCTION public.servers_enforce_staff_directory_flags() IS
  'Staff directory badges: authenticated server owners cannot set is_verified/is_featured; site_owner sessions and service_role (Edge Functions) bypass. Use site_owner_set_server_verified RPC from the app.';
