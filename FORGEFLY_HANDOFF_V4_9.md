# Forgefly — Session Handoff v4.9
> Covers work completed in the June 18, 2026 session.
> Load alongside FORGEFLY_HANDOFF_V4.md (in `/files`) + V4_1 through V4_8.

---

## What was completed this session

### Phase E — Accounting + Time Tracking (#40–#56)

All tasks from the accounting/time tracking phase are now complete.

| # | Task | Status |
|---|---|---|
| 47 | Tax estimate engine + Tax tab (FinancesPage) | ✅ Done |
| 48 | Quarterly reminder nudges (trigger-nudges §5) | ✅ Done |
| 49 | `time_entries` migration + `timeService.ts` + `LogTimeDialog` (manual mode) | ✅ Done |
| 50 | Timer mode in `LogTimeDialog` (second tab, live elapsed, stop → auto-save) | ✅ Done |
| 51 | Project profitability card in `ProjectsPage` (hours, effective rate, budget bar) | ✅ Done |
| 52 | Post-project AI insight (section 6 in trigger-nudges, fires on complete, ≥3 baseline) | ✅ Done |
| 53 | Time tab in `FinancesPage` (KPIs, project breakdown, recent entries, Log time) | ✅ Done |
| 56 | Tax settings in `SettingsPage` → new "Finances" tab | ✅ Done |
| 54 | Year-end print-to-PDF report (`openPrintReport()` in FinancesPage) | ✅ Done |
| 55 | CSV exports + "Send to accountant" (base64 attachments via send-email) | ✅ Done |
| 45 | Contractor 1099-NEC threshold nudge (section 7 in trigger-nudges) | ✅ Done |

### Bug fix — completion score nudge banner

`getNudgeItems` in `DashboardPage.tsx` previously only generated items for `'low'` confidence fields. A user with all-medium fields (common for direct sign-ups) got score=50 but zero nudge items → banner silently hidden.

**Fix:** Extended `getNudgeItems` to produce softer-copy items for `'medium'` fields too:
- `low`: "Add pricing to your services"
- `medium`: "Confirm your service pricing" (softer, same route)

Same pattern applied to services, location, niche, brand. Items are `.sort((a,b) => a.priority - b.priority).slice(0, 3)`. `priority` field was already in the `NudgeItem` interface.

---

## Migrations run this session

| Migration | What it does | Status |
|---|---|---|
| 00031 | `time_entries` table + RLS + `hour_budget` on `projects` | ✅ Run by user in Supabase SQL editor |

> Note: `00031_time_entries.sql` does NOT yet have Toggl columns (`source`, `external_id`, `synced_at`). Those are added by task #57 in the next phase.

---

## Key files modified this session

| File | What changed |
|---|---|
| `src/pages/FinancesPage.tsx` | Tax tab (disclaimer + settings + breakdown + quarterly payments + SEP-IRA), Time tab (KPI cards, project breakdown, recent entries, LogTimeDialog), Export tab (PDF + CSV + send-to-accountant), `toCsv`/`downloadCsv`/`buildIncomeCsv`/`buildExpenseCsv`/`buildMileageCsv` helpers, `openPrintReport()`, `handleSendToAccountant()` |
| `src/pages/ProjectsPage.tsx` | Profitability mini-card per project card (hours, effective rate, budget Progress bar), clock icon → LogTimeDialog pre-set to that project, `loadProjectHours()` on mount |
| `src/pages/SettingsPage.tsx` | New "Finances" tab between Payments and Client Portal; `taxFilingStatus`, `taxHomeOfficeSqft`, `taxPriorYearLiability` state; `handleSaveTaxSettings()` writes to `businesses.extracted_data.tax_settings` |
| `src/pages/DashboardPage.tsx` | `getNudgeItems` extended — medium-confidence items added for pricing, services, location, niche, brand |
| `src/components/common/LogTimeDialog.tsx` | NEW — manual tab (project, date, hours, note) + timer tab (live elapsed, start/stop, stop<60s skipped) |
| `src/services/timeService.ts` | NEW — `getTimeEntries`, `getTimeEntriesByProject`, `createTimeEntry`, `updateTimeEntry`, `deleteTimeEntry`, `getProjectTimeSummaries` |
| `src/types/types.ts` | `hour_budget: number \| null` on `Project`; new `TimeEntry` interface (with `timer_started_at`, `timer_stopped_at`, joined `project`/`client`) |
| `supabase/functions/trigger-nudges/index.ts` | Added sections 5 (quarterly tax), 6 (post-project insight, Haiku), 7 (contractor threshold); `quarterlyDueDates()` helper; all 7 sections inside the `for (const biz of businesses)` loop |
| `supabase/functions/send-email/index.ts` | `accountant_export` case; `attachments` field passed through to Resend |
| `supabase/functions/_shared/email-templates.ts` | `getAccountantExportEmailTemplate()` added |

---

## What is next: Phase F — Toggl Integration (#57–#63)

**Full spec: `FORGEFLY_OUTREACH_SPEC.md §15` (in `/files`)**

Tasks #40–#56 are all done. The next feature block is Toggl sync — fully additive on top of the native timer just built. ~5.5 days.

