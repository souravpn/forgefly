-- Migration: business-scoped tables for the extracted_data architecture
-- Run via: Supabase Dashboard → SQL Editor (paste and run)
--
-- Context: businesses / prompt_sessions / ai_usage_log were created in 00009.
-- This migration adds the remaining domain tables that are all scoped to
-- businesses.id rather than profiles.id (the old user-scoped pattern).
-- The existing clients / invoices / proposals tables are left intact —
-- they continue to power the current live UI while the new architecture lands.

-- ─── businesses: add seed_prompt column ─────────────────────────────────────

alter table businesses
  add column if not exists seed_prompt text;

-- ─── services ────────────────────────────────────────────────────────────────
-- Business-scoped service catalogue extracted from extracted_data.services.
-- Separate from the existing packages table (user-scoped, Stripe-linked).

create table if not exists services (
  id           uuid        primary key default gen_random_uuid(),
  business_id  uuid        not null references businesses(id) on delete cascade,
  name         text        not null,
  price        text        not null,
  type         text        not null check (type in ('project', 'retainer', 'hourly')),
  description  text,
  deliverables jsonb       not null default '[]',
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists services_business_id_idx on services (business_id);

alter table services enable row level security;

create policy "Users can manage their own services"
  on services for all
  using (
    auth.uid() = (select user_id from businesses where id = services.business_id)
  )
  with check (
    auth.uid() = (select user_id from businesses where id = services.business_id)
  );

-- ─── contacts ────────────────────────────────────────────────────────────────
-- Business-scoped CRM contacts. Separate from the legacy clients table
-- (user-scoped, used by the existing invoice/proposal flows).

create table if not exists contacts (
  id           uuid        primary key default gen_random_uuid(),
  business_id  uuid        not null references businesses(id) on delete cascade,
  name         text        not null,
  company      text,
  role         text,
  email        text,
  status       text        not null default 'Prospect'
                           check (status in ('Active client', 'Prospect', 'Past client')),
  created_at   timestamptz not null default now()
);

create index if not exists contacts_business_id_idx on contacts (business_id);

alter table contacts enable row level security;

create policy "Users can manage their own contacts"
  on contacts for all
  using (
    auth.uid() = (select user_id from businesses where id = contacts.business_id)
  )
  with check (
    auth.uid() = (select user_id from businesses where id = contacts.business_id)
  );

-- ─── pipeline_leads ──────────────────────────────────────────────────────────
-- Pre-sales CRM. Separate from projects (delivery tracking).

create table if not exists pipeline_leads (
  id           uuid        primary key default gen_random_uuid(),
  business_id  uuid        not null references businesses(id) on delete cascade,
  contact_id   uuid        references contacts(id) on delete set null,
  stage        text        not null default 'Prospect'
                           check (stage in ('Prospect', 'Qualified', 'Proposal Sent', 'Negotiating', 'Closed Won')),
  value        text,
  service_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists pipeline_leads_business_id_idx on pipeline_leads (business_id);
create index if not exists pipeline_leads_contact_id_idx  on pipeline_leads (contact_id);

alter table pipeline_leads enable row level security;

create policy "Users can manage their own pipeline leads"
  on pipeline_leads for all
  using (
    auth.uid() = (select user_id from businesses where id = pipeline_leads.business_id)
  )
  with check (
    auth.uid() = (select user_id from businesses where id = pipeline_leads.business_id)
  );

drop trigger if exists pipeline_leads_updated_at on pipeline_leads;
create trigger pipeline_leads_updated_at
  before update on pipeline_leads
  for each row execute function update_updated_at_column();

-- ─── engagements ─────────────────────────────────────────────────────────────
-- Per-client portal scope. Each engagement has a unique portal_token that
-- powers the /portal/[token] public URL.

create table if not exists engagements (
  id           uuid        primary key default gen_random_uuid(),
  business_id  uuid        not null references businesses(id) on delete cascade,
  contact_id   uuid        references contacts(id) on delete set null,
  portal_token text        unique not null default encode(gen_random_bytes(8), 'hex'),
  service_name text,
  status       text        not null default 'proposal_sent'
                           check (status in ('proposal_sent', 'active', 'completed', 'cancelled')),
  scope        jsonb       not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists engagements_business_id_idx  on engagements (business_id);
create index if not exists engagements_contact_id_idx   on engagements (contact_id);
create index if not exists engagements_portal_token_idx on engagements (portal_token);

alter table engagements enable row level security;

-- Freelancer can manage all engagements for their business
create policy "Users can manage their own engagements"
  on engagements for all
  using (
    auth.uid() = (select user_id from businesses where id = engagements.business_id)
  )
  with check (
    auth.uid() = (select user_id from businesses where id = engagements.business_id)
  );

-- Public portal read: anyone with the token can read their engagement
create policy "Portal token holders can read their engagement"
  on engagements for select
  using (true);

drop trigger if exists engagements_updated_at on engagements;
create trigger engagements_updated_at
  before update on engagements
  for each row execute function update_updated_at_column();

-- ─── invoices: add business_id + contact_id FKs ──────────────────────────────
-- The existing invoices table (user-scoped) is kept intact. These nullable
-- columns let new business-scoped invoices carry their business/contact ref
-- once the new invoice flow is wired in Phase 3.

alter table invoices
  add column if not exists business_id uuid references businesses(id) on delete set null;

alter table invoices
  add column if not exists contact_id uuid references contacts(id) on delete set null;

create index if not exists invoices_business_id_idx on invoices (business_id);
