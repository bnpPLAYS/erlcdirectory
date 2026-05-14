-- Pronouns: only he/him or she/her (or NULL). Normalize casing and clear anything else.

UPDATE public.profiles
SET pronouns = CASE lower(trim(pronouns))
  WHEN 'he/him' THEN 'he/him'
  WHEN 'she/her' THEN 'she/her'
  ELSE NULL
END
WHERE pronouns IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pronouns_allowed_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pronouns_allowed_chk
  CHECK (pronouns IS NULL OR pronouns IN ('he/him', 'she/her'));

COMMENT ON COLUMN public.profiles.pronouns IS 'Optional: he/him or she/her only (enforced by CHECK).';
