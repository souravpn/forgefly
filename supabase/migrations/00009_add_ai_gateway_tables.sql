-- Migration: AI Gateway tables for the new extracted_data architecture
-- Run via: Supabase Dashboard → SQL Editor (paste and run)

-- ─── businesses ──────────────────────────────────────────────────────────────
-- One active business per user (enforced by partial unique index below).
-- extracted_data is the single source of truth: all tabs are views over this JSON.

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  extracted_data jsonb not null default '{}',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce one active business per user
create unique index if not exists businesses_user_active_unique
  on businesses (user_id)
  where (status = 'active');

-- Fast lookup by user
create index if not exists businesses_user_id_idx on businesses (user_id);

-- RLS
alter table businesses enable row level security;

create policy "Users can manage their own businesses"
  on businesses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_updated_at on businesses;
create trigger businesses_updated_at
  before update on businesses
  for each row execute function update_updated_at_column();

-- ─── prompt_sessions ─────────────────────────────────────────────────────────
-- Tracks every seed/revision prompt so we can show history + support undo.

create table if not exists prompt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  prompt text not null,
  prompt_type text not null check (prompt_type in ('seed', 'additive', 'revision', 'scoped')),
  extracted_data_snapshot jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists prompt_sessions_business_id_idx on prompt_sessions (business_id);
create index if not exists prompt_sessions_user_id_idx on prompt_sessions (user_id);

alter table prompt_sessions enable row level security;

create policy "Users can manage their own prompt sessions"
  on prompt_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── ai_usage_log ────────────────────────────────────────────────────────────
-- Every AI call logged here for cost monitoring. Non-fatal if insert fails.

create table if not exists ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  business_id uuid references businesses(id) on delete set null,
  model text not null,
  prompt_type text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_user_id_idx on ai_usage_log (user_id);
create index if not exists ai_usage_log_created_at_idx on ai_usage_log (created_at desc);

alter table ai_usage_log enable row level security;

-- Users can read their own usage; inserts come from edge functions (service role bypasses RLS)
create policy "Users can read their own usage"
  on ai_usage_log for select
  using (auth.uid() = user_id);
