-- Verifier (Discord admin) declares their role and may leave a short review when approving.
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS verifier_stated_position TEXT,
  ADD COLUMN IF NOT EXISTS verifier_review_text TEXT,
  ADD COLUMN IF NOT EXISTS verifier_review_rating INTEGER
    CHECK (verifier_review_rating IS NULL OR (verifier_review_rating >= 1 AND verifier_review_rating <= 5));

ALTER TABLE public.experience_verification_requests
  ADD COLUMN IF NOT EXISTS approver_stated_position TEXT,
  ADD COLUMN IF NOT EXISTS approver_review_text TEXT,
  ADD COLUMN IF NOT EXISTS approver_review_rating INTEGER
    CHECK (approver_review_rating IS NULL OR (approver_review_rating >= 1 AND approver_review_rating <= 5));

COMMENT ON COLUMN public.experiences.verifier_stated_position IS 'Position the approving Discord admin stated they hold in the server';
COMMENT ON COLUMN public.experiences.verifier_review_text IS 'Optional note from verifier about the member';
COMMENT ON COLUMN public.experiences.verifier_review_rating IS 'Optional 1-5 rating from verifier (also synced to reviews if verifier has a profile)';
