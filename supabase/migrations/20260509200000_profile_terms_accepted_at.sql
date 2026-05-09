-- Track acceptance of Terms / Privacy (shown on first login for new accounts).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Grandfather existing profiles so only accounts created after this migration must accept in-app.
UPDATE public.profiles
SET terms_accepted_at = COALESCE(terms_accepted_at, now())
WHERE terms_accepted_at IS NULL;