### Core decision (do not relitigate)

Native timer stays the **default, zero-setup** path. Toggl is an **optional sync** for freelancers who already use it. The `time_entries` table is source-agnostic — profitability card, tax export, and AI insight work identically regardless of whether hours came from native or Toggl.

### Build order — #57–#63

| # | Task | Effort | Depends on |
|---|---|---|---|
| 57 | `time_entries` schema amendment + `toggl_project_map` table | 0.5d | 00031 already run |
| 58 | Toggl OAuth connection flow + encrypted token storage | 1d | #57 |
| 59 | Project mapping UI (`toggl_project_map` rows, unmapped queue) | 1d | #58 |
| 60 | `sync-toggl-entries` Edge Function (pull, upsert, idempotent) | 1.5d | #59 |
| 61 | Nightly cron + manual "Sync now" button | 0.5d | #60 |
| 62 | "Needs mapping" banner + notification | 0.5d | #60 |
| 63 | UI: Toggl source badge on entries, combined profitability calc | 0.5d | #60 |

**Start with #57** — it unblocks everything else.

---

### #57 — Schema amendment (migration 00032)

New migration to run in Supabase SQL editor:

```sql
-- Add Toggl sync columns to time_entries
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'native'
    CHECK (source IN ('native', 'toggl')),
  ADD COLUMN IF NOT EXISTS external_id text,     -- Toggl time entry ID
  ADD COLUMN IF NOT EXISTS synced_at timestamptz; -- null for native entries

-- Unique index prevents duplicate import on re-sync
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_external_id_idx
  ON public.time_entries (business_id, external_id)
  WHERE external_id IS NOT NULL;

-- Toggl project name → Forgefly project mapping
CREATE TABLE IF NOT EXISTS public.toggl_project_map (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  toggl_project_name   text NOT NULL,
  forgefly_project_id  uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  -- null forgefly_project_id means "don't import this Toggl project"
  UNIQUE (business_id, toggl_project_name)
);

ALTER TABLE public.toggl_project_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own toggl_project_map"
  ON public.toggl_project_map
  FOR ALL USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );
```

---

### #58 — Toggl OAuth + token storage

**Entry point in UI:** `FinancesPage.tsx` → Time tab header area:

```
Time tracking                    [+ Log time]  [Connect Toggl ⇄]
```

When no Toggl token exists: show "Connect Toggl ⇄" button (secondary, ghost variant).
When connected: show "Connected · Sync now" + "Disconnect" link.

**New Supabase secret to add:** `TOGGL_[business_id]_TOKEN` — encrypted per-business.
(Alternative: store in `businesses.extracted_data.toggl_token` encrypted with a server-side key.)

Toggl API base: `https://api.track.toggl.com/api/v9`
Auth: HTTP Basic with `{token}:api_token`
On connect: call `GET /me` to verify token, then fetch `/workspaces` and `/me/projects` to populate the project mapping step.

---

### #60 — `sync-toggl-entries` Edge Function

New Edge Function. Key logic:

```typescript
// Pull entries from last 7 days (covers missed nightly runs)
// GET /workspaces/{wid}/time_entries?start_date=...&end_date=...

for (const entry of togglEntries) {
  const mappedProjectId = projectMap[entry.project_name]
  if (!mappedProjectId) {
    flagForMapping(entry)  // surfaces "Needs mapping" queue
    continue
  }
  await supabase.from('time_entries').upsert({
    business_id,
    project_id: mappedProjectId,
    date: entry.start.split('T')[0],
    hours: entry.duration / 3600,
    note: entry.description,
    source: 'toggl',
    external_id: String(entry.id),
    synced_at: new Date().toISOString()
  }, { onConflict: 'business_id,external_id' })
}
```

Idempotent via unique index on `(business_id, external_id)`. Re-running never creates duplicates.

---

### #63 — UI treatment

- Toggl entries in Time tab list: small Toggl orange dot/badge (not loud — transparency only)
- Profitability card: sum all entries for the project regardless of source — user just sees total hours
- "Needs mapping" banner: dismissible, shows on Time tab when unmapped Toggl projects exist

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

### New for Phase F (Toggl)
- OAuth token: encrypted, scoped per business_id, never plaintext in DB
- Never auto-create Forgefly projects from unmapped Toggl projects
- Never write back to Toggl at MVP (pull only)
- "Needs mapping" queue: notification only, never silent discard
- Sync is idempotent — upsert on `(business_id, external_id)` unique index

---

## Standing pending items (carried from v4.8)

| Item | Where / How |
|---|---|
| Verify cron jobs | Dashboard → Database → Cron Jobs: `send-daily-digest` + `archive-inactive-contacts` |
| Resend SMTP | Dashboard → Auth → SMTP: `smtp.resend.com:465`, user `resend`, pw = Resend API key |
| Stripe subscription price | `create-subscription-checkout`: change `unit_amount: 100` → `2900` |
| Stripe webhook | Register `stripe-webhook` endpoint URL in Stripe Dashboard |
| Terms + Privacy pages | Linked from signup, not yet created |
