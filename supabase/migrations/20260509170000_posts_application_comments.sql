-- Hiring posts: external application + optional Discord guild gate
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS application_url TEXT,
  ADD COLUMN IF NOT EXISTS require_guild_membership BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.posts.application_url IS 'External application URL for hiring posts';
COMMENT ON COLUMN public.posts.require_guild_membership IS 'When true, apply flow checks applicant is in the linked server Discord guild';

-- Discussion threads
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_author ON public.post_comments(author_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_comments_select_all" ON public.post_comments FOR SELECT USING (true);

CREATE POLICY "post_comments_insert_discussion_only" ON public.post_comments FOR INSERT
  WITH CHECK (
    author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.type = 'discussion'
    )
  );

CREATE POLICY "post_comments_update_own" ON public.post_comments FOR UPDATE
  USING (author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "post_comments_delete_own" ON public.post_comments FOR DELETE
  USING (author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
