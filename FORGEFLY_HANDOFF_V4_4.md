# Forgefly — Session Handoff v4.4
> Load alongside FORGEFLY_HANDOFF_V4.md + V4_1 + V4_2 + V4_3
> This file covers work completed in the June 16–17, 2026 session (Proposals B-phase + pipeline wiring).

---

## Session summary

This session completed the full **Proposals B-phase** (B1–B6): the end-to-end lifecycle from inbound request ingestion through AI generation, freelancer-initiated wizard, proposal detail slide-over, and automatic pipeline stage progression.

Phase C (Visibility + B2B Outreach Kit) is next — start fresh with this doc loaded.

---

## What was built this session

### B1 — `submit-proposal-request` edge function rewrite

**File:** `supabase/functions/submit-proposal-request/index.ts`

- Changed insert target from `proposal_requests` → `proposals`
- Added business fetch before insert (needed `business.user_id` for RLS)
- Key insert payload:
  ```typescript
  { business_id, user_id: business.user_id, client_name, client_email,
    title: `${service_name} request` || 'Proposal request',
    initiated_by: 'client', status: 'draft',
    request_context: { company, service_name, problem, timeline, budget_flexible, notes } }
  ```
- Nudge email + dashboard URL changed to `/dashboard/proposals`
- **Deployed** ✓

---

### B2 — `viewed_at` tracking

**Files:** `supabase/functions/portal-approve-proposal/index.ts`, `src/pages/ClientPortalPage.tsx`

**Edge function** — new `track_viewed` branch:
- Action: `"approve" | "request_changes" | "track_viewed"`
- On `track_viewed`: updates `proposals.viewed_at` + `status='viewed'` where `business_id + client_email + status='sent' + viewed_at IS NULL`
- Matches by `business_id + client_email` (not `client_id`) to handle old engagements where `contact_id` is null
- Returns early — no email, no engagement status change

**Frontend** — fire-and-forget on first Proposal tab open:
```typescript
const viewedTrackedRef = useRef(false);
useEffect(() => {
  if (tab !== 'proposal' || viewedTrackedRef.current) return;
  viewedTrackedRef.current = true;
  supabase.functions.invoke('portal-approve-proposal', {
    body: { engagementId: engagement.id, action: 'track_viewed' },
  });
}, [tab, engagement.id]);
```

---

### B3 — Proposal detail slide-over

**File:** `src/pages/ProposalsPage.tsx`

Clicking any proposal card opens a `Sheet` slide-over (right panel) showing:
- Header: client display name, status badge, time ago
- Origin note (client-initiated vs freelancer-created)
- 4-step horizontal activity timeline (Created → Sent → Viewed → Responded) with timestamps
- "Their Request" section (client-initiated proposals only) — pulls from `request_context`
- Introduction, scope bullets, line items table, deliverables/timeline/investment table, terms
- Sticky action bar at bottom with the same contextual buttons as the list row

State: `const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);`
Card rows have `onClick={() => setDetailProposal(p)}` + action buttons wrapped in `onClick={e.stopPropagation()}`.

---

### B4 — `generate_proposal` AI Gateway mode

**File:** `supabase/functions/ai-gateway/index.ts`

New `handleGenerateProposal` function (~170 lines), wired as `mode === 'generate_proposal'`.

**Input:**
```typescript
{ mode: 'generate_proposal', proposal_id, initiated_by, business_id, extra_context? }
```

**Three AI branches** (all use Sonnet, max_tokens 1200):

| `initiated_by` | Tone | Prompt focus |
|---|---|---|
| `'client'` | `'response'` | Reassuring, addresses their stated problem/timeline/budget |
| `'pipeline'` + company intel | `'b2b_tailored'` | Peer-level, matches overlapping services only |
| `'freelancer'` | `'outbound'` | Confident, b2b or b2c based on `motion` field |

**Output:**
```typescript
{ title, introduction, services: string[], deliverables, timeline, terms,
  ai_generation_tone, ai_model_used }
```

Rules:
- NEVER generate a price — always `[amount]` placeholder
- Inject `portfolioUrl` from `businesses.slug`
- Logs usage via `logUsage`

**Deployed** ✓

---

### B5 — "+ New proposal" 3-step wizard

**File:** `src/pages/ProposalsPage.tsx`

The "New Proposal" button now opens a wizard Dialog instead of the raw form.

**Wizard state:**
```typescript
wizardOpen, wizardStep (1|2|3), wizardClientMode ('existing'|'new'),
wizardClientId, wizardNewName, wizardNewEmail,
wizardStartMode ('ai'|'blank'|'duplicate'), wizardDupId,
wizardContext, wizardGenerating
```

