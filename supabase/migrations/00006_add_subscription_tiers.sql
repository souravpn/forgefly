-- Add subscription tier columns to auth.users metadata
-- We'll store subscription info in user metadata

-- Create subscriptions table to track subscription details
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'freelancer' CHECK (tier IN ('freelancer', 'agency')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled', 'trialing')),
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount integer,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Helper function to check if user is agency tier
CREATE OR REPLACE FUNCTION public.is_agency_user(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.subscriptions 
    WHERE user_id = check_user_id 
      AND tier = 'agency' 
      AND status = 'active'
  );
$$;

-- Helper function to get user subscription tier
CREATE OR REPLACE FUNCTION public.get_user_tier(check_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT tier FROM public.subscriptions WHERE user_id = check_user_id AND status = 'active'),
    'freelancer'
  );
$$;

-- Insert default freelancer subscription for existing users
INSERT INTO public.subscriptions (user_id, tier, status)
SELECT id, 'freelancer', 'active'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions)
ON CONFLICT (user_id) DO NOTHING;