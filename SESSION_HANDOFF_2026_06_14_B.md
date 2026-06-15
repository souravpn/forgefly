# Session Handoff — 2026-06-14 (Session B)

## What Happened This Session

### Phase Check
- **Phase 4 (Client Portal):** COMPLETE as of 2026-06-08. No pending subagent work.
- All phases 1–6 are complete per memory.

---

### Bug Fixed: Portal RLS Policy (auth.users permission error)

**Symptom:** Client portal showing "Portal not linked to your account" immediately after signing in with Google.

**Root cause:** Two RLS policies on `engagement_access` were querying `auth.users` directly:
```
(client_email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid()))
```
PostgREST's `authenticated` role can't `SELECT` from `auth.users`. The query silently returned `null`, making the code think there was no access row.

**Fix:** User ran this SQL in Supabase SQL Editor:
```sql
-- Fixed SELECT policy
DROP POLICY "client reads own" ON engagement_access;
CREATE POLICY "client reads own"
  ON engagement_access FOR SELECT TO authenticated
  USING (client_user_id = auth.uid() OR client_email = auth.email());

-- Fixed UPDATE policy
DROP POLICY "update client_user_id" ON engagement_access;
CREATE POLICY "update client_user_id"
  ON engagement_access FOR UPDATE TO authenticated
  USING (client_email = auth.email())
  WITH CHECK (client_email = auth.email());
```

`auth.email()` reads from the JWT claim — no table query, no permission issue.

**Status:** SQL fix given, user to confirm portal is working.

---

## Uncommitted Work

- `src/pages/RequestsPage.tsx` — modified (+83 lines), **not committed**. This is the full Requests page rebuild from the previous session (pill tabs, AI draft modal, Ask a Question). Still needs a commit.

---

## Still Pending from Previous Sessions

| Item | Notes |
|---|---|
| Deploy edge functions | `request-deletion-otp`, `confirm-account-deletion` — still not deployed |
| SQL migrations | `businesses.archived_at`, `businesses.confidence_map`, `businesses.completeness_score`, `deletion_otps` table, pg_cron job for purging archived businesses — check if run |
| Confirm portal is working | After RLS fix above — test full flow: send proposal → client gets email → opens portal → sees engagement |
| Stripe webhook registration | `stripe-webhook` function needs to be registered in Stripe Dashboard with its own signing secret |
| Resend SMTP in Supabase Auth | Supabase → Auth → SMTP: host `smtp.resend.com`, port 465, user `resend`, password = Resend API key |
| Subscription price | Change `unit_amount: 100` → `2900` (monthly) or `29000` (annual) in `create-subscription-checkout/index.ts` before launch |
| Terms of Service + Privacy Policy pages | Referenced at signup but pages don't exist |
| Landing page hero screenshot | Save to `public/dashboard-screenshot.png`, update `LandingPage.tsx` ~line 300 |
| Storage bucket RLS | INSERT (authenticated) + SELECT (anon+authenticated) for `avatars` bucket |

---

## Architecture Reminder: Portal Auth Flow

1. `generate-portal-link` → stores human-readable token in `engagements.portal_token` + upserts `engagement_access` row with `client_email`
2. Client visits `/portal/<token>` → `ClientPortalPage` looks up engagement by `portal_token`
3. `PortalWithAuth.checkAuth()` → `getUser()` → queries `engagement_access` (now fixed) → checks email/user_id match
4. If no match → "denied". If match + no `client_user_id` yet → updates it, then shows portal.

**Old portal links** (sent before `generate-portal-link` was deployed with the new code) won't work. Freelancer must resend proposal to regenerate token.

---

## Key Files

| File | Purpose |
|---|---|
| `src/pages/ClientPortalPage.tsx` | Client portal — auth gate + 5-tab engagement view |
| `src/pages/RequestsPage.tsx` | Proposal requests inbox (modified, uncommitted) |
| `supabase/functions/generate-portal-link/index.ts` | Generates `{company}-{firstName}-{4hex}` token, upserts engagement_access |
| `supabase/functions/_shared/email-templates.ts` | All email templates incl. portal invite |
| `src/pages/SettingsPage.tsx` | Delete business + delete account danger zones |
