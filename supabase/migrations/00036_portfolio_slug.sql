-- Add portfolio slug column to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Backfill existing businesses with their owner's username (preserves current URLs)
UPDATE businesses b
SET slug = p.username
FROM profiles p
WHERE b.user_id = p.id
  AND b.slug IS NULL;

-- Index for fast public portfolio lookup
CREATE INDEX IF NOT EXISTS businesses_slug_idx ON businesses (slug) WHERE slug IS NOT NULL;
