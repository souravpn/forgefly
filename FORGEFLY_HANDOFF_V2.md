# Forgefly — Full Architecture & Product Handoff v2
> Supersedes FORGEFLY_HANDOFF.md. Load this at the start of every Claude Code CLI session.
> Read this file completely before touching any code.

---

## What Forgefly is

A SaaS business OS for freelancers and solopreneurs. Core differentiator: a single
natural-language prompt on the landing page generates a complete operational portal —
services catalog, sales pipeline, invoices, CRM contacts, proposal template, and brand
kit — in one shot. No multi-step onboarding forms.

Competitors (HoneyBook, Bonsai, Dubsado) require hours of manual setup.
Forgefly does it in ~10 seconds from a paragraph.

---

## Economic model (never deviate from this)

- Sourav owns the Anthropic API key and absorbs all AI costs
- Freelancers pay Sourav a fixed monthly SaaS fee via Stripe
- Freelancer clients pay freelancers via Stripe Connect — separate money flow, no AI
- AI (seed extraction, re-prompts, nudges, copilot) comes out of Sourav's margin
- Monthly charge must cover: Anthropic API costs + Stripe fees + infra + margin
- Core ops (invoicing, pipeline drags, contact edits) use ZERO AI tokens — pure DB
- Projected AI cost per active user: $0.02–$0.09/month at current pricing
- At $19–29/month SaaS price, AI is under 0.5% of revenue per user

---

## Tech stack (confirmed)

- Frontend: React + Vite SPA, TypeScript, Tailwind, shadcn/ui
- Auth: Supabase Auth — Google OAuth, AuthCallbackPage.tsx exists
- Backend: Supabase (Postgres + Edge Functions + pg_cron)
- Payments: Stripe (SaaS fee) + Stripe Connect (freelancer → client)
- Deploy: Vercel + Cloudflare DNS
- PWA: Already implemented (PWAInstallPrompt.tsx)
- Future: React Native mobile app (App Store) — architecture must support this

---

## React Native migration preparedness (do this now, costs nothing)

Forgefly will move to React Native / native mobile app in a future version.
Every decision made now must avoid locking the codebase to DOM-only patterns.

### Rules to follow in every file written:

**Rule 1 — Business logic in hooks, never in page components**
All Supabase queries, AI gateway calls, and derived state live in custom hooks.
Page components only render. Hooks are fully portable to React Native.

```tsx
// CORRECT
function PipelinePage() {
  const { leads, isLoading, moveStage } = usePipeline()
  return <PipelineBoard leads={leads} onMove={moveStage} />
}

// WRONG — query in component, not portable
function PipelinePage() {
  const [leads, setLeads] = useState([])
  useEffect(() => { supabase.from('pipeline_leads').select('*')... }, [])
  return <PipelineBoard leads={leads} />
}
```

**Rule 2 — Navigation config as a constant, not hardcoded in components**
All nav items live in `src/config/navigation.ts`. Both web and future RN consume it.

```ts
// src/config/navigation.ts
export const NAV_ITEMS = [
  { id: 'overview',   label: 'Overview',   icon: 'layout-dashboard', route: '/dashboard' },
  { id: 'services',   label: 'Services',   icon: 'package',          route: '/dashboard/services' },
  { id: 'pipeline',   label: 'Pipeline',   icon: 'chart-arrows',     route: '/dashboard/pipeline' },
  { id: 'invoices',   label: 'Invoices',   icon: 'receipt',          route: '/dashboard/invoices' },
  { id: 'clients',    label: 'Clients',    icon: 'users',            route: '/dashboard/clients' },
  { id: 'proposals',  label: 'Proposals',  icon: 'file-text',        route: '/dashboard/proposals' },
  { id: 'brandkit',   label: 'Brand Kit',  icon: 'palette',          route: '/dashboard/brand' },
] as const

export const MORE_ITEMS = [
  { id: 'calendar',   label: 'Calendar',      icon: 'calendar',   route: '/dashboard/calendar' },
  { id: 'automations',label: 'Automations',   icon: 'bolt',       route: '/dashboard/automations' },
  { id: 'settings',   label: 'Settings',      icon: 'settings',   route: '/dashboard/settings' },
] as const
```

**Rule 3 — useAppNavigation hook, not direct React Router calls in components**

