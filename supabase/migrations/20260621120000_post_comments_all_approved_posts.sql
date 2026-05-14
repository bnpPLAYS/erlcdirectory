-- Allow comments on any approved post type (not only discussion), so hiring / looking / announcements
-- can have public Q&A threads while pending posts stay comment-free.

DROP POLICY IF EXISTS "post_comments_insert_discussion_only" ON public.post_comments;

CREATE POLICY "post_comments_insert_approved_posts" ON public.post_comments FOR INSERT
  WITH CHECK (
    author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND p.status = 'approved'
    )
  );

COMMENT ON POLICY "post_comments_insert_approved_posts" ON public.post_comments IS
  'Signed-in members may comment on approved posts only (any post type).';

-- Staff moderation: remove abusive comments without needing the author account.
DROP POLICY IF EXISTS "post_comments_delete_staff" ON public.post_comments;
CREATE POLICY "post_comments_delete_staff" ON public.post_comments FOR DELETE
  USING (public.is_staff());