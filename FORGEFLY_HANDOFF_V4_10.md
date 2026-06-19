# Forgefly — Session Handoff v4.10
> Covers work completed in the June 18, 2026 session (continuation).
> Load alongside FORGEFLY_HANDOFF_V4.md (in `/files`) + V4_1 through V4_9.

---

## What was completed this session

### Phase F — Toggl Integration (#57–#63)

All tasks complete. Native timer remains the default zero-setup path. Toggl is fully additive.

| # | Task | Status |
|---|---|---|
| 57 | `time_entries` schema amendment + `toggl_project_map` table (migration 00032) | ✅ Run |
| 58 | Toggl connect flow + token storage (`connect-toggl` Edge Function) | ✅ Done + deployed |
| 59 | Project mapping UI (Sheet, DB upsert to `toggl_project_map`) | ✅ Done |
| 60 | `sync-toggl-entries` Edge Function (pull last 7d, upsert idempotent) | ✅ Done + deployed |
| 61 | Nightly cron (migration 00033) + "Sync now" button + last-synced timestamp | ✅ Done |
| 62 | "Needs mapping" banner (amber, dismissible, re-shows after sync) | ✅ Done |
| 63 | Toggl source badge on entries + `source` added to timeService SELECT | ✅ Done |

### Bug fix — `togglUnmappedProjects` temporal dead zone

`togglUnmappedProjects` was declared in the late "Derived" section but referenced in a `useEffect` dependency array evaluated during render → TDZ crash.

**Fix:** Moved all five Toggl-derived consts (`togglExtracted`, `togglWorkspaceName`, `togglLastSyncedAt`, `togglUnmappedProjects`, `togglConnected`) to immediately after `useBusiness()` at the top of `FinancesPage`, before any hooks that reference them.

---

## Migrations run this session

| Migration | What it does | Status |
|---|---|---|
| 00032 | `source`/`external_id`/`synced_at` on `time_entries`; `toggl_project_map` table + RLS | ✅ Run |
| 00033 | pg_cron job for `sync-toggl-entries` at 03:00 UTC nightly | ✅ Run |

---

## Key files modified this session

| File | What changed |
|---|---|
| `supabase/functions/connect-toggl/index.ts` | NEW — actions: `connect` (verify token, store, return projects), `disconnect` (strip toggl_* keys), `fetch_projects` (re-fetch for "Manage mappings") |
| `supabase/functions/sync-toggl-entries/index.ts` | NEW — pulls last 7d from Toggl, resolves project names, upserts to `time_entries`. Manual (user JWT) or cron (service role) invocation. Persists `toggl_unmapped_projects` + `toggl_last_synced_at` to `extracted_data`. Auto-disconnects on 401/403. |
| `supabase/migrations/00032_toggl_schema.sql` | NEW — `time_entries` columns + `toggl_project_map` table |
| `supabase/migrations/00033_toggl_sync_cron.sql` | NEW — nightly cron via pg_cron + pg_net |
| `src/pages/FinancesPage.tsx` | Toggl connect/disconnect/sync UI; mapping Sheet; unmapped banner; "Sync now" button with last-synced relative timestamp; TDZ bugfix (derived Toggl consts moved to top of component) |
| `src/services/timeService.ts` | Added `source, external_id, synced_at` to SELECT constant |
| `src/types/types.ts` | Added `source`, `external_id`, `synced_at` to `TimeEntry`; removed stale duplicate `TimeEntry` declaration (had wrong `entry_date` column name) |

---

## Toggl integration — architecture decisions to carry forward