```ts
// src/hooks/useAppNavigation.ts
import { useNavigate, useLocation } from 'react-router-dom'

export function useAppNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  return {
    navigateTo: (route: string) => navigate(route),
    currentRoute: location.pathname,
    isActive: (route: string) => location.pathname.startsWith(route),
  }
}
// React Native version: swap useNavigate for useNavigation() from @react-navigation/native
// Everything consuming useAppNavigation() migrates in one file change
```

**Rule 4 — Page components are layout-ignorant**
Pages never know what wraps them. No nav, no chrome, no shell logic inside a page.
AppShell wraps everything. Pages just render their content.

**Rule 5 — No inline styles or DOM-specific APIs in business logic**
`document.cookie`, `localStorage`, `window.*` calls stay in web-specific utility files,
never in hooks or page components. Use a `storageAdapter` abstraction if needed.

---

## Application shell architecture

Replace the current SidebarProvider-based layout with a clean AppShell.
The existing `sidebar.tsx` shadcn component is NOT used for navigation anymore.
Keep it in the codebase — the Sheet primitive inside it powers MobileMoreSheet.

### File structure for the new shell

```
src/
  config/
    navigation.ts           ← NAV_ITEMS, MORE_ITEMS constants
  components/
    shell/
      AppShell.tsx           ← root layout wrapper, composes all chrome
      ForgeflyBand.tsx       ← row 1: logo, bell, settings, avatar (always visible)
      BusinessBand.tsx       ← row 2: biz identity + command bar trigger
      DesktopTabNav.tsx      ← row 3 desktop: horizontal tabs + ⋯ dropdown (md+)
      MobileFooterNav.tsx    ← mobile: footer tab bar with 5 primary items (sm only)
      MobileMoreSheet.tsx    ← mobile: bottom sheet for secondary nav (sm only)
      DesktopMoreDropdown.tsx← desktop: dropdown from ⋯ tab (md+)
      CommandBar.tsx         ← the re-prompt strip (lives in BusinessBand)
```

### AppShell.tsx structure

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <ForgeflyBand />          {/* always: 32px, muted bg */}
      <BusinessBand />          {/* always: 48px, business identity + cmd trigger */}
      <DesktopTabNav />         {/* hidden on mobile (< 768px) */}
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <MobileFooterNav />       {/* visible on mobile only */}
      <MobileMoreSheet />       {/* mobile sheet, toggled by MobileFooterNav */}
    </div>
  )
}
```

### Three-row chrome layout (desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│ ROW 1 — ForgeflyBand (32px, bg-secondary)                       │
│ [Forgefly logo]                    [🔔] [⚙] [avatar]           │
├─────────────────────────────────────────────────────────────────┤
│ ROW 2 — BusinessBand (48px)                                     │
│ [BizAvatar] [Business name]               [✨ Update OS]        │
│             [Tagline · location]                                 │
├─────────────────────────────────────────────────────────────────┤
│ ROW 3 — DesktopTabNav (38px)                                    │
│ [Overview] [Services] [Pipeline] [Invoices] [Clients] [...]     │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile layout

```
┌──────────────────────────────────────┐
│ ROW 1 — ForgeflyBand (28px)          │
│ [Forgefly]               [🔔] [av]   │
├──────────────────────────────────────┤
│ ROW 2 — BusinessBand (42px)          │
│ [BizDot] [Name]          [✨]        │
│          [Sub]                       │
├──────────────────────────────────────┤
│                                      │
│   page content                       │
│   (pb-16 to clear footer nav)        │
│                                      │
├──────────────────────────────────────┤
│ FOOTER — MobileFooterNav (52px)      │
│ [Home] [Pipeline] [Invoices]         │
│        [Clients]  [• • •]            │
└──────────────────────────────────────┘
```

### Mobile footer tab allocation (5 slots)

Primary (always in footer): Home, Pipeline, Invoices, Clients, More(•••)
Secondary (in More sheet): Services, Proposals, Brand Kit, Calendar, Settings

### More bottom sheet content (mobile)

- Drag handle at top
- Business chip with "Switch business" affordance
- Nav items: Services, Proposals, Brand Kit, Calendar, Settings
- Divider
- User row: avatar, name, email, logout icon

### Desktop ⋯ dropdown content

- Calendar
- Notifications (with badge count)
- Settings
- Divider
- Switch business

---

## Breakpoints

```
sm  < 768px   → mobile layout (footer nav + bottom sheet)
md  768–1023px → desktop layout, tab labels icon-only (no text)
lg  ≥ 1024px  → desktop layout, full icon + label tabs
```

Tailwind classes to use:
- `hidden md:flex` for DesktopTabNav
- `flex md:hidden` for MobileFooterNav
- `pb-16 md:pb-0` on main content (clears footer nav height on mobile)

---

## Database schema to create

Run these migrations in order:

```sql
-- 1. Core business entity
CREATE TABLE businesses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT,
  status       TEXT DEFAULT 'active', -- active | archived
  seed_prompt  TEXT,
  extracted_data JSONB,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- One active business per user — enforced at DB level
