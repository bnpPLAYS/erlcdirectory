-- Once a server has an owner, only that owner (or site owner bypass elsewhere) should change invites via this RPC.

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

  IF v_server.owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'This server is claimed; only the owner can update the invite from the directory.';
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
