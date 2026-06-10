# Session Handoff — Phase 5 Complete
> Load this file + CLAUDE.md + all memory files at the start of each new session.
> Previous handoff doc: `SESSION_HANDOFF_PHASE4_5.md` (phases 3 & 4 context)

---

## What Was Completed This Session (2026-06-09)

### Step 25 — CalendarPage: invoice due dates as synthetic events
**File:** `src/pages/CalendarPage.tsx`

Extended the existing synthetic project-deadline pattern to include unpaid invoices with a due date.

- Added `getInvoices` import from `invoiceService`
- `isSyntheticInvoice(event)` — checks `id.startsWith('invoice-')`
- `isSynthetic(event)` — covers both `project-` and `invoice-` prefixes
- `loadEvents()` now calls `getInvoices()` in parallel with `getCalendarEvents()`; builds `invoiceDueDates` array:
  - Filters to `payment_status !== 'paid'` and `due_date !== null`
  - Red `#ef4444` when overdue (due_date < now), amber `#f59e0b` when upcoming
  - Stashes the raw `Invoice` object as `_invoice` on the event for the modal
- Read-only info modal for invoice events: shows date, client, invoice number + amount, Overdue/Upcoming badge, "Go to Invoices" CTA button
- Existing project deadline modal unchanged

---

### Step 26 — AICopilot migration (already done)
**File:** `src/components/layouts/AICopilot.tsx`

Already called `ai-gateway` with `mode: 'chat'` and `current_page`. No changes needed.

---

### Step 27 — AI History tab in Settings + prompt_sessions logging
**Files:**
- `supabase/functions/ai-gateway/index.ts` (modified + deployed)
- `src/pages/SettingsPage.tsx` (modified)

**ai-gateway change**: After each `handleExtract` call succeeds, inserts a row into `prompt_sessions` with `prompt`, `prompt_type`, and `extracted_data_snapshot: { diff_summary: { sections_updated } }`. Non-fatal if insert fails.

**SettingsPage new tab "AI History"**:
- New `TabsTrigger value="ai-history"` added to existing tab list
- New `AIHistoryTab` component (defined at bottom of file, no new files)
- Two summary cards: total tokens this month + estimated cost this month
- "Business OS prompts" section: last 20 rows from `prompt_sessions` — truncated prompt text, updated sections list, prompt_type badge, date
- "Recent AI calls" table: last 30 rows from `ai_usage_log` — date, type, model (Haiku/Sonnet/Opus), tokens, cost

---

### Auth form validation fixes
**Files:** `src/pages/SignupPage.tsx`, `src/pages/LoginPage.tsx`

**SignupPage**: "Create Account" button `disabled` when any of these are false:
- Email is non-empty
- Password is 8+ chars, has uppercase, has number or symbol (same checks shown in `PasswordStrength` UI)
- Confirm password matches
- Terms checkbox is checked

**LoginPage**: "Sign In" button `disabled` until email AND password are non-empty.

---

### Bug fix — "No active business found" after creating Business OS
**Files:** `src/hooks/useCurrentBusiness.ts`, `src/pages/GeneratedPortalPage.tsx`

**Root cause**: When a user was already logged in and generated their Business OS from `/`, clicking "Save" on the preview navigated to `/login?intent=save_portal`. The `LoginPage` had no `save_portal` handling, so `sessionStorage.pending_portal` was never consumed and the business was never saved.

**Fix 1 — `GeneratedPortalPage.handleSave()`**: Now checks `user` from `useAuth()`. If already logged in → `navigate('/dashboard')` directly. The pending portal stays in sessionStorage and is picked up by fix 2.

**Fix 2 — `useCurrentBusiness.fetchBusiness()`**: After the initial DB fetch returns null (no active business found), now checks `sessionStorage.pending_portal`. If present:
1. Checks if an active business row already exists (select-then-update, avoids partial-index upsert issues)
2. Updates existing row OR inserts new row
3. Logs `prompt_sessions` entry
4. Clears `pending_portal` from sessionStorage
5. Re-fetches the full row and returns it

This also fixes the edge case where email confirmation was completed in a different browser/tab (so `pending_portal` was present but `AuthCallbackPage` never ran in that session).

**Why select-then-update instead of upsert**: The `businesses` table only has a partial unique index on `(user_id) WHERE (status = 'active')`, not a full unique constraint on `user_id`. PostgREST's `onConflict: 'user_id'` won't reliably match a partial index, causing silent insert failures on re-generation. The explicit select-then-update pattern is safe.