CREATE UNIQUE INDEX one_active_biz_per_user
  ON businesses (user_id)
  WHERE status = 'active';

-- 2. Prompt session audit trail
CREATE TABLE prompt_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  prompt_text  TEXT,
  prompt_type  TEXT, -- seed | additive | revision | scoped
  diff_summary JSONB,
  raw_output   JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 3. AI usage tracking (critical for cost monitoring)
CREATE TABLE ai_usage_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id),
  business_id  UUID REFERENCES businesses(id),
  model        TEXT,
  prompt_type  TEXT,
  input_tokens  INT,
  output_tokens INT,
  cost_usd     NUMERIC(10,6),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. Services
CREATE TABLE services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT,
  price        TEXT,
  type         TEXT, -- project | retainer | hourly
  description  TEXT,
  deliverables JSONB,
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 5. Contacts / CRM
CREATE TABLE contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT,
  company      TEXT,
  role         TEXT,
  email        TEXT,
  status       TEXT, -- Active client | Prospect | Past client
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 6. Pre-sales pipeline (separate from projects)
CREATE TABLE pipeline_leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES contacts(id),
  stage        TEXT, -- Prospect | Qualified | Proposal Sent | Negotiating | Closed Won
  value        TEXT,
  service_name TEXT,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 7. Invoices
CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id        UUID REFERENCES contacts(id),
  number            TEXT,
  amount            TEXT,
  status            TEXT, -- Draft | Outstanding | Paid | Overdue
  due_date          TIMESTAMPTZ,
  stripe_payment_id TEXT, -- nullable until paid
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 8. Client engagements (per-client portal scope)
CREATE TABLE engagements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES contacts(id),
  portal_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  service_name TEXT,
  status       TEXT, -- proposal_sent | active | completed | cancelled
  scope        JSONB, -- scoped extracted data for this client
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 9. Enable updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pipeline_leads_updated_at
  BEFORE UPDATE ON pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER engagements_updated_at
  BEFORE UPDATE ON engagements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## extracted_data JSON shape

This is the single source of truth stored in `businesses.extracted_data`.
Every dashboard tab is a view over this JSON. One atomic write propagates everywhere.

```jsonc
{
  "identity": {
    "name": "string",
    "businessName": "string",
    "initials": "string",       // 2 chars for avatar
    "tagline": "string",
    "location": "string",
    "niche": "string",
    "accentColor": "string"     // hex, drives UI theme on preview page
  },
  "services": [
    {
      "name": "string",
      "price": "string",
      "type": "project|retainer|hourly",
      "description": "string",
      "deliverables": ["string"]
    }
  ],
  "pipeline": {
    "stages": ["Prospect","Qualified","Proposal Sent","Negotiating","Closed Won"],
    "leads": [
      { "name": "string", "stage": "string", "value": "string", "service": "string" }
    ]
  },
  "invoices": [
    {
      "client": "string", "service": "string", "amount": "string",
      "status": "string", "date": "string", "number": "string"
    }
  ],
  "metrics": {
    "monthlyRevenue": "string",
    "activeClients": "number",
    "pipelineValue": "string",
    "avgProjectValue": "string"
  },
  "contacts": [
    { "name": "string", "company": "string", "role": "string", "status": "string" }
  ],
  "proposal": {
    "intro": "string",
    "approach": "string",
    "whyUs": "string",
    "nextSteps": ["string"]
  },
  "brand": {
    "primaryColor": "string",   // hex
    "secondaryColor": "string",
    "accentColor": "string",
    "fonts": { "heading": "string", "body": "string" },
    "tone": "string",
    "keywords": ["string"]
  }
}
```

---

## AI gateway architecture

### Supabase Edge Function: `supabase/functions/ai-gateway/index.ts`

ALL AI calls route through here. API key never touches the client.
Insert into `ai_usage_log` on every call — day one, no exceptions.

### Step 1 — Classifier (Haiku, temp 0, max_tokens 250, always first)

