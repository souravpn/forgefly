-- Migration 00043: optional public-profile social links shown on the business's
-- public portfolio, alongside contact email/phone. Only Instagram is editable in
-- the UI for now — the rest are placeholder columns for platforms not yet wired up.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_facebook text,
  ADD COLUMN IF NOT EXISTS social_linkedin text,
  ADD COLUMN IF NOT EXISTS social_x text,
  ADD COLUMN IF NOT EXISTS social_nextdoor text;
