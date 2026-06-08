# Session Handoff — 2026-06-08
> Phase 1 Infrastructure complete. Load FORGEFLY_HANDOFF_V2.md + CLAUDE.md + all MEMORY.md files at the start of the next session.

---

## What was accomplished

Phase 1 (Infrastructure) from FORGEFLY_HANDOFF_V2.md is **fully complete**.
All 7 steps done. The app now has a clean AppShell replacing the old Sidebar nav.

---

## Pre-work fixes

### Fix 1 — Model ID corrected
`supabase/functions/ai-gateway/index.ts` line 14:
- Before: `const HAIKU = 'claude-haiku-4-5'`
- After: `const HAIKU = 'claude-haiku-4-5-20251001'`
- SONNET was already correct: `'claude-sonnet-4-6'`

### Fix 2 — sessionStorage key confirmed
The handoff doc (FORGEFLY_HANDOFF_V2.md) incorrectly states the key is `ff_pending_portal`.
The codebase uses `'pending_portal'` consistently across all three files:
- `LandingPage.tsx` (setItem)
- `GeneratedPortalPage.tsx` (getItem / removeItem)
- `AuthCallbackPage.tsx` (getItem / removeItem)
**Do not rename it.** The handoff doc is wrong; the code is correct.

---

## Files created

### Config & hooks
| File | Purpose |
|---|---|
| `src/config/navigation.ts` | NAV_ITEMS + MORE_ITEMS constants with `/dashboard/*` routes. Single source of truth for all nav — portable to React Native. |
| `src/hooks/useAppNavigation.ts` | Navigation abstraction over React Router. Exposes `navigateTo`, `currentRoute`, `isActive`, `activeNavId`. Swap one file to migrate to React Navigation on RN. |

### Supabase migration
| File | Purpose |
|---|---|
| `supabase/migrations/00010_add_business_scoped_tables.sql` | Creates `services`, `contacts`, `pipeline_leads`, `engagements` tables (all business_id-scoped). Adds `seed_prompt` to `businesses`. Adds nullable `business_id` + `contact_id` FKs to existing `invoices` table. All tables have RLS policies. Reuses `update_updated_at_column()` from 00009. **Must be run manually via Supabase Dashboard → SQL Editor.** |

### AppShell components (`src/components/shell/`)
| File | Purpose |
|---|---|
| `NavIcon.tsx` | Maps string icon IDs from navigation.ts to Lucide components |
| `ForgeflyBand.tsx` | Row 1 (32px): Forgefly wordmark left, bell + avatar-dropdown right. Avatar dropdown has Settings link + Sign out. |
| `BusinessBand.tsx` | Row 2 (48px): Business initials + name + tagline. "Update OS" button toggles CommandBar. Currently shows profile username as biz name placeholder — `useCurrentBusiness` wires real data in Phase 3. |
| `CommandBar.tsx` | Expandable textarea below BusinessBand. Enter submits, Escape closes. Gateway call + diff confirmation modal stubbed — wired in Phase 3 (useCommandBar hook). |
| `DesktopTabNav.tsx` | Row 3 (40px): icon-only tabs on md (768–1023px), icon+label on lg (1024px+). Hidden on mobile. Renders DesktopMoreDropdown at the end. |
| `DesktopMoreDropdown.tsx` | ⋯ dropdown from MORE_ITEMS. Highlights when a more-item route is active. |
| `MobileFooterNav.tsx` | Fixed footer (56px), visible on mobile only. 5 slots: Overview, Pipeline, Invoices, Clients, More(•••). |
| `MobileMoreSheet.tsx` | Bottom sheet triggered by More(•••). Contains: Services, Proposals, Brand Kit, Calendar, Settings. User row with avatar + sign out at bottom. Automations excluded on mobile (being replaced by nudge engine). |
| `AppShell.tsx` | Composes all shell components. Controls `moreOpen` state for MobileMoreSheet. Wraps children in `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` for consistent content width. Includes AICopilot. |

### Stub pages
| File | Purpose |
|---|---|
| `src/pages/PipelinePage.tsx` | Placeholder stub for `/dashboard/pipeline`. Full pre-sales CRM built in Phase 3. |
| `src/pages/BrandKitPage.tsx` | Placeholder stub for `/dashboard/brand`. Full brand kit built in Phase 3. |

---

## Files modified