```typescript
const classifierCall = {
  model: "claude-haiku-4-5-20251001",
  max_tokens: 250,
  temperature: 0,
  system: `You are a routing classifier. Analyse the user prompt and return ONLY valid JSON.
No preamble, no markdown. Schema:
{
  "prompt_type": "seed"|"additive"|"revision"|"scoped",
  "complexity": "simple"|"medium"|"rich",
  "token_estimate": number,
  "sections_needed": string[],  // subset of: identity,services,pipeline,invoices,contacts,proposal,brand
  "has_pricing": boolean,
  "language": string,           // BCP-47 e.g. "en-US"
  "target": "business"|"engagement"  // business = global update, engagement = per-client scope
}`,
  messages: [{ role: "user", content: userPrompt }]
}
```

### Step 2 — Tier selection

| Tier | Model | When | max_tokens | temp |
|------|-------|------|-----------|------|
| 1 | claude-haiku-4-5-20251001 | simple or scoped | 600 | 0.2 |
| 2 | claude-sonnet-4-6 | medium or additive | 1800 | 0.4 |
| 3 | claude-sonnet-4-6 | rich or revision | token_estimate × 1.3 (hard cap 2500) | 0.5 |

### Step 3 — Parallel fan-out (Tier 2 and 3)

Split into two parallel calls:
- Structural: identity, services, pipeline, invoices, contacts
- Creative: brand, proposal, tagline

Render structural tabs immediately. Brand Kit tab gets skeleton loader.

### Step 4 — Diff mode for re-prompts

For additive and revision: pass current `extracted_data` as context.
Ask Claude to return ONLY changed fields as a diff object.
Deep-merge diff into existing data. Never full re-extraction on updates.

### Step 5 — Write target

- `target: "business"` → write to `businesses.extracted_data` (global, all tabs)
- `target: "engagement"` → write to `engagements.scope` (scoped to one client)

### Safety rails

- Hard cap: `max_tokens = 2500` unconditionally
- Schema scoping: only include `sections_needed` in extraction system prompt
- On JSON parse failure: retry once with sections reduced to identity + services
- Log every call to `ai_usage_log` before returning response

### AICopilot routing

- Freeform chat queries → Sonnet
- Quick action chips → Haiku
- Inject `businesses.extracted_data` as system context
- Copilot is READ-MOSTLY: never silently writes to extracted_data
- If user asks copilot to update business identity → copilot responds:
  "Want me to add that to your business OS?" → hands off to command bar flow

---

## Acquisition flow (generate-then-gate)

1. User lands on LandingPage — large prompt textarea as hero CTA
2. Types business description, clicks "Generate my business OS"
3. Store: `sessionStorage.setItem('ff_pending_portal', JSON.stringify({ prompt, timestamp: Date.now() }))`
4. Gateway called — portal renders on /preview page (7 tabs, all pre-populated)
5. User explores portal (10–30 seconds dwell)
6. First save/edit action → auth modal: "Sign in to save your portal"
7. Google OAuth → redirects to AuthCallbackPage
8. AuthCallbackPage checks sessionStorage:

```typescript
const pending = sessionStorage.getItem('ff_pending_portal')
if (pending) {
  const { prompt, timestamp } = JSON.parse(pending)
  if (Date.now() - timestamp < 86_400_000) { // 24h expiry
    sessionStorage.removeItem('ff_pending_portal')
    // save to businesses table, redirect to /dashboard
  }
}
```

---

## Preview page (/preview)

No auth required. Reads from sessionStorage. If missing/expired → redirect to /.
Full 7-tab portal, all data read-only.
Brand color from `extracted_data.brand.primaryColor` drives the UI theme.
Save gate: persistent pill in topbar top-right (not a bottom CTA).
On any edit intent → auth modal fires.

Tabs: Overview | Services | Pipeline | Invoices | Contacts | Proposals | Brand Kit

Overview tab content:
- 4 metric cards (revenue, clients, pipeline, avg project)
- Left col: recent invoices (3 rows, status badges)
- Right col: hot pipeline leads (3 rows, stage badges)

Brand Kit tab layout (2 columns):
- Left: color swatches, typography, tone, keywords
- Right: live preview strip (client portal header + invoice header using brand colors)

---

## Two interaction surfaces

### Surface 1 — Command bar (BusinessBand, always visible)

Visual weight: prominent, echoes landing page prompt.
Job: change what the business IS.
Output: classifier → extraction → diff → confirmation step → write to extracted_data.
User mental model: "This is my business identity layer."

