-- Claimed server owner customization: long description, theme, gallery URLs, review webhook,
-- hidden verified staff on the public page, section toggles, optional Pro hero video URL.

ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS owner_long_description text,
  ADD COLUMN IF NOT EXISTS owner_accent_hex text,
  ADD COLUMN IF NOT EXISTS owner_theme_preset text NOT NULL DEFAULT 'zinc',
  ADD COLUMN IF NOT EXISTS owner_gallery_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_review_webhook_url text,
  ADD COLUMN IF NOT EXISTS owner_hidden_staff_profile_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_show_staff_section boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner_show_reviews_section boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner_hero_video_url text;

COMMENT ON COLUMN public.servers.owner_long_description IS
  'Optional long public description for claimed servers (shown instead of short description when set).';
COMMENT ON COLUMN public.servers.owner_accent_hex IS
  'Optional #RRGGBB accent for claimed server page chrome.';
COMMENT ON COLUMN public.servers.owner_theme_preset IS
  'UI preset key (zinc, slate, neutral; Pro may use extra presets in the app).';
COMMENT ON COLUMN public.servers.owner_gallery_urls IS
  'JSON array of image URLs (e.g. Supabase Storage public URLs) for claimed server gallery.';
COMMENT ON COLUMN public.servers.owner_review_webhook_url IS
  'Optional Discord webhook URL; new public reviews can notify this channel.';
COMMENT ON COLUMN public.servers.owner_hidden_staff_profile_ids IS
  'JSON array of profile UUID strings to omit from the server “Members who work here” list.';
COMMENT ON COLUMN public.servers.owner_show_staff_section IS
  'When false, hide the staff list block on the server page.';
COMMENT ON COLUMN public.servers.owner_show_reviews_section IS
  'When false, hide the reviews block on the server page.';
COMMENT ON COLUMN public.servers.owner_hero_video_url IS
  'Optional embeddable video URL (YouTube) for Pro owners; enforced in app.';

ALTER TABLE public.servers
  DROP CONSTRAINT IF EXISTS servers_owner_accent_hex_check;
ALTER TABLE public.servers
  ADD CONSTRAINT servers_owner_accent_hex_check
  CHECK (
    owner_accent_hex IS NULL
    OR owner_accent_hex ~ '^#[0-9A-Fa-f]{6}$'
  );

ALTER TABLE public.servers
  DROP CONSTRAINT IF EXISTS servers_owner_theme_preset_check;
ALTER TABLE public.servers
  ADD CONSTRAINT servers_owner_theme_preset_check
  CHECK (
    owner_theme_preset IN (
      'zinc',
      'slate',
      'neutral',
      'rose',
      'cyan',
      'amber',
      'violet'
    )
  );

-- Public bucket for owner gallery images (uploads go through Edge Function using service role).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'server-custom',
  'server-custom',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "server_custom_public_read" ON storage.objects;
CREATE POLICY "server_custom_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'server-custom');
