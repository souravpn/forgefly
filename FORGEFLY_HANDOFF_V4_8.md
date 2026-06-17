# Forgefly — Session Handoff v4.8
> Covers work completed in the June 17–18, 2026 sessions.
> Load alongside FORGEFLY_HANDOFF_V4.md (in /files) + V4_1 through V4_7.

---

## What was completed this session

### Phase D — All tasks done (#25–#39)

| # | Task | Status |
|---|---|---|
| 39 | Client profile completion prompt (first portal visit) | ✅ Done |
| 38 | File sharing — `portal_files` table + Storage + UI | ✅ Done |
| 35 | Pipeline auto-progression (invoice paid → Closed Won, triggers) | ✅ Done |
| 36 | Returning client new proposal flow (lifecycle reset + client_id FK) | ✅ Done |
| 31 | Daily digest cron — `send-daily-digest` edge function + cron | ✅ Done |

### Infrastructure / bug fixes

| Item | What changed |
|---|---|
| Portal business name | Now uses `business.name` as primary; `extracted_data.identity.name` is fallback only |
| Portal light/dark mode | Toggle in avatar dropdown; persisted via `localStorage("portal-theme")`; 15 CSS vars on `.portal-root`; Radix Portal dropdowns use direct color values (not CSS vars) |
| Portal header/footer borders | Removed `border-b`/`border-t` Tailwind classes (were using global `--border`); dark mode now borderless (background contrast only); light mode gets explicit `1px solid var(--p-border)` |
| Portal dropdown | DropdownMenuContent renders via Radix Portal outside `.portal-root` — switched from CSS vars to direct `isDark ?` computed values for background, borders, text |
| PipelinePage crash | Added missing `ChevronRight` import |
| Portal auth | Added null-guard on email check + freelancer business-owner bypass |
| Portal link location | Moved from proposal flow to client cards in ClientsPage (email-to-token map lookup) |
| Storage bucket RLS | Migration 00027: avatars bucket public, authenticated INSERT, user-scoped UPDATE/DELETE |
| Daily digest timezone UI | Settings → Business Profile → Notification Preferences — saves to `businesses.extracted_data.timezone` |
| Resend SMTP | Manual step: Dashboard → Auth → SMTP: `smtp.resend.com:465`, user `resend`, pw = Resend API key |

### Migrations run (this session)

| Migration | What it does | Status |
|---|---|---|
| 00022 | `contacts`: add `phone`, `timezone` columns | ✅ Run |
| 00023 | `portal_files` table + RLS | ✅ Run |
| 00024 | Pipeline auto-progression trigger (`invoice paid → Closed Won`) + `portal_request` source | ✅ Run |
| 00025 | `archive_inactive_contacts()` fn + pg_cron nightly schedule | ✅ Run |
| 00026 | `send-daily-digest` pg_cron hourly schedule | ✅ Run |
| 00027 | Avatars storage bucket: public + RLS policies | ✅ Run |

### Edge functions deployed (this session)

| Function | Change |
|---|---|
| `submit-proposal-request` | Pipeline card creation + lifecycle reset (archived/engaged→prospect) + `proposals.client_id` FK link |
| `send-daily-digest` | NEW — hourly cron target; skips if active <4h; dedup sentinel nudge |
| `portal-approve-proposal` | Already done in v4.7 — lifecycle + pipeline on accept |

---

## Standing pending items (non-feature)

| Item | Where / How |
|---|---|
| Verify cron jobs | Dashboard → Database → Cron Jobs: confirm `send-daily-digest` + `archive-inactive-contacts` exist. If missing, run SQL from migrations 00025 and 00026. |
| Resend SMTP | Dashboard → Authentication → SMTP Settings → enable custom SMTP: host `smtp.resend.com`, port `465`, user `resend`, pw = Resend API key, sender `Forgefly <hello@forgefly.io>` |
| Stripe subscription price | `create-subscription-checkout`: change `unit_amount: 100` → `2900` |
| Stripe webhook | Register `stripe-webhook` endpoint URL in Stripe Dashboard |
| Terms + Privacy pages | Pages linked from signup but not yet created |
| `portal-files` bucket | Created by user ✅ |
| Apple Wallet secrets | All 5 confirmed present ✅ |

---

## What is next: Phase E — Accounting + Time Tracking (v4.5)

