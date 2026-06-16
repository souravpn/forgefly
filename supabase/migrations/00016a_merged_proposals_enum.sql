-- 00016a_merged_proposals_enum.sql
-- STEP 1 OF 2: Run this first, then run 00016b_merged_proposals_data.sql
-- Must be a separate transaction because Postgres cannot use new enum values
-- in the same transaction they were added.

ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'viewed';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'declined';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'withdrawn';
