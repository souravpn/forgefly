-- Fix time_entries schema drift.
--
-- Migration 00031_time_entries.sql intended to create `time_entries` with
-- columns (date, user_id, client_id -> clients, timer_stopped_at, source,
-- external_id, synced_at, updated_at). But an earlier migration,
-- 00029_accounting_tables.sql, already creates a `time_entries` table with a
-- different shape (entry_date, no user_id, client_id -> contacts). Since
-- 00029 runs first, 00031's `create table if not exists` silently no-opped —
-- the app has been coded against 00031's intended shape ever since, which is
-- why saving a time entry fails with a PostgREST "no relationship between
-- time_entries and clients" error.
--
-- project_id stays NOT NULL (both migrations agree here) — time tracking is
-- always per-project, and a project's client is inferred from project_id
-- rather than stored/selected independently (see timeService.ts).
--
-- This migration is written defensively (guarded / idempotent) so it
-- converges on the intended shape regardless of which migration's schema
-- actually won on a given environment.

-- 1. Rename entry_date -> date, if needed.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'time_entries' and column_name = 'entry_date'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'time_entries' and column_name = 'date'
  ) then
    alter table public.time_entries rename column entry_date to date;
  end if;
end $$;

-- 2. Add any columns the app expects that aren't there yet.
alter table public.time_entries add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.time_entries add column if not exists timer_stopped_at timestamptz;
alter table public.time_entries add column if not exists source text not null default 'native';
alter table public.time_entries add column if not exists external_id text;
alter table public.time_entries add column if not exists synced_at timestamptz;
alter table public.time_entries add column if not exists updated_at timestamptz not null default now();

-- 3. Backfill user_id (from the owning business) for any rows missing it,
--    then enforce not-null once every row has one.
update public.time_entries te
set user_id = b.user_id
from public.businesses b
where te.business_id = b.id and te.user_id is null;

do $$
begin
  if not exists (select 1 from public.time_entries where user_id is null) then
    alter table public.time_entries alter column user_id set not null;
  end if;
end $$;

-- 4. client_id must reference clients(id), not contacts(id). Existing values
--    (if any point at contacts.id) can't be reliably remapped, so they're
--    cleared rather than kept as an invalid link — the project (and its
--    client) remains the source of truth for attribution.
do $$
declare
  fk_name text;
  fk_target text;
begin
  select tc.constraint_name, ccu.table_name
    into fk_name, fk_target
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
  where tc.table_schema = 'public' and tc.table_name = 'time_entries'
    and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'client_id'
  limit 1;

  if fk_name is not null and fk_target is distinct from 'clients' then
    execute format('alter table public.time_entries drop constraint %I', fk_name);
    update public.time_entries set client_id = null;
    alter table public.time_entries
      add constraint time_entries_client_id_fkey foreign key (client_id) references public.clients(id) on delete set null;
  elsif fk_name is null then
    alter table public.time_entries
      add constraint time_entries_client_id_fkey foreign key (client_id) references public.clients(id) on delete set null;
  end if;
end $$;

-- 5. Widen hours precision to match the app's expected range.
alter table public.time_entries alter column hours type numeric(6,2);

-- 6. updated_at trigger.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists time_entries_updated_at on public.time_entries;
create trigger time_entries_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- 7. RLS: scope by auth.uid() = user_id (matches the app and the rest of
--    the codebase's ownership convention), replacing any business_id-scoped
--    policies left over from 00029.
drop policy if exists "time_entries_select" on public.time_entries;
drop policy if exists "time_entries_insert" on public.time_entries;
drop policy if exists "time_entries_update" on public.time_entries;
drop policy if exists "time_entries_delete" on public.time_entries;
drop policy if exists "users manage own time_entries" on public.time_entries;

create policy "users manage own time_entries" on public.time_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8. Indexes matching the app's query patterns.
create index if not exists time_entries_business_id_idx on public.time_entries(business_id);
create index if not exists time_entries_project_id_idx  on public.time_entries(project_id);
create index if not exists time_entries_date_idx        on public.time_entries(date);
