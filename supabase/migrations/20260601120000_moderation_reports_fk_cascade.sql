-- Deleting a review/message/server must not SET NULL on moderation_reports targets:
-- moderation_reports_target_chk requires (e.g.) kind='review' => review_id IS NOT NULL.
-- CASCADE removes report rows when the reported content is deleted.

ALTER TABLE public.moderation_reports
  DROP CONSTRAINT IF EXISTS moderation_reports_review_id_fkey;

ALTER TABLE public.moderation_reports
  ADD CONSTRAINT moderation_reports_review_id_fkey
  FOREIGN KEY (review_id)
  REFERENCES public.reviews (id)
  ON DELETE CASCADE;

ALTER TABLE public.moderation_reports
  DROP CONSTRAINT IF EXISTS moderation_reports_message_id_fkey;

ALTER TABLE public.moderation_reports
  ADD CONSTRAINT moderation_reports_message_id_fkey
  FOREIGN KEY (message_id)
  REFERENCES public.messages (id)
  ON DELETE CASCADE;

ALTER TABLE public.moderation_reports
  DROP CONSTRAINT IF EXISTS moderation_reports_server_id_fkey;

ALTER TABLE public.moderation_reports
  ADD CONSTRAINT moderation_reports_server_id_fkey
  FOREIGN KEY (server_id)
  REFERENCES public.servers (id)
  ON DELETE CASCADE;