Flow on submit:
1. Classifier runs (Haiku, free)
2. Extraction runs in diff mode
3. Confirmation modal shown with diff:
   ```
   + service   Destination Wedding Photoshoot · $500–$1,500
   + keyword   weddings, lifestyle photography (brand kit)
   ~ avg. project value  $6,075 → $7,217
   [Cancel]  [Apply to all tabs]
   ```
4. On confirm → single atomic write to businesses.extracted_data
5. All tabs re-render from updated source of truth

### Surface 2 — AICopilot panel (floating, corner-triggered)

Visual weight: secondary, assistant feel.
Job: answer questions, draft content, run quick actions.
Output: conversational, ephemeral — nothing persists unless user acts on it.
Copilot never writes to extracted_data directly.
Quick actions: Haiku. Freeform chat: Sonnet.

---

## Client portal architecture

### Two separate surfaces

**Public portfolio** `/p/[slug]` — no auth, read-only
- Freelancer's brand, services, "Request a proposal" CTA
- Reads from businesses.extracted_data

**Per-client portal** `/portal/[token]` — auth-guarded (client signs in)
- Scoped to one engagement
- Tabs: Overview | Proposal | Invoice | Project | Messages
- Reads from engagements table
- Invoice tab has Stripe payment button (Stripe Connect)
- Messages tab is async thread between freelancer and client

### Proposal request flow

1. Client clicks "Request a proposal" on public portfolio
2. Form: name/company, service selector chips, problem description,
   timeline, budget flexibility, additional notes
3. On submit → notify freelancer (in-app + email)
4. Freelancer sees full request in dashboard with "Draft proposal with AI" button
5. AI drafts proposal from: client's request form data + businesses.extracted_data
6. Freelancer reviews, edits if needed, clicks "Send to [client]"
7. Email sent with unique portal link: `forgefly.io/portal/[token]`
8. Client signs in with Google → sees their portal

### Scope update propagation

When freelancer types update in command bar scoped to an engagement:
- Classifier detects `target: "engagement"`
- Diff applied to engagements.scope (not businesses.extracted_data)
- Confirmation modal shows what changes in the client portal
- On confirm: engagement record updated, client notified via portal message

---

## Save behavior by data type

| Data type | Behavior | Example |
|-----------|----------|---------|
| AI-generated profile data | Auto-save on blur | Services, brand kit, tagline |
| Operational records | Explicit confirm | Invoice creation, proposal send |
| Pipeline / CRM state | Auto-save with toast | Stage drag, contact status |
| extracted_data updates | Diff confirm modal | Any command bar re-prompt |
| Engagement scope updates | Diff confirm + client notify | Per-client scope change |

---

## Nudge engine (replaces AutomationsPage)

AutomationsPage.tsx is a manual rule builder — untested, not plugged in.
REPLACE entirely with DB-signal nudge engine.

Supabase pg_cron job, runs nightly. Zero AI tokens for checks — pure SQL:

```sql
-- Invoice overdue
SELECT * FROM invoices
WHERE due_date < now() AND status != 'paid';

-- Pipeline stale (no stage change in 14 days)
SELECT * FROM pipeline_leads
WHERE updated_at < now() - interval '14 days';

-- Proposal unsent (draft for > 7 days)
SELECT * FROM engagements
WHERE created_at < now() - interval '7 days' AND status = 'proposal_sent';
```

Only when a check fires → one Haiku call (~$0.0003) to generate nudge copy.
Nudges surface in dashboard notification area (bell badge) and optionally email.

---

## Pages: action per file

| Page file | Action | Notes |
|-----------|--------|-------|
| LandingPage.tsx + V2 | Replace/consolidate | Seed prompt as hero, generate-then-gate |
| PreviewPage.tsx | Create/rebuild | Full 7-tab portal, read-only, brand-colored |
| OnboardingPage.tsx | Repurpose | Prompt session history view in Settings |
| DashboardPage.tsx | Improve | Wire to extracted_data, no nav chrome in component |
| PackagesPage.tsx | Improve | AI pre-populate from extraction, auto-save |
| ProjectsPage.tsx | Keep as-is | Delivery kanban only, per-client, no change |
| ProposalsPage.tsx | Improve | Auto-fill from extracted_data.proposal |
| AutomationsPage.tsx | Replace | Scrap manual builder, build nudge engine |
| CalendarPage.tsx | Improve | Wire invoice due dates + project deadlines |
| AuthCallbackPage.tsx | Improve | Add pending-portal sessionStorage check |
| ClientPortalPage.tsx | Rebuild | Per-client /portal/[token] route, tabbed |
| PipelinePage.tsx | Create | New — pre-sales CRM, separate from projects |
| BrandKitPage.tsx | Create | New — brand section from extracted_data |

