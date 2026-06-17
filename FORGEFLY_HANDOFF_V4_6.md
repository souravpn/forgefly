# Forgefly — Session Handoff v4.6
> Load alongside FORGEFLY_HANDOFF_V4.md + V4_1 + V4_2 + V4_3 + V4_4 + V4_5
> This file covers Phase D work completed in the June 17, 2026 session (#32, #33, #34).

---

## Session summary

This session completed the **Messages Hub** (Phase D tasks #32–#34):
- Migration 00019: `business_id`, `client_id`, `read_at` columns + RLS on `messages`
- New freelancer Messages page at `/dashboard/messages` (split-pane, realtime)
- Portal Messages tab fully wired + read receipts on both sides

All edge functions confirmed deployed (18 total, all ACTIVE). Migration 00019 run by Sourav.

---

## Migration run this session

### `00019_messages_hub.sql` ✓ run
- `messages` table: added `business_id uuid → businesses`, `client_id uuid → contacts`, `read_at timestamptz`
- Indexes: `(client_id, created_at DESC)`, `(business_id, created_at DESC)`
- Freelancer RLS: SELECT + INSERT + UPDATE (read_at) where `business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())`
- Client RLS (new `client_id` path): SELECT + INSERT + UPDATE where `client_id IN (SELECT id FROM contacts WHERE email = auth.email())`
- Existing engagement_id-based client policies from migration 00017 left intact (backward compat)

---

## What was built this session

### #32 — Messages table + freelancer Messages UI

**`supabase/migrations/00019_messages_hub.sql`** — NEW (run ✓)

**`src/pages/MessagesPage.tsx`** — NEW
- Route: `/dashboard/messages`
- Left pane (260px): all business contacts sorted by latest message time; unread bubble; last message preview ("You: …" prefix on freelancer messages)
- Right pane (flex-1): full thread + compose box; Enter-to-send; auto-scroll to bottom
- **Layout**: breaks out of AppShell's 60vw container via `-mx-4 md:-mx-6 -mt-4 md:-mt-6`; fills `calc(100vh - 136px)` (exact chrome height: ForgeflyBand 40 + BusinessBand 56 + TabNav 40)
- **Grid split**: CSS `gridTemplateColumns` instead of Flexbox — avoids min-width collapse. Desktop: always `260px 1fr`. Mobile: toggle `1fr 0px` ↔ `0px 1fr`
- `useIsDesktop()` hook detects viewport ≥ 768px; grid column calculation uses this, not Tailwind breakpoints (avoids class conflict between `flex`/`hidden`/`md:flex`)
- Mobile back nav: back arrow + selected client name appear in page header when in thread view
- Realtime: subscribes to INSERT + UPDATE on `messages` filtered by `business_id`
  - INSERT: appends new message to thread
  - UPDATE: patches `read_at` in place — freelancer sees ✓✓ turn live when client reads
- Read marking: when a contact is selected, marks all their `sender_role='client'` messages `read_at=now()` via UPDATE; local state patched optimistically
- Send: inserts `{ business_id, client_id, sender_id: user.id, sender_role: 'freelancer', body }`
- Read receipts on freelancer's own messages: `✓` (muted, sent) → `✓✓` (primary color, read by client)

**`src/components/shell/NavIcon.tsx`** — added `MessageSquare` from lucide, keyed as `'message-square'`

**`src/config/navigation.ts`** — `Messages` added to `MORE_ITEMS` (first item, above Calendar)

**`src/routes.tsx`** — `/dashboard/messages` route wired to `MessagesPage`

---

### #33 — Messages in client portal

**`src/pages/ClientPortalPage.tsx`** — updated (`ContactHub` component)

**`DBMessage` type**: added `read_at: string | null` (was missing)

**Messages tab height**: changed from hardcoded `calc(100vh - 200px)` to `calc(100dvh - 196px)` with `minHeight: 320px`. Uses `100dvh` (dynamic viewport height) to handle mobile browser chrome correctly.

**Bubble layout**: changed from `flex justify-end/start` to `flex flex-col items-end/start` so read receipt sits below the bubble.

**Incoming freelancer messages while tab is open**:
- `INSERT` handler now checks current tab state — if already on `messages`, marks the incoming message `read_at` immediately (no bell badge increment)
- Uses functional `setTab` form to read current tab without adding it as a dependency

---

### #34 — Read receipts

**Client side (portal)**:
- `useEffect` on `tab` change: when `tab === 'messages'` opens, UPDATE all `sender_role='freelancer'` messages for this `client_id` where `read_at IS NULL` → sets `read_at = now()`. Patches local state optimistically.
- Bell badge clear (`contacts.unread_count = 0`) merged into the same effect (was previously separate).
- Client's own messages show `✓` (gray, sent to server) or `✓✓` (accent color, read by freelancer).

**Freelancer side (MessagesPage)**:
- Added `UPDATE` subscription alongside `INSERT` on the realtime channel
- When client sets `read_at`, the message patches in place in local state — no reload needed
- Freelancer's sent messages show `✓` (muted) → `✓✓` (primary color) live as client reads

---

## Files changed this session

| File | Change |
|---|---|
| `supabase/migrations/00019_messages_hub.sql` | NEW — messages hub columns + RLS |
| `src/pages/MessagesPage.tsx` | NEW — freelancer Messages page |
| `src/pages/ClientPortalPage.tsx` | #33 + #34 — portal messages tab wired + read receipts |
| `src/components/shell/NavIcon.tsx` | Added MessageSquare icon |
| `src/config/navigation.ts` | Messages added to MORE_ITEMS |
| `src/routes.tsx` | /dashboard/messages route added |

---

## Architecture decisions made this session

### CSS Grid for two-pane messenger layout
Flexbox with `flex-1` + `w-{n}` causes min-width collapse when the flex container is narrower than expected. CSS Grid `gridTemplateColumns: '260px 1fr'` is explicit and doesn't collapse. Used inline `style` prop since Tailwind can't reactively change `gridTemplateColumns` at runtime.

### `useIsDesktop()` hook for mobile/desktop split
Tailwind's `hidden md:flex` pattern fails when the same element also has a static `flex` class — order of CSS declarations in the generated file determines which wins, and it's fragile. Using `window.innerWidth >= 768` via a hook + a JS-controlled grid column is more reliable for this case.

### Breaking out of the 60vw AppShell container
Messages needs full available width. Applied `-mx-4 md:-mx-6 -mt-4 md:-mt-6` negative margins on the page root to cancel the AppShell content wrapper's `px-4 md:px-6 py-4 md:py-6` padding. Height is `calc(100vh - 136px)` where 136 = ForgeflyBand(40) + BusinessBand(56) + TabNav(40).

### Read receipts: optimistic local patch + realtime UPDATE subscription
Client marks messages read → UPDATE in DB → Supabase fires UPDATE event → freelancer's MessagesPage receives it → patches `read_at` in local state. No polling. Both sides stay in sync live.

### Functional `setTab` for reading current tab in INSERT handler
The realtime INSERT handler needs to know the current tab to decide whether to mark-read or increment badge. Using `setTab(currentTab => { ... return currentTab; })` reads current state without adding `tab` as a dependency (which would re-subscribe the channel on every tab change).

---

## What is NOT done yet (Phase D remaining)

### #29 — Notifications table + event triggers

```sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES contacts(id),
  recipient_role  text NOT NULL CHECK (recipient_role IN ('freelancer','client')),
  type            text NOT NULL,
  title           text NOT NULL,
  body            text,
  entity_type     text,
  entity_id       uuid,
  read_at         timestamptz,
  emailed_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX ON notifications (business_id, recipient_role, read_at) WHERE read_at IS NULL;
CREATE INDEX ON notifications (client_id, recipient_role, read_at) WHERE read_at IS NULL;
```

Event triggers needed (per spec §13f): proposal sent/viewed/accepted/declined, invoice sent/paid, message received, file uploaded, project status updated.

### #30 — Email delivery for notifications (Resend)
Send client-facing emails from `noreply@forgefly.io` with reply-to = freelancer's `contact_email`. Use freelancer's brand primary color in email header. Resend is already wired (`send-email` edge function) — this task is about adding the notification email triggers.

### #31 — Daily digest cron (freelancer)
8am in freelancer timezone. Aggregate unread notifications from past 24h. Skip if freelancer was active in last 4h. `trigger-nudges` edge function is already deployed — can extend it or create new function.

### #35 — Pipeline ↔ proposal ↔ client full auto-progression
Per spec §13b full matrix. Some already done (proposal sent → Proposal Sent, accepted → Negotiating, declined → Lost — from Phase B). Still missing:
- client proposal request → pipeline: Prospect (submit-proposal-request does create a `proposals` row with `initiated_by='client'` but doesn't auto-create pipeline card)
- invoice created → pipeline: Closed Won
- contacts.lifecycle_status auto-transitions (prospect → engaged on accept; engaged → archived on inactivity; archived → prospect on new request)

### #36 — Returning client new proposal flow
When an engaged or archived client submits a new request via their portal: link to existing `client_id`, auto-transition lifecycle back to prospect if archived, create pipeline card at Prospect.

### #37 — Read-only project status in portal
Add `client_visible_status` and `client_visible_note` columns to `projects`. Freelancer writes these from ProjectsPage. Portal Projects tab (currently empty state) renders them.

Migration needed:
```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_visible_status text
    CHECK (client_visible_status IN ('not_started','in_progress','review','complete')),
  ADD COLUMN IF NOT EXISTS client_visible_note text;
```

### #38 — File sharing (portal_files table + UI)
```sql
CREATE TABLE portal_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  client_id   uuid REFERENCES contacts(id),
  uploaded_by text CHECK (uploaded_by IN ('freelancer','client')),
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  file_size   int,
  created_at  timestamptz DEFAULT now()
);
```
Supabase Storage bucket: `portal-files`, scoped by `business_id/client_id/`. Portal Files tab (currently empty state) renders these. 50MB per file default.

### #39 — Client profile completion prompt
One-time prompt on first portal login when `contacts.portal_last_seen IS NULL`. Fields: phone, company (optional), timezone. Writes to `contacts`. Sets `portal_last_seen` after save or skip.

---

## Phase D task status summary

| # | Task | Status |
|---|---|---|
| 25 | contacts lifecycle + portal_token fields | ✅ Done (migration 00017) |
| 26 | Client card engaged state + portal bypass link | ✅ Done |
| 27 | Portal auth flow fix | ✅ Done |
| 28 | Portal header + footer | ✅ Done |
| 29 | Notifications table + event triggers | Pending |
| 30 | Email delivery for notifications | Pending |
| 31 | Daily digest cron | Pending |
| 32 | Messages table + freelancer Messages UI | ✅ Done (this session) |
| 33 | Messages in client portal | ✅ Done (this session) |
| 34 | Message read receipts | ✅ Done (this session) |
| 35 | Pipeline ↔ proposal ↔ client full auto-progression | Partial (B-phase done; full matrix pending) |
| 36 | Returning client new proposal flow | Pending |
| 37 | Read-only project status in portal | Pending |
| 38 | File sharing | Pending |
| 39 | Client profile completion prompt | Pending |

**Suggested next order:** #29 (notifications schema) → #30 (email triggers) → #37 (quickest, just schema + portal UI) → #39 → #35 → #36 → #38 → #31

---

## Phase C and Phase 14 status

### Phase C — Visibility + B2B Outreach Kit
All C tasks (C1–C10) are specced in `FORGEFLY_OUTREACH_SPEC.md §3–§11`. Not started. Edge functions `generate-visibility-kit`, `research-company`, `handle-reply-intent` are deployed but UIs are shells.

### Phase 14 — Accounting + Time Tracking
Tasks #40–#56 specced in `FORGEFLY_OUTREACH_SPEC.md §14`. Not started.

---

## Standing pending items (non-feature)

| Item | Notes |
|---|---|
| Apple Wallet certs | 5 Supabase secrets unset — blocks `generate-wallet-pass` |
| Stripe subscription price | `unit_amount: 100` → `2900` in `create-subscription-checkout` before launch |
| Stripe webhook registration | Register `stripe-webhook` endpoint in Stripe Dashboard; check env var name (`SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_KEY`) |
| Resend SMTP in Supabase Auth | Auth → SMTP: host `smtp.resend.com`, port 465, user `resend`, password = Resend API key |
| Storage bucket RLS | `avatars` bucket INSERT (authenticated) + SELECT (anon+authenticated) |
| Terms of Service + Privacy Policy | Pages linked from signup but don't exist |
| Landing page hero image | Save screenshot → `public/dashboard-screenshot.png`; update `LandingPage.tsx` ~line 300 |

---

## Key patterns to remember

### Radix dialog null-guard
Always `{state && <Content>}` inside Radix Dialog/AlertDialog/Sheet.
`open={!!state}` alone is not enough — Radix renders children even when closed.

### Never JOIN `auth.users` in RLS
Use `auth.uid()` and `auth.email()` only. JOINs to `auth.users` cause "permission denied" for the authenticated role.

### `business_id` is the canonical scope key
All message/proposal/invoice queries filter by `business_id`. `user_id` is for RLS only.

### Messages table dual-path
- New hub path: `client_id` (contacts FK) — used by MessagesPage and ContactHub
- Legacy path: `engagement_id` (engagements FK) — used by EngagementPortal (backward compat)
- Both paths coexist; RLS policies cover both

### MessagesPage layout
- Breaks out of 60vw container: `-mx-4 md:-mx-6 -mt-4 md:-mt-6` on page root
- Height: `calc(100vh - 136px)` = full viewport minus shell chrome
- Two-pane: CSS Grid inline style (`gridTemplateColumns`) — not Tailwind flex (fragile at runtime)
- `useIsDesktop()` hook (window.innerWidth ≥ 768) controls column toggle, not CSS classes

### Portal messages height
Uses `calc(100dvh - 196px)` with `minHeight: 320px`. `100dvh` handles mobile browser address bar.

### Functional setState for reading current state in realtime handlers
When a realtime callback needs to read current state (e.g., current tab) without re-subscribing, use:
```typescript
setState(current => { /* read current, maybe call side effects */ return current; });
```
