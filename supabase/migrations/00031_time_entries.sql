-- time_entries: manual + timer-mode time logging per project
create table if not exists public.time_entries (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete set null,
  client_id     uuid references public.clients(id) on delete set null,
  date          date not null default current_date,
  hours         numeric(6,2) not null check (hours > 0),
  note          text,
  -- timer fields (null = manual entry)
  timer_started_at  timestamptz,
  timer_stopped_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.time_entries enable row level security;

create policy "users manage own time_entries" on public.time_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index time_entries_business_id_idx on public.time_entries(business_id);
create index time_entries_project_id_idx  on public.time_entries(project_id);
create index time_entries_date_idx        on public.time_entries(date);

-- hour_budget column on projects (nullable — freelancer sets optionally)
alter table public.projects
  add column if not exists hour_budget numeric(8,2);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger time_entries_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();