---

## Custom hooks to create

All data fetching and business logic lives here. Pages only render.

```
src/hooks/
  useAppNavigation.ts      ← navigation abstraction (RN-portable)
  useCurrentBusiness.ts    ← active business + extracted_data
  usePipeline.ts           ← pipeline leads, stage moves
  useInvoices.ts           ← invoices, status updates
  useContacts.ts           ← CRM contacts
  useServices.ts           ← services from extracted_data
  useProposals.ts          ← proposal templates
  useEngagement.ts         ← per-client portal data
  useCommandBar.ts         ← re-prompt flow state
  useNudges.ts             ← unread nudge count + list
  useAIGateway.ts          ← gateway call wrapper
```

---

## Build order (phases)

### Phase 1 — Infrastructure (do first, blocks everything else)

1. `src/config/navigation.ts` — NAV_ITEMS and MORE_ITEMS constants
2. `src/hooks/useAppNavigation.ts` — navigation abstraction
3. Supabase migrations — all tables from schema above
4. `supabase/functions/ai-gateway/index.ts` — classifier + tier + parallel fan-out
5. AppShell components — ForgeflyBand, BusinessBand, DesktopTabNav,
   MobileFooterNav, MobileMoreSheet
6. `src/components/shell/AppShell.tsx` — compose all shell components
7. Update `MainLayout.tsx` to use AppShell, retire SidebarProvider as nav wrapper
8. Update `routes.tsx` — nest dashboard routes under AppShell

### Phase 2 — Acquisition funnel

9. Consolidate LandingPage — seed prompt hero, generate-then-gate
10. PreviewPage.tsx — full 7-tab read-only portal, brand-colored theme
11. sessionStorage pending-portal logic
12. AuthCallbackPage — add pending-portal check on OAuth return

### Phase 3 — AI pre-population

13. useCurrentBusiness hook + businesses table wired
14. DashboardPage — wire metrics from extracted_data
15. CommandBar component — re-prompt flow with diff confirmation
16. PackagesPage — AI pre-populate services, auto-save
17. ProposalsPage — auto-fill template blocks
18. PipelinePage — new page, pre-sales CRM
19. BrandKitPage — new page, live preview strip

### Phase 4 — Client portal

20. Public portfolio route /p/[slug]
21. Proposal request form
22. Freelancer notification + AI proposal draft
23. Per-client portal /portal/[token] with all 5 tabs

### Phase 5 — Retention

24. Nudge engine — replace AutomationsPage, pg_cron + Haiku copy
25. CalendarPage — wire due dates and deadlines
26. AICopilot migration — GPT-4o → Claude gateway (keep UI, swap engine)
27. Prompt session history in Settings

---

## Key decisions (do not relitigate)

- One active business per user enforced via Postgres partial unique index
- extracted_data is the single source of truth — all tabs are views over this JSON
- API key never in client — all Claude calls go through Supabase Edge Function
- AICopilot is read-mostly — never silently writes to extracted_data
- ProjectsPage ≠ PipelinePage — delivery tracking vs pre-sales CRM, different tables
- AutomationsPage is a full replace — nudge engine is a different mental model
- Parallel fan-out for Tier 2/3 extraction — structural and creative run in parallel
- Diff mode for re-prompts — never full re-extraction, always merge
- Confirmation step before any extracted_data write — user sees diff first
- No hamburger menu anywhere — icon sidebar on desktop, footer tabs on mobile
- Nav items defined in navigation.ts constant — portable to React Native later
- Business logic in hooks — pages only render, hooks are RN-portable
- useAppNavigation abstraction — one file to swap for React Navigation later
- PWA now, native app later — architecture must support both without rewrite
- Brand color from extracted_data.brand.primaryColor drives preview page theme

---

## Session discipline for Claude Code

- Keep sessions scoped to one phase at a time
- Start each session: read this file + CLAUDE.md + MEMORY.md
- End each session: write a brief session log to MEMORY.md before closing
- When a decision is made mid-session, add it to CLAUDE.md with `#` inline
- Never mix Phase 1 infrastructure work with Phase 3 feature work in the same session
- If a session touches navigation.ts, always re-read it fully before editing

