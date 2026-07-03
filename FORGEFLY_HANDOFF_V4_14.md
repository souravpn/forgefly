# Forgefly Handoff — V4.14
**Date:** 2026-07-03
**Branch:** main
**Previous handoff:** FORGEFLY_HANDOFF_V4_13.md (unified AI surface, dashboard analytics, pipeline scroll fix, client badges — all committed + migration 00037 run)

---

## What changed this session (all uncommitted — 23 files, see `git status`)

### 1. Pipeline "Add Lead" — client picker (`PipelinePage.tsx`)

The Add Lead modal's free-text name field is now a real client picker:
- Toggle between **Existing client** (dropdown of all `clients`) and **New client** (inline form matching the Clients page's Add Client modal — name, email, company, phone, avatar, notes).
- Existing pick resolves/creates a matching `contacts` row without duplicating the client.
- New pick creates both the `clients` row and the `contacts` row.
- Edit mode is unchanged (still a plain name field).

### 2. Invoices moved into Finances as a tab

- `FinancesPage.tsx` gained an **Invoices** tab that renders the existing `InvoicesPage` component in place (no logic duplicated).
- `/dashboard/invoices` now redirects to `/dashboard/finances?tab=invoices` (old links/bookmarks still work) — see `routes.tsx`.
- Removed the standalone Invoices entry from `AppSidebar.tsx` (`PROJECT_NAV`) and `config/navigation.ts` (`NAV_ITEMS`).
- Updated every internal `navigate('/dashboard/invoices'...)` call site: `DashboardPage.tsx`, `ProposalsPage.tsx`, `CalendarPage.tsx`, `PaymentSuccessPage.tsx`, `PaymentCancelPage.tsx`.
- `InvoicesPage.tsx`'s own `?action=new` handler now preserves other query params (like `tab`) instead of wiping them.

### 3. "Pipeline" renamed to "Leads" (including the URL)

- Route moved `/dashboard/pipeline` → `/dashboard/leads`; old path now redirects (`routes.tsx`, name `'Pipeline (legacy)'`).
- Nav labels updated everywhere: `AppSidebar.tsx` (`PROJECT_NAV`), `config/navigation.ts`, `MobileFooterNav.tsx` (`FOOTER_IDS`).
- User-facing copy updated: `PipelinePage.tsx` heading + empty-state text, `DashboardPage.tsx` ("Lead momentum" card, "Open leads"), `MilestoneCard.tsx` ("Open Leads"), `OutreachKitPage.tsx` ("Lead card" tab, "Add to leads"), `NoBusinessPage.tsx` onboarding preview mockup.
- `PipelinePage.tsx` component/file name intentionally left as-is (only the route/labels changed) — low priority rename if wanted later.

### 4. New sidebar tab: "Project" (placeholder)

- New `ProjectPage.tsx` — one dashed card: *"Coming soon. This will be atomic projects that are part of either a lead, proposal, or standalone."*
- Route `/dashboard/project`; added to `AppSidebar.tsx` (`PROJECT_NAV`, after Finances) and `config/navigation.ts` (`NAV_ITEMS`, so it's reachable in `MobileMoreSheet.tsx` too via `SECONDARY_IDS`).
- New `layers` icon added to `NavIcon.tsx`.

### 5. New sidebar tab: "Social" (placeholder, after Public Portfolio)

- New `SocialPage.tsx` — one dashed card: *"Coming soon. This is going to keep track of all your social commerce side — including social storefronts, listening, updates, sentiment check, etc."*
- Route `/dashboard/social`; rendered as its own `NavLink` right after the "Public Portfolio" button in both `AppSidebar.tsx` (desktop) and `MobileMoreSheet.tsx` (mobile "More" sheet), not looped in with the other nav arrays — matches how Public Portfolio itself is special-cased.
- Added to `config/navigation.ts` `MORE_ITEMS` (for `activeNavId` highlighting) but filtered out of `MobileMoreSheet`'s generic loop so it only appears in the one hand-placed spot.
- New `share2` icon added to `NavIcon.tsx`.

### 6. Brand kit secondary color as app background + glass panels (`AppShell.tsx`, `AppSidebar.tsx`)

- The business's `extracted_data.brand.secondaryColor` is now applied as the root app background (falls back to `bg-muted/60` if unset).
- The **left sidebar** and the **main content column** (the two persistent panels either side of the color) are now near-transparent (`bg-*/10` + `backdrop-blur-md`) with `shadow-lg` so the color shows through while staying legible.
- Iterated once already on user feedback: originally the floating AI Copilot/Update-OS overlay was made transparent instead of the content column (wrong target) — that overlay is back to fully opaque since it's a transient popup, not one of the two main panels. If the blur/shadow strength still isn't right, that's a quick tweak in `AppShell.tsx` (search `backdrop-blur-md`).

### 7. Dashboard "Upcoming" widget bug fix (`DashboardPage.tsx`)

- Root cause: the widget only ever pulled project deadlines, invoice due dates, and proposal expirations — it never queried `calendar_events` at all, so any calendar event was invisible there (separate bug from the Calendar page's own working sidebar widget).
- Added a `calendar_events` query (from now onward, next 15) merged into the same sorted `upcoming` list, each item showing time + client name, linking to `/dashboard/calendar`.
- Added a header line under "Upcoming" showing today's day + date.

### 8. Portal "not linked to your account" bug (proposal → new client)

Root cause chain in `ProposalsPage.tsx`:
- New-client creation via raw `.from('clients').insert(...)` was missing `user_id` (required column) and the error was silently swallowed → `clientId` ended up `null`.
- Separately, `engagements.contact_id` (FK into `contacts`) was being set to a **`clients.id`** instead — wrong table entirely, in both `handleSendClientDraft` and `handleSendEmail`.
- Fix: added `resolveContactId()` helper (finds-or-creates the correct `contacts` row) used everywhere `engagements.contact_id` is set; fixed the `clients` insert to include `user_id` and surface errors.
- Gave the user a one-off SQL script to backfill the specific already-broken engagement/contact link (not applied by me — user has the script, run status unconfirmed).

### 9. Proposal-approved-but-freelancer-saw-nothing bug

Two more bugs found in the same legacy `engagements` path once a client approves via the portal:
- `portal-approve-proposal` (edge function, legacy `engagementId` branch) compared `proposals.client_id` (→ `clients`) directly against `engagement.contact_id` (→ `contacts`) — different ID spaces, so the `UPDATE` never matched and the proposal's status never flipped to `accepted`. Fixed to match by `business_id + client_email (+ title)` instead, mirroring the newer `proposalId`-based branch. Also added the missing in-app `nudges` + `notifications` inserts (the legacy branch only ever sent an email, and only if `RESEND_API_KEY` was set).
- `ClientPortalPage.tsx`'s legacy `handleSendMessage`/`handleRequestChanges` only stamped `engagement_id` on new messages; the freelancer's `MessagesPage.tsx` filters strictly by `business_id`. Now both also stamp `business_id`/`client_id` so they show up in the inbox.
- Gave the user a one-off SQL backfill script for the specific already-approved proposal + already-sent message (Freeda Freeman case) — run status unconfirmed.
- **Needs deploying:** `supabase functions deploy portal-approve-proposal` (edge function isn't covered by the frontend build/typecheck).

### 10. Universal lead + client tracking for every proposal-creation path

Per explicit ask: *any* proposal — freelancer-initiated or external-lead-initiated — should now always end up with a tracked Leads card and a `clients` row if the client is new. Added to `ProposalsPage.tsx`:
- `resolveClientId()` — finds-or-creates the `clients` row.
- `resolveContactId()` — now tolerates a null/missing email (previously required one).
- `ensureLeadStage(businessId, contactId, serviceName, minStage)` — creates a pipeline lead if missing, advances it if behind `minStage`, **never regresses** a lead that's further along or already closed. Stage ranking: `Prospect < Qualified < Contacted < Proposal Sent < Negotiating < Closed Won/Lost`.

Wired into all four freelancer-side flows:
| Flow | Behavior |
|---|---|
| `handleWizardGenerate` (AI wizard, new proposal) | ensures client (if new) + contact + lead at `Prospect` on creation |
| `handleSubmitForm` (manual create/edit, existing clients only) | ensures lead at `Prospect` |
| `handleSendClientDraft` (send AI-drafted proposal) | ensures/advances lead to `Proposal Sent` at send time |
| `handleSendEmail` (send existing/manual proposal) | same, plus backfills a missing `client_id` if the proposal was never linked to a `clients` row |

Also fixed `supabase/functions/submit-proposal-request/index.ts` (external/client-initiated portal requests) — previously only looked up an *existing* client and left `client_id` null forever for anyone new; now creates the `clients` row too. Pipeline-lead creation here was already correct.
**Needs deploying:** `supabase functions deploy submit-proposal-request`.

**Not done:** proposals created *before* this fix aren't retroactively backfilled (no lead card / client row for old orphaned ones). Offered to write a one-off backfill script if wanted — not yet requested.

---

## Pending / not yet done

- [ ] **Commit all uncommitted changes** (23 files — `tsc --noEmit` and `vite build` both pass; only pre-existing `biome` organize-imports notices, not new)
- [ ] **Deploy 2 edge functions:** `portal-approve-proposal`, `submit-proposal-request` (code changed, not yet deployed)
- [ ] **Run 2 one-off SQL backfills given to user** (status unconfirmed):
  - Link/grant fix for the specific broken engagement (`portal_token = '65bd9b34de483e3f'`) — contact link + `engagement_access` grant
  - Backfill for Freeda's already-approved proposal + already-sent message (status, messages `business_id`/`client_id`, nudge/notification)
- [ ] **DB webhook for `schedule-review-request`** — SQL command given (pg_net trigger, mirrors `00033_toggl_sync_cron.sql`); Dashboard-UI alternative also given; run status unconfirmed (carried forward from V4.13)
- [ ] Confirm blur/shadow strength on the transparent panels reads well in practice (only eyeballed via description, not a live browser session)
- [ ] Old proposals/engagements created before the Section 8/9/10 fixes may still have broken links — not retroactively fixed except the two specific one-off cases above
- [ ] Phase I still not specced (carried forward from V4.13)

---

## Architecture snapshot (this session's additions/moves)

```
src/
  pages/
    ProjectPage.tsx             ← NEW placeholder, /dashboard/project
    SocialPage.tsx              ← NEW placeholder, /dashboard/social
    PipelinePage.tsx            ← now "Leads" (route /dashboard/leads), + client picker in Add Lead
    FinancesPage.tsx            ← now has an "Invoices" tab (renders InvoicesPage)
    ProposalsPage.tsx           ← resolveClientId/resolveContactId/ensureLeadStage helpers;
                                   every send/create path now tracks Leads + Clients correctly
    DashboardPage.tsx           ← "Upcoming" now includes calendar_events + today's date header
    ClientPortalPage.tsx        ← legacy message inserts now stamp business_id/client_id
  components/shell/
    AppShell.tsx                ← brand secondaryColor as bg; sidebar + content column transparent/blurred
    AppSidebar.tsx              ← PROJECT_NAV +project; Social NavLink after Public Portfolio
    MobileMoreSheet.tsx         ← +project in SECONDARY_IDS; Social rendered after Public Portfolio
    MobileFooterNav.tsx         ← FOOTER_IDS updated (leads/finances replace pipeline/invoices)
    NavIcon.tsx                 ← +layers, +share2
  config/navigation.ts          ← +project, +social; -invoices; pipeline→leads
  routes.tsx                    ← +/dashboard/project, +/dashboard/social;
                                   /dashboard/pipeline and /dashboard/invoices now legacy redirects
supabase/functions/
  portal-approve-proposal/index.ts   ← legacy branch: correct proposal match, +nudges/notifications
  submit-proposal-request/index.ts   ← now creates a `clients` row for new client requests
```

---

## Load alongside

- `FORGEFLY_HANDOFF_V4_13.md` — unified AI surface, dashboard analytics, pipeline scroll fix, client badges (all committed, migration run)
- `FORGEFLY_HANDOFF_V4_12.md` — Phase H full context (reviews, testimonials, brand kit, public portfolio)
- All prior handoffs `V4_1` through `V4_11` in `/files`
