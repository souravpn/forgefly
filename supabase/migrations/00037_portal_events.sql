CREATE TABLE IF NOT EXISTS portal_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL DEFAULT 'view',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portal_events_biz_created_idx
  ON portal_events (business_id, created_at DESC);
