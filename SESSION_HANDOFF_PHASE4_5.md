# Session Handoff — Phase 4 & 5
> Phase 3 complete. Load this file + FORGEFLY_HANDOFF_V2.md + CLAUDE.md + all memory files at the start of each new session.

---

## Phase 3 — What was completed (this session pair, 2026-06-08)

All 7 Phase 3 items from FORGEFLY_HANDOFF_V2.md are done.

| Step | File | Status |
|------|------|--------|
| useCurrentBusiness hook | `src/hooks/useCurrentBusiness.ts` | Done |
| DashboardPage wiring | `src/pages/DashboardPage.tsx` | Done |
| BusinessBand real data | `src/components/shell/BusinessBand.tsx` | Done |
| PackagesPage AI pre-pop | `src/pages/PackagesPage.tsx` | Done (full rewrite) |
| PipelinePage | `src/pages/PipelinePage.tsx` | Done (full rewrite) |
| BrandKitPage | `src/pages/BrandKitPage.tsx` | Done (full rewrite) |
| ProposalsPage AI template | `src/pages/ProposalsPage.tsx` | Done |
| CommandBar re-prompt flow | `src/components/shell/CommandBar.tsx` | Done |

### Critical fix from this session: realtime channel collision
`useCurrentBusiness` originally subscribed to a Supabase Realtime channel. When `BusinessBand` (always mounted) and `DashboardPage` both called the hook simultaneously, it threw:
> "cannot add postgres_changes callbacks for realtime:businesses:{uuid} after subscribe()"

**Fix:** Realtime subscription was removed from `useCurrentBusiness`. The hook now fetches once on mount via `fetchBusiness()`. Realtime will be added via a `CurrentBusinessContext` provider in Phase 4 (so the subscription runs exactly once in the tree, not per callsite).

### Key patterns established in Phase 3

**Save pattern** (all Phase 3 pages use this):
```typescript
await supabase.from('businesses')
  .update({ extracted_data: { ...extractedData, [section]: updatedSection } })
  .eq('id', business.id)
await refetch()
```

**CommandBar flow** (fully wired):
1. User submits prompt → `ai-gateway` called with `mode: 'extract'`, `current_data: extractedData`, `business_id`
2. Gateway returns `{ extracted_data: mergedData, sections_updated: string[] }`
3. Frontend computes diff lines (new services, changed metrics, updated identity, etc.)
4. `DiffConfirmModal` shown with `+`/`~` lines
5. On confirm → single write to `businesses.extracted_data` → `refetch()`

**Data source in Phase 3** (stopgap — migrate in Phase 4):
- `PipelinePage` reads/writes `extracted_data.pipeline.leads` (not the `pipeline_leads` table)
- `PackagesPage` reads/writes `extracted_data.services` (not the `services` table)
- This was intentional — avoids new migrations during Phase 3. Phase 4 wires real tables.

---

## Phase 4 — Client Portal

### Goal
Surface the freelancer's business publicly, let prospects request proposals, and rebuild the per-client portal around the `engagements` table.

### What already exists (do not rebuild)

| File | What it does |
|------|-------------|
| `src/pages/ClientPortalPage.tsx` (594 lines) | Per-client portal at `/portal/:token`. Tabs: Proposal (approve/decline), Invoice (Stripe checkout), Project (status). Powered by `portal_links` table (old architecture). Fully functional for existing users. |
| `supabase/functions/generate-portal-link/` | Generates a time-limited token linked to a `clients` record (old architecture). Used by InvoicesPage, ProposalsPage. |
| `supabase/functions/portal-approve-proposal/` | Client approves/declines proposal via token. Updates `proposals.status`. |
| `supabase/functions/portal-create-checkout/` | Creates Stripe Checkout for an invoice. Supports Stripe Connect destination charges. |
| `supabase/tables/engagements` | Already exists from migration 00010. Has `portal_token`, `contact_id`, `business_id`, `scope JSONB`, `status`. |

### New migration needed: `00011_add_proposal_requests.sql`

