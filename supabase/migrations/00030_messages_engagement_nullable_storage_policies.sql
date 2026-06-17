-- Migration 00030: Three bug fixes
-- 1. Make messages.engagement_id nullable (freelancer dashboard messages have no engagement)
-- 2. Storage policies for portal-files bucket (previously manual-only)
-- 3. Fix client INSERT policy — case-insensitive email, NULL-email fallback, owner bypass

-- ─── 1. engagement_id nullable ───────────────────────────────────────────────

ALTER TABLE messages ALTER COLUMN engagement_id DROP NOT NULL;

-- ─── 3. Fix client INSERT RLS on messages ────────────────────────────────────
-- Old policy used case-sensitive email comparison and broke when:
--   a) contact.email is NULL
--   b) email casing differs between auth and contacts
--   c) freelancer is previewing their own portal

DROP POLICY IF EXISTS "Client can insert messages by client_id" ON messages;
CREATE POLICY "Client can insert messages by client_id"
  ON messages FOR INSERT
  WITH CHECK (
    sender_role = 'client'
    AND auth.uid() IS NOT NULL
    AND (
      -- Client path: email match (case-insensitive)
      EXISTS (
        SELECT 1 FROM contacts c
        WHERE c.id = client_id
          AND lower(c.email) = lower(auth.email())
      )
      OR
      -- Freelancer previewing their own portal
      business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

-- Also fix client SELECT policy to use case-insensitive match
DROP POLICY IF EXISTS "Client can read messages by client_id" ON messages;
CREATE POLICY "Client can read messages by client_id"
  ON messages FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM contacts WHERE lower(email) = lower(auth.email())
    )
  );

-- ─── 2. Storage policies: portal-files bucket ────────────────────────────────
-- Bucket must exist first (created manually or via dashboard).
-- These policies allow authenticated freelancers/clients to upload and manage files.

DROP POLICY IF EXISTS "Authenticated upload to portal-files"  ON storage.objects;
DROP POLICY IF EXISTS "Public read from portal-files"         ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete from portal-files" ON storage.objects;

-- Any authenticated user can upload (DB-level RLS on portal_files table enforces ownership)
CREATE POLICY "Authenticated upload to portal-files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portal-files'
    AND auth.role() = 'authenticated'
  );

-- Public read (bucket is public)
CREATE POLICY "Public read from portal-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portal-files');

-- Authenticated users can delete files in the bucket
CREATE POLICY "Authenticated delete from portal-files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'portal-files'
    AND auth.role() = 'authenticated'
  );
