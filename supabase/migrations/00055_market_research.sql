-- Market research pipeline: a search-grounded (Perplexity Sonar) + Claude-
-- synthesized landscape report per business, triggered once post-generate-call.
--
-- `market_research` is the polled job/status row (same shape as the
-- check-video-render Shotstack pattern — write immediately, flip to 'ready'
-- when synthesis completes, frontend polls rather than holding a request
-- open). `market_research_items` are the atomic items the report breaks down
-- into: a fixed allow-list of item_type values (never model-invented), each
-- tagged 'actionable' (has a real-world send) or 'fyi' (insight only).
--
-- Both tables are written only by the generate-market-research edge
-- function's service-role client — the model's output is only ever title/
-- summary/lead content (data), never a business_id or a send decision.
-- Approving an actionable item just flips its status; the actual send still
-- goes through the existing propose/execute two-phase confirm, same as every
-- other Freeda action.

create table if not exists public.market_research (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending', 'running', 'ready', 'failed')),
  trigger_source text not null default 'generate_call' check (trigger_source in ('generate_call', 'manual')),
  market_summary text,
  citations      jsonb,
  error          text,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists market_research_business_idx
  on public.market_research (business_id, created_at desc);

alter table public.market_research enable row level security;

-- Select-only: the job row is only ever written by the edge function's
-- service-role client (both the initial insert and any future manual re-run).
create policy "market_research_select" on public.market_research
  for select using (
    business_id in (select id from public.businesses where user_id = auth.uid())
  );

create table if not exists public.market_research_items (
  id                  uuid primary key default gen_random_uuid(),
  market_research_id  uuid not null references public.market_research(id) on delete cascade,
  item_type           text not null check (item_type in ('outreach_draft', 'channel_signup_suggestion', 'pricing_note', 'positioning_insight')),
  kind                text not null check (kind in ('actionable', 'fyi')),
  title               text not null,
  summary             text not null,
  lead_name           text,
  lead_contact        jsonb,
  status              text not null default 'new' check (status in ('new', 'approved', 'rejected', 'dismissed', 'sent')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists market_research_items_research_idx
  on public.market_research_items (market_research_id);

alter table public.market_research_items enable row level security;

create policy "market_research_items_select" on public.market_research_items
  for select using (
    market_research_id in (
      select id from public.market_research
      where business_id in (select id from public.businesses where user_id = auth.uid())
    )
  );

-- Update-only (no insert/delete for authenticated users): the swipe queue
-- flips status to 'approved' / 'rejected' / 'dismissed' directly, but items
-- themselves are only ever created by the edge function's fan-out step.
create policy "market_research_items_update" on public.market_research_items
  for update using (
    market_research_id in (
      select id from public.market_research
      where business_id in (select id from public.businesses where user_id = auth.uid())
    )
  );

drop trigger if exists market_research_items_updated_at on public.market_research_items;
create trigger market_research_items_updated_at
  before update on public.market_research_items
  for each row execute function public.set_updated_at();
