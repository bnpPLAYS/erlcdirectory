-- Report categories, server reports, profile bans, staff message deletion

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;

ALTER TABLE public.moderation_reports ADD COLUMN IF NOT EXISTS report_category text;
ALTER TABLE public.moderation_reports ADD COLUMN IF NOT EXISTS server_id uuid REFERENCES public.servers (id) ON DELETE SET NULL;

ALTER TABLE public.moderation_reports DROP CONSTRAINT IF EXISTS moderation_reports_kind_check;
ALTER TABLE public.moderation_reports DROP CONSTRAINT IF EXISTS moderation_reports_target_chk;

ALTER TABLE public.moderation_reports ADD CONSTRAINT moderation_reports_kind_check
  CHECK (kind IN ('review', 'message', 'server'));

ALTER TABLE public.moderation_reports ADD CONSTRAINT moderation_reports_category_check
  CHECK (
    report_category IS NULL
    OR report_category IN (
      'harassment',
      'spam',
      'hate',
      'impersonation',
      'scam',
      'nsfw',
      'copyright',
      'other'
    )
  );

ALTER TABLE public.moderation_reports ADD CONSTRAINT moderation_reports_target_chk CHECK (
  (kind = 'review' AND review_id IS NOT NULL AND message_id IS NULL AND server_id IS NULL)
  OR (kind = 'message' AND message_id IS NOT NULL AND review_id IS NULL AND server_id IS NULL)
  OR (kind = 'server' AND server_id IS NOT NULL AND review_id IS NULL AND message_id IS NULL)
);

DROP POLICY IF EXISTS "Staff can delete messages" ON public.messages;
CREATE POLICY "Staff can delete messages" ON public.messages FOR DELETE
  USING (public.is_staff());
