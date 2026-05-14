-- Create client_portal_tokens table for magic link access
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ
);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON client_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_client_id ON client_portal_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_expires_at ON client_portal_tokens(expires_at);

-- RLS policies for portal tokens
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;

-- Users can create tokens for their own clients
CREATE POLICY "Users can create portal tokens for their clients"
  ON client_portal_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_portal_tokens.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- Users can view tokens for their own clients
CREATE POLICY "Users can view portal tokens for their clients"
  ON client_portal_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_portal_tokens.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- Public can validate tokens (for portal access)
CREATE POLICY "Anyone can validate tokens"
  ON client_portal_tokens
  FOR SELECT
  TO anon
  USING (expires_at > NOW());

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_portal_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM client_portal_tokens
  WHERE expires_at < NOW();
END;
$$;