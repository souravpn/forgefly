-- Phase 3.5: outreach kit + visibility engine
-- Expands pipeline_leads stage constraint and adds outreach tracking columns

-- Drop existing stage check and replace with expanded set
ALTER TABLE pipeline_leads DROP CONSTRAINT IF EXISTS pipeline_leads_stage_check;
ALTER TABLE pipeline_leads ADD CONSTRAINT pipeline_leads_stage_check
  CHECK (stage IN (
    'Prospect', 'Qualified', 'Contacted',
    'Proposal Sent', 'Negotiating', 'Closed Won', 'Lost'
  ));

-- Outreach tracking columns (all nullable / defaulted so existing rows are unaffected)
ALTER TABLE pipeline_leads
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS company_url text,
  ADD COLUMN IF NOT EXISTS service_overlap_score float,
  ADD COLUMN IF NOT EXISTS matched_services text[],
  ADD COLUMN IF NOT EXISTS outreach_sequence_step int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outreach_sequence_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS last_reply_intent text,
  ADD COLUMN IF NOT EXISTS next_action_date date,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS company_intel jsonb;

-- Sequence status constraint (separate statement so IF NOT EXISTS on column works first)
DO $$ BEGIN
  ALTER TABLE pipeline_leads ADD CONSTRAINT pipeline_leads_seq_status_check
    CHECK (outreach_sequence_status IN (
      'not_started', 'in_progress', 'paused', 'complete', 'dead'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Source constraint
DO $$ BEGIN
  ALTER TABLE pipeline_leads ADD CONSTRAINT pipeline_leads_source_check
    CHECK (source IN ('manual', 'outreach_kit', 'visibility_kit'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for sequence queries (nudge engine, sequence tracker)
CREATE INDEX IF NOT EXISTS pipeline_leads_sequence_idx
  ON pipeline_leads (business_id, outreach_sequence_status, next_action_date);