**Step 1 — Who is this for?**
- Toggle: "Existing client" (dropdown) | "New contact" (name + email fields)
- If no clients exist, defaults to "new" mode (toggle hidden)

**Step 2 — How do you want to start?**
- Three option cards: Generate with AI (Sparkles) / Start from blank (FileText) / Duplicate existing (Copy)
- If "Duplicate" selected: secondary Select for which proposal to copy

**Step 3 — Add context (optional, AI path only)**
- Textarea: `"e.g. they mentioned a tight timeline, or they have a fixed budget of $2k"`
- "Generate proposal →" button → `handleWizardGenerate()`

**Three paths:**
- **AI**: creates `draft` proposal row → calls `ai-gateway` `generate_proposal` with `extra_context` → persists fields → opens existing draft modal
- **Blank**: close wizard → open manual form pre-filled with wizard's client
- **Duplicate**: close wizard → open manual form pre-filled with source proposal fields + wizard's client

**Null-guard:** `{wizardOpen && <DialogContent>}` inside the Dialog.

---

### B6 — Pipeline auto-progression

**Files:** `src/pages/PipelinePage.tsx`, `src/pages/ProposalsPage.tsx`, `supabase/functions/portal-approve-proposal/index.ts`

**PipelinePage.tsx:**
- Added `'Lost'` to `STAGES` const (was valid in DB from migration 00013 but missing from frontend)
- Added `'Lost'` to `STAGE_CONFIG`: rose/red color

**Stage progression map:**

| Proposal event | Pipeline stage | Where |
|---|---|---|
| Proposal sent to client | `'Proposal Sent'` | `handleSendEmail` in ProposalsPage |
| Client approves proposal | `'Negotiating'` | `portal-approve-proposal` edge function |
| Freelancer marks declined | `'Lost'` | `handleStatusChange` in ProposalsPage |

**Matching strategy:** by `pipeline_lead_id` if set (direct), otherwise by `business_id + contact_id` (denormalized fallback).

**"Proposal Sent" update** only advances from `['Prospect', 'Qualified', 'Contacted']` — won't move backwards if already further along.

**"Negotiating" update** skips if stage is already `'Closed Won'` or `'Lost'`.

**Bug fixed:** `portal-approve-proposal` was jumping straight to `'Closed Won'` on approve — corrected to `'Negotiating'`. (Closed Won should be set manually when project is delivered.)

**Deployed** ✓

---

## Files changed this session

| File | Change |
|---|---|
| `supabase/functions/submit-proposal-request/index.ts` | Full rewrite — writes to `proposals` not `proposal_requests` |
| `supabase/functions/portal-approve-proposal/index.ts` | `track_viewed` branch + `Negotiating` fix + `Lost` handling |
| `supabase/functions/ai-gateway/index.ts` | `generate_proposal` mode (3-branch Sonnet generation) |
| `src/pages/ProposalsPage.tsx` | B3 slide-over, B5 wizard, B6 pipeline updates, `Copy` import |
| `src/pages/ClientPortalPage.tsx` | `viewedTrackedRef` fire-and-forget tracking on proposal tab open |
| `src/pages/PipelinePage.tsx` | Added `'Lost'` stage to STAGES + STAGE_CONFIG |

No new migrations this session.

---

## Architecture decisions made this session

### Proposal → pipeline matching is dual-path
Pipeline updates try `pipeline_lead_id` first (direct FK), then fall back to `business_id + contact_id` match. This handles proposals created before the `pipeline_lead_id` column existed.

### Pipeline updates are fire-and-forget in the frontend
`handleSendEmail` and `handleStatusChange` don't `await` the pipeline update — they fire it without blocking the toast or UI reload. If it fails silently, the user can still drag the lead manually. This avoids showing an error for a non-critical side-effect.

### `generate_proposal` `extra_context` is optional
The edge function appends extra_context to the system prompt if provided. The frontend wizard sends it only when non-empty (`trim() || undefined`).

### Wizard opens on "New Proposal"; manual form still reachable
The `openCreate()` function (opens the raw form) is still present and called from the wizard's "blank" and "duplicate" paths. It's no longer called directly from any button. `openEdit(p)` is unchanged — edit still goes directly to the form.

---

## What is NOT done yet (from prior sessions)

### Immediate (from v4.3)

**Apple Wallet pass — certs not set as Supabase secrets:**
- `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID` (FF94K758F9), `APPLE_CERT_P12_BASE64`, `APPLE_CERT_P12_PASSPHRASE`, `APPLE_WWDR_CERT_BASE64`