---

## Full Project State (as of 2026-06-09)

### Phase progress

| Phase | Status |
|-------|--------|
| Phase 1 — Infrastructure | **COMPLETE** |
| Phase 2 — Acquisition funnel (landing page, onboarding) | **COMPLETE** |
| Phase 3 — AI pre-population (CommandBar, real data wiring) | **COMPLETE** |
| Phase 4 — Client portal (portfolio, proposal requests, engagement portal) | **COMPLETE** |
| Phase 5 — Retention / nudge engine | **COMPLETE** |

---

## All Edge Functions (deployed to production)

| Function | Purpose |
|----------|---------|
| `ai-gateway` | Main AI router: `mode: 'extract'` for Business OS generation/update, `mode: 'chat'` for AICopilot. Logs to `ai_usage_log` and `prompt_sessions`. |
| `ai-copilot` | Legacy OpenAI chat — still deployed but unused (replaced by `ai-gateway` chat mode) |
| `submit-proposal-request` | Public endpoint — inserts `proposal_requests` + `nudges`, emails freelancer via Resend |
| `trigger-nudges` | Service-role endpoint — checks all active businesses for overdue invoices, stale leads, unsent proposals, new requests. Generates AI copy via Haiku with fallback. Called by pg_cron daily at 9 AM UTC (or manually via Automations page). |
| `create-invoice-checkout` | Creates Stripe Checkout for an invoice (legacy freelancer-side) |
| `create-checkout-session` | Generic Stripe checkout |
| `create-subscription-checkout` | Stripe subscription checkout for agency tier |
| `verify-stripe-payment` | Verifies Stripe session, marks invoice paid, creates payment record |
| `stripe-webhook` | Handles `checkout.session.completed` for invoice payments |
| `subscription-webhook` | Handles agency tier subscription activation, sends congrats email |
| `send-email` | Transactional emails via Resend: `welcome`, `proposal`, `invoice`, `client_message`, `agency_upgrade`, `new_request` |
| `generate-portal-link` | Generates time-limited token for client portal → `forgefly.io/portal/{token}` |
| `portal-approve-proposal` | Client approves/requests changes on proposal via token |
| `portal-create-checkout` | Creates Stripe Checkout for client invoice payment. Uses destination charges if freelancer has active Stripe Connect account. |
| `create-connect-account` | Creates Stripe Express account + onboarding link for freelancer Stripe Connect setup |
| `get-connect-status` | Checks freelancer's Stripe Connect account status from Stripe API, updates DB |

---

## All Routes

| Path | Page | Public |
|------|------|--------|
| `/` | `LandingPage` | ✓ |
| `/login` | `LoginPage` | ✓ |
| `/signup` | `SignupPage` | ✓ |
| `/auth/callback` | `AuthCallbackPage` | ✓ |
| `/preview` | `GeneratedPortalPage` | ✓ |
| `/portal/:token` | `ClientPortalPage` | ✓ |
| `/p/:slug` | `PublicPortfolioPage` | ✓ |
| `/onboarding` | `OnboardingPage` | — |
| `/dashboard` | `DashboardPage` | — |
| `/dashboard/services` | `PackagesPage` | — |
| `/dashboard/pipeline` | `PipelinePage` | — |
| `/dashboard/invoices` | `InvoicesPage` | — |
| `/dashboard/clients` | `ClientsPage` | — |
| `/dashboard/clients/:clientId` | `ClientDetailPage` | — |
| `/dashboard/proposals` | `ProposalsPage` | — |
| `/dashboard/brand` | `BrandKitPage` | — |
| `/dashboard/calendar` | `CalendarPage` | — |
| `/dashboard/automations` | `AutomationsPage` | — |
| `/dashboard/settings` | `SettingsPage` | — |
| `/dashboard/projects` | `ProjectsPage` | — |
| `/dashboard/finances` | `FinancesPage` | — |
| `/dashboard/requests` | `RequestsPage` | — |
| `/payment/success` | `PaymentSuccessPage` | — |
| `/payment/cancel` | `PaymentCancelPage` | — |

---

## DB Migrations Applied

