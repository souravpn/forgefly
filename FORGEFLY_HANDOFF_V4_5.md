# Forgefly — Session Handoff v4.5
> Load alongside FORGEFLY_HANDOFF_V4.md + V4_1 + V4_2 + V4_3 + V4_4
> This file covers Phase D work completed in the June 17, 2026 session (Client Portal Hub — tasks #25–#28).

---

## Session summary

This session built the **Per-Client Portal Hub** architecture (Phase D, §13). The portal is now per-client (routes via `contacts.portal_token`) with a full 6-tab hub, backward compat for old engagement links, pipeline "Engaged" state visibility, and a polished portal header.

Phase C (Visibility + B2B Outreach Kit) was intentionally skipped — Phase D is independent of it.

---

## Migrations run this session (both applied in Supabase)

### `00017_client_portal_hub.sql` ✓ run
- `contacts` table: added `lifecycle_status` (prospect/engaged/archived), `portal_token` (UNIQUE), `portal_last_seen`, `unread_count`
- All existing contacts got `portal_token` generated via `encode(gen_random_bytes(8), 'hex')`
- RLS: "Portal token holder can read contact" (by token), "Client can read own contact by email" (by auth.email())
- Messages RLS fix: dropped old policies that JOINed `auth.users` (permission denied bug), recreated using `auth.uid()` / `auth.email()` only

### `00018_portal_hub_client_rls.sql` ✓ run
- `proposals`: client-read policy — `status IN ('sent','viewed','accepted','declined','rejected','expired') AND client_email = auth.email()`
- `invoices`: client-read policy — via `contacts.email = auth.email()` through `contact_id`

---

## What was built this session

### #27 — Portal auth flow fix (per-client hub architecture)

**`supabase/functions/portal-approve-proposal/index.ts`** — updated
- New `proposalId` path alongside legacy `engagementId` path
- `proposalId` path validates `proposal.client_email === user.email` (not engagement_access)
- `track_viewed`: marks specific proposal viewed (not all by email)
- `approve`: updates proposal status='accepted', advances pipeline_lead to 'Negotiating', sets `contacts.lifecycle_status='engaged'`, emails freelancer
- Legacy `engagementId` path kept intact

**`supabase/functions/generate-portal-link/index.ts`** — updated
- Now prefers `contacts.portal_token` over `engagements.portal_token`
- If contact exists: use/generate contacts.portal_token as primary URL
- Maintains `engagement.portal_token` + `engagement_access` for backward compat
- Falls back to engagement token path if no contact or contact token fails

**`src/pages/ClientPortalPage.tsx`** — full rewrite (~900 lines)

Resolution logic (main `ClientPortalPage` component):
1. Try `contacts WHERE portal_token = token` → `ContactPortalWithAuth` → `ContactHub`
2. Fallback: `engagements WHERE portal_token = token` → `EngagementPortalWithAuth` → `EngagementPortal` (legacy, kept intact)

`ContactPortalWithAuth`: validates `session.user.email === contact.email`; shows `AuthGate` or `AccessDenied` as needed.

`ContactHub` — 6 tabs:
| Tab | Data source | Notes |
|---|---|---|
| Overview | proposals + invoices counts | Quick stats + recent proposals list |
| Proposals | `proposals` by `business_id + client_email` | Dialog detail with approve/decline, calls `portal-approve-proposal` with `proposalId` |
| Invoices | `invoices` by `contact_id` | Pay with Stripe CTA |
| Projects | empty state | Ready for #37 |
| Messages | `messages` by `client_id` | Realtime, empty state until #32 adds `client_id` column |
| Files | empty state | Ready for #38 |

`AuthGate`: refactored to accept `businessName`/`clientName` props (works for both portal paths). Google + magic link sign-in.

`EngagementPortal` and `EngagementPortalWithAuth`: kept exactly as before for backward compat.

---

### #26 — Client card engaged state + portal bypass link

**`src/pages/PipelinePage.tsx`** — updated

- `Lead` type: added `lifecycleStatus: string`, `portalToken: string | null`
- `loadLeads` query: joined `contacts(name, lifecycle_status, portal_token)`
- `LeadCard`: shows **"Client"** badge (emerald) when `lifecycleStatus === 'engaged'`
- `LeadCard` action row: adds **Link2** (copy portal URL to clipboard) + **ExternalLink** (open portal in new tab) buttons when `portalToken` is set
- `handleSaveLead` (new contact path): generates `portal_token` client-side at insert time via `crypto.getRandomValues`
- `generatePortalToken()` helper added

---

### #28 — Portal header + footer

**`src/pages/ClientPortalPage.tsx`** — changes to `ContactHub`

**Notification bell:**
- Bell icon in header, seeded from `contact.unread_count`
- Red badge shows count (capped at "9+")
- Click → switches to Messages tab + clears badge + resets `contacts.unread_count = 0` in DB
- New freelancer messages via realtime also increment badge

**Client avatar dropdown** (replaces flat initials + "Sign out" button):
- Accent-colored initials button → `DropdownMenu`
- Shows client name + email at top
- "Sign out" item (red) at bottom
- Uses `@/components/ui/dropdown-menu`

**Footer badge:**
- Pill-shaped: `⚡ Powered by Forgefly ›`
- Subtle border + accent ⚡ — present but not loud

---

## Edge functions to deploy

Both updated this session — deploy before testing portal:

```bash
supabase functions deploy portal-approve-proposal
supabase functions deploy generate-portal-link
```

---

## Files changed this session

| File | Change |
|---|---|
| `supabase/migrations/00017_client_portal_hub.sql` | NEW — contacts lifecycle fields + messages RLS fix |
| `supabase/migrations/00018_portal_hub_client_rls.sql` | NEW — client-read RLS on proposals + invoices |
| `supabase/functions/portal-approve-proposal/index.ts` | proposalId path + lifecycle_status update |
| `supabase/functions/generate-portal-link/index.ts` | prefers contacts.portal_token |
| `src/pages/ClientPortalPage.tsx` | Full rewrite — ContactHub + legacy fallback |
| `src/pages/PipelinePage.tsx` | Engaged badge + portal bypass link buttons |

---

## Architecture decisions made this session

### Contact-first portal resolution
`/portal/:token` first queries `contacts.portal_token`; only falls back to `engagements.portal_token` if no contact found. This means all new portal links are per-client hub links. Old links (shared before this session) still work via the legacy path.

### proposalId validation by email, not engagement_access
The new portal hub has no `engagement_access` row. Proposal approval is validated by `proposal.client_email === user.email`. Safe because this function uses the service role key for reads but validates the caller's identity via the auth JWT.

### portal_token generated client-side on new lead creation
Avoids a round-trip to the server. Uses `crypto.getRandomValues` (16 hex chars). Collision risk is negligible for this scale.

### unread_count cleared on tab open, not on message render
Clearing on tab switch is simpler and avoids marking-as-read before the user has seen the messages (they might open the tab and not scroll down).

---

## What is NOT done yet (Phase D remaining)

### Next up: #32 — Messages migration + freelancer UI

**Migration needed:**
```sql
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id),
  ADD COLUMN IF NOT EXISTS client_id   uuid REFERENCES contacts(id),
  ADD COLUMN IF NOT EXISTS read_at     timestamptz;

CREATE INDEX IF NOT EXISTS messages_client_id_idx ON messages (client_id);
CREATE INDEX IF NOT EXISTS messages_business_id_idx ON messages (business_id);
```

**Freelancer side**: A "Messages" section (or tab) in the dashboard where the freelancer can see per-client message threads and reply. Currently only the client-side portal has messaging UI.

**RLS additions needed:**
- Freelancer can read/insert messages where `business_id = auth.uid()`'s business (via businesses.user_id)
- Client can read/insert messages where `client_id = contact.id` (contact found by email)

### #29 — Notifications table + event triggers
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  contact_id  uuid REFERENCES contacts(id),
  type        text NOT NULL,  -- 'proposal_approved', 'message_received', 'invoice_paid'
  payload     jsonb,
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);
```
Triggers or application-level writes when: proposal approved, message sent by client, invoice paid.

### #37 — Read-only project status in portal
Add `client_visible_status` (text) and `client_visible_note` (text) columns to `projects`.
Freelancer sets these from the project detail page; client sees them in the Projects tab of the hub.

### #38 — File sharing
New `portal_files` table:
```sql
CREATE TABLE portal_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  contact_id  uuid REFERENCES contacts(id),
  name        text NOT NULL,
  url         text NOT NULL,
  size        bigint,
  uploaded_by text,  -- 'freelancer' | 'client'
  created_at  timestamptz DEFAULT now()
);
```
Files tab in hub renders these; freelancer uploads from dashboard.

### #39 — Client profile completion prompt
On first portal visit (when `contact.portal_last_seen IS NULL`), show a prompt asking the client to confirm/add their company name and any notes. Updates `contacts.company` + sets `portal_last_seen`.

### Apple Wallet certs (still not set)
Supabase secrets still needed:
- `APPLE_PASS_TYPE_ID`
- `APPLE_TEAM_ID` (FF94K758F9)
- `APPLE_CERT_P12_BASE64`
- `APPLE_CERT_P12_PASSPHRASE`
- `APPLE_WWDR_CERT_BASE64`

---

## Key patterns to remember

### Radix dialog null-guard
Always `{state && <Content>}` inside Radix Dialog/AlertDialog/Sheet.
`open={!!state}` alone is not enough — Radix renders children even when closed.

### Never JOIN `auth.users` in RLS
Use `auth.uid()` and `auth.email()` functions only. JOINs to `auth.users` cause "permission denied" for the authenticated role.

### business_id is the canonical scope key
All proposal/invoice/message queries filter by `business_id` (from `useBusiness()` context). `user_id` is for RLS only.

### Portal token sources
- New hub: `contacts.portal_token` (per-client, persistent)
- Legacy: `engagements.portal_token` (per-engagement)
- Both resolve via `ClientPortalPage` — contacts checked first

### Proposal approval validation
New hub: `proposal.client_email === user.email` (email match)
Legacy: `engagement_access` row (uid or email match)
