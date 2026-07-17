# CLAUDE.md — src/services/

Guidance specific to this directory. Read the root `CLAUDE.md`'s "Data layer" section first.

## Conventions

- **One file per domain**, named for the table/feature it owns (`clientService.ts` → `clients`, `invoiceService.ts` → `invoices`, etc.) — components never call `supabase.from(...)` directly, they go through a service function. If you're writing a `.from()` call inside a page/component, that logic belongs in a service file instead.
- **Ownership comes from the session, not from an argument.** Write functions don't take a `user_id`/`business_id` parameter to filter by — they rely on RLS (`auth.uid()`) to scope the row automatically, and reads similarly rely on RLS rather than an explicit `.eq('user_id', ...)` in most services. This mirrors the AI-to-database security boundary in the root CLAUDE.md: the owning id is never a value passed around, it's enforced at the RLS layer.
- **Realtime**: services that need live updates export a `subscribeTo*` function (e.g. `subscribeToClients`) wrapping a Supabase Realtime channel — check for an existing one before adding a polling loop for something that already has a subscription available.
- **`dashboardService.ts`** is the one cross-cutting exception to "one file per domain" — it's deliberately the single source of truth for every number the Dashboard shows, and Freeda's KPI-catalog answers (`freedaKpiCatalog.ts`) read from the exact same `loadOverviewData()` so a number Freeda states can never drift from what's on screen. Don't duplicate a metric calculation elsewhere; add it here and have both consumers read it.
- **`promotionService.ts` vs `socialService.ts`**: `socialService.ts` owns platform *connections* (OAuth status, competitor intel); `promotionService.ts` owns promotion *content* (drafts, publish orchestration). A connection-status question goes in the former, anything about a specific post/draft goes in the latter.