| File | What it adds |
|------|-------------|
| `combined_setup.sql` | All base tables |
| `00001–00007_*.sql` | Incremental schema: Stripe, Calendar, Client Portal tokens |
| `00008_add_stripe_connect.sql` | `stripe_account_id`, `stripe_account_status` on `profiles` |
| `00009_add_ai_gateway_tables.sql` | `businesses`, `prompt_sessions`, `ai_usage_log`, `engagements` |
| `00010_add_business_scoped_tables.sql` | `pipeline_leads`, `contacts`, `services` tables |
| `00011_add_proposal_requests.sql` | `proposal_requests`, `nudges` tables |

---

## Key Architecture Notes

### Business OS generation flow (fully debugged)

1. **Anonymous user**: Landing page → `ai-gateway` (extract, no auth) → `sessionStorage.pending_portal` → `/preview` → click Save → `/login?intent=save_portal` → sign up/log in → `/auth/callback` → `savePendingPortal()` → `/dashboard`
2. **Already logged in**: Landing page → extract → `/preview` → click Save → `/dashboard` (direct) → `useCurrentBusiness.fetchBusiness()` detects `pending_portal` → auto-saves business → clears sessionStorage
3. **Email confirmation in new tab**: Same as #2 path — `useCurrentBusiness` catches it on next dashboard load

### CurrentBusinessContext

`src/contexts/CurrentBusinessContext.tsx` — wraps `AppShell`. Runs `useCurrentBusiness()` exactly ONCE for the entire protected shell. All pages call `useBusiness()` (not `useCurrentBusiness()` directly) to share state and avoid channel collisions.

**Pattern used by all pages that need business data:**
```typescript
const { business, extractedData, refetch } = useBusiness()
```

### CommandBar re-prompt flow

1. User submits prompt in CommandBar
2. `ai-gateway` called with `mode: 'extract'`, `current_data: extractedData`, `business_id`
3. Returns `{ extracted_data: mergedData, sections_updated: string[] }`
4. `DiffConfirmModal` shows `+` (new) / `~` (changed) lines
5. On confirm → single `UPDATE businesses SET extracted_data = mergedData WHERE id = business.id` → `refetch()`

### Pipeline + Services (migrated to real tables in Phase 4)

- `pipeline_leads` table — leads with `contact_id` FK to `contacts` table. On first load, seeds from `extracted_data.pipeline.leads` if table is empty. DnD writes `UPDATE pipeline_leads SET stage`.
- `services` table — service rows with `sort_order`. On first load, seeds from `extracted_data.services` if empty.

### Nudge engine

`trigger-nudges` edge function — runs daily at 9 AM UTC via pg_cron (SQL below). Also callable manually from Automations page → "Run check now".

4 nudge types: `overdue_invoice` (3+ days), `stale_lead` (14+ days no update), `unsent_proposal` (draft 7+ days), `new_request` (unactioned 24h+). Settings toggles in `businesses.extracted_data.settings.nudges`.

