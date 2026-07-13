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
| `ai-gateway` | Calls Anthropic's Claude (Sonnet/Haiku) with business context; powers AI Copilot chat, proposal/outreach generation, and the Update-OS command bar. Returns structured JSON with an optional `action` for chat mode |
| `create-invoice-checkout` | Creates a Stripe Checkout session for an invoice |
| `create-checkout-session` | Generic Stripe checkout |
| `create-subscription-checkout` | Stripe subscription checkout for agency tier |
| `verify-stripe-payment` | Verifies payment completion and updates DB |
| `stripe-webhook` / `subscription-webhook` | Handles Stripe webhook events |
| `send-email` | Sends transactional emails via `_shared/email-templates.ts` |
| `generate-portal-link` | Generates tokens for the client portal |

### AI Copilot

The `AICopilot` component (`src/components/layouts/AICopilot.tsx`) is a resizable right-side panel, opened via the "AI Copilot" button in `AppSidebar`. It calls the `ai-gateway` Edge Function (chat mode), which fetches live business context (clients, projects, proposals, invoices, subscription) and passes it to Claude. Responses include an optional `action` field (e.g., `navigate`, `create_proposal`) that the frontend handles.

### Subscription tiers

`isAgency` in `AuthContext` is `true` only when `subscription.tier === 'agency' && subscription.status === 'active'`. Agency-only features are gated behind this flag. The `UpgradeModal` component handles upsell prompts.

### UI

- Components in `src/components/ui/` are shadcn/ui primitives — treat them as library code.
- `src/components/common/` contains app-specific shared components.
- `src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge) used everywhere for conditional class merging.
- The `@` path alias resolves to `src/`.

### Linting rules

Biome (`biome.json`) enforces: no undeclared dependencies, no redeclare, no CommonJS (`require`). Formatter is disabled in Biome; Prettier handles formatting. The `lint` script also validates Tailwind CSS output and runs a build smoke test via `.rules/testBuild.sh`.
