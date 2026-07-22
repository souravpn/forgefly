-- SECURITY FIX: the public portal-read policy on `engagements` was
-- `using (true)` — an unrestricted SELECT that let anyone with just the
-- anon key dump every engagement across every business, including the
-- portal_token secret itself (the credential the policy was meant to
-- gate on). Replace it with a policy that actually checks the token,
-- passed as a request header by the one legacy caller
-- (src/pages/ClientPortalPage.tsx) that still reads this table directly.

drop policy if exists "Portal token holders can read their engagement" on engagements;

create policy "Portal token holders can read their engagement"
  on engagements for select
  using (
    portal_token = coalesce(current_setting('request.headers', true)::json->>'x-portal-token', '')
  );