**Full spec: `FORGEFLY_OUTREACH_SPEC.md §14` (in `/files`)**

This is the next major feature phase. ~20 days of work, tasks #40–#56.

### Core principle (must carry into every implementation decision)

Forgefly calculates and organizes. It never gives tax advice.
Every tax-adjacent surface carries this exact disclaimer:
> "These are estimates based on the information you've provided. Consult a qualified tax professional for advice specific to your situation."

Stay behind the liability line: **calculate, flag, remind — never advise, file, or guarantee.**

---

### New top-level page: Finances

New nav item alongside Pipeline / Proposals / Invoices / Clients.
Invoices stays separate (operational: send, track, get paid).
Finances is analytical: understand, plan, report. Different jobs, both needed.

**Tabs:** Overview / Income / Expenses / Time / Tax / Export

---

### 14b — Data model (4 new tables + 1 update)

#### `transactions` — unified income + expense ledger

```sql
CREATE TABLE transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid REFERENCES businesses(id) ON DELETE CASCADE,
  type                  text NOT NULL CHECK (type IN ('income','expense')),
  amount                numeric(10,2) NOT NULL,
  currency              text DEFAULT 'USD',

  -- income
  invoice_id            uuid REFERENCES invoices(id),
  client_id             uuid REFERENCES contacts(id),
  income_category       text,   -- 'services'|'products'|'licensing'|'royalties'

  -- expense
  expense_category_id   uuid REFERENCES expense_categories(id),
  vendor                text,
  receipt_url           text,   -- Supabase Storage URL
  receipt_extracted     boolean DEFAULT false,
  is_recurring          boolean DEFAULT false,
  recurrence_rule       text,   -- 'monthly'|'annual'

  -- shared
  description           text,
  transaction_date      date NOT NULL,   -- cash basis: when money moved
  tax_year              int GENERATED ALWAYS AS
                          (EXTRACT(year FROM transaction_date)::int) STORED,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX ON transactions (business_id, type, tax_year);
CREATE INDEX ON transactions (business_id, transaction_date DESC);
CREATE INDEX ON transactions (invoice_id) WHERE invoice_id IS NOT NULL;
```

#### `expense_categories` — per-vertical seeded defaults

```sql
CREATE TABLE expense_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id),   -- null = system default
  name            text NOT NULL,
  schedule_c_line text,           -- Schedule C line item
  is_cogs         boolean DEFAULT false,
  is_default      boolean DEFAULT false,
  vertical        text,           -- null = all verticals
  sort_order      int DEFAULT 0
);
```

**Default categories — all verticals:**
Software & subscriptions (L22) · Hardware & equipment (L13) · Phone & internet (L25) ·
Marketing & advertising (L8) · Professional development (L27a) ·
Bank & payment fees (L10) · Office supplies (L18) · Travel — flights & hotels (L24a) ·
Meals with clients (L24b — 50% deductible, always flag) ·
Professional services (L17) · Home office (L30 — via simplified method) · Other (L27a)

**b2c_local additions** (baker, photographer, florist):
COGS — materials (L4) · COGS — packaging (L4) · COGS — supplies (L4) · Vehicle/mileage (L9)

**b2b_creative additions** (designer, developer, videographer):
Software licenses (L22) · Stock assets (L22) · Contractor payments (L11 — 1099 flag) · Equipment rental (L20b)

**b2b_professional additions** (CPA, consultant, coach):
Professional liability insurance (L15) · Continuing education (L27a) · Association memberships (L27a) · Contractor payments (L11)

#### `mileage_logs`

```sql
CREATE TABLE mileage_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid REFERENCES businesses(id) ON DELETE CASCADE,
  trip_date         date NOT NULL,
  miles             numeric(6,1) NOT NULL,
  purpose           text NOT NULL,
  client_id         uuid REFERENCES contacts(id),
  project_id        uuid REFERENCES projects(id),
  irs_rate          numeric(4,3) NOT NULL,     -- store rate at time of trip
  deductible_amount numeric(8,2) GENERATED ALWAYS AS (miles * irs_rate) STORED,
  tax_year          int GENERATED ALWAYS AS (EXTRACT(year FROM trip_date)::int) STORED,
  created_at        timestamptz DEFAULT now()
);
```

IRS rate for 2024: `0.670`. Store per-row (rate changes annually). Update via config each January.

#### `time_entries`

