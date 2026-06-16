-- Portal messages: real-time chat between freelancer and client per engagement
CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role   TEXT NOT NULL CHECK (sender_role IN ('freelancer', 'client')),
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX messages_engagement_id_idx ON messages (engagement_id, created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Freelancer: full access to messages on their own engagements
CREATE POLICY "Freelancer manages messages on their engagements"
  ON messages FOR ALL
  USING (
    auth.uid() = (
      SELECT b.user_id
      FROM businesses b
      JOIN engagements e ON e.business_id = b.id
      WHERE e.id = messages.engagement_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT b.user_id
      FROM businesses b
      JOIN engagements e ON e.business_id = b.id
      WHERE e.id = messages.engagement_id
    )
  );

-- Client: read and insert on engagements they have access to (via engagement_access allowlist)
-- Uses auth.uid() / auth.email() — never joins auth.users directly (permission denied for authenticated role)
CREATE POLICY "Client reads and sends messages on their portal"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM engagement_access ea
      WHERE ea.engagement_id = messages.engagement_id
        AND (ea.client_user_id = auth.uid() OR ea.client_email = auth.email())
    )
  );

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

-- Enable Realtime so the portal subscription (postgres_changes INSERT) fires
-- (skipped: table is already a member of supabase_realtime publication)
