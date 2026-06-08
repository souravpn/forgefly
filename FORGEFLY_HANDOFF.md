# Forgefly — Architecture & Product Handoff
> Generated from claude.ai brainstorming session. Load this at the start of each Claude Code CLI session.

---

## What Forgefly is

A SaaS business OS for freelancers and solopreneurs. The core differentiator: a **single natural-language prompt on the landing page generates a complete operational portal** — services catalog, sales pipeline, invoices, CRM contacts, proposal template, and brand kit — in one shot. No multi-step onboarding forms. No blank-slate setup.

Competitors (HoneyBook, Bonsai, Dubsado) require 3–5 hours of manual onboarding. Forgefly does it in 8 seconds from a paragraph.

---

## Economic model (never deviate from this)

- Sourav owns the Anthropic API key and absorbs all AI costs
- Freelancers pay Sourav a **fixed monthly SaaS fee** via Stripe
- Freelancer clients pay freelancers via **Stripe Connect** — entirely separate money flow, no AI involved
- AI (seed extraction, re-prompts, nudges) comes out of Sourav's margin
- Monthly charge must cover: Anthropic API costs per user + Stripe fees + infra + margin
- **Core ops (invoicing, pipeline drags, contact edits) use zero AI tokens** — pure DB reads/writes
- Projected AI cost per active user: **$0.02–$0.09/month** at current Sonnet/Haiku pricing
- At $19–29/month SaaS price, AI is under 0.5% of revenue per user; Stripe fees and infra dominate cost side

---

## Tech stack (confirmed)

- **Frontend:** React + Vite SPA, TypeScript, Tailwind, shadcn/ui
- **Auth:** Supabase Auth — Google OAuth working, `AuthCallbackPage.tsx` exists, `vercel.json` SPA rewrite in place
- **Backend:** Supabase (Postgres + Edge Functions)
- **Payments:** Stripe (SaaS fee) + Stripe Connect (freelancer → client)
- **Deploy:** Vercel + Cloudflare DNS
- **PWA:** Already implemented (`PWAInstallPrompt.tsx`)

---

## Current file tree (as of handoff)

Key pages confirmed to exist:
```
src/pages/
  LandingPage.tsx        # V1 — to be consolidated
  LandingPageV2.tsx      # V2 — pick winner, add seed prompt hero
  LoginPage.tsx
  SignupPage.tsx
  AuthCallbackPage.tsx   # needs pending-portal check added
  OnboardingPage.tsx     # to be repurposed as prompt history / biz settings
  DashboardPage.tsx      # needs command bar + AI-extracted metrics
  PackagesPage.tsx       # needs AI pre-population from extraction
  ProjectsPage.tsx       # delivery kanban only — todo/inprogress/review/done, per client
  CalendarPage.tsx       # needs invoice due dates + project deadlines wired
  ClientsPage.tsx
  ClientPortalPage.tsx   # client-facing portal — keep, differentiator
  InvoicesPage.tsx
  FinancesPage.tsx
  PaymentSuccessPage.tsx
  PaymentCancelPage.tsx
  ProposalsPage.tsx      # needs AI pre-population of template blocks
  AutomationsPage.tsx    # manual rule builder, untested — REPLACE with nudge engine
  SettingsPage.tsx

src/components/layouts/
  AICopilot.tsx          # chat panel, currently GPT-4o — migrate to Claude via gateway
  MainLayout.tsx
  Sidebar.tsx
```

Pages to **add**:
- `PipelinePage.tsx` — pre-sales CRM (leads/stages/deal value), separate from ProjectsPage
- `BrandKitPage.tsx` — colors, fonts, tone, keywords from extracted_data

---

## Database schema to build

