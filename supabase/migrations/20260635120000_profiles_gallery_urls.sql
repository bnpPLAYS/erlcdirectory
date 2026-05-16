-- Profile photo gallery (same pattern as server owner_gallery_urls).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_gallery_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.profile_gallery_urls IS
  'JSON array of image URLs (Supabase Storage public URLs) shown on the member profile page.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-custom',
  'profile-custom',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "profile_custom_public_read" ON storage.objects;
CREATE POLICY "profile_custom_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-custom');
