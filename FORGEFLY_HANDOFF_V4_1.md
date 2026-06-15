# Forgefly — Handoff v4.1
> Session: June 14–15, 2026
> Supersedes: FORGEFLY_HANDOFF_V4.md for v4.1 amendment status
> Load alongside FORGEFLY_HANDOFF_V4.md and FORGEFLY_OUTREACH_SPEC.md

---

## What happened this session

All v4.1 amendments from FORGEFLY_HANDOFF_V4.md §"v4.1 amendments" were implemented.
The session also added a contact phone field (not in the original spec — user requested it).

---

## v4.1 amendment status — COMPLETE

| Amendment | Status | Notes |
|---|---|---|
| 10a — Portfolio link injection | ✅ Done | `generate-visibility-kit` + `research-company` |
| 10b — Bio/About on public portfolio | ✅ Done | Auto-generated, editable in Settings |
| 10c — Business Settings identity fields | ✅ Done | + contact_phone added |
| 10d — Brand Kit 4-color fix | ✅ Done | Added ctaColor as 4th color |
| 10e — Pre-warm auto-finds post | ✅ Done | `research-company action:'prewarm_comment'` |

---

## Files changed this session

### New files
- `supabase/migrations/00014_v41_amendments.sql`
  - Adds to `businesses`: `bio text`, `slug text` (unique index), `contact_email text`, `contact_phone text`, `logo_url text`
  - **Must be run in Supabase SQL Editor before using any new features**

### Modified files

#### `src/hooks/useCurrentBusiness.ts`
- Added to `Business` interface: `bio`, `slug`, `contact_email`, `contact_phone`, `logo_url` (all `string | null`)
- Hook uses `select('*')` so new columns come through automatically once migration runs

#### `src/pages/PublicPortfolioPage.tsx`
- Business interface updated with `bio`, `contact_email`, `contact_phone`
- Query updated to fetch new columns
- **Bio/About section** added between header and services grid (renders only when `bio` is set)
- **Contact row** below the "Request a Proposal" CTA: `mailto:` email + `tel:` phone links in brand primary color

#### `src/pages/SettingsPage.tsx`
- New **"Public Identity" card** at the top of the Business Profile tab, above Business Information
- Fields: business name (→ `businesses.name`), public URL slug, bio (~500 chars), contact email, contact phone
- Slug pre-fills from `business.slug` with fallback to `profile.username` — user always sees their real current slug
- Card description shows live `forgefly.app/p/{slug}` preview as user types
- Slug availability check (debounce on blur): checks against all other businesses, shows ✓ available / ✗ taken
- Change warning: if slug differs from original, amber "⚠ Changing slug breaks existing links" message
- Save calls `handleSavePublicIdent()` → writes directly to `businesses` table

#### `src/pages/BrandKitPage.tsx`
- `BrandData` interface: added `ctaColor`
- `ColorEditor` section: 4 colors (Primary / Secondary / Accent / CTA) with role description text
- `LivePreview`: uses `ctaColor` for CTA button + added to 4-slot harmony strip

#### `supabase/functions/generate-visibility-kit/index.ts`
- `BusinessContext` type: added `portfolioUrl?: string | null`
- Reads `businesses.slug` at invocation time; builds `portfolioUrl = PUBLIC_SITE_URL/p/{slug}`
- Channel generators updated to mention portfolio URL where appropriate:
  - `behance_dribbble_bio`: if Portfolio URL provided, include at end
  - `linkedin_kit`: include in About section + featured_caption
  - `linkedin_authority`: include in About's third paragraph
  - `nextdoor_intro`: include at end
  - DM / connection note / cold email (short) deliberately excluded per spec
- **Bio auto-generation**: after visibility kit generates, if `businesses.bio` is null, runs a Haiku call to generate a 2–4 sentence first-person bio and saves it to `businesses.bio`. Bio included in response as `{ visibility_kit, bio }`.

#### `supabase/functions/research-company/index.ts`
- Added `HAIKU` model constant
- New `action: 'prewarm_comment'` branch (10e):
  - Accepts `{ action: 'prewarm_comment', company_input, company_name, freelancer_name, ... }`
  - Web-searches for `"[company name]" linkedin post` via Google, extracts LinkedIn URL from results
  - Fetches post content; if LinkedIn is gated or unavailable → returns `{ gated: true }`
  - Otherwise calls Haiku with strict system prompt: peer-level comment, ONE specific detail, no compliments, no "great post!", max 3 sentences
  - Returns `{ gated: false, comment: string }`
