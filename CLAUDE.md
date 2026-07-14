# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Run tests (watch mode)
pnpm test:ci      # Run tests with coverage (single run)
pnpm test:watch   # Run tests in watch mode
pnpm test:ui      # Run tests with Vitest UI
pnpm lint         # Full lint: type-check + biome + tailwind CSS check
pnpm type-check   # TypeScript type checking only
pnpm format       # Format with Prettier
```

To run a single test file:
```bash
pnpm vitest run src/test/stripe.test.ts
```

## Environment

Requires a `.env` file with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Supabase Edge Functions require secrets set server-side: `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`.

## Architecture

**Forgefly** is an AI-powered business OS for freelancers/solopreneurs. React 18 + TypeScript SPA with Supabase as the backend and Stripe for payments.

### Auth & routing

- `AuthContext` (`src/contexts/AuthContext.tsx`) manages Supabase session, user `Profile`, and `Subscription` (freelancer vs. agency tier). Authentication uses a `username@miaoda.com` email convention — users sign in with a username, not an email.
- `RouteGuard` (`src/components/common/RouteGuard.tsx`) redirects unauthenticated users to `/login`. Public routes are declared in `routes.tsx` via `public: true`.
- `App.tsx` splits routes into two groups: public routes render without a layout wrapper; protected routes render inside `MainLayout` (Sidebar + Outlet + AICopilot).

### Data layer

All DB access goes through `src/services/` — one file per domain (`clientService.ts`, `projectService.ts`, `invoiceService.ts`, `proposalService.ts`, `paymentService.ts`, `packageService.ts`, `calendarService.ts`). Services call Supabase directly via `src/db/supabase.ts`. Several services expose a `subscribeTo*` function using Supabase Realtime for live updates.

All domain types are in `src/types/types.ts` — `Client`, `Project`, `Invoice`, `Proposal`, `Payment`, `Package`, `CalendarEvent`, `Automation`, `Profile`, `BusinessProfile`.

### Supabase Edge Functions

Located in `supabase/functions/`, written in Deno/TypeScript:

| Function | Purpose |
|---|---|
| `ai-gateway` | Calls Anthropic's Claude (Sonnet/Haiku) with business context; powers Freeda (chat, business-data updates, proposal/outreach generation). `mode: 'freeda'` is the single entry point Freeda's UI calls — it routes every message through a 5-bucket intent classifier (`update`/`query`/`action`/`support`/`off_topic`) and dispatches to the matching handler. Returns structured JSON, tagged with `kind` matching the routed bucket |
| `create-invoice-checkout` | Creates a Stripe Checkout session for an invoice |
| `create-checkout-session` | Generic Stripe checkout |
| `create-subscription-checkout` | Stripe subscription checkout for agency tier |
| `verify-stripe-payment` | Verifies payment completion and updates DB |
| `stripe-webhook` / `subscription-webhook` | Handles Stripe webhook events |
| `send-email` | Sends transactional emails via `_shared/email-templates.ts` |
| `generate-portal-link` | Generates tokens for the client portal |

### Freeda (AI Copilot)

The `AICopilot` component (`src/components/layouts/AICopilot.tsx`) is the single Freeda surface — a resizable right-side panel, opened via the "Ask Freeda" button in `AppSidebar`. There used to be a second surface (a standalone "Upgrade my Business" command bar, `CommandBar.tsx`) for business-data updates; it was retired and merged into this panel so users only have one place to type anything — an update, a question, or a request to take an action.

It calls `ai-gateway`'s `mode: 'freeda'`, which routes the message and returns a `kind`-tagged response the panel renders differently per bucket, all inline within the same scrolling chat history:
- `update` → a diff card (`buildDiffLines`/`applyBusinessDiff` in `src/lib/businessDiff.ts`) with Dismiss/Apply — applying writes `extracted_data` and syncs new services/contacts into their own tables.
- `query` → either a live stat/list card sourced from `src/config/freedaKpiCatalog.ts` + `src/services/dashboardService.ts` (same data the Dashboard renders, so the numbers can't drift), or a freeform grounded answer if the question doesn't match a known KPI.
- `action` → a read-only proposal card (recipients + a drafted message). Sending is deliberately not wired up yet — see the security boundary section below.
- `support` / `off_topic` → a plain chat reply, rendered as markdown (`react-markdown`).

### AI-to-database security boundary — read before adding any AI-driven DB read/write/action

This applies to every current and future `ai-gateway` mode (`extract`, `chat`, and any query/action capability added later) and to any other code path where LLM output can influence a database read, write, or side-effecting action (sending a message, marking something paid, bulk operations, etc.).

**The LLM's output must only ever be treated as data (values to fill in), never as query logic (which table, which row, which operation).** Concretely:
- The owning `user_id` / `business_id` on any write must come from the authenticated session (e.g. `business.user_id` from `useBusiness()`), never from a field the model returned — even if the model's JSON contains a `user_id`-shaped field, application code must ignore it and hardcode the real one. See `applyBusinessDiff()` in `src/lib/businessDiff.ts` for the reference pattern.
- Every table touched by AI-influenced writes must have RLS scoped to `auth.uid()` (see `businesses`, `services`, `clients` policies) — this is the actual enforcement boundary, not app-code discipline alone.
- The model must never be allowed to construct or select raw SQL, table names, or target rows. `query` intent already follows this: `matchKpiCatalog()` in `ai-gateway` only ever returns a *catalog id*, never a computed value — the frontend fetches the live number itself via the same code the Dashboard uses. Any future open-ended query capability (beyond the fixed KPI catalog) needs the same shape: a fixed allow-list of pre-defined, parameterized functions the model can invoke, never raw SQL construction.
- Any action with a real-world side effect (sending a message/email, bulk operations, marking something paid) must render a review/confirm step before executing — never fire directly from a classified intent. `action` intent already does the "propose" half (`handleActionPropose` in `ai-gateway` returns a read-only recipient list + drafted message, never sends); the execute-after-confirm step is intentionally not built yet — do not wire a send button to fire directly without that explicit confirmation step existing server-side too.

This is what keeps prompt injection from becoming a database compromise. It does not come for free when adding new AI-driven capabilities — it has to be deliberately preserved each time.

### Subscription tiers

`isAgency` in `AuthContext` is `true` only when `subscription.tier === 'agency' && subscription.status === 'active'`. Agency-only features are gated behind this flag. The `UpgradeModal` component handles upsell prompts.

### UI

- Components in `src/components/ui/` are shadcn/ui primitives — treat them as library code.
- `src/components/common/` contains app-specific shared components.
- `src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge) used everywhere for conditional class merging.
- The `@` path alias resolves to `src/`.

### Linting rules

Biome (`biome.json`) enforces: no undeclared dependencies, no redeclare, no CommonJS (`require`). Formatter is disabled in Biome; Prettier handles formatting. The `lint` script also validates Tailwind CSS output and runs a build smoke test via `.rules/testBuild.sh`.