```sql
-- Proposal requests from public portfolio
CREATE TABLE proposal_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  company         TEXT,
  email           TEXT NOT NULL,
  service_name    TEXT,               -- matches extracted_data.services[].name
  problem         TEXT,               -- client's problem description
  timeline        TEXT,               -- e.g. "ASAP", "1–3 months"
  budget_flexible BOOLEAN DEFAULT false,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'drafted', 'sent', 'declined')),
  engagement_id   UUID REFERENCES engagements(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX proposal_requests_business_id_idx ON proposal_requests (business_id);
ALTER TABLE proposal_requests ENABLE ROW LEVEL SECURITY;

-- Freelancer can manage their own requests
CREATE POLICY "Users manage their own proposal requests"
  ON proposal_requests FOR ALL
  USING (auth.uid() = (SELECT user_id FROM businesses WHERE id = proposal_requests.business_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM businesses WHERE id = proposal_requests.business_id));

-- Public insert — anyone can submit a request (no auth required)
CREATE POLICY "Public can submit proposal requests"
  ON proposal_requests FOR INSERT
  WITH CHECK (true);

-- ─── nudges (Phase 5 but add now so pg_cron can be set up) ───────────────────
CREATE TABLE nudges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,  -- overdue_invoice | stale_lead | unsent_proposal | new_request
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  action_url  TEXT,           -- e.g. /dashboard/invoices
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX nudges_user_id_unread_idx ON nudges (user_id) WHERE read = false;
ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own nudges"
  ON nudges FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Run via Supabase Dashboard → SQL Editor.

### Step 20 — Public portfolio page `/p/:slug`

**File to create:** `src/pages/PublicPortfolioPage.tsx`

**Route to add in `routes.tsx`** (public, no AppShell):
```typescript
{ path: '/p/:slug', element: <PublicPortfolioPage />, public: true }
```

The `slug` is the freelancer's username (from `profiles.username`). Fetch `businesses` via a query like:
```typescript
const { data } = await supabase
  .from('businesses')
  .select('*, profiles!inner(username)')
  .eq('profiles.username', slug)
  .eq('status', 'active')
  .maybeSingle()
```
This requires a join — alternatively add a `slug` column to `businesses` (simplest).

**Page layout:**
- Header: brand `primaryColor` from `extracted_data.brand.primaryColor`, business name, tagline, niche
- Services grid: `extracted_data.services` (name, price, type badge, description)
- "Request a proposal" CTA → opens `ProposalRequestModal`

**ProposalRequestModal (inline component):**
- Fields: name, company, email (required), service selector chips (from `extracted_data.services`), problem description (textarea), timeline (Select: ASAP / 1–3 months / 3–6 months / 6+ months), budget_flexible (checkbox), notes (optional textarea)
- On submit: `POST /functions/v1/submit-proposal-request` (new edge function)
- Shows "Request sent!" confirmation

**Edge function to create:** `supabase/functions/submit-proposal-request/index.ts`
- No auth required (public endpoint — omit Authorization header check)
- Input: `{ business_id, name, company, email, service_name, problem, timeline, budget_flexible, notes }`
- Inserts row into `proposal_requests`
- Calls `send-email` with a new `new_request` template to the freelancer (get their email from `profiles` via `businesses.user_id`)
- Inserts a nudge row: `{ type: 'new_request', title: 'New proposal request', body: '${name} from ${company} wants to work with you on ${service_name}.' }`
- Returns `{ success: true }`

**Email template to add in `supabase/functions/_shared/email-templates.ts`:**
```typescript
export function getNewRequestEmailTemplate(data: {
  freelancerName: string
  clientName: string
  clientCompany: string
  serviceName: string
  dashboardUrl: string
}): EmailTemplate
```

---

### Step 21 — Proposal requests in dashboard

**File to create:** `src/pages/RequestsPage.tsx`

**Route:** `/dashboard/requests` — add to `routes.tsx` and `src/config/navigation.ts` (inside MORE_ITEMS).

Or alternatively, surface as a notification panel — see Step 22.

**Page layout:**
- List of `proposal_requests` for the current business, sorted by `created_at desc`
- Cards: client name, company, service, problem excerpt, timeline, date
- Status chip (new / drafted / sent / declined)
- "Draft proposal with AI" button on each `new` request

---

### Step 22 — Freelancer notifications + AI proposal draft

**ForgeflyBand bell badge** (`src/components/shell/ForgeflyBand.tsx`):
- Currently the bell icon is a non-functional button
- Add `useNudges` hook that fetches `SELECT count(*) FROM nudges WHERE user_id = auth.uid() AND read = false`
- Show red badge with count when > 0
- On click: open a Notifications panel (popover or sheet)

**`src/hooks/useNudges.ts`** (new hook):
```typescript
export function useNudges() {
  // fetches nudges for current user, unread first
  // exposes { nudges, unreadCount, markRead, markAllRead }
}
```

**Notifications panel** (simple popover from ForgeflyBand):
- List of nudges (title, body, time ago, action_url)
- "Mark all read" button
- Click on nudge → navigate to `action_url`, mark as read

**"Draft proposal with AI" button flow:**
When clicked on a proposal request:
1. Call `ai-gateway` with `mode: 'draft_proposal'` (new mode to add) OR use existing `mode: 'chat'` with a specific prompt
2. Pass: `request` data + `extracted_data.proposal` template + `extracted_data.services`
3. Gateway returns a draft proposal (title, introduction, services, deliverables, pricing estimate, timeline, terms)
4. Open the existing `CreateProposalModal` in `ProposalsPage` pre-filled with the draft
5. Freelancer reviews/edits and clicks Send

**Simplest implementation** (avoid new gateway mode): Just call `ai-gateway` with `mode: 'chat'` and a structured prompt, parse the response as a proposal draft. The copilot already returns structured JSON. This avoids touching the edge function.

---

### Step 23 — Per-client portal rebuild

**Approach:** The existing `ClientPortalPage.tsx` works for the old architecture. For Phase 4, add engagement-based portal support alongside it.

**Detection logic** in `ClientPortalPage.tsx`:
```typescript
// Try engagements table first (new architecture)
const { data: engagement } = await supabase
  .from('engagements')
  .select('*, contacts(*)')
  .eq('portal_token', token)
  .maybeSingle()

