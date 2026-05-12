-- Singleton config for canary.erlc.directory access (staff-controlled session + test code).
-- Updated only via Edge Function (service role); no client policies.

CREATE TABLE IF NOT EXISTS public.canary_test_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_active boolean NOT NULL DEFAULT false,
  code_salt text,
  code_hash text,
  session_nonce text NOT NULL DEFAULT '',
  started_at timestamptz,
  started_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.canary_test_config IS
  'Staff toggles canary access; testers enter a one-time-style code on canary.erlc.directory.';

INSERT INTO public.canary_test_config (id, is_active, session_nonce)
VALUES (1, false, '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.canary_test_config ENABLE ROW LEVEL SECURITY;

-- No GRANT to anon/authenticated: only service_role (Edge Functions) touches this table.
