-- Migration 00017: Per-client portal hub — #25 contacts lifecycle fields
-- Adds: lifecycle_status, portal_token, portal_last_seen, unread_count
-- Also fixes: Messages RLS policies (auth.users JOIN bug from v4.2 — was blocking clients)

-- ─── 1. contacts: lifecycle + portal token fields ─────────────────────────────

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lifecycle_status text        NOT NULL DEFAULT 'prospect'
    CONSTRAINT contacts_lifecycle_check
    CHECK (lifecycle_status IN ('prospect','engaged','archived')),
  ADD COLUMN IF NOT EXISTS portal_token     text        UNIQUE,
  ADD COLUMN IF NOT EXISTS portal_last_seen timestamptz,
  ADD COLUMN IF NOT EXISTS unread_count     int         NOT NULL DEFAULT 0;

-- Generate portal tokens for all existing contacts
UPDATE contacts
  SET portal_token = encode(gen_random_bytes(8), 'hex')
  WHERE portal_token IS NULL;

CREATE INDEX IF NOT EXISTS contacts_portal_token_idx
  ON contacts (portal_token)
  WHERE portal_token IS NOT NULL;

-- Public: look up a contact by its portal_token (same security model as engagements public read)
DROP POLICY IF EXISTS "Portal token holder can read contact" ON contacts;
CREATE POLICY "Portal token holder can read contact"
  ON contacts FOR SELECT
  USING (portal_token IS NOT NULL);

-- Authenticated: client reads their own contact record by email (needed for auth check in portal)
DROP POLICY IF EXISTS "Client can read own contact by email" ON contacts;
CREATE POLICY "Client can read own contact by email"
  ON contacts FOR SELECT
  USING (email = auth.email());

-- ─── 2. Messages RLS fix (v4.2 outstanding — auth.users JOIN blocked clients) ─

-- Re-create the two client policies without the auth.users JOIN.
-- Uses auth.uid() and auth.email() functions only (safe for the authenticated role).

DROP POLICY IF EXISTS "Client reads and sends messages on their portal" ON messages;
CREATE POLICY "Client reads and sends messages on their portal"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM engagement_access ea
      WHERE ea.engagement_id = messages.engagement_id
        AND (ea.client_user_id = auth.uid() OR ea.client_email = auth.email())
    )
  );

DROP POLICY IF EXISTS "Client inserts messages on their portal" ON messages;
CREATE POLICY "Client inserts messages on their portal"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM engagement_access ea
      WHERE ea.engagement_id = messages.engagement_id
        AND (ea.client_user_id = auth.uid() OR ea.client_email = auth.email())
    )
  );