| File | What changed |
|---|---|
| `supabase/functions/ai-gateway/index.ts` | HAIKU model ID fixed (see pre-work Fix 1) |
| `src/components/layouts/MainLayout.tsx` | Now just wraps AppShell around Outlet. Old Sidebar + AICopilot imports removed. 17 lines → 8 lines. |
| `src/config/navigation.ts` | Routes updated from flat (`/clients`, `/invoices`…) to `/dashboard/*` in step 7. |
| `src/routes.tsx` | All dashboard routes migrated to `/dashboard/*`. PipelinePage + BrandKitPage added. ProjectsPage + FinancesPage moved to `/dashboard/projects` and `/dashboard/finances`. Public routes unchanged. |
| `src/pages/PaymentSuccessPage.tsx` | `/invoices` → `/dashboard/invoices` (stale path fix) |
| `src/pages/PaymentCancelPage.tsx` | `/invoices` → `/dashboard/invoices` (stale path fix) |
| `src/components/shell/ForgeflyBand.tsx` | `/settings` → `/dashboard/settings` (stale path fix) |
| `src/components/layouts/AICopilot.tsx` | `/finances` → `/dashboard/finances` (stale path fix) |

---

## Architecture decisions made this session

- **`services` nav item routes to PackagesPage** — `PackagesPage` is the services catalog in the current codebase. The route is `/dashboard/services`. In Phase 3 when `ServicesPage` is built from `extracted_data.services`, `PackagesPage` will be retired or merged.
- **`contacts` table is separate from `clients`** — The existing `clients` table (user-scoped, Stripe-linked) stays intact for the current invoice/proposal flows. The new `contacts` table is business-scoped (businesses.id FK) and feeds the new pipeline CRM. They coexist during the transition.
- **Automations excluded from mobile More sheet** — It's being replaced by the nudge engine (Phase 5). No point surfacing it on mobile.
- **BusinessBand shows profile username as biz name placeholder** — `useCurrentBusiness` hook is a Phase 3 deliverable. BusinessBand uses `profile.username` until then. This is intentional, not a bug.
- **CommandBar is a UI stub** — The textarea and submit button exist and are interactive, but the actual gateway call + diff confirmation modal are wired in Phase 3 (`useCommandBar` hook). Submitting currently does nothing except close the bar after 400ms.
- **Content max-width is `max-w-7xl`** — Matches the landing page and GeneratedPortalPage exactly. Applied as a wrapper div inside AppShell's `<main>`. Pages don't need to manage their own width.

---

## Current route map

```
Public (no AppShell):
  /                    → LandingPage
  /login               → LoginPage
  /signup              → SignupPage
  /auth/callback       → AuthCallbackPage
  /preview             → GeneratedPortalPage
  /portal/:token       → ClientPortalPage

Protected (inside AppShell):
  /onboarding          → OnboardingPage
  /dashboard           → DashboardPage          ← Overview tab
  /dashboard/services  → PackagesPage            ← Services tab (Phase 3: replace)
  /dashboard/pipeline  → PipelinePage (stub)     ← Pipeline tab (Phase 3: build)
  /dashboard/invoices  → InvoicesPage            ← Invoices tab
  /dashboard/clients   → ClientsPage             ← Clients tab
  /dashboard/clients/:clientId → ClientsPage
  /dashboard/proposals → ProposalsPage           ← Proposals tab
  /dashboard/brand     → BrandKitPage (stub)     ← Brand Kit tab (Phase 3: build)
  /dashboard/calendar  → CalendarPage            ← More → Calendar
  /dashboard/automations → AutomationsPage       ← More → Automations
  /dashboard/settings  → SettingsPage            ← More → Settings
  /dashboard/projects  → ProjectsPage            ← Not in nav (delivery kanban)
  /dashboard/finances  → FinancesPage            ← Not in nav (legacy)
  /payment/success     → PaymentSuccessPage
  /payment/cancel      → PaymentCancelPage
```

---

## Pending actions before next session

1. **Run migration 00010** — paste `supabase/migrations/00010_add_business_scoped_tables.sql` into Supabase Dashboard → SQL Editor and run it. This is a prerequisite for Phase 3 hooks.
2. **Visual check** — run `pnpm dev` and verify the AppShell renders correctly on desktop (3 rows) and mobile (2 rows + footer tabs). Check that nav tab highlighting works as you navigate.
3. **Deploy ai-gateway** — `npx supabase functions deploy ai-gateway` to push the Haiku model ID fix to production.

---

## What's next: Phase 2 — Acquisition funnel

Steps from FORGEFLY_HANDOFF_V2.md:
1. Consolidate LandingPage — seed prompt as hero, generate-then-gate flow
2. PreviewPage rebuild — full 7-tab read-only portal, brand-colored theme (replacing GeneratedPortalPage)
3. sessionStorage pending-portal logic (key is `pending_portal` — confirmed correct)
4. AuthCallbackPage — add pending-portal check on OAuth return

Phase 2 does not touch the AppShell or any Phase 1 work.
