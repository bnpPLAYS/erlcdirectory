-- Let members choose which experience rows appear under "Recent work" on directory cards.
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS show_on_directory_card boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.experiences.show_on_directory_card IS
  'When true, this experience may appear in the Member Directory card "Recent work" strip (up to two, ordered by start_date).';