- Default research branch: accepts `portfolio_url?: string | null`
  - `portfolioLine` injected into user content sent to Sonnet
  - System prompt rules updated: cold email + follow-up include URL, DM and connection note explicitly excluded (char limit)

#### `src/pages/OutreachKitPage.tsx`
- **Pre-warm flow** (10e): changed from paste-first to auto-fetch-first
  - "Find post + draft comment →" button calls `research-company action:'prewarm_comment'` immediately
  - If `gated: true` → shows paste fallback (textarea + "Generate comment" button)
  - If gated paste branch used → calls `ai-gateway mode:'chat'` with strict no-compliment rule
  - New state: `prewarmGated: boolean`
- **Portfolio URL in research**: before calling `research-company`, fetches `businesses.slug` from DB, builds `portfolioUrl = window.location.origin/p/{slug}`, passes as `portfolio_url`

---

## Pending actions (Sourav must do)

### 1. Run migration 00014
```sql
-- Run in Supabase SQL Editor
-- File: supabase/migrations/00014_v41_amendments.sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS logo_url text;

CREATE UNIQUE INDEX businesses_slug_key ON businesses (slug) WHERE slug IS NOT NULL;
```

### 2. Deploy edge functions
```bash
npx supabase functions deploy generate-visibility-kit
npx supabase functions deploy research-company
```

### 3. Also still pending from v4.0
```bash
npx supabase functions deploy ai-gateway
npx supabase functions deploy handle-reply-intent
```
And run migration 00013_phase35_outreach.sql (B2B pipeline columns).

### 4. No new secrets needed
`generate-visibility-kit` uses the existing `SITE_URL` secret (already set to `https://www.forgefly.io`)
to build portfolio URLs. No new environment variables required.

---

## Architecture decisions made this session

### Slug resolution (current vs. future)
`PublicPortfolioPage` currently resolves `/p/{slug}` via `profiles.username`, not `businesses.slug`.
The Settings page falls back to `profile.username` when `businesses.slug` is null.
When the user sets a slug via Settings, it writes to `businesses.slug` — but `PublicPortfolioPage` still resolves via `profiles.username`. These will diverge if the user sets a different slug.

**TODO for next session**: Update `PublicPortfolioPage` to try `businesses.slug` first, then fall back to `profiles.username`. A user with both set should resolve by the `businesses.slug`. Consider whether to also sync the change back to `profiles.username` (probably not — they serve different purposes).

### Bio pre-population timing
Bio is generated lazily when `generate-visibility-kit` is called, not at seed extraction time.
Reason: avoids threading bio through the complex auth-callback → pending_businesses chain.
Existing users without a bio get one when they first generate their visibility kit.

### ctaColor default
`BrandKitPage` defaults `ctaColor` to `primaryColor` when not set, so the 4th swatch
isn't visually empty for businesses generated before this session.

---

## What's next (v4.2 — already specced in FORGEFLY_HANDOFF_V4.md)

QR code + Apple Wallet pass. Specced in FORGEFLY_OUTREACH_SPEC.md §11.

| Component | What |
|---|---|
| Share modal | Add "QR code" tab + "Wallet pass" tab |
| `/p/[slug]` | "Add to Apple Wallet" (iOS) / "Save contact .vcf" (Android) below CTA |
| Brand Kit page | QR download assets section |
| Business Settings | Wallet pass preview + "Add to my own Wallet" CTA |
| Edge Function | `generate-wallet-pass` — server-side .pkpass via `passkit-generator` |

Build estimate: +5 days full, +1.5 days MVP (QR only, no Wallet).

---

## CLI session discipline (reminder)

- Start every session: read `FORGEFLY_HANDOFF_V4.md` + `FORGEFLY_HANDOFF_V4_1.md` + `CLAUDE.md` + `MEMORY.md`
- Load `FORGEFLY_OUTREACH_SPEC.md` for any outreach/visibility/v4.2 work
- Run `npx tsc --noEmit` before finishing any session
- End every session: update memory + write a handoff doc
