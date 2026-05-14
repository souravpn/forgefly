-- Add missing fields to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_checkout_session_id ON invoices(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_checkout_session_id ON payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Enable RLS if not already enabled
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view payments for their invoices" ON payments;
DROP POLICY IF EXISTS "Service role can manage payments" ON payments;

-- Helper function to check if user owns the invoice
CREATE OR REPLACE FUNCTION user_owns_invoice(invoice_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_uuid AND i.user_id = auth.uid()
  );
$$;

-- RLS Policies for payments
CREATE POLICY "Users can view payments for their invoices"
  ON payments FOR SELECT
  USING (user_id = auth.uid() OR user_owns_invoice(invoice_id));

CREATE POLICY "Service role can manage payments"
  ON payments FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');