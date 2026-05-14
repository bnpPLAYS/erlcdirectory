-- Immutable audit trail for staff / moderation actions. Readable only by the site owner (RLS).
-- Rows are inserted by Edge Functions using the service role (bypasses RLS).

CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action text NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 10),
  target_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  target_server_id uuid REFERENCES public.servers (id) ON DELETE SET NULL,
  report_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_created ON public.staff_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_actor_time
  ON public.staff_audit_logs (actor_user_id, action, created_at DESC);

COMMENT ON TABLE public.staff_audit_logs IS
  'Staff and moderation actions with human-readable reasons. SELECT restricted to site owner; inserts via service role only.';

ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Site owner can read staff audit logs" ON public.staff_audit_logs;
CREATE POLICY "Site owner can read staff audit logs" ON public.staff_audit_logs
  FOR SELECT
  USING (public.is_site_owner());

-- No INSERT/UPDATE/DELETE for authenticated clients — Edge Functions use service_role.
