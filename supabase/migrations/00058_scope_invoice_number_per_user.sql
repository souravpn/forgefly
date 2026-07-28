-- The previous fix (00057) made each user's own invoice numbering atomic,
-- but invoices_invoice_number_key was a GLOBAL `unique (invoice_number)`
-- constraint — not scoped per user. Since every user's counter independently
-- starts at 1 each day, the first invoice from any two different users on
-- the same day both produce e.g. "INV-20260728-001" and collide at the
-- database level, regardless of how race-free each user's own sequence is.
--
-- Invoice numbers only need to be unique per freelancer/business, exactly
-- like real-world invoicing (different businesses routinely both have their
-- own "INV-001") — not unique across the whole platform. Deliberately NOT
-- scoped to project_id too: Postgres treats NULL != NULL for uniqueness, so
-- a (user_id, project_id, invoice_number) constraint would give project-less
-- invoices no DB-level duplicate protection at all. (user_id, invoice_number)
-- covers every invoice unconditionally. Verified no existing
-- (user_id, invoice_number) duplicates before this ships.

alter table public.invoices drop constraint if exists invoices_invoice_number_key;

alter table public.invoices
  add constraint invoices_user_id_invoice_number_key unique (user_id, invoice_number);
