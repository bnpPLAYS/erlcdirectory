-- Prune ephemeral / dead rows to reduce database disk usage.
-- Safe: does not delete accepted connections, messages, posts, audit logs, or moderation history.
-- Re-run anytime via: SELECT public.maintenance_prune_expired_ephemeral();
-- Optional: schedule with pg_cron (if enabled on the project) — see bottom of this file.

CREATE OR REPLACE FUNCTION public.maintenance_prune_expired_ephemeral()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_oauth bigint := 0;
  n_evr bigint := 0;
  n_conn_terminal bigint := 0;
  n_conn_stale_pending bigint := 0;
BEGIN
  -- Roblox OAuth PKCE rows past expiry (abandoned flows accumulate here).
  DELETE FROM public.roblox_oauth_states
  WHERE expires_at < now();
  GET DIAGNOSTICS n_oauth = ROW_COUNT;

  -- Experience verification tokens are only meaningful until shortly after expiry;
  -- experiences keep verifier metadata on public.experiences.
  DELETE FROM public.experience_verification_requests
  WHERE expires_at < (now() - interval '30 days');
  GET DIAGNOSTICS n_evr = ROW_COUNT;

  -- Terminal connection requests (no longer needed for uniqueness or messaging).
  DELETE FROM public.connection_requests
  WHERE status IN ('declined', 'cancelled')
    AND COALESCE(responded_at, created_at) < (now() - interval '120 days');
  GET DIAGNOSTICS n_conn_terminal = ROW_COUNT;

  -- Abandoned pending requests (never accepted; safe to drop after long inactivity).
  DELETE FROM public.connection_requests
  WHERE status = 'pending'
    AND created_at < (now() - interval '365 days');
  GET DIAGNOSTICS n_conn_stale_pending = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_roblox_oauth_states', n_oauth,
    'deleted_experience_verification_requests', n_evr,
    'deleted_connection_requests_terminal', n_conn_terminal,
    'deleted_connection_requests_stale_pending', n_conn_stale_pending,
    'pruned_at', to_jsonb(now())
  );
END;
$$;

COMMENT ON FUNCTION public.maintenance_prune_expired_ephemeral() IS
  'Deletes expired OAuth PKCE state, old verification request rows, and stale connection_requests. '
  'Run manually or via pg_cron. Does not remove accepted connections or user-generated content.';

REVOKE ALL ON FUNCTION public.maintenance_prune_expired_ephemeral() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintenance_prune_expired_ephemeral() TO postgres;

-- One-time prune on migrate (returns row counts in migration logs).
SELECT public.maintenance_prune_expired_ephemeral();

-- Daily prune when pg_cron is available (no-op if extension missing).
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('maintenance_prune_expired_ephemeral');
    EXCEPTION
      WHEN others THEN NULL;
    END;
    PERFORM cron.schedule(
      'maintenance_prune_expired_ephemeral',
      '20 5 * * *',
      $cmd$SELECT public.maintenance_prune_expired_ephemeral()$cmd$
    );
  END IF;
END
$cron$;
