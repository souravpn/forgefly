# Forgefly — Session Handoff v4.11
> Covers work completed in the June 18, 2026 session (continued from v4.10).
> Load alongside FORGEFLY_HANDOFF_V4.md (in `/files`) + V4_1 through V4_10.

---

## What was completed this session

### Phase G — Onboarding + Overview redesign (#64–#75) — ALL DONE

Phase G started in the previous context window and was fully completed this session.

| # | Task | Status |
|---|---|---|
| 64 | No-business landing page (seed prompt, 3 demo cards) | ✅ Done (prior session) |
| 65 | Demo card live generation flow (400ms → auto-generate → "👌 Looking good · Save") | ✅ Done (prior session) |
| 66 | Generation animation — text steps + artifact previews | ✅ Done (prior session) |
| 67 | Early brand color via parallel classify call → `TIER_COLORS` map | ✅ Done (prior session) |
| 68 | Ambient morphing CSS shape (clip-path, brand color) | ✅ Done (prior session) |
| 69 | Reveal beat — 350ms stillness → PortalPreview spring slides up | ✅ Done (prior session) |
| 70 | Migration 00034 — `onboarding_seen` + `onboarding_milestones` + `onboarding_events` | ✅ Run |
| 71 | MilestoneCard component + `mark-milestone` EF + four page beacons | ✅ Done |
| 72 | Overview page redesign — 6 containers, predictive graph removed | ✅ Done |
| 73 | Quick win AI nudge (Haiku, daily re-evaluation, localStorage cache) | ✅ Done |
| 74 | [+] button + `?action=new` auto-open in 6 pages | ✅ Done |
| 75 | Visibility deferral logic (portfolio shared OR age ≥ 3 days gates nudge) | ✅ Done |

---

## Key files modified this session

| File | What changed |
|---|---|
| `supabase/functions/mark-milestone/index.ts` | NEW — writes milestone completion/skip to DB. Deployed. |
| `supabase/functions/ai-gateway/index.ts` | Added `mode: 'nudge'` handler (Haiku, context-injected, returns `{title, description, action, route}`). Deployed. |
| `src/hooks/useCurrentBusiness.ts` | Added `OnboardingMilestones` interface; added `onboarding_seen` and `onboarding_milestones` fields to `Business` interface. |
| `src/components/common/MilestoneCard.tsx` | NEW — shows one milestone at a time, auto-completes `business_created` on mount, skip-in-session set, disappears when all complete. |
| `src/components/common/QuickWinNudge.tsx` | NEW — fetches Haiku nudge, caches daily in localStorage keyed `qw_nudge_${businessId}_${YYYY-MM-DD}`, skeleton while loading. |
| `src/pages/DashboardPage.tsx` | Full rewrite — 6-container 2×3 grid, real DB data, [+] dropdown, visibility deferral, MilestoneCard + QuickWinNudge in container 3. Predictive cashflow removed. |
| `src/pages/PackagesPage.tsx` | Added dwell beacon (10s timer → `services_reviewed`); `?action=new` auto-opens service modal. |
| `src/pages/BrandKitPage.tsx` | Added `CopyLinkButton` component; portfolio URL copy fires `portfolio_shared` beacon. |
| `src/pages/PipelinePage.tsx` | First lead INSERT fires `prospect_added` beacon; `?action=new` auto-opens lead modal. |
| `src/pages/ProposalsPage.tsx` | First proposal send fires `proposal_sent` beacon; `?action=new` auto-opens wizard. |
| `src/pages/ClientsPage.tsx` | `?action=new` auto-opens create modal. |
| `src/pages/ProjectsPage.tsx` | `?action=new` auto-opens create modal. |
| `src/pages/InvoicesPage.tsx` | `?action=new` auto-opens create modal. |

---

## Migrations run this session

| Migration | What it does | Status |
|---|---|---|
| 00034 | `onboarding_seen` + `onboarding_milestones` JSONB on `businesses`; `onboarding_events` table + RLS | ✅ Run (prior session) |