```sql
-- Core business entity
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  status TEXT DEFAULT 'active', -- active | archived
  seed_prompt TEXT,
  extracted_data JSONB,          -- single source of truth for entire portal
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One active business per user enforced at DB level
CREATE UNIQUE INDEX one_active_biz_per_user
  ON businesses (user_id)
  WHERE status = 'active';

-- Every prompt that touched the business OS (audit trail + diff history)
CREATE TABLE prompt_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  prompt_text TEXT,
  prompt_type TEXT,   -- seed | additive | revision | scoped
  diff_summary JSONB, -- { services_added: 1, keywords_added: 2, ... }
  raw_output JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Track every AI call for cost monitoring
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  business_id UUID REFERENCES businesses(id),
  model TEXT,
  prompt_type TEXT,
  input_tokens INT,
  output_tokens INT,
  cost_usd NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Services extracted from prompt
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT,
  price TEXT,
  type TEXT,   -- project | retainer | hourly
  description TEXT,
  deliverables JSONB
);

-- CRM contacts
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT,
  company TEXT,
  role TEXT,
  status TEXT  -- Active client | Prospect | Past client
);

-- Pre-sales pipeline
CREATE TABLE pipeline_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  contact_id UUID REFERENCES contacts(id),
  stage TEXT,   -- Prospect | Qualified | Proposal Sent | Negotiating | Closed Won
  value TEXT,
  service_name TEXT
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  contact_id UUID REFERENCES contacts(id),
  number TEXT,
  amount TEXT,
  status TEXT,              -- Draft | Outstanding | Paid | Overdue
  due_date TIMESTAMPTZ,
  stripe_payment_id TEXT,   -- nullable until paid
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## The extracted_data JSON shape

This is the **single source of truth** stored in `businesses.extracted_data`. Every tab reads from this. One atomic write propagates to all tabs.

```jsonc
{
  "identity": {
    "name": "string",
    "businessName": "string",
    "initials": "string",      // 2 chars for avatar
    "tagline": "string",
    "location": "string",
    "niche": "string",
    "accentColor": "string"
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
    "leads": [{ "name": "string", "stage": "string", "value": "string", "service": "string" }]
  },
  "invoices": [
    { "client": "string", "service": "string", "amount": "string", "status": "string", "date": "string", "number": "string" }
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
    "primaryColor": "string",
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

All AI calls route through here. API key never leaves the server. Structure:

**Step 1 — Classifier (always Haiku, always first)**
```typescript
// Input: raw user prompt
// Output: routing JSON (~200 tokens, temp 0)
{
  prompt_type: "seed" | "additive" | "revision" | "scoped",
  complexity: "simple" | "medium" | "rich",
  token_estimate: number,
  sections_needed: string[],  // subset of 7 schema sections
  has_pricing: boolean,
  language: string
}
```

**Step 2 — Tier selection**
| Tier | Model | Condition | max_tokens | temp |
|------|-------|-----------|-----------|------|
| 1 | `claude-haiku-4-5-20251001` | simple or scoped | 600 | 0.2 |
| 2 | `claude-sonnet-4-6` | medium or additive | 1800 | 0.4 |
| 3 | `claude-sonnet-4-6` | rich or revision | token_estimate × 1.3 (max 2500) | 0.5 |

**Step 3 — Parallel fan-out for Tier 2/3**
- Call A: structural sections (identity, services, pipeline, invoices, contacts)
- Call B: creative sections (brand, proposal, tagline)
- Render structural tabs immediately, brand tab gets skeleton loader ~1s

**Step 4 — Diff mode for re-prompts**
For `additive` and `revision` types, pass current `extracted_data` as context. Ask Claude to return only the changed fields (diff object). Deep-merge into existing data — never overwrite.

**Safety rails:**
- Hard cap: `max_tokens = 2500` unconditionally
- Schema scoping: only include `sections_needed` fields in extraction system prompt
- On JSON parse failure: retry once with sections reduced to identity + services only
- Log every call to `ai_usage_log` before returning

---

## Acquisition flow (generate-then-gate)

1. User lands on `LandingPage` — sees large prompt textarea as hero element
2. Types business description, clicks "Generate my business OS"
3. `sessionStorage.setItem('ff_pending_portal', JSON.stringify({ prompt, timestamp: Date.now() }))`
4. Gateway called — portal renders fully in the page (7 tabs, all pre-populated)
5. User explores (10–30 seconds dwell, feels the value)
6. First save/edit action → auth modal fires: "Sign in to save your portal"
7. Google OAuth → redirects back to `AuthCallbackPage`
8. `AuthCallbackPage` checks `sessionStorage` for pending portal:
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

## Two interaction surfaces (do not merge these)

### Surface 1: Command bar
- Location: pinned strip below topbar, visible on all dashboard pages
- Visual weight: prominent, echoes landing page prompt
- Job: **change what the business IS** — add services, update pricing, pivot scope
- Output: runs classifier → extraction → diff → **confirmation step → write to extracted_data**
- User mental model: "This is my business identity layer"

### Surface 2: AICopilot panel (keep existing UI)
- Location: floating panel, corner trigger button
- Visual weight: secondary, assistant feel
- Job: **answer questions, draft content, quick actions** — does not write to extracted_data
- Output: conversational, ephemeral — user copies what they want
- If user asks copilot to update business identity → copilot says "Want me to add that to your business OS?" and hands off to command bar flow
- User mental model: "This is my smart assistant"

**Migration:** AICopilot.tsx currently calls GPT-4o. Swap to Supabase Edge Function. Keep UI identical. Inject `businesses.extracted_data` as system context. Route quick actions → Haiku, freeform chat → Sonnet.

---

## Global update propagation (how re-prompts work from any page)

When command bar fires from any page (e.g. user is on Invoices, types "I now offer wedding photography"):

1. Classifier runs — current page is metadata only, does NOT restrict update scope
2. Extraction runs in diff mode — returns only changed fields
3. **Confirmation step shown** — diff rendered before any write:
   ```
   + service   Destination Wedding Photoshoot · $500–$1,500
   + keyword   weddings, lifestyle photography (brand kit)
   + proposal  Service mentioned in intro section
   [Cancel]  [Apply to all tabs]
   ```
4. On confirm — single atomic write: `supabase.from('businesses').update({ extracted_data: merged })`
5. All tabs that read from `extracted_data` reflect change on next render — no cross-tab sync needed

**Scope classification:**
- "I also offer X" → global (services + proposals + brand + pipeline)
- "My price went up to $Y" → targeted (one field, toast confirm only)
- "I'm pivoting to enterprise only" → broad (all sections, full diff review)
- Copilot: "Draft a proposal for Acme" → ephemeral (no write to extracted_data)

---

## Save behavior by data type

| Data type | Behavior | Example |
|-----------|----------|---------|
| AI-generated profile data | Auto-save on blur | Services, brand kit, tagline |
| Operational records | Explicit confirm | Invoice creation, proposal send |
| Pipeline / CRM state | Auto-save with toast | Stage drag, contact status |
| extracted_data updates | Diff confirm step | Any command bar re-prompt |

---

## Pages: keep / improve / replace / add

| Page | Action | Notes |
|------|--------|-------|
| LandingPage.tsx + V2 | **Replace** | Consolidate into one. Seed prompt as hero. Generate-then-gate flow. |
| OnboardingPage.tsx | **Repurpose** | Retire auth-first onboarding. Repurpose as prompt session history view. |
| DashboardPage.tsx | **Improve** | Wire metrics to extracted_data. Add command bar. |
| PackagesPage.tsx | **Improve** | AI pre-populate services on first load. Auto-save on edit. |
| ProjectsPage.tsx | **Keep as-is** | Delivery kanban (todo/inprogress/review/done). Client FK. Do not conflate with pipeline. |
| ProposalsPage.tsx | **Improve** | Auto-fill intro/approach/why-us from extracted_data.proposal. |
| AutomationsPage.tsx | **Replace** | Scrap manual rule builder. Build DB-signal nudge engine. |
| CalendarPage.tsx | **Improve** | Wire invoice due dates + project deadlines as calendar events. |
| AuthCallbackPage.tsx | **Improve** | Add pending-portal sessionStorage check. |
| AICopilot.tsx | **Improve** | Migrate GPT-4o → Claude gateway. Keep UI. |
| PipelinePage.tsx | **Add** | New — pre-sales CRM. Separate from ProjectsPage. |
| BrandKitPage.tsx | **Add** | New — render brand section from extracted_data. |

---

## Nudge engine (replaces AutomationsPage)

Supabase pg_cron job, runs nightly. **Zero AI tokens for checks** — pure SQL:

```sql
-- Invoice overdue
SELECT * FROM invoices WHERE due_date < now() AND status != 'paid';

-- Pipeline stale (no stage change in 14 days)
SELECT * FROM pipeline_leads WHERE updated_at < now() - interval '14 days';

-- Proposal unsent
SELECT * FROM proposals WHERE created_at < now() - interval '7 days' AND status = 'draft';
```

Only when a check fires → one Haiku call (~$0.0003) to generate nudge copy.
Nudges surface in dashboard notification area and optionally email.

---

## Build order (priority)

### Phase 1 — Infrastructure (do first, everything depends on this)
1. `supabase/functions/ai-gateway/index.ts` — unified AI gateway, classifier + tier selection
2. DB migrations — businesses, prompt_sessions, ai_usage_log tables
3. Migrate AICopilot.tsx from GPT-4o → gateway (keep UI, swap engine)

### Phase 2 — Acquisition funnel
4. Consolidate landing pages + seed prompt hero + generate-then-gate flow
5. sessionStorage pending-portal logic
6. AuthCallbackPage pending-portal check on OAuth return

### Phase 3 — AI pre-population (visible value)
7. DashboardPage — wire extracted_data, add command bar strip
8. PackagesPage — AI pre-populate services
9. ProposalsPage — auto-fill template blocks
10. PipelinePage.tsx — new page, pre-sales CRM
11. BrandKitPage.tsx — new page, brand section

### Phase 4 — Retention
12. AutomationsPage → nudge engine (pg_cron + DB signals + Haiku copy)
13. CalendarPage — wire due dates and deadlines
14. Prompt session history UI in SettingsPage

---

## Key decisions made (do not relitigate)

- **One active business per user** enforced via Postgres partial unique index — not application logic
- **extracted_data is the single source of truth** — all tabs are views over this JSON
- **API key never in client** — all Claude calls go through Supabase Edge Function
- **AICopilot is read-mostly** — never silently writes to extracted_data; hands off to command bar flow for identity changes
- **ProjectsPage ≠ PipelinePage** — delivery tracking vs pre-sales CRM are different data models and different user mindsets
- **AutomationsPage is a full replace** — manual rule builder is untested, not plugged in; nudge engine is a different mental model
- **Parallel fan-out** for Tier 2/3 extraction — structural and creative sections run as two parallel calls, render structural first
- **Diff mode for re-prompts** — never full re-extraction on updates, always merge into existing extracted_data
- **Confirmation step before any extracted_data write** from command bar — user sees diff first

---

## Claude Code session tips

- Keep sessions scoped to one phase at a time
- Start each session by reading this file + CLAUDE.md + MEMORY.md
- Write a new handoff doc at the end of each session before closing
- Use `#` inline to add things to CLAUDE.md mid-session without interrupting flow
- Haiku for quick actions in gateway, Sonnet for extraction and chat — never swap these
- Add `ai_usage_log` inserts from day one — you need real cost data to price the SaaS tier correctly

