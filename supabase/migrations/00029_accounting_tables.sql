-- Migration 00029: transactions, mileage_logs, time_entries, contractor_payments
--                  + invoice → transaction auto-link trigger (#41)

-- ─── transactions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type                  text NOT NULL CHECK (type IN ('income', 'expense')),
  amount                numeric(10,2) NOT NULL,
  currency              text DEFAULT 'USD',

  -- income fields
  invoice_id            uuid REFERENCES invoices(id) ON DELETE SET NULL,
  client_id             uuid REFERENCES contacts(id) ON DELETE SET NULL,
  income_category       text CHECK (income_category IN ('services','products','licensing','royalties')),

  -- expense fields
  expense_category_id   uuid REFERENCES expense_categories(id) ON DELETE SET NULL,
  vendor                text,
  receipt_url           text,
  receipt_extracted     boolean DEFAULT false,
  is_recurring          boolean DEFAULT false,
  recurrence_rule       text CHECK (recurrence_rule IN ('monthly','annual')),

  -- shared
  description           text,
  transaction_date      date NOT NULL,
  tax_year              int GENERATED ALWAYS AS (EXTRACT(year FROM transaction_date)::int) STORED,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX ON transactions (business_id, type, tax_year);
CREATE INDEX ON transactions (business_id, transaction_date DESC);
CREATE INDEX ON transactions (invoice_id) WHERE invoice_id IS NOT NULL;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "transactions_update" ON transactions
  FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "transactions_delete" ON transactions
  FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- ─── mileage_logs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mileage_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  trip_date         date NOT NULL,
  miles             numeric(6,1) NOT NULL,
  purpose           text NOT NULL,
  client_id         uuid REFERENCES contacts(id) ON DELETE SET NULL,
  project_id        uuid REFERENCES projects(id) ON DELETE SET NULL,
  irs_rate          numeric(4,3) NOT NULL DEFAULT 0.670,
  deductible_amount numeric(8,2) GENERATED ALWAYS AS (miles * irs_rate) STORED,
  tax_year          int GENERATED ALWAYS AS (EXTRACT(year FROM trip_date)::int) STORED,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX ON mileage_logs (business_id, tax_year);
CREATE INDEX ON mileage_logs (business_id, trip_date DESC);

ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mileage_logs_select" ON mileage_logs
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "mileage_logs_insert" ON mileage_logs
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "mileage_logs_update" ON mileage_logs
  FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "mileage_logs_delete" ON mileage_logs
  FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- ─── time_entries ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id        uuid REFERENCES contacts(id) ON DELETE SET NULL,
  entry_date       date NOT NULL,
  hours            numeric(4,2) NOT NULL,
  note             text,
  timer_started_at timestamptz,
  tax_year         int GENERATED ALWAYS AS (EXTRACT(year FROM entry_date)::int) STORED,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX ON time_entries (business_id, project_id);
CREATE INDEX ON time_entries (business_id, tax_year);
CREATE INDEX ON time_entries (business_id, entry_date DESC);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON time_entries
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "time_entries_insert" ON time_entries
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "time_entries_update" ON time_entries
  FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "time_entries_delete" ON time_entries
  FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- ─── contractor_payments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contractor_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contractor_name   text NOT NULL,
  contractor_email  text,
  w9_on_file        boolean DEFAULT false,
  payment_date      date NOT NULL,
  amount            numeric(10,2) NOT NULL,
  description       text,
  tax_year          int GENERATED ALWAYS AS (EXTRACT(year FROM payment_date)::int) STORED,
  ytd_total         numeric(10,2),
  threshold_flag    boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX ON contractor_payments (business_id, tax_year);
CREATE INDEX ON contractor_payments (business_id, contractor_name, tax_year);

ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractor_payments_select" ON contractor_payments
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "contractor_payments_insert" ON contractor_payments
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "contractor_payments_update" ON contractor_payments
  FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "contractor_payments_delete" ON contractor_payments
  FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- ─── Trigger: recalculate contractor ytd_total + threshold_flag ──────────────

CREATE OR REPLACE FUNCTION recalc_contractor_ytd()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ytd numeric(10,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_ytd
  FROM contractor_payments
  WHERE business_id       = NEW.business_id
    AND tax_year          = NEW.tax_year
    AND contractor_name   = NEW.contractor_name;

  UPDATE contractor_payments
  SET ytd_total      = v_ytd,
      threshold_flag = (v_ytd >= 600)
  WHERE business_id     = NEW.business_id
    AND tax_year        = NEW.tax_year
    AND contractor_name = NEW.contractor_name;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_contractor_ytd ON contractor_payments;
CREATE TRIGGER trg_recalc_contractor_ytd
  AFTER INSERT OR UPDATE OF amount ON contractor_payments
  FOR EACH ROW EXECUTE FUNCTION recalc_contractor_ytd();

-- ─── Trigger: invoice paid → auto-create income transaction ──────────────────

CREATE OR REPLACE FUNCTION create_income_transaction_on_invoice_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_business_id uuid;
  v_contact_id  uuid;
  v_paid_date   date;
  v_client_name text;
BEGIN
  -- Only fire when payment_status transitions to 'paid'
  IF NEW.payment_status != 'paid' OR OLD.payment_status = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Skip if transaction already exists for this invoice (idempotent)
  IF EXISTS (SELECT 1 FROM transactions WHERE invoice_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Resolve business_id
  v_business_id := NEW.business_id;
  IF v_business_id IS NULL THEN
    SELECT b.id INTO v_business_id
    FROM businesses b
    WHERE b.user_id = NEW.user_id AND b.status = 'active'
    LIMIT 1;
  END IF;
  IF v_business_id IS NULL THEN RETURN NEW; END IF;

  -- Resolve contact_id + client name
  v_contact_id := NEW.contact_id;
  IF v_contact_id IS NOT NULL THEN
    SELECT name INTO v_client_name FROM contacts WHERE id = v_contact_id LIMIT 1;
  END IF;

  -- Use paid_at date if available, else today
  v_paid_date := COALESCE(NEW.paid_at::date, CURRENT_DATE);

  INSERT INTO transactions (
    business_id,
    type,
    amount,
    currency,
    invoice_id,
    client_id,
    income_category,
    transaction_date,
    description
  ) VALUES (
    v_business_id,
    'income',
    NEW.amount,
    'USD',
    NEW.id,
    v_contact_id,
    'services',
    v_paid_date,
    'Invoice #' || COALESCE(NEW.invoice_number, NEW.id::text)
      || CASE WHEN v_client_name IS NOT NULL THEN ' — ' || v_client_name ELSE '' END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_income_transaction ON invoices;
CREATE TRIGGER trg_create_income_transaction
  AFTER UPDATE OF payment_status ON invoices
  FOR EACH ROW EXECUTE FUNCTION create_income_transaction_on_invoice_paid();
