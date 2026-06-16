-- 00016b_merged_proposals_data.sql
-- STEP 2 OF 2: Run this after 00016a has been committed.

-- 1. Add new columns to proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS initiated_by text DEFAULT 'freelancer'
    CHECK (initiated_by IN ('freelancer','client','pipeline')),
  ADD COLUMN IF NOT EXISTS pipeline_lead_id uuid,
  ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_generation_tone text,
  ADD COLUMN IF NOT EXISTS ai_model_used text,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS request_context jsonb;

-- 2. Populate business_id for existing proposals
UPDATE public.proposals p
SET business_id = b.id
FROM public.businesses b
WHERE b.user_id = p.user_id
  AND b.status = 'active'
  AND p.business_id IS NULL;

-- 3. Populate denormalized client name/email from clients table
UPDATE public.proposals p
SET
  client_name = COALESCE(p.client_name, c.name),
  client_email = COALESCE(p.client_email, c.email)
FROM public.clients c
WHERE c.id = p.client_id
  AND (p.client_name IS NULL OR p.client_email IS NULL);

-- 4. Set total_amount from pricing where not yet set
UPDATE public.proposals
SET total_amount = pricing
WHERE pricing IS NOT NULL AND total_amount IS NULL;

-- 5. For drafted/sent proposal_requests that already have a linked proposals row
--    (stored in proposal_requests.engagement_id), update that proposals row.
UPDATE public.proposals p
SET
  initiated_by = 'client',
  ai_generated = true,
  client_name  = COALESCE(p.client_name, pr.name),
  client_email = COALESCE(p.client_email, pr.email),
  request_context = jsonb_build_object(
    'original_request_id', pr.id::text,
    'company',         pr.company,
    'service_name',    pr.service_name,
    'problem',         pr.problem,
    'timeline',        pr.timeline,
    'budget_flexible', pr.budget_flexible,
    'notes',           pr.notes
  )
FROM public.proposal_requests pr
WHERE pr.engagement_id IS NOT NULL
  AND pr.engagement_id::uuid = p.id
  AND p.initiated_by = 'freelancer';

-- 6. Insert new proposals for unlinked requests (new / declined)
INSERT INTO public.proposals (
  user_id, business_id,
  client_name, client_email,
  title, description,
  initiated_by, status,
  request_context,
  created_at, updated_at
)
SELECT
  b.user_id,
  pr.business_id,
  pr.name,
  pr.email,
  COALESCE(pr.service_name, 'Request from ' || pr.name),
  pr.problem,
  'client',
  CASE pr.status
    WHEN 'declined' THEN 'declined'::public.proposal_status
    ELSE 'draft'::public.proposal_status
  END,
  jsonb_build_object(
    'original_request_id', pr.id::text,
    'company',         pr.company,
    'service_name',    pr.service_name,
    'problem',         pr.problem,
    'timeline',        pr.timeline,
    'budget_flexible', pr.budget_flexible,
    'notes',           pr.notes
  ),
  pr.created_at,
  pr.created_at
FROM public.proposal_requests pr
JOIN public.businesses b ON b.id = pr.business_id
WHERE pr.engagement_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.proposals p2
    WHERE p2.request_context->>'original_request_id' = pr.id::text
  );

-- 7. Indexes
CREATE INDEX IF NOT EXISTS proposals_business_id_idx        ON public.proposals (business_id);
CREATE INDEX IF NOT EXISTS proposals_business_initiated_idx ON public.proposals (business_id, initiated_by);
CREATE INDEX IF NOT EXISTS proposals_business_status_idx    ON public.proposals (business_id, status);
