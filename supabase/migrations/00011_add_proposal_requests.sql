-- Proposal requests submitted from the public portfolio page
CREATE TABLE proposal_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  company         TEXT,
  email           TEXT NOT NULL,
  service_name    TEXT,
  problem         TEXT,
  timeline        TEXT,
  budget_flexible BOOLEAN DEFAULT false,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'drafted', 'sent', 'declined')),
  engagement_id   UUID REFERENCES engagements(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX proposal_requests_business_id_idx ON proposal_requests (business_id);
ALTER TABLE proposal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own proposal requests"
  ON proposal_requests FOR ALL
  USING (auth.uid() = (SELECT user_id FROM businesses WHERE id = proposal_requests.business_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM businesses WHERE id = proposal_requests.business_id));

CREATE POLICY "Public can submit proposal requests"
  ON proposal_requests FOR INSERT
  WITH CHECK (true);

-- Nudges: in-app notifications for the freelancer
CREATE TABLE nudges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- overdue_invoice | stale_lead | unsent_proposal | new_request
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  action_url  TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX nudges_user_id_unread_idx ON nudges (user_id) WHERE read = false;
ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own nudges"
  ON nudges FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
