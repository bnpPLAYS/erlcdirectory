-- Directory staff: profile warnings, user reports, review deletion by staff
-- Defines is_staff() first so pasting this whole file in SQL Editor works.
-- Requires public.is_site_owner() from earlier migrations.

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_site_owner()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'::public.app_role
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ---------------------------------------------------------------------------
-- Warnings (visible to the warned user and all staff)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  issued_by_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_warnings_subject ON public.profile_warnings (subject_profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_warnings_created ON public.profile_warnings (created_at DESC);

ALTER TABLE public.profile_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_warnings_select" ON public.profile_warnings;
CREATE POLICY "profile_warnings_select" ON public.profile_warnings FOR SELECT
  USING (
    public.is_staff()
    OR subject_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "profile_warnings_insert" ON public.profile_warnings;
CREATE POLICY "profile_warnings_insert" ON public.profile_warnings FOR INSERT
  WITH CHECK (
    public.is_staff()
    AND issued_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Reports (users report reviews or DMs; staff triage in admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('review', 'message')),
  review_id uuid REFERENCES public.reviews (id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages (id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations (id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 1 AND char_length(reason) <= 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  staff_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderation_reports_target_chk CHECK (
    (kind = 'review' AND review_id IS NOT NULL)
    OR (kind = 'message' AND message_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON public.moderation_reports (status);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_created ON public.moderation_reports (created_at DESC);

ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderation_reports_insert" ON public.moderation_reports;
CREATE POLICY "moderation_reports_insert" ON public.moderation_reports FOR INSERT
  WITH CHECK (
    reporter_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "moderation_reports_select" ON public.moderation_reports;
CREATE POLICY "moderation_reports_select" ON public.moderation_reports FOR SELECT
  USING (
    public.is_staff()
    OR reporter_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "moderation_reports_update" ON public.moderation_reports;
CREATE POLICY "moderation_reports_update" ON public.moderation_reports FOR UPDATE
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ---------------------------------------------------------------------------
-- Staff can remove any review (trigger still recomputes profile rating)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can delete any review" ON public.reviews;
CREATE POLICY "Staff can delete any review" ON public.reviews FOR DELETE
  USING (public.is_staff());
