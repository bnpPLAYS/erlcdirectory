-- Post moderation + staff (admin role) helpers.
-- Idempotent: uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS where appropriate.

-- ---------------------------------------------------------------------------
-- is_staff(): site owner OR row in user_roles with admin (for moderation RLS)
-- ---------------------------------------------------------------------------
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
-- posts.status: pending | approved | rejected (existing rows → approved)
-- Must run BEFORE post_status_by_id() — function body references posts.status.
-- ---------------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.posts
SET status = 'approved'
WHERE status IS NULL OR TRIM(status) = '';

ALTER TABLE public.posts
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.posts
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);

-- Used by author UPDATE policy to compare new status with stored row without RLS recursion.
CREATE OR REPLACE FUNCTION public.post_status_by_id(_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.posts WHERE id = _id;
$$;

REVOKE ALL ON FUNCTION public.post_status_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_status_by_id(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: public board sees approved only; authors see own; staff sees all
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Posts are publicly viewable when approved" ON public.posts;

CREATE POLICY "Posts are publicly viewable when approved" ON public.posts FOR SELECT
  USING (
    status = 'approved'
    OR author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_staff()
  );

-- Replace loose author + insert policies (avoid permissive OR allowing self-approve).
DROP POLICY IF EXISTS "Authors can manage their posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Author cannot self-approve" ON public.posts;

CREATE POLICY "Authors can insert own posts" ON public.posts FOR INSERT
  WITH CHECK (author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Authors can delete own posts" ON public.posts FOR DELETE
  USING (author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Non-staff authors: edit content but cannot flip status to/from approved (staff moderates).
CREATE POLICY "Authors update own posts" ON public.posts FOR UPDATE
  USING (
    author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND NOT public.is_staff()
  )
  WITH CHECK (
    author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND (
      status IN ('pending', 'rejected')
      OR status IS NOT DISTINCT FROM public.post_status_by_id(posts.id)
    )
  );

DROP POLICY IF EXISTS "Staff can update posts" ON public.posts;
CREATE POLICY "Staff can update posts" ON public.posts FOR UPDATE
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff can delete posts" ON public.posts;
CREATE POLICY "Staff can delete posts" ON public.posts FOR DELETE USING (public.is_staff());

-- Site-owner policies from earlier migrations stay as extra permissive paths.

-- ---------------------------------------------------------------------------
-- RPC: moderation from staff panel (matches is_staff(), not site-owner-only name)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.site_owner_set_post_status(
  p_post_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid status: %', p_status USING ERRCODE = '22023';
  END IF;
  UPDATE public.posts SET status = p_status WHERE id = p_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.site_owner_set_post_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_owner_set_post_status(uuid, text) TO authenticated;
