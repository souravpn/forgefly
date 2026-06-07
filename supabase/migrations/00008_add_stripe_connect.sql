-- Add Stripe Connect fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_account_status text NOT NULL DEFAULT 'not_connected';