```sql
CREATE TABLE time_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid REFERENCES businesses(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES projects(id) ON DELETE CASCADE,
  client_id        uuid REFERENCES contacts(id),
  entry_date       date NOT NULL,
  hours            numeric(4,2) NOT NULL,     -- 1.5 = 1hr 30min
  note             text,
  timer_started_at timestamptz,               -- set when using live timer
  tax_year         int GENERATED ALWAYS AS (EXTRACT(year FROM entry_date)::int) STORED,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX ON time_entries (business_id, project_id);
CREATE INDEX ON time_entries (business_id, tax_year);
```

#### `contractor_payments`

```sql
CREATE TABLE contractor_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid REFERENCES businesses(id) ON DELETE CASCADE,
  contractor_name   text NOT NULL,
  contractor_email  text,
  w9_on_file        boolean DEFAULT false,
  payment_date      date NOT NULL,
  amount            numeric(10,2) NOT NULL,
  description       text,
  tax_year          int GENERATED ALWAYS AS (EXTRACT(year FROM payment_date)::int) STORED,
  ytd_total         numeric(10,2),            -- updated by trigger
  threshold_flag    boolean DEFAULT false,    -- true when ytd_total >= 600
  created_at        timestamptz DEFAULT now()
);
```

DB trigger: after INSERT/UPDATE, recalculate `ytd_total` per contractor per `tax_year`, set `threshold_flag = true` when `ytd_total >= 600`. Fire a nudge: "Contractor crossed $600 — may require 1099-NEC. Collect their W-9." (with disclaimer).

---

### 14c — Invoice → transaction link

When `invoices.payment_status` → `'paid'`, auto-create an income transaction:

```typescript
// Extend the existing advance_pipeline_on_invoice_paid trigger
// OR add a new trigger / webhook handler

await supabase.from('transactions').insert({
  business_id:      invoice.business_id,
  type:             'income',
  amount:           invoice.total_amount,
  invoice_id:       invoice.id,
  client_id:        invoice.contact_id,
  income_category:  'services',   // user can change after
  transaction_date: stripePaymentDate ?? today,
  description:      `Invoice #${invoice.number} — ${invoice.client_name}`,
})
```

If Stripe webhook provides exact payment timestamp → use it. Otherwise use today.

---

### 14d — Receipt capture (AI extraction)

Edge Function: `extract-receipt` (new)
Model: `claude-sonnet-4-6` (needs vision for receipt images)

```typescript
const system = `Extract receipt data. Return ONLY valid JSON:
{
  "vendor": string,
  "amount": number,
  "date": "YYYY-MM-DD",
  "description": string,
  "suggested_category": "software_subscriptions|hardware_equipment|phone_internet|
    marketing_advertising|professional_development|bank_fees|office_supplies|
    travel|meals_clients|professional_services|cogs_materials|
    cogs_packaging|contractor_payments|other",
  "confidence": "high"|"medium"|"low",
  "notes": string   // flag unusual items e.g. "meal — 50% deductible"
}`
```

**Rules:**
- Always pre-fill the form — never auto-save.
- Set `receipt_extracted = true` on the transaction row.
- Store extracted JSON in `transaction.notes` as audit trail.
- If `suggested_category = 'meals_clients'`: show inline note: "Meals with clients are 50% deductible. Forgefly calculates the deductible amount automatically."

---

### 14e — P&L dashboard (Finances page)

#### Overview tab
```
[Year ▾]  [Month ▾ All]

Gross Income   Total Expenses   Net Profit
$48,200        $12,340          $35,860
+12% vs last yr  —              74% margin

Monthly bar chart: income vs expenses, 12 months
Top expense categories (ranked list with %)
Unpaid invoices affecting cash flow
```

#### Income tab
- Transactions where `type='income'`, grouped by month then client
- Filter by `income_category`
- **1099 tracker**: clients with YTD income > $600 flagged "May require 1099-NEC"
  (disclaimer required: "Consult a tax professional")

#### Expenses tab
- Transactions where `type='expense'`, grouped by category
- Meals column shows 50% adjusted deductible amount
- Mileage section: total miles × IRS rate = total deductible
- Contractors section (see §14i)

#### Time tab — see §14h

#### Tax tab — see §14f

#### Export tab — see §14g

---

### 14f — Tax estimate engine

**Prominent disclaimer at top of Tax tab (non-negotiable):**
> "These are estimates based on the information you've entered. Tax law is complex and varies by situation. Consult a qualified tax professional before making financial decisions based on these figures."

**Calculation (Schedule C, cash basis):**

```typescript
const netProfit         = grossIncome - totalDeductibleExpenses
const seAdjustedIncome  = netProfit * 0.9235
const seTax             = seAdjustedIncome * 0.153
const seDeduction       = seTax * 0.5
const standardDeduction = 14600           // 2024 single; adjust for filing status
const taxableIncome     = netProfit - seDeduction - standardDeduction
const estimatedIncomeTax = calculateBrackets(taxableIncome, filingStatus)
  // 2024 brackets: 10/12/22/24/32/35/37%
