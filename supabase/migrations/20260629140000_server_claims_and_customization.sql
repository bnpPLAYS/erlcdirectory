-- Server claim flow + per-server owner customization columns.
-- Idempotent: safe to re-run.

------------------------------------------------------------
-- 1) servers: customization columns
------------------------------------------------------------
ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS long_description text,
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS review_webhook_url text,
  ADD COLUMN IF NOT EXISTS claim_open boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.servers.theme IS
  'Owner-customized theme: { accent_hex, secondary_hex, banner_overlay, font, pro_palette }';
COMMENT ON COLUMN public.servers.gallery IS
  'Array of { url, caption } images shown on the public server page (drag-and-drop uploads, base64 data URLs).';
COMMENT ON COLUMN public.servers.layout IS
  'Section visibility/order: { show_members, show_reviews, show_gallery, sections_order }';
COMMENT ON COLUMN public.servers.review_webhook_url IS
  'Discord webhook URL — server posts a clean embed to this channel whenever a new review is left.';
COMMENT ON COLUMN public.servers.long_description IS
  'Long-form HTML/markdown blurb shown above member list once owner customizes.';

------------------------------------------------------------
-- 2) server_claim_requests
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.server_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers (id) ON DELETE CASCADE,
  claimant_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  claimant_discord_id text,
  claimant_discord_username text,
  claimant_discord_link text,
  message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  staff_notes text,
  decided_at timestamptz,
  decided_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS server_claim_requests_unique_pending
  ON public.server_claim_requests (server_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS server_claim_requests_status_idx
  ON public.server_claim_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS server_claim_requests_server_idx
  ON public.server_claim_requests (server_id);
CREATE INDEX IF NOT EXISTS server_claim_requests_profile_idx
  ON public.server_claim_requests (claimant_profile_id);

COMMENT ON TABLE public.server_claim_requests IS
  'Requests by verified staff members of unclaimed servers asking the directory team to mark them as owner.';

ALTER TABLE public.server_claim_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own claim requests viewable" ON public.server_claim_requests;
CREATE POLICY "Own claim requests viewable"
  ON public.server_claim_requests FOR SELECT
  USING (
    claimant_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can view claim requests" ON public.server_claim_requests;
CREATE POLICY "Staff can view claim requests"
  ON public.server_claim_requests FOR SELECT
  USING (public.is_staff());

DROP POLICY IF EXISTS "Owner can cancel own pending claim" ON public.server_claim_requests;
CREATE POLICY "Owner can cancel own pending claim"
  ON public.server_claim_requests FOR UPDATE
  USING (
    status = 'pending'
    AND claimant_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    status IN ('pending', 'cancelled')
    AND claimant_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

------------------------------------------------------------
-- 3) Trigger: lock customization to owner once claimed
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.servers_enforce_owner_only_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id uuid;
BEGIN
  IF COALESCE(auth.role()::text, '') = 'service_role' OR public.is_site_owner() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Owner-only fields only meaningful after claim. Block setting them at create time.
    NEW.long_description := NULL;
    NEW.theme := '{}'::jsonb;
    NEW.gallery := '[]'::jsonb;
    NEW.layout := '{}'::jsonb;
    NEW.review_webhook_url := NULL;
    NEW.claimed_at := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE
  SELECT id INTO caller_profile_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF NEW.owner_id IS NULL OR caller_profile_id IS NULL OR caller_profile_id <> NEW.owner_id THEN
    -- Caller is not the owner of the row — keep owner-only fields frozen.
    NEW.long_description := OLD.long_description;
    NEW.theme := OLD.theme;
    NEW.gallery := OLD.gallery;
    NEW.layout := OLD.layout;
    NEW.review_webhook_url := OLD.review_webhook_url;
    NEW.claimed_at := OLD.claimed_at;
    -- Discord invite locks to owner once claimed (verified-staff helper RPC bypasses via SECURITY DEFINER).
    IF OLD.owner_id IS NOT NULL THEN
      NEW.discord_invite := OLD.discord_invite;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS servers_enforce_owner_only_fields ON public.servers;
CREATE TRIGGER servers_enforce_owner_only_fields
  BEFORE INSERT OR UPDATE ON public.servers
  FOR EACH ROW
  EXECUTE FUNCTION public.servers_enforce_owner_only_fields();

COMMENT ON FUNCTION public.servers_enforce_owner_only_fields() IS
  'Locks long_description / theme / gallery / layout / review_webhook_url / claimed_at to the row owner. Service role and site_owner bypass.';

------------------------------------------------------------
-- 4) Allow server owner to update their experiences row
--    (so owners can remove a verified staff member from their server).
------------------------------------------------------------
DROP POLICY IF EXISTS "Server owner can remove guild experiences" ON public.experiences;
CREATE POLICY "Server owner can remove guild experiences"
  ON public.experiences FOR DELETE
  USING (
    guild_id IS NOT NULL
    AND guild_id IN (
      SELECT s.guild_id
      FROM public.servers s
      WHERE s.owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

COMMENT ON POLICY "Server owner can remove guild experiences" ON public.experiences IS
  'Server owners can prune verified staff entries on their own server (guild_id match).';

------------------------------------------------------------
-- 5) Helper: claim request payload for staff list
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_pending_server_claims()
RETURNS TABLE (
  request_id uuid,
  created_at timestamptz,
  server_id uuid,
  server_name text,
  server_guild_id text,
  server_icon text,
  claimant_profile_id uuid,
  claimant_display_name text,
  claimant_discord_username text,
  claimant_discord_id text,
  claimant_discord_link text,
  message text,
  status text,
  staff_notes text,
  decided_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS request_id,
    r.created_at,
    r.server_id,
    s.name AS server_name,
    s.guild_id AS server_guild_id,
    s.icon AS server_icon,
    r.claimant_profile_id,
    p.display_name AS claimant_display_name,
    p.discord_username AS claimant_discord_username,
    r.claimant_discord_id,
    r.claimant_discord_link,
    r.message,
    r.status,
    r.staff_notes,
    r.decided_at
  FROM public.server_claim_requests r
  LEFT JOIN public.servers s ON s.id = r.server_id
  LEFT JOIN public.profiles p ON p.id = r.claimant_profile_id
  WHERE public.is_staff()
  ORDER BY (r.status = 'pending') DESC, r.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.staff_pending_server_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_pending_server_claims() TO authenticated;

COMMENT ON FUNCTION public.staff_pending_server_claims() IS
  'Lists server claim requests for staff (pending first, newest first). Returns empty for non-staff.';
