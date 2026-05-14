-- Allow Discord-verified experience holders for a guild to set servers.discord_invite
-- when the stored value is missing or not a recognized invite format (RLS otherwise
-- limits server row updates to owner / site owner).

CREATE OR REPLACE FUNCTION public.discord_invite_looks_valid(p_invite text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_invite IS NULL THEN false
    WHEN length(trim(both from p_invite)) = 0 THEN false
    ELSE
      trim(both from p_invite) ~* '^https?://(discord\.gg/[-a-z0-9]+|discord\.com/invite/[-a-z0-9]+|discordapp\.com/invite/[-a-z0-9]+)/?(\?.*)?$'
      OR trim(both from p_invite) ~* '^[-a-z0-9]{2,50}$'
  END;
$$;

COMMENT ON FUNCTION public.discord_invite_looks_valid(text) IS
  'True if the string looks like a Discord invite URL or bare invite code.';

REVOKE ALL ON FUNCTION public.discord_invite_looks_valid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discord_invite_looks_valid(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verified_staff_set_server_discord_invite(
  p_server_id uuid,
  p_invite text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_server public.servers%ROWTYPE;
  v_trim text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_trim := nullif(trim(both from coalesce(p_invite, '')), '');
  IF v_trim IS NULL THEN
    RAISE EXCEPTION 'Invite is required';
  END IF;

  IF NOT public.discord_invite_looks_valid(v_trim) THEN
    RAISE EXCEPTION 'Invalid Discord invite (use discord.gg/…, discord.com/invite/…, or the invite code)';
  END IF;

  SELECT * INTO v_server FROM public.servers WHERE id = p_server_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Server not found';
  END IF;

  IF v_server.guild_id IS NULL OR length(trim(both from v_server.guild_id)) = 0 THEN
    RAISE EXCEPTION 'Server has no Discord guild linked';
  END IF;

  IF public.discord_invite_looks_valid(v_server.discord_invite) THEN
    RAISE EXCEPTION 'This server already has a valid invite on file';
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.experiences e
    WHERE e.profile_id = v_profile_id
      AND trim(both from e.guild_id) = trim(both from v_server.guild_id)
      AND e.is_verified = true
  ) THEN
    RAISE EXCEPTION 'Only verified staff for this server can add an invite';
  END IF;

  UPDATE public.servers
  SET discord_invite = v_trim
  WHERE id = p_server_id;
END;
$$;

COMMENT ON FUNCTION public.verified_staff_set_server_discord_invite(uuid, text) IS
  'Sets servers.discord_invite when missing/invalid; caller must have is_verified experience for the server guild.';

REVOKE ALL ON FUNCTION public.verified_staff_set_server_discord_invite(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verified_staff_set_server_discord_invite(uuid, text) TO authenticated;
