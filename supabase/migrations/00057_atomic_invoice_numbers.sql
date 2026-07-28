-- Invoice creation was intermittently failing with "duplicate key value
-- violates unique constraint invoices_invoice_number_key". Root cause:
-- generateInvoiceNumber() in invoiceService.ts derives the sequence from a
-- live `SELECT count(*) ... WHERE created_at is today`, then inserts with
-- count+1 — that read-then-insert isn't atomic, so two nearly-simultaneous
-- invoice creations can both read the same count and collide.
--
-- Fix: a per-user, per-day counter table incremented via a single atomic
-- `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, which Postgres guarantees
-- is race-free (the row lock is held for the duration of the statement).

create table if not exists public.invoice_number_counters (
  user_id  uuid not null references auth.users(id) on delete cascade,
  date_key text not null,
  counter  integer not null default 0,
  primary key (user_id, date_key)
);

alter table public.invoice_number_counters enable row level security;

create policy "users manage own invoice_number_counters" on public.invoice_number_counters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.next_invoice_sequence(p_date_key text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.invoice_number_counters (user_id, date_key, counter)
  values (auth.uid(), p_date_key, 1)
  on conflict (user_id, date_key)
  do update set counter = invoice_number_counters.counter + 1
  returning counter;
$$;

grant execute on function public.next_invoice_sequence(text) to authenticated;

-- Backfill: seed each user's counter from the highest sequence already used
-- for that day, parsed out of existing `INV-YYYYMMDD-NNN` invoice numbers —
-- otherwise the first post-migration invoice for a user/day with existing
-- invoices would restart at 001 and immediately collide with it.
insert into public.invoice_number_counters (user_id, date_key, counter)
select
  user_id,
  substring(invoice_number from 5 for 8) as date_key,
  max(substring(invoice_number from 14 for 3)::integer) as counter
from public.invoices
where invoice_number ~ '^INV-\d{8}-\d{3}$'
group by user_id, substring(invoice_number from 5 for 8)
on conflict (user_id, date_key) do update set counter = excluded.counter;