**pg_cron setup SQL** (run once in Supabase SQL Editor if not already done):
```sql
SELECT cron.schedule(
  'trigger-nudges-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oqwgssdmrauhhiiaxryg.supabase.co/functions/v1/trigger-nudges',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

### Client Portal architecture

Two parallel systems coexist:

| System | Token source | Table | Used by |
|--------|-------------|-------|---------|
| Legacy | `client_portal_tokens` | `client_portal_tokens` | Existing invoice/proposal emails |
| Engagement | `engagements.portal_token` | `engagements` | New engagement portal |

`ClientPortalPage` at `/portal/:token` detects which system by checking `engagements` first, falls back to legacy. `LegacyClientPortal` component handles old tokens.

### Stripe Connect

Freelancers connect their own Stripe Express accounts via Settings → Payments. `portal-create-checkout` uses `payment_intent_data.transfer_data.destination` for destination charges when connected account is active. `PLATFORM_FEE_PERCENT` env var (unset = 0%) controls platform cut.

### Auth convention

Supabase users sign in with `username@miaoda.com` email convention (username = their chosen handle, domain is `miaoda.com`). Google + Apple OAuth also supported. Apple OAuth does NOT work from localhost.

---

## Pending Pre-Launch Items

| Item | Priority | Notes |
|------|----------|-------|
| **Subscription price** | **CRITICAL** | Change `unit_amount: 100` → `2900` (monthly) / `29000` (annual) in `supabase/functions/create-subscription-checkout/index.ts` |
| **Stripe webhook registration** | **CRITICAL** | Register `stripe-webhook` function URL in Stripe Dashboard as a webhook endpoint with its own signing secret. Also check: function uses `SUPABASE_SERVICE_KEY` env var — may need to be `SUPABASE_SERVICE_ROLE_KEY`. |
| **Resend SMTP in Supabase Auth** | **HIGH** | Supabase → Auth → SMTP: host `smtp.resend.com`, port 465, user `resend`, password = Resend API key. Without this, auth emails use Supabase default (rate-limited). |
| **pg_cron schedule** | **HIGH** | Enable pg_cron extension (Dashboard → Database → Extensions, goes in `pg_catalog`), enable pg_net (in `extensions` schema), then run the `cron.schedule` SQL above |
| **Storage bucket RLS** | **MEDIUM** | INSERT (authenticated) + SELECT (anon + authenticated) for `avatars` bucket |
| **Terms of Service page** | **MEDIUM** | `/terms` — linked from signup form but page doesn't exist |
| **Privacy Policy page** | **MEDIUM** | `/privacy` — linked from signup form but page doesn't exist |
| **Landing page hero screenshot** | **LOW** | Save dashboard screenshot to `public/dashboard-screenshot.png`, update `src` in `LandingPage.tsx` ~line 300 |
| **Apple OAuth secret renewal** | **RECURRING** | JWT expires ~Dec 2026. Regenerate using Ruby script with `AuthKey_3C7FJZM8WS.p8`. Team ID: `FF94K758F9`, Key ID: `3C7FJZM8WS` |

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Auth context | `src/contexts/AuthContext.tsx` |
| Shared business context | `src/contexts/CurrentBusinessContext.tsx` |
| Business hook (with pending_portal auto-save) | `src/hooks/useCurrentBusiness.ts` |
| Nudges hook | `src/hooks/useNudges.ts` |
| All domain types | `src/types/types.ts` |
| Services (DB access) | `src/services/` |
| Edge functions | `supabase/functions/` |
| Email templates | `supabase/functions/_shared/email-templates.ts` |
| Routes | `src/routes.tsx` |
| Navigation config | `src/config/navigation.ts` |
| Supabase client | `src/db/supabase.ts` |
| AppShell (root layout) | `src/components/shell/AppShell.tsx` |
| CommandBar | `src/components/shell/CommandBar.tsx` |
| AICopilot | `src/components/layouts/AICopilot.tsx` |
| BusinessBand (Update OS button) | `src/components/shell/BusinessBand.tsx` |
| ForgeflyBand (bell/notifications) | `src/components/shell/ForgeflyBand.tsx` |
| Landing page | `src/pages/LandingPage.tsx` |
| Preview page | `src/pages/GeneratedPortalPage.tsx` |
| Auth callback (saves pending_portal) | `src/pages/AuthCallbackPage.tsx` |
| Dashboard | `src/pages/DashboardPage.tsx` |
| Pipeline | `src/pages/PipelinePage.tsx` |
| Services / Packages | `src/pages/PackagesPage.tsx` |
| Calendar | `src/pages/CalendarPage.tsx` |
| Invoices | `src/pages/InvoicesPage.tsx` |
| Proposals | `src/pages/ProposalsPage.tsx` |
| Proposal requests inbox | `src/pages/RequestsPage.tsx` |
| Brand Kit | `src/pages/BrandKitPage.tsx` |
| Automations / Nudges | `src/pages/AutomationsPage.tsx` |
| Settings (4 tabs + AI History) | `src/pages/SettingsPage.tsx` |
| Client portal | `src/pages/ClientPortalPage.tsx` |
| Public portfolio | `src/pages/PublicPortfolioPage.tsx` |

---

## Supabase Project

- **Project ref:** `oqwgssdmrauhhiiaxryg`
- **Production URL:** `https://oqwgssdmrauhhiiaxryg.supabase.co`
- **Frontend production:** `https://www.forgefly.io`
- **Deploy edge function:** `npx supabase functions deploy <function-name>`

## Important Conventions

- Path alias `@` → `src/`
- Motion: `import { motion, ... } from 'motion/react'` (NOT `framer-motion`)
- Biome linter: no CommonJS `require`, no undeclared deps
- `cn()` from `src/lib/utils.ts` for conditional Tailwind classes
- ProposalStatus DB enum: `'draft' | 'sent' | 'accepted' | 'rejected'` (NOT `'approved'`)
- ProjectStatus DB enum: `'lead' | 'in_progress' | 'review' | 'completed' | 'archived'`
- Stripe API version: `'2025-08-27.basil'` (matches stripe@19.1.0)
- Email sends from: `hello@forgefly.io`, `billing@forgefly.io` (Resend, domain verified)
