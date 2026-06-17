-- Migration 00024: Pipeline auto-progression (#35)
-- 1. Add 'portal_request' to pipeline_leads.source constraint
-- 2. DB trigger: invoice paid → pipeline Closed Won

-- ─── 1. Expand source constraint to include portal_request ────────────────────
ALTER TABLE pipeline_leads DROP CONSTRAINT IF EXISTS pipeline_leads_source_check;
ALTER TABLE pipeline_leads ADD CONSTRAINT pipeline_leads_source_check
  CHECK (source IN ('manual', 'outreach_kit', 'visibility_kit', 'portal_request'));

-- ─── 2. Trigger: advance pipeline to Closed Won when invoice is paid ──────────

CREATE OR REPLACE FUNCTION advance_pipeline_on_invoice_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_business_id uuid;
  v_contact_id  uuid;
BEGIN
  -- Only fire when payment_status transitions to 'paid'
  IF NEW.payment_status != 'paid' OR OLD.payment_status = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Resolve business_id: use column directly or look up via user_id
  v_business_id := NEW.business_id;
  IF v_business_id IS NULL THEN
    SELECT b.id INTO v_business_id
    FROM businesses b
    WHERE b.user_id = NEW.user_id
      AND b.status = 'active'
    LIMIT 1;
  END IF;
  IF v_business_id IS NULL THEN RETURN NEW; END IF;

  -- Resolve contact_id: use invoice.contact_id if set, else match via client email
  v_contact_id := NEW.contact_id;
  IF v_contact_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT ct.id INTO v_contact_id
    FROM contacts ct
    JOIN clients cl ON cl.email = ct.email
    WHERE cl.id = NEW.client_id
      AND ct.business_id = v_business_id
    LIMIT 1;
  END IF;
  IF v_contact_id IS NULL THEN RETURN NEW; END IF;

  -- Advance any active pipeline lead for this contact to Closed Won
  UPDATE pipeline_leads
  SET stage = 'Closed Won'
  WHERE business_id = v_business_id
    AND contact_id   = v_contact_id
    AND stage NOT IN ('Closed Won', 'Lost');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_pipeline_on_invoice_paid ON invoices;
CREATE TRIGGER trg_advance_pipeline_on_invoice_paid
  AFTER UPDATE OF payment_status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION advance_pipeline_on_invoice_paid();
