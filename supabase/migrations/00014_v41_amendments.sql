-- v4.1 amendments: add public identity columns to businesses
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Unique slug per business (allow null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'businesses' AND indexname = 'businesses_slug_key'
  ) THEN
    CREATE UNIQUE INDEX businesses_slug_key ON businesses (slug) WHERE slug IS NOT NULL;
  END IF;
END$$;
