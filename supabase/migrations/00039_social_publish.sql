-- Migration 00039: Real Instagram publish + WhatsApp outbound send (Social Phase B)
-- social_connections is service-role-only: no client-side RLS SELECT policy, so tokens
-- never round-trip through the browser. Edge functions read it via the service-role client.

CREATE TABLE IF NOT EXISTS social_connections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform     text NOT NULL,          -- 'instagram' | 'whatsapp'
  access_token text NOT NULL,
  external_id  text NOT NULL,          -- Instagram User ID or WhatsApp Phone Number ID
  extra        jsonb,                  -- platform-specific extras (e.g. WhatsApp Business Account ID)
  status       text NOT NULL DEFAULT 'connected', -- 'connected' | 'disconnected'
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (business_id, platform)
);

ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
-- Intentionally no SELECT/INSERT/UPDATE/DELETE policy for `authenticated` — this table
-- is only accessible via the service-role client inside edge functions.

-- ─── social_posts additions for real publishing ──────────────────────────────

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS platform_post_id text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
