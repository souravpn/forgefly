-- Migration 00023: Portal file sharing (#38)
-- Table: portal_files — files shared between freelancer and client via portal

CREATE TABLE IF NOT EXISTS portal_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES contacts(id)   ON DELETE CASCADE,
  uploaded_by  text        NOT NULL CHECK (uploaded_by IN ('freelancer','client')),
  file_name    text        NOT NULL,
  file_url     text        NOT NULL,
  storage_path text        NOT NULL,
  file_size    int,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_files_business_client_idx
  ON portal_files (business_id, client_id, created_at DESC);

ALTER TABLE portal_files ENABLE ROW LEVEL SECURITY;

-- Freelancer: full access to files for their own business
CREATE POLICY "Freelancer manages portal files"
  ON portal_files FOR ALL
  USING  (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Client: read-only access to files shared with them
CREATE POLICY "Client reads own portal files"
  ON portal_files FOR SELECT
  USING (client_id IN (SELECT id FROM contacts WHERE email = auth.email()));

-- ─── Storage bucket: portal-files ─────────────────────────────────────────────
-- Create via Supabase dashboard: Storage → New bucket → "portal-files" (public: true)
-- Then add these Storage policies in the Supabase dashboard:
--
-- Policy: Freelancer upload
--   Allowed operation: INSERT
--   Target roles: authenticated
--   WITH CHECK: (auth.uid()::text = (storage.foldername(name))[1])
--   Note: path format is {user_id}/{business_id}/{client_id}/filename
--         Use business_id in folder check via a function if needed.
--         For MVP, allow any authenticated user to upload (scoped by RLS on portal_files table).
--
-- Policy: Public read (since bucket is public, no extra policy needed for SELECT)
