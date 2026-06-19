-- Migration 00034: onboarding milestones schema
-- Run in Supabase SQL Editor

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS onboarding_seen       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_milestones jsonb DEFAULT '{
    "business_created": false,
    "services_reviewed": false,
    "portfolio_shared": false,
    "prospect_added": false,
    "proposal_sent": false
  }';

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  milestone     text NOT NULL,
  completed_at  timestamptz DEFAULT now(),
  skipped       boolean DEFAULT false
);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own onboarding_events"
  ON public.onboarding_events FOR ALL
  USING (business_id IN (
    SELECT id FROM public.businesses WHERE user_id = auth.uid()
  ));
