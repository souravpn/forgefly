# Forgefly — Session Handoff v4.2
> Load alongside FORGEFLY_HANDOFF_V4.md and FORGEFLY_HANDOFF_V4_1.md.
> This file covers work completed in the June 15, 2026 session (continued from v4.1).

---

## What was built this session

### 1. Calendar date detection in "Ask a Question" composer
**File:** `src/pages/RequestsPage.tsx`

Hybrid regex + AI approach:
- `CALENDAR_TRIGGER` regex catches any temporal keyword (tomorrow, morning, Monday, "at 10", etc.) — runs on every keystroke, costs zero tokens
- When triggered: 800ms debounce → call Haiku via `ai-gateway` `mode: 'chat'` with today's date + message text → returns `{ date, time, duration_mins }` JSON
- `calSuggestion` + `calDetecting` state drives chip UI below the textarea
- Chip shows spinner while detecting, then `"Mon, Jun 16 at 10:00 AM · 30 min"` + `"+ Add to Calendar"` button
- On click: `createCalendarEvent()` from `calendarService` → success toast

**Key bug fixed during testing:**
`ai-gateway` returns the JSON object directly as `data` (not wrapped in `data.message`). Parser checks `data.date !== undefined` first before falling back to `data.message`.

**Not yet extended to:** OutreachKitPage reply composer, AICopilot panel — same pattern applies when ready.

---

### 2. ai-gateway hardening
**File:** `supabase/functions/ai-gateway/index.ts` — **deployed**

Two fixes:
1. `runClassifier()` — added try/catch around `JSON.parse`. When Haiku returns natural language instead of JSON (e.g. user typed a calendar command in the Update OS bar), it now falls back to safe defaults (`scoped`, no sections) instead of throwing to the top-level catch.
2. `handleExtract()` — early guard: if `sections_needed.length === 0 && !isDiff`, returns `not_applicable: true` with the current data unchanged instead of attempting extraction. Prevents garbage output when users type non-business commands (calendar changes, etc.) into the Update OS bar.

---

### 3. Client portal fixes
Three separate bugs fixed:

#### 3a. "Portal not found" for logged-in Forgefly users
**Root cause:** `businesses` table RLS had one policy — `auth.uid() = user_id` (owner only). When FFtest11 (a Forgefly user) opened FFtest10's portal link, their JWT matched no policy → businesses query returned null → `!business` → "Portal not found". Anonymous visitors worked fine (separate anon policy). Authenticated Forgefly users were blocked.

**Fix:** `supabase/migrations/00015_portal_access_fixes.sql`
```sql
create policy "Public can read active businesses"
  on businesses for select
  using (status = 'active');  -- no TO clause = all roles
```
**Status:** Both policies in 00015 already existed in DB (created earlier via dashboard). The businesses policy was `{public}` role with `status = 'active'` — correct. But the business referenced by the test engagement (`4ab15116...`) **doesn't exist** — FFtest10 regenerated their portal, creating a new business ID while the old engagement still pointed to the deleted one.

**Manual fix needed for test data:**
```sql
-- Find FFtest10's current business ID
select b.id from businesses b
join profiles p on p.id = b.user_id
where p.username = 'fftest10' and b.status = 'active';

-- Update the stale engagement
update engagements
set business_id = '<ID_ABOVE>'
where id = '5ffe5f8d-8aa7-4777-813c-c2e7033ae68a';

-- Create missing access row
insert into engagement_access (engagement_id, client_email)
values ('5ffe5f8d-8aa7-4777-813c-c2e7033ae68a', 'fftest11@yopmail.com');
```

#### 3b. engagement_access row never written when contact_id is null
**Root cause:** `generate-portal-link` gets client email from `engagement.contacts?.email`. If `contact_id` is null on the engagement, `clientEmail` is null → the `if (clientEmail)` block is skipped → no `engagement_access` row → client hits "Portal not linked to your account" even though they received the email.

**Fix:**
- `supabase/functions/generate-portal-link/index.ts` — **deployed**: accepts `clientEmail` body param as fallback. `clientEmail = contact?.email ?? clientEmailOverride ?? null`
- `src/pages/RequestsPage.tsx`: passes `clientEmail: request.email` to the function
- `src/pages/ProposalsPage.tsx`: passes `clientEmail: selectedProposal.client.email`

#### 3c. Messages RLS: permission denied for auth.users
**Root cause:** Both client message policies (SELECT + INSERT) did `JOIN auth.users u ON u.email = ea.client_email`. The `authenticated` role cannot read `auth.users` directly — only `service_role` can.

**Fix:** Run in SQL editor (migration file updated at `supabase/migrations/00012_add_messages_table.sql`):
```sql
DROP POLICY "Client reads and sends messages on their portal" ON messages;
DROP POLICY "Client inserts messages on their portal" ON messages;

CREATE POLICY "Client reads and sends messages on their portal"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM engagement_access ea
      WHERE ea.engagement_id = messages.engagement_id
        AND (ea.client_user_id = auth.uid() OR ea.client_email = auth.email())
    )
  );

CREATE POLICY "Client inserts messages on their portal"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM engagement_access ea
      WHERE ea.engagement_id = messages.engagement_id
        AND (ea.client_user_id = auth.uid() OR ea.client_email = auth.email())
    )
  );
```
**Rule for future policies:** Never JOIN `auth.users` in RLS. Use `auth.uid()` and `auth.email()` functions instead.

