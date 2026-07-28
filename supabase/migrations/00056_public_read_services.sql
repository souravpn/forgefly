-- Public portfolio page (/p/:slug) shows a business's services to anonymous
-- visitors, but `services` only ever had an owner-scoped RLS policy — so an
-- anon query for a business's services always returned zero rows. The page
-- worked around this by reading the stale `businesses.extracted_data.services`
-- JSONB snapshot instead of the `services` table, which is the table
-- freelancers actually edit (PackagesPage.tsx) — the two drift apart the
-- moment a freelancer adds/edits/deletes a service, since nothing writes
-- those changes back into extracted_data.
--
-- Fix is two-part: this migration adds the missing public-read policy;
-- PublicPortfolioPage.tsx (app code) is updated to query `services` directly
-- instead of the JSONB snapshot, matching how work_samples/portal_sections/
-- reviews are already fetched for this same page.

create policy "public read active business services" on services
  for select
  using (
    business_id in (select id from businesses where status = 'active')
  );
