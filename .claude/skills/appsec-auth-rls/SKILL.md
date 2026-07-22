---
name: appsec-auth-rls
description: Use when writing a new Supabase migration that creates a table holding business/user/client data, modifying an RLS policy, or writing a new edge function that takes a business_id/user_id in its request and reads or writes business-scoped data. Fires on any change under supabase/migrations/ or a new supabase/functions/*/index.ts.
---

# RLS + caller-identity review

Read `sec-rev/APPSEC.md` §4 and §5 first. RLS is the actual enforcement boundary for every table holding business or user data — not app-code discipline, not "the frontend only ever queries with the right filter." A `using (true)` policy grants access to any caller regardless of what the client-side query filters on.

## New migration — checklist

1. Does the new table get `alter table ... enable row level security`?
2. Is every policy scoped to `auth.uid()` directly, or through an ownership chain (e.g. joining through `businesses.user_id`)?
3. If a policy uses `using (true))`, does the table have **any** secret/token column (an API key, a `portal_token`, anything meant to gate access on its own)? If yes, `using (true)` leaks that secret to anyone holding the anon key — that's the entire internet, since the anon key ships in the frontend bundle. This is the exact shape of the `engagements` CRITICAL finding from the 2026-07-22 review (see `sec-rev/findings/2026-07-22-full-review.md`) — don't reintroduce it.
4. If the intended access pattern really is "anyone who holds token X can read row X," that can't be expressed as `using (true)` — RLS evaluates per-row, not per-query-shape. Use either: (a) an edge function that validates the token server-side with the service-role client, or (b) an RLS policy matching a value the client sends via a custom header (`current_setting('request.headers', true)::json->>'x-your-token'`) — see `supabase/migrations/00051_engagements_rls_fix.sql` + `src/pages/ClientPortalPage.tsx`'s `engagementClientFor()` for the reference implementation.

## New edge function — checklist

1. Does it take a `business_id`/`user_id` in the request body? If so, does it do anything beyond reading data that's already meant to be fully public?
2. If yes to something non-public, does it verify the caller via the dual-client pattern — an anon+forwarded-Authorization client's `auth.getUser()`, then check `business.user_id === user.id` — before proceeding? Reference: `generate-visibility-kit/index.ts`.
3. If it's genuinely meant to be unauthenticated, which exception does it fall under: public-intake-by-token (validate the token against the DB, don't just check it's present), function-to-function-only (require the caller's Authorization header to equal the service-role key, since the anon key doesn't gate anything), or cron-only (confirm it's not independently reachable with attacker-controlled targeting)? Document which, in a comment, the way `submit-review`/`portal-create-checkout` already do.
4. Default to requiring the ownership check. Only skip it with a documented reason matching one of the exceptions above — "no auth check" should never be the default a new function ships with.
