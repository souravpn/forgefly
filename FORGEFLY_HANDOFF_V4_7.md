# Forgefly — Session Handoff v4.7
> Load alongside FORGEFLY_HANDOFF_V4.md + V4_1 + V4_2 + V4_3 + V4_4 + V4_5 + V4_6
> This file covers Phase D work completed in the June 17, 2026 session (#29, #30, #37).

---

## Session summary

This session completed:
- **#29** — Notifications table + DB trigger nudges + realtime bell
- **#30** — Email delivery: freelancer-to-client emails for messages and project status updates
- **#37** — Read-only project status in client portal

Migrations to run: 00020, 00021 (both confirmed run by Sourav this session).
Edge functions deployed: `send-email`, `portal-approve-proposal`.

---

## Migrations run this session

### `00020_notifications.sql` ✓ run
- `notifications` table: `business_id`, `client_id`, `recipient_role` ('freelancer'|'client'), `type`, `title`, `body`, `entity_type`, `entity_id`, `read_at`, `emailed_at`
- Indexes: partial on unread rows only — `(business_id, created_at DESC) WHERE read_at IS NULL AND recipient_role = 'freelancer'` and symmetric for client
- RLS: freelancer SELECT + UPDATE via `business_id IN (businesses WHERE user_id = auth.uid())`; client SELECT + UPDATE via `client_id IN (contacts WHERE email = auth.email())`
- `contacts` UPDATE policy for clients: allows portal to write `portal_last_seen`
- **DB trigger `trg_nudge_on_client_message`** on `messages` INSERT: when `sender_role='client'` and `business_id IS NOT NULL`, inserts a nudge (freelancer bell) + notifications row. Runs SECURITY DEFINER — bypasses RLS.
- **DB trigger `trg_nudge_on_portal_first_visit`** on `contacts` UPDATE: when `portal_last_seen` transitions NULL → non-null, inserts nudge + notifications row for freelancer.

### `00021_project_client_visibility.sql` ✓ run
- `projects` table: `contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL`, `client_visible_status text CHECK (IN ('not_started','in_progress','review','complete'))`, `client_visible_note text`
- Index: `(contact_id) WHERE contact_id IS NOT NULL`
- RLS: client SELECT on projects where `client_visible_status IS NOT NULL AND contact_id IN (contacts WHERE email = auth.email())`

---

## What was built this session

### #29 — Notifications table + event triggers

**`supabase/migrations/00020_notifications.sql`** — NEW (run ✓)
See migration details above.

**`src/hooks/useNudges.ts`** — updated
- Added Supabase Realtime subscription: `nudges:${user.id}` channel, INSERT filter `user_id=eq.{id}`
- New nudges prepend to local state immediately — bell badge increments live without any refresh

**`supabase/functions/portal-approve-proposal/index.ts`** — updated + redeployed
- After proposal approve (proposalId path): inserts nudge `{ type: 'proposal_accepted', user_id: business.user_id }` + notifications row
- `contact` variable is in scope (fetched earlier to advance pipeline), used as `client_id` on the notification row

**`src/pages/ClientPortalPage.tsx`** (`ContactHub`) — updated
- `useEffect` on mount: `UPDATE contacts SET portal_last_seen = now() WHERE id = contact.id`
- DB trigger `trg_nudge_on_portal_first_visit` fires when `portal_last_seen` changes from NULL → non-null

**Event coverage after #29:**

| Client action | Freelancer bell notification |
|---|---|
| Sends a message | ✅ DB trigger on messages INSERT |
| Opens portal (first time) | ✅ DB trigger on contacts UPDATE |
| Accepts proposal | ✅ Edge function write (portal-approve-proposal) |

---

### #30 — Email delivery for notifications

**`supabase/functions/_shared/email-templates.ts`** — updated + redeployed
- `getClientMessageTemplate(clientName, senderName, subject, message, portalUrl?)` — added optional `portalUrl` parameter
- When `portalUrl` is provided, renders a "View in portal →" CTA button in the email body

**`supabase/functions/send-email/index.ts`** — updated + redeployed
- New top-level `reply_to` parameter: passed directly to Resend API as `reply_to: [reply_to]`
- `client_message` case: forwards `data.portalUrl` to `getClientMessageTemplate`
- Purpose: client email replies land in the freelancer's inbox (`business.contact_email`) not noreply@forgefly.io

**`src/pages/MessagesPage.tsx`** — updated
- `Contact` type: added `portal_token: string | null`
- Contacts query: added `portal_token` to SELECT
- `handleSend`: after successful message INSERT, fire-and-forget `supabase.functions.invoke('send-email', ...)`:
  - `type: 'client_message'`
  - `to: contact.email`
  - `reply_to: business.contact_email`
  - `data.portalUrl`: built from `SITE_URL/portal/${contact.portal_token}` if token exists
  - Does NOT block the UX — errors are silent (email is best-effort)
- Added `const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'https://www.forgefly.io'`

**`src/pages/ProjectsPage.tsx`** — updated
- Added `useBusiness()` hook for `business.name` and `business.contact_email`
- Added `const SITE_URL` constant
- `handleSubmit` contact resolve: now fetches `id, email, name, portal_token` (was just `id`)
- After project save: sends email if `client_visible_status` is set AND changed from previous value:
  - `statusChanged`: `isEditModalOpen ? new !== old : true` (always send on create)
  - Email body: `"Status: In progress\n{note}"` (no note line if note is empty)
  - `portalUrl` from `contactPortalToken`

**Email coverage after #30:**

| Event | Recipient | Email type |
|---|---|---|
| Proposal sent to client | Client | `portal_invite` (ProposalsPage — pre-existing) |
| Client accepts proposal | Freelancer | Custom HTML (portal-approve-proposal — pre-existing) |
| Freelancer sends message | Client | `client_message` + portal CTA (new) |
| Project status updated | Client | `client_message` + status + note + portal CTA (new) |

**Not yet emailed (future #30 extension):**
- Invoice sent → client email
- File shared → client email
- Daily digest for freelancer (#31)

---

### #37 — Read-only project status in portal

**`supabase/migrations/00021_project_client_visibility.sql`** — NEW (run ✓)
See migration details above.

**`src/types/types.ts`** — updated `Project` interface
```typescript
contact_id: string | null;
client_visible_status: 'not_started' | 'in_progress' | 'review' | 'complete' | null;
client_visible_note: string | null;
```

**`src/pages/ProjectsPage.tsx`** — updated
- `formData` state: added `client_visible_status: ''` and `client_visible_note: ''`
- `openCreateModal` / `openEditModal`: initialize new fields (edit reads `project.client_visible_status ?? ''`)
- `handleSubmit`:
  - Resolves `contact_id`: queries `contacts WHERE email = client.email`, sets `contact_id` silently — freelancer doesn't need a separate action
  - Passes `contact_id`, `client_visible_status: formData.client_visible_status || null`, `client_visible_note: formData.client_visible_note || null` to `createProject`/`updateProject`
- Edit modal: new "Visible to client in portal" section (below board status, above footer):
  - "Client status" dropdown: Not shared / Not started / In progress / In review / Complete
  - "Note for client" textarea (2 rows)
  - Section separated by `border-t` with a `text-xs uppercase tracking-wide` label

**`src/pages/ClientPortalPage.tsx`** — updated (`ContactHub`)
- New `PortalProject` interface: `id, name, description, deadline, client_visible_status, client_visible_note`
- `projects` state added
- `useEffect` on mount: loads `projects WHERE contact_id = contact.id AND client_visible_status IS NOT NULL ORDER BY created_at DESC`
- Projects tab: replaced empty state with project cards:
  - Status badge: colored pill (gray=not_started, accent=in_progress, amber=review, green=complete)
  - Note shown below a border-t divider if set
  - Deadline shown if set
  - Empty state when `projects.length === 0`

---

## Files changed this session

| File | Change |
|---|---|
| `supabase/migrations/00020_notifications.sql` | NEW — notifications table + DB triggers |
| `supabase/migrations/00021_project_client_visibility.sql` | NEW — project portal visibility |
| `src/hooks/useNudges.ts` | Realtime subscription for live bell |
| `src/pages/ClientPortalPage.tsx` | portal_last_seen on mount + projects tab + PortalProject type |
| `src/pages/ProjectsPage.tsx` | client_visible_* fields + contact_id auto-resolve + project status email |
| `src/pages/MessagesPage.tsx` | portal_token in Contact + email after message send |
| `src/types/types.ts` | Project type extended with contact_id + client_visible_* |
| `supabase/functions/_shared/email-templates.ts` | getClientMessageTemplate portalUrl CTA |
| `supabase/functions/send-email/index.ts` | reply_to + portalUrl passthrough |
| `supabase/functions/portal-approve-proposal/index.ts` | Nudge + notification insert on approve |

---

## What is NOT done yet (Phase D remaining)

### #31 — Daily digest cron (freelancer)
8am in freelancer timezone. Aggregate unread nudges from past 24h. Skip if freelancer was active in last 4h. `trigger-nudges` edge function is already deployed — extend or create `send-daily-digest`. Requires knowing freelancer timezone (from business profile or contacts.timezone).

### #35 — Pipeline ↔ proposal ↔ client full auto-progression
Partial (Phase B done: proposal sent → "Proposal Sent" stage, accept → "Negotiating", decline → "Lost").
Still missing:
- `submit-proposal-request` creates a proposals row with `initiated_by='client'` but does NOT create a pipeline card — add pipeline_leads INSERT there
- Invoice created/paid → pipeline stage → "Closed Won"
- `contacts.lifecycle_status` auto-transitions: prospect→engaged on accept; engaged→archived after 90 days inactivity; archived→prospect on new request

### #36 — Returning client new proposal flow
When archived/engaged client submits a new request via portal: link to existing `client_id`/`contact_id`, transition `lifecycle_status` back to 'prospect', create pipeline card at Prospect stage.

### #38 — File sharing (portal_files + Supabase Storage)
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
Storage bucket: `portal-files`, scoped `business_id/client_id/`. Portal Files tab (currently empty) renders these. 50MB per file.

### #39 — Client profile completion prompt
One-time on first portal login when `contacts.portal_last_seen IS NULL` (now set on mount, so trigger BEFORE the mount update). Fields: phone, company, timezone. Writes to `contacts`. Skip or save closes the prompt.
⚠️ Note: the portal now sets `portal_last_seen` on EVERY mount. For #39, the "first visit" check needs to happen BEFORE the update — read `contact.portal_last_seen` from the initial prop (already null on truly first visit since the prop comes from the token loader which ran before mount).

---

## Phase D task status summary

| # | Task | Status |
|---|---|---|
| 25 | contacts lifecycle + portal_token fields | ✅ Done |
| 26 | Client card engaged state + portal bypass link | ✅ Done |
| 27 | Portal auth flow fix | ✅ Done |
| 28 | Portal header + footer | ✅ Done |
| 29 | Notifications table + event triggers | ✅ Done (this session) |
| 30 | Email delivery for notifications | ✅ Done (this session) |
| 31 | Daily digest cron | Pending |
| 32 | Messages table + freelancer Messages UI | ✅ Done |
| 33 | Messages in client portal | ✅ Done |
| 34 | Message read receipts | ✅ Done |
| 35 | Pipeline ↔ proposal ↔ client full auto-progression | Partial |
| 36 | Returning client new proposal flow | Pending |
| 37 | Read-only project status in portal | ✅ Done (this session) |
| 38 | File sharing | Pending |
| 39 | Client profile completion prompt | Pending |

**Suggested next order:** #39 → #38 → #35 → #36 → #31

---

## Architecture decisions made this session

### DB triggers for cross-role notifications
Client sends message → freelancer gets a nudge. The client's RLS session can't insert rows with `user_id = freelancer.user_id`. DB triggers run SECURITY DEFINER and bypass RLS, so they can write nudges for any user. This is the correct pattern for cross-role side effects.

### `portal_last_seen` UPDATE from client session
The `contacts` UPDATE policy for clients was added in migration 00020. Scoped to `email = auth.email()`. Allows the portal to write `portal_last_seen` on mount. Implications for #39: since portal_last_seen is now set on every ContactHub mount, the "first visit" gate must check the value from the INITIAL prop (before the mount effect runs) — `contact.portal_last_seen` from the loader is null on truly first visit.

### `contact_id` auto-resolve in ProjectsPage
Projects use the legacy `clients` table (FK: `client_id → clients.id`). The portal uses the `contacts` table. To link them, `handleSubmit` silently queries `contacts WHERE email = clients[selected].email` and sets `contact_id`. The freelancer doesn't see this — they just pick a client as before. The freelancer's RLS on contacts means the email match is already scoped to their own business.

### Email is fire-and-forget
`supabase.functions.invoke('send-email', ...)` is called without `await` in both MessagesPage and ProjectsPage. Errors are not surfaced to the user. Email delivery is best-effort — the message/project save succeeds regardless. This is intentional: don't block the freelancer's workflow on email delivery.

### `reply_to` on all client emails
All emails sent to clients via `send-email` now include `reply_to: business.contact_email`. This means if the client hits "Reply" in their email client, the reply goes directly to the freelancer — not to the Forgefly noreply address. Critical for the freelancer to actually receive client replies.

---

## Key patterns (carry forward)

### Never JOIN `auth.users` in RLS — use `auth.uid()` / `auth.email()` only
### `business_id` is the canonical scope key — `user_id` is for RLS only
### Radix dialog null-guard: `{state && <Content>}` inside Dialog/Sheet/AlertDialog
### DB trigger SECURITY DEFINER for cross-role writes (client action → freelancer nudge)
### Functional `setState(current => ...)` to read current state in realtime handlers without adding deps

---

## Standing pending items (non-feature)

| Item | Notes |
|---|---|
| Apple Wallet certs | 5 Supabase secrets unset — blocks `generate-wallet-pass` |
| Stripe subscription price | `unit_amount: 100` → `2900` in `create-subscription-checkout` |
| Stripe webhook registration | Register `stripe-webhook` in Stripe Dashboard |
| Resend SMTP in Supabase Auth | Auth → SMTP: `smtp.resend.com:465`, user `resend`, password = API key |
| Storage bucket RLS | `avatars` bucket: INSERT (authenticated) + SELECT (anon+auth) |
| Terms of Service + Privacy Policy | Pages linked from signup but don't exist |
| Landing page hero image | `public/dashboard-screenshot.png` + update `LandingPage.tsx` ~line 300 |
| `VITE_SITE_URL` env var | Both MessagesPage and ProjectsPage now use `import.meta.env.VITE_SITE_URL` with fallback to `https://www.forgefly.io` — add to `.env` if needed |
