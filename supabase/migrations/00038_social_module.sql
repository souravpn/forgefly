-- Migration 00038: Social module Phase A — AI-drafted IG captions + competitor tracking
-- No Meta API dependency: drafts sit for manual posting, competitor data is scraped/AI-suggested.

CREATE TABLE IF NOT EXISTS social_posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform     text NOT NULL DEFAULT 'instagram',
  caption      text NOT NULL,
  status       text NOT NULL DEFAULT 'draft',   -- 'draft' | 'approved' | 'archived'
  source       text NOT NULL DEFAULT 'ai_generated', -- 'ai_generated' | 'manual'
  created_at   timestamptz DEFAULT now(),
  approved_at  timestamptz
);

CREATE INDEX IF NOT EXISTS social_posts_business_idx
  ON social_posts (business_id, created_at DESC);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_posts_select" ON social_posts
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "social_posts_insert" ON social_posts
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "social_posts_update" ON social_posts
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "social_posts_delete" ON social_posts
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

-- ─── Competitor tracking ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS competitor_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  handle       text NOT NULL,
  platform     text NOT NULL DEFAULT 'instagram',
  website_url  text,
  source       text NOT NULL DEFAULT 'manual',   -- 'ai_suggested' | 'manual'
  status       text NOT NULL DEFAULT 'suggested', -- 'suggested' | 'tracking' | 'dismissed'
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competitor_profiles_business_idx
  ON competitor_profiles (business_id, created_at DESC);

ALTER TABLE competitor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitor_profiles_select" ON competitor_profiles
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "competitor_profiles_insert" ON competitor_profiles
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "competitor_profiles_update" ON competitor_profiles
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "competitor_profiles_delete" ON competitor_profiles
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS competitor_site_intel (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id    uuid NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  pricing_notes    text,
  turnaround_notes text,
  review_summary   text,
  raw_extract      jsonb,
  scraped_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competitor_site_intel_competitor_idx
  ON competitor_site_intel (competitor_id);

ALTER TABLE competitor_site_intel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitor_site_intel_select" ON competitor_site_intel
  FOR SELECT USING (
    competitor_id IN (
      SELECT id FROM competitor_profiles
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "competitor_site_intel_insert" ON competitor_site_intel
  FOR INSERT WITH CHECK (
    competitor_id IN (
      SELECT id FROM competitor_profiles
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "competitor_site_intel_delete" ON competitor_site_intel
  FOR DELETE USING (
    competitor_id IN (
      SELECT id FROM competitor_profiles
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );
