# Forgefly — Session Handoff v4.3
> Load alongside FORGEFLY_HANDOFF_V4.md, FORGEFLY_HANDOFF_V4_1.md, FORGEFLY_HANDOFF_V4_2.md
> This file covers work completed in the June 16, 2026 session.

---

## What was built this session

### Merged Proposals page (§12 of FORGEFLY_OUTREACH_SPEC.md)

"Proposals" and "Requests" pages are now a single unified page at `/dashboard/proposals`.
The split was the app's internal architecture leaking into the UI — one concept, one place.

---

### Files changed

| File | Change |
|---|---|
| `supabase/migrations/00016a_merged_proposals_enum.sql` | Extends `proposal_status` ENUM with `viewed`, `declined`, `expired`, `withdrawn` — run FIRST |
| `supabase/migrations/00016b_merged_proposals_data.sql` | All schema + data migration — run SECOND |
| `src/types/types.ts` | `ProposalStatus` expanded; `Proposal` interface updated with all new fields; new `ProposalOrigin`, `ProposalLineItem`, `ProposalRequestContext` types |
| `src/pages/ProposalsPage.tsx` | Full rewrite — merged view with origin tabs, contextual actions, AI draft modal, follow-up, send flow |
| `src/pages/RequestsPage.tsx` | Replaced with redirect to `/dashboard/proposals` |
| `src/config/navigation.ts` | "Requests" removed from `MORE_ITEMS` |

---

### Migration — must be run in Supabase SQL Editor

**Why two steps:** Postgres does not allow using newly-added enum values in the same transaction they were added (`ALTER TYPE ADD VALUE` must commit before use). This is a hard Postgres constraint — do not try to combine into one script.

**Step 1** — paste and run `00016a_merged_proposals_enum.sql`:
```sql
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'viewed';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'declined';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'withdrawn';
```

**Step 2** — paste and run `00016b_merged_proposals_data.sql` (the full file).

What it does:
- Adds `business_id`, `client_name`, `client_email`, `initiated_by`, `request_context`, `line_items`, `total_amount`, `currency`, `ai_generated`, `viewed_at`, `responded_at`, `expires_at`, `pipeline_lead_id` to `proposals`
- Backfills `business_id` + `client_name`/`client_email` for all existing proposals from their linked businesses/clients
- Updates drafted/sent `proposal_requests` rows → marks their linked proposal as `initiated_by='client'` with `request_context` JSONB
- Migrates all unlinked `proposal_requests` (new/declined) into `proposals` as `initiated_by='client', status='draft'` rows
- Adds indexes on `(business_id)`, `(business_id, initiated_by)`, `(business_id, status)`

---

### Schema additions

New columns on `proposals`:

| Column | Type | Notes |
|---|---|---|
| `business_id` | uuid → businesses | Backfilled from user_id; all new writes include this |
| `client_name` | text | Denormalized from clients; populated at send time |
| `client_email` | text | Denormalized from clients; populated at send time |
| `initiated_by` | text CHECK | `'freelancer'` \| `'client'` \| `'pipeline'` |
| `request_context` | jsonb | For `initiated_by='client'`: stores `company`, `service_name`, `problem`, `timeline`, `budget_flexible`, `notes`, `original_request_id` |
| `line_items` | jsonb | `[{label, qty, unit_price}]` — for future itemized proposals |
| `total_amount` | numeric(10,2) | Backfilled from `pricing`; use this going forward |
| `currency` | text | Default `'USD'` |
| `ai_generated` | boolean | Set to true when AI drafted the content |
| `ai_generation_tone` | text | `'outbound'` \| `'response'` \| `'b2b_tailored'` |
| `ai_model_used` | text | e.g. `'claude-sonnet-4-6'` |
| `viewed_at` | timestamptz | Set when client opens portal — server-side only |
| `responded_at` | timestamptz | Set when client approves/declines |
| `expires_at` | timestamptz | Optional expiry |
| `pipeline_lead_id` | uuid | Links to `pipeline_leads` for auto-progression |

New `proposal_status` enum values: `viewed`, `declined`, `expired`, `withdrawn`
Note: `rejected` still exists in the enum for backward compatibility. In the UI, 'rejected' and 'declined' display identically as "Declined".

---

### ProposalsPage — what was built

**Filter bar:**
- Origin tabs: **All** | **Created by me** (freelancer + pipeline) | **Requested** (client-initiated) — with counts and "N new requests" pill in header
- Status dropdown: All / Draft / Sent / Viewed / Accepted / Declined / Expired
- Search: freetext on client name or proposal title

**List rows** (not cards) — each row shows:
- Avatar circle with initials
- Client name · Proposal title · Amount
- Origin note: "Requested by them" (with UserCheck icon) or "You created"
- Time ago · Status badge · AI badge (if ai_generated)
- Problem snippet (for client-initiated drafts only)

**Contextual action buttons** (per spec §12e), driven by `initiated_by × status`:
- `client + draft`: [Draft with AI] [Decline] — or [View draft] if content already exists
- `client + sent/viewed`: [Follow up]
- `client + accepted`: [Create invoice]
- `freelancer + draft`: [Send] [Edit] [Delete]
- `freelancer + sent`: [Follow up] [Resend]
- `freelancer + viewed`: [Follow up]
- `freelancer + accepted`: [Create invoice]
- `freelancer + declined/rejected`: [Archive]
- `freelancer + expired`: [Reopen]

**AI Draft modal** (for `initiated_by='client'` proposals):
- Ported from old RequestsPage with a key architectural change: the draft UPDATES the existing proposal row in DB (no longer creates a new one)
- AI call uses `request_context.problem`, `company`, `service_name`, `timeline` from the proposal
- View → Edit → Regenerate → Send flow
- Send: upserts client in `clients`, upserts engagement, generates portal link, sends `portal_invite` email (CC freelancer), updates proposal `status='sent'`
- On open: if proposal already has draft content (`introduction` or `services`), opens directly in view mode without re-running AI

**Follow-up dialog**: pre-drafted message with client name + proposal title pre-filled; sends via `send-email` (client_message type)

**Manual create/edit modal**: for freelancer-initiated proposals — all legacy fields (title, client, introduction, services, deliverables, pricing, timeline, terms)

**Send/Resend dialog**: existing portal-link send flow, now reads from unified proposal fields

**Create invoice shortcut**: navigates to `/dashboard/invoices?client_id=...&amount=...&description=...`

---

### Bug fixed during session

**Root cause:** Radix UI's `AlertDialog` and `Dialog` always render children in the DOM even when `open={false}` (for animation). The send dialog and follow-up dialog called `getClientDisplay(sendDialog!)` where `sendDialog` was `null` on initial render → `Cannot read properties of null (reading 'client')` crash.

**Fix:** Wrapped dialog content in `{sendDialog && (...)}` and `{followUpProposal && (...)}`. This is now the established pattern for all Radix dialogs in Forgefly that have nullable state — always guard content, never use `!` non-null assertion for state that starts as null.

**Rule to remember:** In Radix dialogs: `open={!!state}` alone is not enough. Always `{state && <Content>}` inside.

---

## Architecture decisions made this session

### `business_id` is now the primary scope key for proposals
- All new proposals must include `business_id` (from `useBusiness()` context)
- The query in ProposalsPage filters by `business_id`; falls back to user_id RLS if column not yet populated (pre-migration compatibility)
- Going forward: `business_id` is the canonical scope. `user_id` stays for RLS but is secondary.

### `request_context` JSONB preserves inbound request detail
- When migrating from `proposal_requests`, the original fields (`company`, `problem`, `timeline`, etc.) are stored in `request_context`
- The AI draft modal reads from `request_context` to reconstruct drafting context
- `request_context.original_request_id` tracks which `proposal_requests` row this came from

### `proposal_requests` table is now archived
- No new writes to `proposal_requests` — all new inbound requests from the portfolio form should write directly to `proposals` with `initiated_by='client'`
- **TODO:** Update `submit-proposal-request` edge function to write to `proposals` instead of `proposal_requests`
- The old table is left in place for backward compatibility; data is migrated

