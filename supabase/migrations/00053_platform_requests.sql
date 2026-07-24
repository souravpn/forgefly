CREATE TABLE IF NOT EXISTS platform_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  homepage_url text NOT NULL,
  status       text NOT NULL DEFAULT 'new', -- 'new' | 'reviewed'
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_requests_business_idx
  ON platform_requests (business_id, created_at DESC);

ALTER TABLE platform_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_requests_select" ON platform_requests
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "platform_requests_insert" ON platform_requests
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );
