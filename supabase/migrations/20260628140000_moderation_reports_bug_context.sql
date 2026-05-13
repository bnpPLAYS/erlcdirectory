-- Website bug reports (no linked review/message/server) + optional client context.

ALTER TABLE public.moderation_reports
  ADD COLUMN IF NOT EXISTS page_path text,
  ADD COLUMN IF NOT EXISTS user_agent text;

COMMENT ON COLUMN public.moderation_reports.page_path IS
  'URL path (+ query) where the reporter saw the issue; used for kind=bug.';
COMMENT ON COLUMN public.moderation_reports.user_agent IS
  'Browser user-agent when submitted; used for kind=bug.';

ALTER TABLE public.moderation_reports DROP CONSTRAINT IF EXISTS moderation_reports_kind_check;
ALTER TABLE public.moderation_reports DROP CONSTRAINT IF EXISTS moderation_reports_target_chk;
ALTER TABLE public.moderation_reports DROP CONSTRAINT IF EXISTS moderation_reports_category_check;

ALTER TABLE public.moderation_reports ADD CONSTRAINT moderation_reports_kind_check
  CHECK (kind IN ('review', 'message', 'server', 'bug'));

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
      'other',
      'bug'
    )
  );

ALTER TABLE public.moderation_reports ADD CONSTRAINT moderation_reports_target_chk CHECK (
  (kind = 'review' AND review_id IS NOT NULL AND message_id IS NULL AND server_id IS NULL)
  OR (kind = 'message' AND message_id IS NOT NULL AND review_id IS NULL AND server_id IS NULL)
  OR (kind = 'server' AND server_id IS NOT NULL AND review_id IS NULL AND message_id IS NULL)
  OR (kind = 'bug' AND review_id IS NULL AND message_id IS NULL AND server_id IS NULL)
);
