-- Ephemeral PKCE state for Roblox OAuth profile linking (server-only via service role).

CREATE TABLE IF NOT EXISTS public.roblox_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roblox_oauth_states_expires_at ON public.roblox_oauth_states (expires_at);

ALTER TABLE public.roblox_oauth_states ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.roblox_oauth_states IS 'PKCE verifiers for Roblox OAuth; read/write only from Edge Functions (service role).';

COMMENT ON COLUMN public.profiles.roblox_verified_at IS 'Set when Roblox user id is verified (Pro inventory check or Roblox OAuth link).';
