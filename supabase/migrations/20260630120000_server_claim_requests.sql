-- Server ownership claims: verified staff of an unclaimed server submit a request;
-- ERLC Directory staff approve/reject and set servers.owner_id on approval.

ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS claim_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

COMMENT ON COLUMN public.servers.claim_open IS
  'When false, verified staff cannot submit new ownership claim requests for this server.';
COMMENT ON COLUMN public.servers.claimed_at IS
  'Set when staff approves a server ownership claim (owner_id becomes the claimant profile).';

CREATE TABLE IF NOT EXISTS public.server_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers (id) ON DELETE CASCADE,
  claimant_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  discord_link text NOT NULL,
  message text,
  staff_notes text,
  decided_at timestamptz,
  decided_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS server_claim_one_pending_per_server
  ON public.server_claim_requests (server_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_server_claim_requests_claimant
  ON public.server_claim_requests (claimant_profile_id, created_at DESC);

COMMENT ON TABLE public.server_claim_requests IS
  'Pending ownership claims for unclaimed servers; decided by is_staff() via Edge Function.';

ALTER TABLE public.server_claim_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own server claim requests" ON public.server_claim_requests;
CREATE POLICY "Users read own server claim requests"
  ON public.server_claim_requests
  FOR SELECT
  TO authenticated
  USING (
    claimant_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff read all server claim requests" ON public.server_claim_requests;
CREATE POLICY "Staff read all server claim requests"
  ON public.server_claim_requests
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Inserts/updates only via service role (Edge Functions).

CREATE OR REPLACE FUNCTION public.staff_pending_server_claims()
RETURNS TABLE (
  id uuid,
  server_id uuid,
  server_name text,
  guild_id text,
  claimant_profile_id uuid,
  claimant_display_name text,
  claimant_discord_username text,
  discord_link text,
  message text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.server_id,
    s.name::text,
    coalesce(trim(both from s.guild_id), '')::text,
    r.claimant_profile_id,
    coalesce(nullif(trim(both from p.display_name), ''), nullif(trim(both from p.discord_username), ''), 'Member')::text,
    coalesce(nullif(trim(both from p.discord_username), ''), '')::text,
    r.discord_link,
    r.message,
    r.status,
    r.created_at
  FROM public.server_claim_requests r
  JOIN public.servers s ON s.id = r.server_id
  JOIN public.profiles p ON p.id = r.claimant_profile_id
  ORDER BY
    CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
    r.created_at DESC
  LIMIT 120;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_pending_server_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_pending_server_claims() TO authenticated;