---

## Architecture decisions to carry forward

### Phase G decisions (new)
- **Milestone completion always by EF:** `mark-milestone` Edge Function is the only writer to `businesses.onboarding_milestones` and `onboarding_events`. Never update from the client directly.
- **`business_created` auto-completion:** `MilestoneCard` fires it on mount (once per session) using a `useRef` guard. No EF call needed from AppShell.
- **AI nudge daily cache:** keyed `qw_nudge_${businessId}_${YYYY-MM-DD}` in localStorage. Haiku is called at most once per day per business. No server-side cache.
- **Visibility deferral (#75):** the `nudgeUnlocked` check is inline in `DashboardPage` — `portfolio_shared` milestone OR `created_at` age ≥ 3 days. Before that, container 3 shows a quiet "You're making progress" message and does NOT call Haiku.
- **`?action=new` convention:** each page reads `searchParams.get('action') === 'new'` in a mount-only `useEffect`, opens its modal, then calls `setSearchParams({}, { replace: true })` to avoid re-triggering on back navigation.

### Carried from prior sessions
- `business_id` is canonical scope key — `user_id` is for RLS only
- Never JOIN `auth.users` in RLS — use `auth.uid()` only
- Radix dialog null-guard: `{state && <Content>}` inside Dialog/Sheet/AlertDialog
- DB trigger SECURITY DEFINER for cross-role writes
- Functional `setState(current => ...)` in realtime handlers
- Email is fire-and-forget (`invoke(...)` without `await`)
- Milestone completion always written by Edge Function — never client-side
- motion imports from `motion/react` (Framer Motion v12 pattern)

---

## What is next: Phase H — Testimonial engine + public portal enhancements (#76–#88)

**Full spec: `FORGEFLY_OUTREACH_SPEC.md §17` (in `/files`)**
**Summary in: `FORGEFLY_HANDOFF_V4.md` pp. 566–622 (in `/files`)**

Estimated ~13 days. This phase makes the public portfolio credible and conversion-optimised.

### Core principles (do not relitigate)
- Reviews belong to the client. The freelancer cannot edit or delete them.
- Low reviews (< 3 stars) are private feedback. They never appear on the public portal.
- Testimonials render only when count ≥ 3 ai_selected reviews. No "be the first" placeholder.
- Work samples tie to real completed Forgefly projects — not arbitrary uploads.
- The footer green pill is for the visitor, not Forgefly. It earns its place.

---

### Migration needed (start of Phase H)

Run this SQL before any Phase H code:

```sql
-- Migration 00035: reviews, review_requests, portal_sections, work_samples

CREATE TABLE reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid REFERENCES businesses(id) ON DELETE CASCADE,
  client_id         uuid REFERENCES contacts(id),
  invoice_id        uuid REFERENCES invoices(id),
  client_name       text NOT NULL,
  client_avatar     text,
  rating            int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           text,
  freelancer_reply  text,
  replied_at        timestamptz,
  is_verified       boolean DEFAULT true,
  request_sent_at   timestamptz,
  submitted_at      timestamptz DEFAULT now(),
  portal_eligible   boolean GENERATED ALWAYS AS (rating >= 3) STORED,
  ai_selected       boolean DEFAULT false,
  ai_selected_at    timestamptz
);
CREATE INDEX ON reviews (business_id, portal_eligible, submitted_at DESC);
CREATE INDEX ON reviews (business_id, ai_selected);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own reviews" ON reviews FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
-- Public read for portal display:
CREATE POLICY "public read ai_selected reviews" ON reviews FOR SELECT
  USING (ai_selected = true AND portal_eligible = true);

CREATE TABLE review_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid REFERENCES businesses(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES contacts(id),
  invoice_id    uuid REFERENCES invoices(id) UNIQUE,
  scheduled_for timestamptz NOT NULL,
  sent_at       timestamptz,
  review_id     uuid REFERENCES reviews(id),
  status        text DEFAULT 'pending' CHECK (status IN ('pending','sent','completed','declined'))
);
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own review_requests" ON review_requests FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE TABLE portal_sections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid REFERENCES businesses(id) ON DELETE CASCADE,
  section_type  text NOT NULL CHECK (section_type IN ('text','text_image','banner','links')),
  position      int NOT NULL CHECK (position IN (1, 2)),
  title         text,
  body          text,
  image_url     text,
  banner_color  text CHECK (banner_color IN ('info','warning','closed')),
  links         jsonb DEFAULT '[]',
  is_active     boolean DEFAULT true,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (business_id, position)
);
ALTER TABLE portal_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own portal_sections" ON portal_sections FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "public read active portal_sections" ON portal_sections FOR SELECT
  USING (is_active = true);

CREATE TABLE work_samples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid REFERENCES businesses(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id),
  client_id     uuid REFERENCES contacts(id),
  title         text,
  image_url     text NOT NULL,
  sort_order    int DEFAULT 0,
  is_active     boolean DEFAULT true,
  uploaded_at   timestamptz DEFAULT now()
);
CREATE INDEX ON work_samples (business_id, is_active, sort_order);
ALTER TABLE work_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own work_samples" ON work_samples FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
CREATE POLICY "public read active work_samples" ON work_samples FOR SELECT
  USING (is_active = true);
```

---

### Build order — #76–#88

| # | Task | Effort | Depends on |
|---|---|---|---|
| 76 | Migration 00035 + `schedule-review-request` EF (fires on invoice paid) | 1 day | invoices table |
| 77 | Review request email — Resend template + daily cron scan | 1 day | #76, Resend SMTP |
| 78 | `/review/[token]` — public submission page (signed JWT, 30-day expiry, no auth) | 1 day | #76 |
| 79 | AI testimonial selection — Phase 1 (simple) + Phase 2 Haiku (20+ reviews) | 1 day | #76 |
| 80 | Freelancer Reviews sub-tab under Clients — all reviews + reply flow | 1.5 days | #76 |
| 81 | AI quarterly review insight (Haiku, 90-day cron) | 0.5 days | #76 |
| 82 | `portal_sections` editor UI in Brand Kit — 4 section types, 2-slot limit | 1.5 days | migration |
| 83 | Custom section rendering on `/p/[slug]` (text, text+image, banner, links) | 1 day | #82 |
| 84 | `work_samples` upload UI — from completed project OR direct, max 5, drag reorder | 1.5 days | migration |
| 85 | Work samples grid on `/p/[slug]` — 2-col, lightbox on click | 1 day | #84 |
| 86 | Testimonials section on `/p/[slug]` — conditional render (≥ 3 ai_selected only) | 1 day | #79 |
| 87 | Portal footer — both `/p/[slug]` and `/portal/[token]` | 0.5 days | portal shell |
| 88 | Notification: new review received | 0.5 days | #76 |

**Sequence:** 76 → 77+78+79 parallel → 80+81 parallel → 82+84 parallel → 83+85+86 parallel → 87+88 parallel.

---

### Key spec details per task

#### #76 — Schema + invoice trigger
`schedule-review-request` Edge Function fires when `invoices.status` updates to `'paid'`.
Inserts into `review_requests` with `scheduled_for = paid_at + 7 days`. One request per invoice (UNIQUE on `invoice_id`). Wire it via a Supabase DB webhook on `invoices` UPDATE.

#### #77 — Review request email
Daily cron scans `review_requests WHERE status='pending' AND scheduled_for <= now()`. For each: sends email via Resend, sets `sent_at = now(), status = 'sent'`. Skips if `review_id` already set (client already reviewed). Email styled with freelancer's `brand.primaryColor`. One email only — no follow-up.

Email subject: `How did [business name] do?`
Reply-to: `[business contact_email]`
CTA links to `/review/[signed_jwt_token]`

#### #78 — `/review/[token]` submission page
New public route (add to `routes.tsx` with `public: true`). Token is a signed JWT containing `{review_request_id, client_id, business_id}`, signed with `REVIEW_JWT_SECRET` Supabase secret, expires 30 days. On submit:
1. Creates `reviews` row
2. Sets `review_requests.review_id` + `status = 'completed'`
3. Fires `select-portal-testimonials` (EF call, fire-and-forget)
4. Fires notification to freelancer (simple toast/push — #88)

Page: star rating tap UI + optional comment textarea + pre-filled name. No auth. Clean, brand-colored.

#### #79 — AI testimonial selection
`select-portal-testimonials` Edge Function. Fires after every new review submission.

**Phase 1 (< 20 eligible reviews):**
```typescript
// Top 5 by rating DESC, submitted_at DESC tiebreak
const selected = eligibleReviews.sort((a, b) =>
  b.rating - a.rating || new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
).slice(0, 5)
```

**Phase 2 (≥ 20 eligible reviews):**
Haiku call with all eligible reviews JSON. Returns array of 5 UUIDs. Haiku selects for: time-period diversity, work-type diversity, all ≥ 4 stars, authentic + specific, consistent quality over time.

After selection:
- `UPDATE reviews SET ai_selected = false WHERE business_id = $1` (clear old)
- `UPDATE reviews SET ai_selected = true, ai_selected_at = now() WHERE id = ANY($selected_ids)`

Hard rule: if `portal_eligible` count < 3, don't call at all — section won't render regardless.

#### #80 — Reviews sub-tab
New route under Clients (`/dashboard/clients/reviews` or a sub-tab). Shows ALL reviews including < 3 stars. Filter chips: All / 5★ / 4★ / 3★ / 2★ / 1★. Shows "✓ On portal" badge on `ai_selected` rows. Low-rating rows show "Not on portal" note in muted text.

Reply flow: "Reply →" inline text field, "Post reply" button → updates `reviews.freelancer_reply` + `replied_at`. Freelancer can edit own reply. No AI drafting for replies — must be the freelancer's genuine voice.

#### #81 — AI quarterly insight
90-day cron. Fires Haiku with all review comments for the business. Returns:
```json
{ "strengths": ["string", "string"], "friction": "string|null", "suggestion": "string" }
```
Surfaces as a card in the Reviews sub-tab. Stores result in `businesses.extracted_data.review_insight` with `insight_generated_at` timestamp. Re-runs every 90 days OR when manually triggered.

#### #82 — Custom sections editor
In Brand Kit (or a new "Portal" sub-tab in Brand Kit). Shows current sections with section type label + preview + [Edit] + [Remove]. [+ Add section] disabled when 2 sections exist. Editor modal has type selector → type-specific fields. Saves to `portal_sections` table. UNIQUE(business_id, position) enforced at DB level.

Section types:
- **text**: title (optional) + body textarea (plain text, line breaks preserved)
- **text_image**: title + body + image upload to `work_samples` Storage bucket
- **banner**: body text (single line) + color picker (info/warning/closed)
- **links**: optional title + [{label, url}] array (add/remove rows)

#### #83 — Custom sections on `/p/[slug]`
Read `portal_sections WHERE business_id = $id AND is_active = true ORDER BY position`. Render position 1 between Bio and Services, position 2 between Services and Work samples. Render nothing if section missing.

Banner colors: `info` = blue-50/blue-700, `warning` = amber-50/amber-700, `closed` = red-50/red-700.

#### #84 — Work samples upload UI
Location: Brand Kit → "Work" tab (or add tab). Two add paths:
1. **From project**: completed projects list → select → image upload → title pre-filled from project name (editable)
2. **Direct upload**: image upload (JPG/PNG/WebP, max 5MB) → title required → project link optional

Max 5 active enforced at app layer:
```typescript
const { count } = await supabase.from('work_samples').select('id', { count: 'exact' })
  .eq('business_id', business.id).eq('is_active', true)
if ((count ?? 0) >= 5) toast.error('Maximum 5 work samples')
```

Drag to reorder (use `@dnd-kit` already in project). Upload to `work-samples` Supabase Storage bucket (public).

#### #85 — Work samples grid on `/p/[slug]`
Read `work_samples WHERE business_id = $id AND is_active = true ORDER BY sort_order`. Render only if count ≥ 1. 2-column grid desktop, 1-column mobile. Each: image + title below. Lightbox on click (Dialog with full-size image + title). Use existing Dialog from shadcn.

#### #86 — Testimonials on `/p/[slug]`
Read `reviews WHERE business_id = $id AND ai_selected = true AND portal_eligible = true ORDER BY ai_selected_at DESC`. Render section only if count ≥ 3. No placeholder if < 3.

Section header: "What clients say"
Each review: filled SVG stars + comment (quoted) + `— [client_name] · [Mon YYYY]` + freelancer reply (if set, shown as `↳ "reply text"` in muted text). Company name shown if available.
Stars: filled SVG not emoji. Date format: `Jun 2026` (month + year only).

#### #87 — Portal footer
Add to bottom of both `/p/[slug]` (`PublicPortfolioPage`) and `/portal/[token]` (`ClientPortalPage`).

```
© {getFullYear()}  {business.name}  ·  All Rights Reserved  ·  Powered by Forgefly
```

On `/p/[slug]` only, add green pill below:
```
background: #E1F5EE  color: #085041  border: 1px solid #5DCAA5
"Have a business? Try Forgefly" → https://forgefly.io?ref=portfolio_footer
```

On `/portal/[token]`: "Powered by Forgefly" text only. No pill. Wrong moment for acquisition pitch.

#### #88 — New review notification
After review submission, send a brief notification to the freelancer. Options in priority:
1. Supabase Realtime channel (already in project) — push a toast if freelancer is online
2. Email via `send-email` EF — "⭐ [client_name] left you a [N]-star review"

Use fire-and-forget email for reliability. Toast for immediacy if online.

---

### Files to read before starting Phase H

- `src/pages/PublicPortfolioPage.tsx` — understand current `/p/[slug]` render structure and where to insert new sections
- `src/pages/ClientPortalPage.tsx` — understand `/portal/[token]` structure for footer
- `src/pages/ClientsPage.tsx` — understand tabs/routing to know where to add Reviews sub-tab
- `src/pages/BrandKitPage.tsx` — understand current Brand Kit tabs to know where to add custom sections + work samples editor
- `supabase/functions/send-email/index.ts` — understand email send pattern + `_shared/email-templates.ts`
- `src/routes.tsx` — add `/review/[token]` public route

---

## Supabase project

- **Project ref:** `oqwgssdmrauhhiiaxryg`
- **Functions deployed this session:** `mark-milestone`, `ai-gateway` (updated)
- **All other EFs deployed remain live**

---

## Standing pending items (carried forward)

| Item | Where / How |
|---|---|
| Resend SMTP | Auth → SMTP: `smtp.resend.com:465`, user `resend`, pw = Resend API key. **Required for #77.** |
| `REVIEW_JWT_SECRET` secret | Set in Supabase secrets before building #78 |
| Stripe subscription price | `create-subscription-checkout`: change `unit_amount: 100` → `2900` |
| Stripe webhook | Register `stripe-webhook` endpoint URL in Stripe Dashboard |
| Terms + Privacy pages | Linked from signup, not yet created |

---

## Session handoff note

Session handoff: `FORGEFLY_HANDOFF_V4_11.md` — Phase G (#64–#75) ALL DONE (2026-06-18).

**Next task:** Start Phase H. Begin with migration 00035 (all 4 tables) + EF `schedule-review-request` (#76), then fan out to #77+#78+#79 in parallel once migration is confirmed run.

Load alongside V4 (in /files) + V4_1–V4_10 for full context.
