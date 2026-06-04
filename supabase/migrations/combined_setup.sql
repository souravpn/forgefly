-- ============================================================
-- FORGEFLY — COMBINED SCHEMA SETUP
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- ── 00001: Initial schema ────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text,
  role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_description text,
  service_type text,
  hourly_rate numeric(10, 2),
  branding_colors jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active',
  total_value numeric(10, 2) DEFAULT 0,
  last_interaction timestamptz,
  notes text,
  avatar_url text,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM ('lead', 'in_progress', 'review', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status public.project_status NOT NULL DEFAULT 'lead'::public.project_status,
  value numeric(10, 2),
  deadline timestamptz,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  invoice_number text UNIQUE NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft'::public.invoice_status,
  amount numeric(10, 2) NOT NULL,
  description text,
  issue_date date DEFAULT CURRENT_DATE,
  due_date timestamptz,
  paid_at timestamptz,
  sent_at timestamptz,
  notes text,
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'failed')),
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE public.proposal_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  status public.proposal_status NOT NULL DEFAULT 'draft'::public.proposal_status,
  content jsonb,
  introduction text,
  services text,
  deliverables text,
  pricing numeric,
  timeline text,
  terms text,
  value numeric(10, 2),
  sent_date timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL,
  action_type text NOT NULL,
  config jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  event_type text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  meeting_link text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  stripe_payment_intent_id text NOT NULL UNIQUE,
  stripe_charge_id text,
  stripe_checkout_session_id text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL CHECK (status IN ('succeeded', 'failed', 'refunded')),
  payment_method_type text,
  customer_email text,
  customer_name text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.client_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON public.calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_client_id ON public.calendar_events(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON public.calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON public.calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_packages_user_id ON public.packages(user_id);
CREATE INDEX IF NOT EXISTS idx_packages_is_active ON public.packages(is_active);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id ON public.clients(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON public.invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_checkout_session_id ON public.invoices(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_checkout_session_id ON public.payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON public.client_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_client_id ON public.client_portal_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_expires_at ON public.client_portal_tokens(expires_at);

-- ── Trigger: auto-create profile on new user signup ─────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'), '@', 1)
    ),
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    'user'::public.user_role,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'freelancer', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── Helper functions ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_role(uid uuid, role_name text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role = role_name::public.user_role);
$$;

CREATE OR REPLACE FUNCTION public.is_agency_user(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = check_user_id AND tier = 'agency' AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.get_user_tier(check_user_id uuid DEFAULT auth.uid())
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT tier FROM public.subscriptions WHERE user_id = check_user_id AND status = 'active'), 'freelancer');
$$;

CREATE OR REPLACE FUNCTION public.user_owns_invoice(invoice_uuid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_uuid AND i.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_portal_tokens()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.client_portal_tokens WHERE expires_at < NOW();
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Admins have full access to profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- business_profiles
DROP POLICY IF EXISTS "Users can manage their own business profile" ON public.business_profiles;
CREATE POLICY "Users can manage their own business profile" ON public.business_profiles FOR ALL TO authenticated USING (auth.uid() = user_id);

-- clients
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
CREATE POLICY "Users can manage their own clients" ON public.clients FOR ALL TO authenticated USING (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
CREATE POLICY "Users can manage their own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id);

-- invoices
DROP POLICY IF EXISTS "Users can manage their own invoices" ON public.invoices;
CREATE POLICY "Users can manage their own invoices" ON public.invoices FOR ALL TO authenticated USING (auth.uid() = user_id);

-- proposals
DROP POLICY IF EXISTS "Users can manage their own proposals" ON public.proposals;
CREATE POLICY "Users can manage their own proposals" ON public.proposals FOR ALL TO authenticated USING (auth.uid() = user_id);

-- tasks
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
CREATE POLICY "Users can manage their own tasks" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id);

-- automations
DROP POLICY IF EXISTS "Users can manage their own automations" ON public.automations;
CREATE POLICY "Users can manage their own automations" ON public.automations FOR ALL TO authenticated USING (auth.uid() = user_id);

-- calendar_events
DROP POLICY IF EXISTS "Users can manage their own calendar events" ON public.calendar_events;
CREATE POLICY "Users can manage their own calendar events" ON public.calendar_events FOR ALL TO authenticated USING (auth.uid() = user_id);

-- packages
DROP POLICY IF EXISTS "Users can view their own packages" ON public.packages;
DROP POLICY IF EXISTS "Users can insert their own packages" ON public.packages;
DROP POLICY IF EXISTS "Users can update their own packages" ON public.packages;
DROP POLICY IF EXISTS "Users can delete their own packages" ON public.packages;
CREATE POLICY "Users can manage their own packages" ON public.packages FOR ALL TO authenticated USING (auth.uid() = user_id);

-- payments
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view payments for their invoices" ON public.payments;
DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;
CREATE POLICY "Users can view payments for their invoices" ON public.payments FOR SELECT USING (user_id = auth.uid() OR public.user_owns_invoice(invoice_id));
CREATE POLICY "Service role can manage payments" ON public.payments FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- subscriptions
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own subscription" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscription" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- client_portal_tokens
DROP POLICY IF EXISTS "Users can create portal tokens for their clients" ON public.client_portal_tokens;
DROP POLICY IF EXISTS "Users can view portal tokens for their clients" ON public.client_portal_tokens;
DROP POLICY IF EXISTS "Anyone can validate tokens" ON public.client_portal_tokens;
CREATE POLICY "Users can create portal tokens for their clients" ON public.client_portal_tokens FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_portal_tokens.client_id AND clients.user_id = auth.uid()));
CREATE POLICY "Users can view portal tokens for their clients" ON public.client_portal_tokens FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_portal_tokens.client_id AND clients.user_id = auth.uid()));
CREATE POLICY "Anyone can validate tokens" ON public.client_portal_tokens FOR SELECT TO anon USING (expires_at > NOW());

-- ── Realtime ─────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE clients; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE projects; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE proposals; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE invoices; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE packages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE payments; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ── Backfill: create profile + subscription for existing OAuth users ──

INSERT INTO public.profiles (id, username, email, role, avatar_url)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'username',
    split_part(COALESCE(email, raw_user_meta_data->>'email', 'user'), '@', 1)
  ),
  COALESCE(email, raw_user_meta_data->>'email'),
  'user'::public.user_role,
  raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT DO NOTHING;

INSERT INTO public.subscriptions (user_id, tier, status)
SELECT id, 'freelancer', 'active'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- ── Public view ───────────────────────────────────────────────

CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, username, role FROM public.profiles;