const totalTax          = seTax + estimatedIncomeTax

// Safe harbor (avoid underpayment penalty)
const safeHarbor = Math.min(totalTax * 0.90, priorYearLiability)

// Quarterly split: totalTax / 4 per quarter
// Due dates: Q1 Apr 15 · Q2 Jun 15 · Q3 Sep 15 · Q4 Jan 15
```

**Home office (IRS simplified method only):**
$5/sqft × user-entered sqft, capped at 300 sqft = max $1,500/yr deduction.
User enters sqft in Finances settings. Do NOT implement the regular method (too complex).

**SEP-IRA opportunity surface:**
Max contribution = 25% of net profit, capped at $69,000 (2024).
Show: "You could contribute up to $X and reduce your tax bill by ~$Y."
Link to IRS SEP-IRA page. **Never recommend a provider.**

**Quarterly reminders:**
Nudge + email 30 days before, 7 days before, and on each due date.
Uses existing notification system (trigger-nudges + send-email).

**Filing status setting:**
In Finances settings: single (default) / MFJ / MFS / HOH.
Affects standard deduction and bracket lookup.

---

### 14g — Year-end export

PDF package (generated on demand per year):
1. Cover: business name, tax year, generated date, disclaimer
2. P&L summary
3. Income detail (by date, with invoice refs)
4. Expense detail (by category, with receipt refs)
5. Mileage log (all trips, rate, total deduction)
6. Home office summary (sqft, method, deduction)
7. Contractor payments (YTD totals, threshold flags)
8. Time summary (hours by project — substantiates home office)
9. 1099 threshold report (clients >$600, with disclaimer)
10. Quarterly payment record

Footer on every page: "Generated by Forgefly. For informational purposes only. Consult a qualified tax professional before filing."

**CSV exports (separate):** income transactions · expense transactions · mileage log

**"Send to my accountant" flow:**
Secure download link (72hr expiry) with PDF + CSVs attached.
User enters accountant's email → Forgefly sends the link.
Accountant does NOT need a Forgefly account.

---

### 14h — Time tracking

**Entry points:**
- Project card → "Log time"
- Finances → Time tab → "+ Log time"
- (Phase 2: mobile floating "Start timer" button)

**Two modes:**

```
Manual:  Project ▾ | Date | Hours | Note | [Save]
Timer:   Project ▾ | Note | [▶ Start] → elapsed time → [■ Stop → auto-save]
```

**Project profitability card** (on project detail page):
```
Quoted price     $4,000
Hours logged     23.5 hrs
Effective rate   $170/hr
Budget           [Set →]
If budget set: progress bar — amber at 80%, red at 95%
```

**Post-project AI insight** (fires when project marked complete, requires ≥3 completed projects as baseline):
- Model: Haiku (no user prompt — background nudge)
- Context: this project's hours/rate vs. average of last 3 similar projects
- Output: 2 sentences max, direct, specific, no fluff
- Example: "This project took 38 hours — 12 more than your last two brand sprints. At your current rate, that gap costs you $2,040."

**Time tab in Finances:**
```
Total hours this year: 847 hrs · 12 projects · 8 clients
[Year ▾]  [Project ▾]  [Client ▾]

Project breakdown: name | hours | quoted | effective $/hr
Note: "Included in year-end tax export for home office substantiation"
```

---

### 14i — Contractor payment tracker

In Finances → Expenses tab, dedicated "Contractors" section:

```
Alex Rivera     $1,240  ⚠ W-9 needed · May require 1099-NEC
Sarah Kim         $480  $120 until 1099 threshold
Dev Studio LLC  $3,600  ⚠ W-9 needed · May require 1099-NEC

