-- Migration 00019: Messages hub — #32
-- Adds business_id, client_id, read_at to messages table
-- Adds RLS policies for freelancer (by business) and client (by client_id)

-- ─── 1. New columns ───────────────────────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id   uuid REFERENCES contacts(id)   ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS read_at     timestamptz;

CREATE INDEX IF NOT EXISTS messages_client_id_idx
  ON messages (client_id, created_at DESC)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_business_id_idx
  ON messages (business_id, created_at DESC)
  WHERE business_id IS NOT NULL;

-- ─── 2. Freelancer RLS — read + insert by business ────────────────────────────

DROP POLICY IF EXISTS "Freelancer can read business messages" ON messages;
CREATE POLICY "Freelancer can read business messages"
  ON messages FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Freelancer can insert business messages" ON messages;
CREATE POLICY "Freelancer can insert business messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_role = 'freelancer'
    AND business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- ─── 3. Freelancer RLS — mark messages read (UPDATE read_at) ─────────────────

DROP POLICY IF EXISTS "Freelancer can update read_at on business messages" ON messages;
CREATE POLICY "Freelancer can update read_at on business messages"
  ON messages FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- ─── 4. Client RLS — read + insert via client_id path ────────────────────────
-- (The engagement_id-based client policies from 00017 remain for backward compat)

DROP POLICY IF EXISTS "Client can read messages by client_id" ON messages;
CREATE POLICY "Client can read messages by client_id"
  ON messages FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM contacts WHERE email = auth.email()
    )
  );

DROP POLICY IF EXISTS "Client can insert messages by client_id" ON messages;
CREATE POLICY "Client can insert messages by client_id"
  ON messages FOR INSERT
  WITH CHECK (
    sender_role = 'client'
    AND client_id IN (
      SELECT id FROM contacts WHERE email = auth.email()
    )
  );

-- ─── 5. Client RLS — mark messages read via client_id path ───────────────────

DROP POLICY IF EXISTS "Client can update read_at by client_id" ON messages;
CREATE POLICY "Client can update read_at by client_id"
  ON messages FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM contacts WHERE email = auth.email()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM contacts WHERE email = auth.email()
    )
  );
