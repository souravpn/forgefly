-- Add Stripe customer ID to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add payment fields to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'failed'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

-- Create packages table
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  one_time_price numeric,
  monthly_price numeric,
  features text,
  is_active boolean NOT NULL DEFAULT true,
  stripe_one_time_price_id text,
  stripe_monthly_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_price CHECK (one_time_price IS NOT NULL OR monthly_price IS NOT NULL)
);

-- Create payments table for transaction history
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  package_id uuid REFERENCES packages(id) ON DELETE SET NULL,
  stripe_payment_intent_id text NOT NULL UNIQUE,
  stripe_charge_id text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL CHECK (status IN ('succeeded', 'failed', 'refunded')),
  payment_method_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_packages_user_id ON packages(user_id);
CREATE INDEX IF NOT EXISTS idx_packages_is_active ON packages(is_active);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id ON clients(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);

-- Enable Row Level Security
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for packages
CREATE POLICY "Users can view their own packages" ON packages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own packages" ON packages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own packages" ON packages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own packages" ON packages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create RLS policies for payments
CREATE POLICY "Users can view their own payments" ON payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments" ON payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE packages;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;