[+ Add contractor payment]
```

- `w9_on_file` toggle: freelancer marks "W-9 collected" to clear the flag
- Forgefly tracks the flag only — never stores W-9 documents

---

### 14j — Nav + settings placement

**Finances nav:** top-level item after Invoices.

**Finances settings** (new section in SettingsPage → Business Profile tab or dedicated Finances tab):
- Filing status: single (default) / MFJ / MFS / HOH
- Home office sqft (for simplified method calculation)
- Prior year tax liability (for safe harbor calc; 0 if first year)

---

### Build order — #40–#56

| # | Task | Effort |
|---|---|---|
| 40 | `expense_categories` seed data per vertical | 0.5d |
| 41 | `transactions` table + invoice→transaction trigger | 1d |
| 42 | Expense entry UI (manual) + category assignment | 1.5d |
| 43 | `extract-receipt` edge function (Sonnet vision) | 1.5d |
| 44 | `mileage_logs` table + UI | 1d |
| 45 | `contractor_payments` table + threshold trigger + nudge | 1d |
| 46 | P&L dashboard — Overview + Income + Expenses tabs | 2d |
| 47 | Tax estimate engine + Tax tab | 2.5d |
| 48 | Quarterly reminder notifications | 0.5d |
| 49 | `time_entries` table + log time UI (manual) | 1d |
| 50 | Timer mode (start/stop) | 1d |
| 51 | Project profitability card | 1d |
| 52 | Post-project AI insight (Haiku nudge, fires on complete) | 0.5d |
| 53 | Time tab in Finances | 0.5d |
| 54 | Year-end PDF export | 2.5d |
| 55 | CSV exports + "Send to accountant" link | 1d |
| 56 | Filing status + home office + prior-year settings | 0.5d |

**Total: ~20 days**

**Recommended sequence:**
```
40 + 41  (schema foundation — must be first)
  ↓ parallel:
42 + 44 + 45  (data entry surfaces)
  ↓
43  (receipt AI — depends on 42)
  ↓
46  (P&L dashboard — depends on 41+42+44)
  ↓ parallel:
47 + 56  (tax engine + settings)
  ↓
48  (reminders — depends on 47)
  ↓ parallel:
49 + 50  (time tracking)
  ↓ parallel:
51 + 52 + 53  (time insights + tab)
  ↓
54 + 55  (export — depends on everything above)
```

**Start with #40 + #41.** They have no dependencies on each other and unblock everything else.

---

## Architecture decisions to carry forward

### From prior sessions (still active)
- `business_id` is canonical scope key — `user_id` is for RLS only
- Never JOIN `auth.users` in RLS — use `auth.uid()` / `auth.email()` only
- Radix dialog null-guard: `{state && <Content>}` inside Dialog/Sheet/AlertDialog
- DB trigger SECURITY DEFINER for cross-role writes
- Functional `setState(current => ...)` in realtime handlers (no stale closure)
- Email is fire-and-forget (`invoke(...)` without `await`)
- Radix Portal renders OUTSIDE the React tree — CSS variables from parent don't inherit; use direct computed values for DropdownMenuContent, DialogContent etc.

### New for Phase E
- Cash basis accounting throughout (no accrual)
- IRS mileage rate stored per-row (changes annually — do not hardcode in calculations)
- All tax calculations must surface the standard disclaimer
- Receipt extraction: always pre-fill form, never auto-save
- Meals with clients: always show 50% deductible note
- SEP-IRA: surface the opportunity, link to IRS, never name a provider
- Contractor W-9: track flag only, never store the document itself

---

## Key files at end of this session

| File | Notes |
|---|---|
| `src/pages/ClientPortalPage.tsx` | ContactHub: dark/light theme, business name fix, file sharing, profile prompt |
| `src/pages/SettingsPage.tsx` | Timezone picker in Notification Preferences card |
| `src/pages/ClientsPage.tsx` | Portal link copy button on client cards |
| `src/pages/MessagesPage.tsx` | Files tab + upload/delete in ThreadPane |
| `supabase/functions/send-daily-digest/index.ts` | NEW — hourly digest cron target |
| `supabase/functions/submit-proposal-request/index.ts` | Pipeline card + lifecycle reset + client_id FK |
| `supabase/functions/_shared/email-templates.ts` | `getDailyDigestEmailTemplate` added |
| `supabase/migrations/00022–00027` | All run ✅ |
