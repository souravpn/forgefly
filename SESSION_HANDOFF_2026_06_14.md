# Session Handoff — 2026-06-14

## What Was Built This Session

### 1. Settings Page — Delete Business + Delete Account (src/pages/SettingsPage.tsx)

**Delete Business** (Business Profile tab, bottom):
- Expandable danger zone card with red border
- Type `DELETE` to unlock the button
- On confirm: sets `businesses.status = 'archived'`, `archived_at = now()`, redirects to `/`
- 7-day TTL before permanent purge (via pg_cron)

**Delete Account** (Account tab, bottom):
- Expandable danger zone card
- Step 1: "Send confirmation code" → calls `request-deletion-otp` edge function → 6-digit OTP emailed
- Step 2: User enters code → calls `confirm-account-deletion` edge function → deletes all data, calls `auth.admin.deleteUser`, signs out, redirects to `/`

**New edge functions written** (need deployment):
- `supabase/functions/request-deletion-otp/index.ts` — generates OTP, upserts `deletion_otps`, sends via `send-email`
- `supabase/functions/confirm-account-deletion/index.ts` — verifies OTP, deletes: businesses → clients → proposals → invoices → prompt_sessions → profiles → auth user

**Email template added**: `getDeletionOtpEmailTemplate` in `_shared/email-templates.ts`

---

### 2. Proposal Requests Page — Full Rebuild (src/pages/RequestsPage.tsx)

**Pill tab filter**: All | Requests | Drafted | Accepted | Declined (with live counts per status)

**AI Draft now saves to proposals table**:
- Parses AI JSON (handles code fences + raw JSON)
- Upserts prospect as `clients` row with `status: 'prospect'`
- Inserts into `proposals` table with `status: 'draft'`
- Stores `proposal.id` in `proposal_requests.engagement_id`
- After saving, opens **Draft Modal** immediately

**Draft Modal** (opens after AI draft OR clicking a drafted card):
- VIEW mode: formatted proposal — "The Challenge", Scope of Work table, "Why This Works For [Company]" sections
- EDIT mode: inline inputs for all fields
- Footer: Edit draft | Regenerate (re-runs AI, overwrites DB) | Send to [FirstName]
- "Send to client" runs full flow: upsert engagement → generate portal link → send portal invite email → mark proposal `sent`

**Old drafted cards** (created before proposal saving existed):
- Clicking "View draft →" shows toast with "Re-draft" action that resets status to `new`

**"Ask a Question" button** (on `new` status cards):
- Appears between "Draft with AI" and "Decline"
- Expands inline textarea with recipient email shown, placeholder pre-filled with client first name
- Cancel / Send to [FirstName] buttons
- Uses `client_message` email type via `send-email` function

---

### 3. Portal Invite Email Redesign (supabase/functions/_shared/email-templates.ts)

Updated `getPortalInviteEmailTemplate` to match new design:
- Subject: `[Proposal Title] — [Business Name]`
- Opens with client's first name + references their specific problem in the first line
- Dark card layout with green accent strip
- Portal token box (dark, monospace URL, "Sign in with your Google account")
- "Open Client Portal →" CTA button
- Closes with `— [FreelancerFirstName]`

**New data fields accepted**: `clientFirstName`, `freelancerName`, `problemSnippet`

**CC support added** to `send-email` edge function — pass `cc: freelancerEmail` in body, gets forwarded to Resend API

---

## SQL Migrations Needed (run in Supabase SQL editor)

```sql
-- Soft-delete for businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS confidence_map JSONB;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS completeness_score INT DEFAULT 0;

-- OTP table for account deletion
CREATE TABLE IF NOT EXISTS deletion_otps (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE deletion_otps ENABLE ROW LEVEL SECURITY;

-- Portal token column on engagements (if not already added)
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;

-- pg_cron: purge archived businesses after 7 days
-- (enable pg_cron extension first in Dashboard → Database → Extensions)
SELECT cron.schedule(
  'purge-archived-businesses',
  '0 2 * * *',
  $$DELETE FROM businesses WHERE status = 'archived' AND archived_at < now() - interval '7 days'$$
);
```

---

## Edge Functions to Deploy

```bash
supabase functions deploy request-deletion-otp
supabase functions deploy confirm-account-deletion
supabase functions deploy send-email
supabase functions deploy generate-portal-link
```

---

## Known Issues / In-Progress

### Portal "not found" at UUID-style URLs
- **Root cause**: `generate-portal-link` not yet deployed with new code. Old function generates random hex tokens that aren't stored in `engagements.portal_token`.
- **Fix**: Deploy `generate-portal-link` + run `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE`. Old portal links won't work — freelancer needs to resend proposal to regenerate token.
- **Status**: User still testing, not confirmed broken.

### ProposalsPage "No proposals yet" for AI-drafted proposals
- **Root cause** (previously): AI draft was only logged to console, never saved to `proposals` table. Now fixed — saves on draft.
- **Note**: Proposals drafted before this session's fix won't appear. They'll need to be re-drafted from Requests page.

---

## Architecture Notes

### Proposal Request Flow (complete)
1. Prospect fills form on `/p/<slug>` → `submit-proposal-request` edge function → `proposal_requests` table, `status: 'new'` + nudge notification
2. Freelancer sees it in Requests page → clicks "Draft with AI"
3. AI generates draft → saved to `proposals` table (`status: 'draft'`) → `proposal_request.engagement_id` = `proposal.id`
4. Draft Modal opens → freelancer reviews/edits/regenerates
5. "Send to [Client]" → upserts `engagements` row → `generate-portal-link` → `send-email` (portal invite with CC) → `proposal.status = 'sent'`, `proposal_request.status = 'sent'`
6. Client gets email → clicks portal link → `ClientPortalPage` at `/portal/<token>` → auth gate → 5-tab portal

### Key Schema Relationships
- `proposal_requests.engagement_id` → `proposals.id` (reused column, semantically a proposal_id)
- `engagements.portal_token` → what `/portal/:token` looks up by
- `engagement_access` → per-engagement email allowlist for client portal auth
- `businesses.status = 'archived'` + `archived_at` → soft-delete with 7-day TTL

### Files Changed This Session
- `src/pages/SettingsPage.tsx` — delete business + delete account danger zones
- `src/pages/RequestsPage.tsx` — complete rewrite with modal, pill tabs, ask-a-question
- `supabase/functions/_shared/email-templates.ts` — portal invite redesign + deletion OTP template
- `supabase/functions/send-email/index.ts` — CC support + deletion_otp case + new portal_invite fields
- `supabase/functions/request-deletion-otp/index.ts` — new
- `supabase/functions/confirm-account-deletion/index.ts` — new

---

## Pending From Previous Sessions (still not done)

- Stripe webhook registration in Stripe dashboard
- Resend SMTP configured in Supabase Auth (for magic links to use Resend, not Supabase default)
- Storage bucket RLS for user avatars
- Terms of Service + Privacy Policy pages
- Landing page hero screenshot (for OG/meta)
- pg_cron for daily nudges (`trigger-nudges` function)