### Radix dialog null-guard pattern
All dialogs with nullable state must guard content: `{state && <DialogContent>...</DialogContent>}`.
Never rely on `open={!!state}` alone.

---

## Outstanding / not yet done

### Immediate (needed for full proposal flow to work)

**Run migrations in Supabase SQL Editor:**
1. `00016a_merged_proposals_enum.sql` — add new enum values
2. `00016b_merged_proposals_data.sql` — schema + data migration

**Update `submit-proposal-request` edge function:**
Currently writes to `proposal_requests`. Should write directly to `proposals` with `initiated_by='client'`. Until this is updated, new inbound requests from the portfolio form still go to the old table and won't appear in the merged Proposals page until the migration re-runs.

### From v4.2 (still pending)

**Apple Wallet pass — certs not set as Supabase secrets:**
- `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID` (FF94K758F9), `APPLE_CERT_P12_BASE64`, `APPLE_CERT_P12_PASSPHRASE`, `APPLE_WWDR_CERT_BASE64`

**SQL patches still needed (from v4.2):**
```sql
-- Messages RLS (auth.users join bug — run in SQL editor)
DROP POLICY "Client reads and sends messages on their portal" ON messages;
DROP POLICY "Client inserts messages on their portal" ON messages;
-- (full SQL in FORGEFLY_HANDOFF_V4_2.md §3c)

-- Fix stale test engagement (from v4.2 §3a):
-- update engagements set business_id = '<fftest10_current_id>' where id = '5ffe5f8d-...';
-- insert into engagement_access (engagement_id, client_email) values ('5ffe5f8d-...', 'fftest11@yopmail.com');
```

**Deploy pending edge functions:**
```bash
npx supabase functions deploy ai-gateway
npx supabase functions deploy generate-visibility-kit
npx supabase functions deploy research-company
npx supabase functions deploy handle-reply-intent
```

**Run pending migrations:**
```sql
-- Migration 00014 (if not yet run):
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS logo_url text;
CREATE UNIQUE INDEX IF NOT EXISTS businesses_slug_key ON businesses (slug) WHERE slug IS NOT NULL;

-- Migration 00013 (B2B pipeline outreach columns — if not yet run):
-- See supabase/migrations/00013_phase35_outreach.sql
```

### Not yet started (from spec)

**§12 remaining items:**
- **Proposal detail view** (§12f) — slide-over panel with activity timeline; `viewed_at` tracking endpoint from portal
- **AI generation Edge Function update** (§12g) — three-branch `generate_proposal` action in `ai-gateway`: freelancer / client-response / pipeline-tailored
- **"+ New proposal" multi-step flow** (§12h) — 3-step: Who → How to start → Generate context
- **Pipeline auto-progression triggers** (§12i) — Edge Function: proposal `sent` → pipeline 'Proposal Sent', `accepted` → 'Negotiating', `declined` → 'Lost'
- **`submit-proposal-request` update** — write to `proposals` directly instead of `proposal_requests`
- **`viewed_at` tracking** — `POST /proposals/[id]/viewed` from portal page, server-side only

**Phase 3.5 (Visibility + Outreach Kit):**
- "Let's Make You Visible" tab — VisibilityPage shell exists, content not yet built
- B2B Outreach Kit — OutreachKitPage exists, full 5-step flow spec in FORGEFLY_OUTREACH_SPEC.md

---

## Key file locations (updated)

| Purpose | Path |
|---|---|
| Merged proposals page | `src/pages/ProposalsPage.tsx` |
| Proposal types | `src/types/types.ts` — `Proposal`, `ProposalStatus`, `ProposalOrigin`, `ProposalRequestContext` |
| Proposal service | `src/services/proposalService.ts` — still works, scope by business_id in page |
| Nav constants | `src/config/navigation.ts` — Requests removed from MORE_ITEMS |
| Migration (enum) | `supabase/migrations/00016a_merged_proposals_enum.sql` |
| Migration (data) | `supabase/migrations/00016b_merged_proposals_data.sql` |
