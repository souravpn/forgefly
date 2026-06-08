# Forgefly Session Handoff — 2026-06-07

## What was built this session

### 1. Subscription upgrade flow (Agency tier)
- `create-subscription-checkout`: price set to **$1 (100 cents)** for testing — change to 2900/29000 before launch
- `subscription-webhook`: after payment, activates subscription in DB and sends congratulatory email via Resend
- `_shared/email-templates.ts`: added `getAgencyUpgradeEmailTemplate`
- `DashboardPage.tsx`: detects `?upgrade=success` query param, shows Crown icon dialog ("Welcome to Agency!"), clears URL param

### 2. Stripe Connect (freelancer payouts)
- `profiles` table: added `stripe_account_id` (text) and `stripe_account_status` text columns via migration `00008_add_stripe_connect.sql`
- New edge function `create-connect-account`: creates Stripe Express account + onboarding link
- New edge function `get-connect-status`: checks account status from Stripe, updates DB
- `SettingsPage.tsx`: new **Payments tab** with 4 states (not connected → pending → under review → active), Connect button, Manage on Stripe link
- After Stripe onboarding, redirects to `/settings?tab=payments&connect=success` and auto-refreshes status
- `portal-create-checkout`: uses `payment_intent_data.transfer_data.destination` (destination charges) to route client payments to freelancer's connected Stripe account
- Platform fee: set `PLATFORM_FEE_PERCENT` secret (e.g. `"2"` for 2%) — currently 0%
- Stripe Connect enabled on Forgefly platform account (sandbox). Tested with a manually-inserted test connected account.

### 3. Invoice payment status fix
- `portal-create-checkout`: success URL now includes `{CHECKOUT_SESSION_ID}` so Stripe injects the real session ID
- `ClientPortalPage.tsx`: detects `?session_id=` on payment success, calls `verify-stripe-payment` edge function, reloads data → invoice shows paid immediately
- `InvoicesPage.tsx`: removed "Pay with Stripe" and "Mark Paid" buttons; sent/overdue invoices now show **Resend + Revise + Delete (red)**

---

## Current pending items

| Item | Priority | Notes |
|---|---|---|
| **Subscription price** | Before launch | Change `unit_amount: 100` → `2900`/`29000` in `create-subscription-checkout/index.ts` |
| **`stripe-webhook` bug** | Medium | Uses `SUPABASE_SERVICE_KEY` (wrong) — should be `SUPABASE_SERVICE_ROLE_KEY`. Also needs to be registered as a webhook endpoint in Stripe Dashboard separately from subscription-webhook. |
| **Real Stripe Connect flow** | Next | Test full freelancer onboarding (not manually inserted). Freelancer clicks Connect, goes through Express onboarding, returns to Settings → Payments → Active. |
| **Landing page hero (Safari)** | Low | Save screenshot to `public/dashboard-screenshot.png`, update src in `LandingPage.tsx` ~line 300 |
| **Resend SMTP in Supabase Auth** | Low | host `smtp.resend.com`, port 465, user `resend`, password = Resend API key |
| **Storage RLS policies** | Low | INSERT (authenticated) + SELECT (anon) for `avatars` bucket |
| **ToS + Privacy Policy pages** | Low | Signup links to them but pages don't exist |

---

## Key architecture facts

**Payment flows:**
- **Client pays invoice** → portal link (no auth) → `portal-create-checkout` → Stripe Checkout → success URL with `session_id` → `verify-stripe-payment` → invoice marked paid
- **Freelancer upgrades** → UpgradeModal → `create-subscription-checkout` → Stripe → `?upgrade=success` → DashboardPage dialog + congratulatory email
- **Freelancer connects Stripe** → Settings → Payments → `create-connect-account` → Stripe Express onboarding → return URL → `get-connect-status`

**Key enum values (match DB exactly):**
- ProposalStatus: `'draft' | 'sent' | 'accepted' | 'rejected'` (NOT 'approved')
- ProjectStatus: `'lead' | 'in_progress' | 'review' | 'completed' | 'archived'`
- stripe_account_status: `'not_connected' | 'pending' | 'under_review' | 'active'`

**Stripe API version across all functions:** `'2025-08-27.basil'` (matches stripe@19.1.0)

**Supabase project ref:** `oqwgssdmrauhhiiaxryg`

**Deploy edge functions:** `npx supabase functions deploy <function-name>`

**Run new DB migrations:** paste SQL into Supabase Dashboard → SQL Editor (db push fails on already-applied migrations)

---

## Files changed this session

| File | Change |
|---|---|
| `supabase/functions/create-subscription-checkout/index.ts` | unit_amount → 100 |
| `supabase/functions/subscription-webhook/index.ts` | sends congratulatory email after activation |
| `supabase/functions/_shared/email-templates.ts` | added `getAgencyUpgradeEmailTemplate` |
| `supabase/functions/create-connect-account/index.ts` | **NEW** — Express account + onboarding link |
| `supabase/functions/get-connect-status/index.ts` | **NEW** — check/update account status |
| `supabase/functions/portal-create-checkout/index.ts` | destination charges + session_id in success URL |
| `supabase/functions/verify-stripe-payment/index.ts` | (no change, already correct) |
| `supabase/migrations/00008_add_stripe_connect.sql` | **NEW** — stripe_account_id + stripe_account_status on profiles |
| `src/types/types.ts` | Profile type: added stripe_account_id, stripe_account_status |
| `src/pages/DashboardPage.tsx` | upgrade success dialog |
| `src/pages/SettingsPage.tsx` | Payments tab with Connect UI |
| `src/pages/InvoicesPage.tsx` | Revise + Delete replacing Pay/Mark Paid |
| `src/pages/ClientPortalPage.tsx` | verify-stripe-payment call on payment success |