---

### 4. Proposal approval — downstream updates
**Problem:** `handleApproveProposal` only did `engagements.update({ status: 'active' })`. Proposals table, pipeline leads, and freelancer notification were all untouched.

**Fix:** `supabase/functions/portal-approve-proposal/index.ts` — **complete rewrite, deployed**

On `action: 'approve'`, the function now (all via service role):
1. Validates caller via `engagement_access` (new system — not old `client_portal_tokens`)
2. Updates `engagements.status = 'active'`
3. Updates `proposals.status = 'accepted'` — matches by `business.user_id + contact_id + status='sent'`
4. Advances `pipeline_leads` stage to `'Closed Won'` — matches by `business_id + contact_id`
5. Sends notification email to freelancer (via Resend directly, no `send-email` function needed)

**Frontend:** `ClientPortalPage.handleApproveProposal` now calls the edge function instead of the direct DB update.

**Caveat:** Steps 3 and 4 require `engagement.contact_id` to be non-null. For the test engagement where `contact_id = null`, only the engagement status updates. Going forward, all engagements created through the normal send flow have `contact_id` set.

---

## Outstanding / not yet done

### Needs immediate SQL run (portal testing blocked until these are done)
```sql
-- Messages policies (permission denied bug)
DROP POLICY "Client reads and sends messages on their portal" ON messages;
DROP POLICY "Client inserts messages on their portal" ON messages;
CREATE POLICY "Client reads and sends messages on their portal" ...
CREATE POLICY "Client inserts messages on their portal" ...
-- (full SQL above in section 3c)

-- Fix stale test engagement (section 3a)
update engagements set business_id = '<fftest10_current_id>' where id = '5ffe5f8d-...';
insert into engagement_access (engagement_id, client_email) values ('5ffe5f8d-...', 'fftest11@yopmail.com');
```

### Apple Wallet pass — certs not yet set as Supabase secrets
From v4.1 session. Edge function `generate-wallet-pass` is deployed but will fail until these secrets are set in Supabase dashboard:
- `APPLE_PASS_TYPE_ID`
- `APPLE_TEAM_ID` (FF94K758F9)
- `APPLE_CERT_P12_BASE64`
- `APPLE_CERT_P12_PASSPHRASE`
- `APPLE_WWDR_CERT_BASE64`

### Calendar detection — extend to other surfaces
Currently only in RequestsPage "Ask a Question" composer. Same `CALENDAR_TRIGGER` + debounced Haiku pattern can be applied to:
- OutreachKitPage reply composer
- AICopilot panel (would also need calendar events added to `fetchUserContext`)

### AICopilot doesn't know about calendar events
`fetchUserContext` and `buildChatSystem` in `ai-gateway` never query `calendar_events`. Claude says "I don't have access to your calendar" because it genuinely has no data. Fix: add upcoming events (next 14 days) to `fetchUserContext` + include in system prompt + add `update_calendar_event` action.

### Phase 3.5 (not started this session)
- "Let's Make You Visible" tab
- B2B Outreach Kit
Full spec in `FORGEFLY_OUTREACH_SPEC.md`

---

## Architecture notes added this session

- **Never JOIN `auth.users` in RLS policies** — use `auth.uid()` / `auth.email()` functions
- **`ai-gateway` `mode: 'chat'` response shape** — returns JSON object directly as `data`, not wrapped in `data.message`. Always check `data.date !== undefined` before falling back to `data.message` parsing
- **`engagement_access` is the source of truth for portal auth** — `client_portal_tokens` table is the old system, unused by the new portal. `portal-approve-proposal` was rewritten to use `engagement_access`
- **Soft-delete businesses** — hard-deleting a business leaves dangling `business_id` in engagements. Flagged but not yet fixed. Mitigation: portal page should handle missing business gracefully rather than showing "Portal not found"
- **`generate-portal-link` always needs `clientEmail`** — pass it explicitly from every call site; don't rely on `contact_id` being set on the engagement

---

## Files changed this session

| File | Change |
|---|---|
| `src/pages/RequestsPage.tsx` | Calendar detection, ai-gateway import, calSuggestion/calDetecting state, chip UI, handleAddToCalendar, generate-portal-link clientEmail param |
| `src/pages/ProposalsPage.tsx` | generate-portal-link clientEmail param |
| `src/pages/ClientPortalPage.tsx` | handleApproveProposal → calls edge function |
| `supabase/functions/ai-gateway/index.ts` | runClassifier try/catch, handleExtract early guard |
| `supabase/functions/generate-portal-link/index.ts` | clientEmail fallback param |
| `supabase/functions/portal-approve-proposal/index.ts` | Complete rewrite — engagement + proposal + pipeline + email |
| `supabase/migrations/00012_add_messages_table.sql` | Messages RLS policies (local only — run SQL manually in dashboard) |
| `supabase/migrations/00015_portal_access_fixes.sql` | Businesses public read + engagement_access read policies (already exist in DB) |
