-- Migration 00044: Promotions — Featured daily promo + per-platform publish targets
-- Extends social_posts with "Featured" concept and adds social_post_targets to track
-- per-platform publish status independently (only Instagram is functionally live today;
-- Facebook/Nextdoor/X/LinkedIn rows exist for UI consistency but stay 'pending'/'skipped').

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS is_featured   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_date date,
  ADD COLUMN IF NOT EXISTS headline      text,
  ADD COLUMN IF NOT EXISTS template_id   text;

CREATE UNIQUE INDEX IF NOT EXISTS social_posts_one_featured_per_day
  ON social_posts (business_id, featured_date)
  WHERE is_featured;

CREATE TABLE IF NOT EXISTS social_post_targets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform          text NOT NULL,                   -- 'instagram' | 'facebook' | 'nextdoor' | 'x' | 'linkedin'
  status            text NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'published' | 'skipped' | 'failed'
  platform_post_id  text,
  published_at      timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (post_id, platform)
);

CREATE INDEX IF NOT EXISTS social_post_targets_post_idx
  ON social_post_targets (post_id);

ALTER TABLE social_post_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_post_targets_select" ON social_post_targets
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM social_posts
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "social_post_targets_insert" ON social_post_targets
  FOR INSERT WITH CHECK (
    post_id IN (
      SELECT id FROM social_posts
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "social_post_targets_update" ON social_post_targets
  FOR UPDATE USING (
    post_id IN (
      SELECT id FROM social_posts
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "social_post_targets_delete" ON social_post_targets
  FOR DELETE USING (
    post_id IN (
      SELECT id FROM social_posts
      WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
    )
  );