**SQL patches still needed (from v4.2 §3c):**
```sql
-- Messages RLS (auth.users join bug — run in SQL editor)
DROP POLICY "Client reads and sends messages on their portal" ON messages;
DROP POLICY "Client inserts messages on their portal" ON messages;
-- (full SQL in FORGEFLY_HANDOFF_V4_2.md §3c)
```

---

## Phase C — What's next

Phase C is the **Visibility + B2B Outreach Kit**. Load `FORGEFLY_OUTREACH_SPEC.md` alongside the V4 handoff chain. The spec describes each feature in detail.

### Phase C tasks (as planned at end of Phase B)

**C1 — Portfolio public page** (`/p/:slug`)
- Already has a route; needs design polish + proposal request form wired to new `submit-proposal-request` (now writing to `proposals`)
- Add services grid, testimonials section, CTA

**C2 — Outreach Kit page** (`/dashboard/outreach`)
- Already exists as `OutreachKitPage.tsx` — review current state before touching
- Features: company URL input → AI extraction → pipeline lead creation with `source='outreach_kit'`

**C3 — Outreach sequence** (email drip from pipeline leads)
- `outreach_sequence_step`, `outreach_sequence_status` columns already exist on `pipeline_leads`
- Need: sequence engine (step 1 → step 2 → step 3 emails), `next_action_date` scheduling

**C4 — B2B proposal trigger from pipeline**
- When a pipeline lead's `source='outreach_kit'` and stage reaches 'Contacted', offer "Generate proposal"
- Should use `initiated_by='pipeline'` + company intel from `company_intel` JSONB

**C5 — AI copilot pipeline context**
- The `ai-copilot` edge function already fetches business context; add pipeline lead counts by stage
- Enable natural language commands: "move Jane to Negotiating", "show me all Proposal Sent leads"

**C6 — `pipeline_lead_id` linking on proposal create**
- When creating a proposal from a pipeline lead (C4 path), set `proposals.pipeline_lead_id`
- Also: in the wizard step 1, if selecting an existing client who has a pipeline lead, auto-link

**C7 — Reply intent detection** (`last_reply_intent`)
- `pipeline_leads.last_reply_intent` column exists; needs AI classification of email replies
- Values: `positive` | `negative` | `not_sure` | `out_of_office`

**C8 — Reminder / next-action scheduling**
- `next_action_date`, `reminder_sent_at` columns exist
- Need: cron or webhook that fires reminders when `next_action_date` is past

**C9 — Outreach analytics panel**
- Per-stage counts, reply intent breakdown, sequence completion rate
- Simple read-only dashboard panel on the Outreach Kit page

**C10 — "Lost" pipeline recovery flow**
- When a lead moves to "Lost", offer a follow-up template 30 days later
- Lightweight: just set `next_action_date = now + 30d` and surface in dashboard

### Key files to load for Phase C

```
src/pages/OutreachKitPage.tsx      — existing outreach kit (review current state first)
src/pages/PipelinePage.tsx         — pipeline kanban (just updated with Lost stage)
supabase/functions/ai-gateway/index.ts  — already has b2b_tailored branch
files/FORGEFLY_OUTREACH_SPEC.md    — full spec for C-phase features
```

### DB columns already in place (from migration 00013)
All of these exist — no new migrations needed to start C1–C4:
```
pipeline_leads: source, company_url, service_overlap_score, matched_services,
                outreach_sequence_step, outreach_sequence_status, last_reply_intent,
                next_action_date, reminder_sent_at, company_intel
```

---

## Key patterns to remember

### Radix dialog null-guard
Always `{state && <Content>}` inside Radix Dialog/AlertDialog/Sheet.
`open={!!state}` alone is not enough — Radix renders children even when closed.

### Never JOIN `auth.users` in RLS
Use `auth.uid()` and `auth.email()` functions only. JOINs to `auth.users` cause RLS recursion errors.

### `business_id` is the canonical scope key
All proposal queries filter by `business_id` (from `useBusiness()` context). `user_id` is for RLS only.

### Proposal origin drives AI tone
`initiated_by: 'client'` → `'response'` tone (reassuring)
`initiated_by: 'pipeline'` → `'b2b_tailored'` tone (peer-level)
`initiated_by: 'freelancer'` → `'outbound'` tone (confident)

### AI models in use
- Haiku (`claude-haiku-4-5-20251001`): classification, short copy, intent detection
- Sonnet (`claude-sonnet-4-6`): full proposal generation, rich content