if (engagement) {
  // render new engagement-based portal
} else {
  // fall back to old portal_links based lookup (existing code)
}
```

**New engagement portal tabs:**
1. **Overview** — engagement summary, status, service name, key dates
2. **Proposal** — `engagement.scope.proposal` or linked `proposals` row. Approve / Request Changes buttons (call `portal-approve-proposal`).
3. **Invoice** — linked invoice, Pay button (calls `portal-create-checkout`)
4. **Messages** — simple async thread between freelancer and client. Store messages in a new `engagement_messages` table (or use `engagements.scope.messages` array as a Phase 4 stopgap).
5. **Project** — linked project status from `projects` table (optional — show if `engagement.scope.project_id` is set)

**For creating engagements:** When a freelancer drafts and sends a proposal from a proposal request:
1. Create a `contacts` row (from request data)
2. Create an `engagements` row (`contact_id`, `business_id`, `service_name`, `scope: { proposal: draft }`)
3. Send portal link via `send-email` with the `engagements.portal_token`
4. Mark `proposal_requests.status = 'sent'`, set `proposal_requests.engagement_id`

---

## Phase 5 — Retention

### What already exists

| File | Status |
|------|--------|
| `src/pages/AutomationsPage.tsx` | Replace entirely — manual rule builder, never wired, not tested |
| `src/pages/CalendarPage.tsx` | Keep and extend — already has synthetic project deadline events |
| `src/components/layouts/AICopilot.tsx` | Calls `ai-copilot` edge function (OpenAI). Migrate to `ai-gateway` chat mode. |
| `supabase/functions/ai-copilot/` | OpenAI GPT-4o edge function. Deprecate after AICopilot migration. |

### Step 24 — Nudge engine (replace AutomationsPage)

**Replace `AutomationsPage.tsx`** with a nudge history + settings page.

**New edge function:** `supabase/functions/trigger-nudges/index.ts`

Logic (runs nightly via pg_cron):
```typescript
// 1. Overdue invoices
const overdueInvoices = await supabase
  .from('invoices')
  .select('*, clients(*)')
  .lt('due_date', new Date().toISOString())
  .neq('payment_status', 'paid')

// 2. Stale pipeline leads (no update in 14 days)
const staleLeads = await supabase
  .from('pipeline_leads')
  .select('*, contacts(*)')
  .lt('updated_at', new Date(Date.now() - 14 * 86400000).toISOString())
  .neq('stage', 'Closed Won')

// 3. Unsent proposals (draft for > 7 days)
const unsentProposals = await supabase
  .from('proposals')
  .select('*')
  .eq('status', 'draft')
  .lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString())

// 4. New proposal requests (not yet actioned)
const newRequests = await supabase
  .from('proposal_requests')
  .select('*')
  .eq('status', 'new')
  .lt('created_at', new Date(Date.now() - 24 * 3600000).toISOString())