- **Token storage:** `businesses.extracted_data.toggl_token` — encrypted at rest in Postgres, never returned to browser after initial paste
- **No OAuth:** Toggl's static API token is sufficient; no redirect flow, no refresh tokens
- **Sync is pull-only:** Never write back to Toggl at MVP
- **Idempotent upsert:** `(business_id, external_id)` unique index — re-running never creates duplicates
- **Unmapped projects:** surfaced via `extracted_data.toggl_unmapped_projects` array; never silently discarded
- **Token revoked:** 401/403 from Toggl → auto-clears all `toggl_*` keys from `extracted_data` (clean disconnect)
- **Source-agnostic profitability:** `getProjectTimeSummaries` queries by `business_id` only — native + Toggl hours sum identically
- **`@souravpn/toggl-mcp`** (Sourav's MCP server): for Claude-in-conversation Toggl access, NOT for the headless sync. Future use: enrich `ai-copilot` context with live Toggl data.

---

## What is next: Phase G — Onboarding + Overview redesign (#64–#75)

**Full spec: `FORGEFLY_OUTREACH_SPEC.md §16` (in `/files`)**
**Summary in: `FORGEFLY_HANDOFF_V4.md` pp. 507–564 (in `/files`)**

Estimated ~13 days. This is the highest-leverage phase remaining — it's what a new freelancer sees first.

### Core principle (do not relitigate)
No wizard. No progress bar. No tutorials. Onboarding is a **suggested path** — every step skippable, resumable, completable out of order. Empty states are invitations with action buttons, not zeroes.

---

### Schema additions needed (migration 00034)

```sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS onboarding_seen       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_milestones jsonb DEFAULT '{
    "services_reviewed": false,
    "portfolio_shared": false,
    "prospect_added": false,
    "proposal_sent": false
  }';

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  milestone     text NOT NULL,
  completed_at  timestamptz DEFAULT now(),
  skipped       boolean DEFAULT false
);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own onboarding_events"
  ON public.onboarding_events FOR ALL
  USING (business_id IN (
    SELECT id FROM public.businesses WHERE user_id = auth.uid()
  ));
```

**Milestone completion is always written by Edge Function — never client-side.**

| Milestone | Trigger |
|---|---|
| `services_reviewed` | Services page load + dwell > 10s (client beacon) OR any services edit saved |
| `portfolio_shared` | Share modal copy/share action |
| `prospect_added` | `pipeline_leads` INSERT for this `business_id` |
| `proposal_sent` | `proposals` status UPDATE → `'sent'` |

---

### Build order — #64–#75

| # | Task | Effort | Depends on |
|---|---|---|---|
| 64 | No-business landing page (layout, seed prompt, 3 demo cards) | 1.5d | auth flow |
| 65 | Demo card live generation flow (seed inject → 400ms → auto-generate → "Customise" CTA) | 1d | #64 |
| 66 | Generation animation — text steps + artifact previews (real extracted data) | 2d | existing generation flow |
| 67 | Brand color extraction at step 1 (Haiku call → recolor UI immediately) | 0.5d | #66 |
| 68 | Ambient morphing CSS shape (clip-path, brand color, low opacity) | 0.5d | #67 |
| 69 | Reveal beat (350ms stillness → portal spring-slides up) | 0.5d | #66 |
| 70 | Migration 00034 — `onboarding_seen` + `onboarding_milestones` + `onboarding_events` | 0.5d | businesses table |
| 71 | Milestone card component + completion logic (Edge Functions write) | 1.5d | #70 |
| 72 | Overview page redesign — 6 containers + empty states | 2.5d | all data sources |
| 73 | Quick win AI nudge (Haiku, daily re-evaluation, priority ordering) | 1d | #72, notifications |
| 74 | [+] button + grouped action dropdown | 0.5d | #72 |
| 75 | Visibility deferral logic (trigger after portfolio share OR account age > 3d) | 0.5d | #71 |

**Parallel start:** #64 + #70 can begin simultaneously. Then #65 + #66 in parallel. Then #67 + #68 + #69 in parallel. Then #71 + #72 in parallel. Then #73 + #74 + #75 in parallel.

---

### Key spec details per task

#### #64 — No-business landing page
Replaces full app shell for users with no active business. Minimal chrome: logo top-left, sign-out top-right — nothing else. Three demo cards (PacUX / Baked by Clara / Frost & Co. CPA) look like real portal previews — avatar initials, business name, tagline, service pills. No card says "demo" or "example."

#### #65 — Demo card flow
On card click: seed field populates → 400ms pause (types in) → generation starts automatically → on completion CTA becomes **"Customise this for you →"** (not "Claim →"). Collapses "see what it does" and "make it mine" into one gesture.

#### #66 — Generation animation (4 layers)
1. **Text steps** — sequential: pending (gray hollow circle) → active (brand color pulsing dot) → complete (checkmark)
2. **Artifact previews** — right column, each step completion fades in a real data card: business name/tagline, service pills, brand palette (4 swatches), proposal stub, pipeline column labels, portal preview miniature
3. **Brand color** — extracted by Haiku at step 1, immediately applied to ambient shape, step indicators, UI accents. Screen recolors to match their business before any content appears.
4. **Ambient shape** — slowly morphing CSS `clip-path` animation in brand primary color at low opacity. Not a spinner. Never loops identically.

#### #67 — Brand color extraction
Haiku call fires at generation step 1. Returns `{ primary_color: "#hex" }`. Applied immediately to ambient shape + step dot + button accent. This is the first thing the user sees that belongs to their business.

#### #69 — Reveal beat
When all steps complete: 350ms stillness (all checkmarks + all previews visible). Then full portal preview slides up from bottom with spring ease. Generation screen fades behind it. Ambient shape transitions into portal background. **The stillness is intentional — makes the reveal feel earned.**

#### #71 — Milestone card (§16e)
Lives in container 3 (Quick win position) during active onboarding. One suggested action at a time. No step numbers. No progress bar. No percentage. Always has "skip for now" text link. Five milestones: business created (auto-complete) → services reviewed → portfolio shared → prospect added → proposal sent. Out-of-order completion OK. On all complete: card disappears — no announcement, no congratulations. Container 3 becomes permanent AI nudge slot.

#### #72 — Overview page redesign (§16f)
Six containers in 2×3 grid (single column mobile). Predictive revenue graph removed entirely.

| Container | Question answered | Key data |
|---|---|---|
| 1. Cash position | How much money do I have? | Received this month, outstanding invoices, tax-aside estimate |
| 2. Needs attention | What's waiting on me? | Unread messages, viewed proposals, overdue invoices — max 4, ranked by urgency, inline action per item |
| 3. Quick win | What should I do next? | Milestone card (onboarding) → AI nudge (Haiku, daily) |
| 4. Active work | What am I working on? | Active projects, status dots, due date ⚠ within 5 days |
| 5. Pipeline momentum | Is new work coming in? | Prospects/proposals/conversion this month + 2 active leads |
| 6. Upcoming | What's coming up? | Tax dates, project deadlines, proposal expiry, invoice due dates — max 5, chronological |

Empty state copy is human and specific, not generic:
- "All clear. Nothing needs your attention right now. Enjoy it while it lasts."
- "No prospects yet. Add someone you'd love to work with — even a long shot counts."

#### #73 — Quick win AI nudge
Haiku call, context injected: recent activity, pipeline state, tax dates, days since last proposal, visibility kit status, days since last client contact. Nudge priority order: tax urgency > overdue client action > pipeline stall > financial insight > visibility. Refreshes daily. One nudge at a time.

#### #74 — [+] button
Top-right of Overview header. Dropdown grouped by visual divider (no text group headers):
- Get new work: + New prospect, + New proposal
- Manage clients: + New client, + New project
- Get paid: + New invoice
- Stay organized: + New service, + New event, + New automation

Each item navigates to the relevant page with creation modal pre-opened.

#### #75 — Visibility deferral
`onboarding_seen = true` is set on auth callback (first landing). Visibility kit is NOT surfaced immediately after generation. Enters Quick win slot after: portfolio link first shared OR account age > 3 days. Copy: "Ready to get your first client? Let's make you visible →". Never a forced navigation, always a suggestion.

---

## Architecture decisions to carry forward

### Carried from prior sessions
- `business_id` is canonical scope key — `user_id` is for RLS only
- Never JOIN `auth.users` in RLS — use `auth.uid()` only
- Radix dialog null-guard: `{state && <Content>}` inside Dialog/Sheet/AlertDialog
- DB trigger SECURITY DEFINER for cross-role writes
- Functional `setState(current => ...)` in realtime handlers
- Email is fire-and-forget (`invoke(...)` without `await`)
- Radix Portal renders OUTSIDE React tree — use direct computed values, not CSS vars, for DropdownMenuContent
- Milestone completion always written by Edge Function — never client-side

### From Phase F (Toggl)
- OAuth token: encrypted, scoped per `business_id`, never plaintext in browser after initial paste
- Never auto-create Forgefly projects from unmapped Toggl projects
- Never write back to Toggl at MVP (pull only)
- Sync is idempotent — upsert on `(business_id, external_id)` unique index
- "Needs mapping" queue: always surfaced, never silent discard

---

## Standing pending items (carried forward)

| Item | Where / How |
|---|---|
| Verify cron jobs | Dashboard → Database → Cron Jobs: `send-daily-digest`, `archive-inactive-contacts`, `sync-toggl-entries` |
| Resend SMTP | Dashboard → Auth → SMTP: `smtp.resend.com:465`, user `resend`, pw = Resend API key |
| Stripe subscription price | `create-subscription-checkout`: change `unit_amount: 100` → `2900` |
| Stripe webhook | Register `stripe-webhook` endpoint URL in Stripe Dashboard |
| Terms + Privacy pages | Linked from signup, not yet created |
