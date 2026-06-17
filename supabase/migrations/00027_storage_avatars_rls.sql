-- Migration 00027: Storage bucket RLS for avatars
-- Makes the avatars bucket public (required for getPublicUrl to work)
-- and adds policies so only authenticated users can upload/delete.
--
-- File path convention: {user_id}_{timestamp}.{ext}  (flat, no subfolder)

-- ─── 1. Ensure bucket exists and is public ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,           -- public: getPublicUrl returns directly accessible URLs
  5242880,        -- 5 MB max per file
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit   = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

-- ─── 2. Storage RLS policies ──────────────────────────────────────────────────

-- Any authenticated user can upload an avatar
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Users can overwrite/update their own avatar (filename starts with their user id)
CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'avatars' AND starts_with(name, auth.uid()::text))
  WITH CHECK (bucket_id = 'avatars' AND starts_with(name, auth.uid()::text));

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND starts_with(name, auth.uid()::text));

-- Public SELECT is automatic for public buckets — no policy needed.
