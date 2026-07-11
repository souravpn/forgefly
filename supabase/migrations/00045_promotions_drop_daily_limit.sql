-- Migration 00045: manual "Generate with AI" must work anytime, unlimited — the
-- one-per-day constraint was only ever meant to gate a future proactive daily
-- auto-generation (not yet built), not the manual trigger. The partial unique
-- index blocked a new Featured promo from being generated on the same day an
-- earlier one had already been published/drafted away, which is wrong.
DROP INDEX IF EXISTS social_posts_one_featured_per_day;