// For each hit: one Haiku call to generate nudge copy, insert into nudges table
```

**pg_cron setup** (run in Supabase SQL Editor):
```sql
SELECT cron.schedule(
  'daily-nudges',
  '0 9 * * *',           -- 09:00 UTC every day
  $$
  SELECT net.http_post(
    url := 'https://oqwgssdmrauhhiiaxryg.supabase.co/functions/v1/trigger-nudges',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**New `AutomationsPage.tsx`** (replace):
- Heading: "Nudges & Automations"
- Shows nudge history list from `nudges` table (last 30 days)
- Toggle cards for each nudge type (on/off): Overdue invoice reminder, Stale pipeline alert, Unsent proposal reminder, New proposal request alert
- Store preferences in `businesses.extracted_data.settings.nudges` or a new `business_settings` JSONB column

**`useNudges.ts`** hook wires the bell badge in ForgeflyBand (see Step 22).

---

### Step 25 — CalendarPage: wire invoice due dates

`src/pages/CalendarPage.tsx` already has synthetic project deadline events (events with `id.startsWith('project-')` are read-only). Extend this pattern for invoices.

**What to add:**
```typescript
// Synthetic invoice due date events (read-only, id starts with 'invoice-')
const syntheticInvoiceEvents = invoices
  .filter(inv => inv.due_date && inv.payment_status !== 'paid')
  .map(inv => ({
    id: `invoice-${inv.id}`,
    title: `Invoice Due: ${inv.client?.name ?? 'Unknown'} — $${inv.amount}`,
    start: inv.due_date,
    end: inv.due_date,
    type: 'deadline' as CalendarEventType,
    color: inv.payment_status === 'overdue' ? '#ef4444' : '#f59e0b',
  }))
```

Load invoices in `CalendarPage` (it doesn't currently load them). Use `getInvoices()` from `invoiceService`.

`isSyntheticInvoice(event)`: `event.id.startsWith('invoice-')` — read-only, click shows info modal with "Go to Invoices" link.

---

### Step 26 — AICopilot migration: OpenAI → Claude gateway

**File:** `src/components/layouts/AICopilot.tsx`

Currently calls: `supabase.functions.invoke('ai-copilot', { body: { message, currentPage } })`

Change to: `supabase.functions.invoke('ai-gateway', { body: { mode: 'chat', message, current_page: currentPage } })`

The `ai-gateway` chat mode already:
- Fetches the same business context (clients, projects, proposals, invoices, subscription, business)
- Returns `{ message, action, actionData, suggestions }` — same shape as `ai-copilot`
- Routes `open_command_bar` action correctly
- Uses Haiku for quick lookups, Sonnet for freeform

The `AICopilot.tsx` action handler already handles `navigate`, `create_proposal`, `create_invoice`, `show_forecast`, `upgrade_agency`, `open_command_bar`. No changes needed to the action handling code.

After migrating, the `ai-copilot` edge function can be left deployed but ignored (don't delete in case anything else calls it).

---

### Step 27 — Prompt session history in Settings

**`src/pages/SettingsPage.tsx`** — add a new "AI History" tab.

The `ai_usage_log` table already tracks every gateway call (model, prompt_type, tokens, cost_usd, created_at). Use this to show:
- List of recent AI calls (last 30)
- Columns: date, prompt_type, model, tokens, cost
- Total tokens + cost this month

The `prompt_sessions` table exists in the schema but the gateway doesn't currently write to it. Either:
1. Add `prompt` logging to `ai-gateway` `handleExtract` (insert into `prompt_sessions` with `prompt_text` and `diff_summary: { sections_updated }`)
2. Or just use `ai_usage_log` which already exists and is populated

Option 1 is better for user value (they can see what prompts they typed). Add to `ai-gateway` in the same session as Step 27.

---

## Architecture notes for Phase 4/5

### CurrentBusinessContext (add at Phase 4 start)

Before building Phase 4, create `src/contexts/CurrentBusinessContext.tsx`:

```typescript
// Wraps AppShell children. Provides business + extractedData to the whole app
// via a single subscription. Fixes the channel-collision problem permanently.
export const CurrentBusinessContext = createContext<UseCurrentBusinessResult>(...)

export function CurrentBusinessProvider({ children }) {
  const result = useCurrentBusiness()  // runs ONCE here
  return <CurrentBusinessContext.Provider value={result}>{children}</CurrentBusinessContext.Provider>
}

export function useBusiness() {
  return useContext(CurrentBusinessContext)
}
```

Then update: `BusinessBand`, `DashboardPage`, `PackagesPage`, `PipelinePage`, `BrandKitPage`, `ProposalsPage`, `CommandBar` — replace `useCurrentBusiness()` calls with `useBusiness()`. The hook only runs once; all pages share the same state.

Add `<CurrentBusinessProvider>` inside `AppShell.tsx` wrapping the children.

### Pipeline migration to real table (Phase 4)

In Phase 3, `PipelinePage` reads/writes `extracted_data.pipeline.leads`. In Phase 4:
- Sync `extracted_data.pipeline.leads` → `pipeline_leads` table on first load (upsert by name)
- `PipelinePage` reads from `pipeline_leads` (not `extracted_data`)
- Drag-and-drop writes to `pipeline_leads` directly (no more `extracted_data` write)
- `extracted_data.pipeline` is kept in sync via a DB trigger or a post-save sync call

### Services migration to real table (Phase 4)

Same pattern as pipeline. `PackagesPage` Phase 4 should:
- Sync `extracted_data.services` → `services` table on first load
- CRUD writes to `services` table directly
- Remove the AI services section from `PackagesPage` (it moves to a `ServicesPage` or stays as `PackagesPage` renamed)

### Don't touch these in Phase 4/5

- `InvoicesPage.tsx` — working fine, don't refactor
- `ProjectsPage.tsx` — delivery kanban, not related to Phase 4/5
- `ClientsPage.tsx` — old architecture `clients` table, leave for now
- `FinancesPage.tsx` — legacy, not in nav
- Auth flow (LoginPage, SignupPage, AuthCallbackPage) — all working
- Stripe Connect — fully wired, don't touch

---

## File map for Phase 4/5

### New files to create

| File | Purpose |
|------|---------|
| `src/pages/PublicPortfolioPage.tsx` | Public `/p/:slug` page with services + request CTA |
| `src/pages/RequestsPage.tsx` | Proposal requests inbox at `/dashboard/requests` |
| `src/contexts/CurrentBusinessContext.tsx` | Shared business state (single subscription) |
| `src/hooks/useNudges.ts` | Unread nudge count + nudge list |
| `src/hooks/useEngagement.ts` | Per-client portal data from `engagements` table |
| `supabase/functions/submit-proposal-request/index.ts` | Public form submit → `proposal_requests` + notify |
| `supabase/migrations/00011_add_proposal_requests.sql` | `proposal_requests` + `nudges` tables |

### Files to significantly modify

| File | What changes |
|------|-------------|
| `src/components/shell/ForgeflyBand.tsx` | Bell badge wired to `useNudges` unread count |
| `src/pages/ClientPortalPage.tsx` | Add engagement detection + new engagement-based portal |
| `src/pages/AutomationsPage.tsx` | Full replace with nudge history + settings |
| `src/pages/CalendarPage.tsx` | Add synthetic invoice due date events |
| `src/components/layouts/AICopilot.tsx` | Swap endpoint from `ai-copilot` to `ai-gateway` chat mode |
| `src/pages/SettingsPage.tsx` | Add "AI History" tab |
| `supabase/functions/ai-gateway/index.ts` | Add `prompt_sessions` logging in `handleExtract` |
| `src/routes.tsx` | Add `/p/:slug` and `/dashboard/requests` routes |
| `src/config/navigation.ts` | Add `requests` to MORE_ITEMS (with bell badge count) |
| `src/components/shell/AppShell.tsx` | Wrap with `CurrentBusinessProvider` |

---

## Pending items from earlier sessions (still open)

| Item | Notes |
|------|-------|
| Subscription price to production | Change `unit_amount: 100` → `2900`/`29000` in `create-subscription-checkout/index.ts` before launch |
| Stripe webhook registration | Register `stripe-webhook` in Stripe Dashboard with signing secret |
| Resend SMTP in Supabase Auth | host `smtp.resend.com`, port 465, user `resend`, password = Resend API key |
| Storage bucket RLS | INSERT (authenticated) + SELECT (anon+authenticated) for `avatars` bucket |
| Terms of Service + Privacy Policy | Signup links to them but pages don't exist |
| Apple OAuth secret renewal | JWT expires ~Dec 2026 — regenerate with `AuthKey_3C7FJZM8WS.p8` |
| Landing page hero image | Save screenshot to `public/dashboard-screenshot.png`, update src in LandingPage.tsx ~line 300 |
| `PLATFORM_FEE_PERCENT` env var | Optional — set in Supabase secrets for platform cut on client payments |

---

## Recommended Phase 4 session order

1. `CurrentBusinessContext` — fix channel-collision permanently, all pages share one subscription
2. Migration `00011` — `proposal_requests` + `nudges` tables (run in Supabase SQL Editor)
3. `PublicPortfolioPage` + route — public portfolio with services grid + proposal request modal
4. `submit-proposal-request` edge function + email template
5. `useNudges` hook + ForgeflyBand bell badge
6. `RequestsPage` — proposal requests inbox + "Draft with AI" flow
7. `ClientPortalPage` engagement extension — detect engagement token, render new tabs
8. Pipeline + Services migration to real tables (sync from `extracted_data` on first load)

Phase 5 can run as a separate session: nudge engine first, then copilot migration, then calendar extension.
