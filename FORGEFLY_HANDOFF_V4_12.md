# Forgefly — Session Handoff v4.12
> Covers work completed in the June 18–19, 2026 session.
> Load alongside FORGEFLY_HANDOFF_V4.md (in `/files`) + V4_1 through V4_11.

---

## What was completed this session

### Phase H — Testimonial engine + public portal enhancements (#76–#88) — ALL DONE

| # | Task | Status |
|---|---|---|
| 76 | `schedule-review-request` EF — fires on invoice paid DB webhook, inserts review_requests row (paid_at + 7 days), resolves contacts from clients table | ✅ Deployed |
| 77 | `send-review-requests` EF — daily cron (10am UTC), signs 30-day HMAC-SHA256 JWT per request, sends via Resend directly (no send-email EF — no user auth in cron), updates status='sent' | ✅ Deployed |
| 78 | `/review/:token` — public ReviewSubmitPage: client-side JWT decode for expiry check, StarPicker with primaryColor fill, RATING_LABELS, submits to `submit-review` EF | ✅ Done |
| 79 | `select-portal-testimonials` EF — Phase 1 (<20: top 5 rating DESC) / Phase 2 (≥20: Haiku diversity pick), atomic swap (clear all → set selected), fires after every review submission | ✅ Deployed |
| 80 | `ReviewsPage` (`/dashboard/reviews`) — all reviews list + filter chips, summary strip, "✓ On portal" badge, AI insight card (reads `extracted_data.review_insight`), inline reply/edit | ✅ Done |
| 81 | `quarterly-review-insight` EF — quarterly cron (9am UTC on 1st Jan/Apr/Jul/Oct), Haiku analysis of all reviews, stores `{strengths, friction, suggestion, generated_at}` in `businesses.extracted_data.review_insight` | ✅ Deployed |
| 82 | Brand Kit → Portal tab — sections editor: list, [Add section] capped at 2, modal with 4 section types, image upload under `sections/` prefix, 3-pill banner color picker, dynamic links rows | ✅ Done |
| 83 | PublicPortfolioPage custom sections — renders pos 1 AND pos 2 between Bio and Services (both above services); banner colors; text/text_image/links types | ✅ Done |
| 84 | Brand Kit → Work tab — "X / 5 samples" counter, DnD sort (@dnd-kit), "From project" + "Upload" modes, 5MB check, lazy-loads completed projects on first tab open, is_active=false for soft-delete | ✅ Done |
| 85 | PublicPortfolioPage work samples — 2-col grid, `cursor-zoom-in`, hover title overlay, lightbox via shadcn Dialog (`<DialogTitle className="sr-only">`) | ✅ Done |
| 86 | PublicPortfolioPage testimonials — conditional render (≥3 ai_selected gate), StarRating with primaryColor, quoted comment, `— name · Mon YYYY`, `↳ "reply"` for freelancer replies | ✅ Done |
| 87 | Portal footers: PublicPortfolioPage — copyright + green pill (#E1F5EE / #085041 / border #5DCAA5); ClientPortalPage ContactHub — plain text only, no pill (wrong moment for acquisition); EngagementPortal — dark theme footer | ✅ Done |
| 88 | `useReviewNotification` hook — Supabase Realtime INSERT subscription on `reviews` filtered to `business_id`, fires sonner toast with star display + "View" action → `/dashboard/reviews`. Wired globally in `AppShellContent`. | ✅ Done |

### Additional changes this session

| Change | Detail |
|---|---|
| ClientPortalPage — remove floating pill | Removed duplicate "⚡ Powered by Forgefly" pill (separate footer block) from ContactHub. "Powered by Forgefly" only appears in the plain-text footer at the bottom. |
| `NavIcon.tsx` | Added `Star` (lucide-react) mapped to `'star'` |
| `navigation.ts` | Added `reviews` as first entry in `MORE_ITEMS` → `/dashboard/reviews` |
| `routes.tsx` | Added `/dashboard/reviews` (ReviewsPage) + `/review/:token` (ReviewSubmitPage, public) |
| `AppShell.tsx` | Added `useReviewNotification()` call in `AppShellContent` |
| Storage RLS | User added `work-samples` public bucket + two policies (authenticated uploads, public reads) in Supabase Dashboard |

---

## Key files modified this session

| File | What changed |
|---|---|
| `src/pages/ReviewsPage.tsx` | NEW — reviews list, filter chips, summary strip, AI insight card, inline reply |
| `src/pages/ReviewSubmitPage.tsx` | NEW — public review form with StarPicker, RATING_LABELS, JWT decode |
| `src/hooks/useReviewNotification.ts` | NEW — global Realtime subscription, sonner toast on new review INSERT |
| `src/components/shell/AppShell.tsx` | Added `useReviewNotification()` |
| `src/components/shell/NavIcon.tsx` | Added `Star` icon + `'star'` mapping |
| `src/config/navigation.ts` | Added `reviews` to `MORE_ITEMS` |
| `src/routes.tsx` | Added ReviewsPage + ReviewSubmitPage imports and routes |
| `src/pages/BrandKitPage.tsx` | Full rewrite — Brand/Portal/Work tabs; DnD work samples; section editor; image upload to `work-samples` bucket |
| `src/pages/PublicPortfolioPage.tsx` | Added portal sections (pos 1+2 above services), work samples grid + lightbox, testimonials section, footer + green pill |
| `src/pages/ClientPortalPage.tsx` | Removed floating pill; two footers (ContactHub plain-text, EngagementPortal dark) remain |
| `supabase/functions/schedule-review-request/index.ts` | NEW — DB webhook handler for invoices UPDATE |
| `supabase/functions/send-review-requests/index.ts` | NEW — daily cron EF, JWT signing, Resend direct |
| `supabase/functions/submit-review/index.ts` | NEW — JWT verify, insert review, update review_request, notify freelancer, trigger select-portal-testimonials |
| `supabase/functions/select-portal-testimonials/index.ts` | NEW — Phase 1/2 selection, atomic swap |
| `supabase/functions/quarterly-review-insight/index.ts` | NEW — quarterly sweep all businesses, Haiku analysis, stores in extracted_data |
| `supabase/functions/_shared/email-templates.ts` | Added `getReviewRequestEmailTemplate` + `getReviewReceivedEmailTemplate` |

---

## Migrations run this session

| Migration | What it does | Status |
|---|---|---|
| 00035 | `reviews`, `review_requests`, `portal_sections`, `work_samples` tables + RLS + indexes. `portal_eligible` as `GENERATED ALWAYS AS (rating >= 3) STORED`. | ✅ Run |

---

## Crons registered this session

| Cron name | Schedule | EF | Status |
|---|---|---|---|
| `send-review-requests-daily` | `0 10 * * *` (10am UTC daily) | `send-review-requests` | ✅ Registered via pg_cron |
| `quarterly-review-insight` | `0 9 1 1,4,7,10 *` (9am UTC, 1st of Jan/Apr/Jul/Oct) | `quarterly-review-insight` | ✅ Registered via pg_cron |

---

## Architecture decisions to carry forward

### Phase H decisions (new)
- **clients vs contacts for review_requests:** `invoices.client_id` → `clients` table (legacy). `review_requests.client_id` → `contacts` table (new). `schedule-review-request` EF resolves by email: looks up contact for the business by email, creates one if not found (status='Active client').
- **JWT without external libraries:** HMAC-SHA256 via Web Crypto API (native Deno). No djwt or similar. `signJwt()` in send-review-requests, `verifyJwt()` in submit-review.
- **Cron EFs call Resend directly:** `send-review-requests` runs as cron with no user auth context — can't use the `send-email` EF which requires a user JWT. Resend API called directly with `RESEND_API_KEY`.
- **Portal sections both above services:** Spec originally placed pos 2 between services and work samples. Changed at user request: both pos 1 AND pos 2 now render between Bio and Services.
- **select-portal-testimonials hard gate:** fewer than 3 eligible reviews = EF returns early with `{skipped: true}`. No changes to `ai_selected` made. Testimonials section on public portfolio requires ≥ 3 `ai_selected` reviews to render at all.
- **Atomic swap for ai_selected:** clear `ai_selected=false` for entire business, then set `ai_selected=true` for selected IDs. Single EF call, no partial states.
- **quarterly-review-insight sweeps all businesses:** EF processes all active businesses sequentially in one call. Per-business try/catch so one failure doesn't abort others. Minimum 5 reviews before insight is generated.
- **Realtime review notification is global:** `useReviewNotification` lives in `AppShellContent` — fires regardless of which page the freelancer is on.
- **Work samples soft-delete:** `is_active=false` rather than DELETE. Public portfolio only reads `is_active=true`.

### Carried from prior sessions
- `business_id` is canonical scope key — `user_id` is for RLS only
- Never JOIN `auth.users` in RLS — use `auth.uid()` only
- Radix dialog null-guard: `{state && <Content>}` inside Dialog/Sheet/AlertDialog
- DB trigger SECURITY DEFINER for cross-role writes
- Functional `setState(current => ...)` in realtime handlers
- Email is fire-and-forget (`invoke(...)` without `await`)
- Milestone completion always written by Edge Function — never client-side
- `motion` imports from `motion/react` (Framer Motion v12 pattern)
- `?action=new` convention: `searchParams.get('action') === 'new'` in mount-only `useEffect`, clears with `replace: true`

---

## DB Webhook still needed

The `schedule-review-request` EF is deployed but requires a DB webhook to fire. Set this up in Supabase Dashboard → Database → Webhooks:

| Field | Value |
|---|---|
| Name | `invoice-paid-schedule-review` |
| Table | `invoices` |
| Events | `UPDATE` |
| URL | `https://oqwgssdmrauhhiiaxryg.supabase.co/functions/v1/schedule-review-request` |
| HTTP headers | `Authorization: Bearer <service_role_key>` |

---

## Standing pending items (carried forward)

| Item | Where / How |
|---|---|
| DB webhook for `schedule-review-request` | Supabase Dashboard → Database → Webhooks (see above) |
| Resend SMTP for Supabase Auth | Auth → SMTP: `smtp.resend.com:465`, user `resend`, pw = Resend API key. For magic links etc (review emails bypass this — they go direct) |
| Stripe subscription price | `create-subscription-checkout`: change `unit_amount: 100` → `2900` |
| Stripe webhook | Register `stripe-webhook` endpoint URL in Stripe Dashboard |
| Terms + Privacy pages | Linked from signup, not yet created |

---

## What is next: Phase I

Phase H is complete. The testimonial engine is fully operational end-to-end:
- Invoice paid → review request scheduled → email sent → client submits → AI selects → public portfolio shows testimonials
- Freelancer sees all reviews in `/dashboard/reviews` with reply flow + quarterly AI insight
- New reviews trigger global in-app toast notification

Possible Phase I directions (to be specced):
- **Client messages / inbox** (MessagesPage is wired but likely needs backend)
- **Automations engine** (AutomationsPage exists but triggers/actions need building)
- **Stripe Connect** for freelancer payouts (currently Stripe payments go to Sourav, not the freelancer — needed for production)
- **Mobile PWA / wallet pass** (`generate-wallet-pass` EF exists but UI not wired)
- **Analytics / reporting** on invoices, revenue, project velocity

---

## Supabase project

- **Project ref:** `oqwgssdmrauhhiiaxryg`
- **Functions deployed this session:** `schedule-review-request`, `send-review-requests`, `submit-review`, `select-portal-testimonials`, `quarterly-review-insight`
- **All prior EFs remain live**

---

## Session handoff note

Session handoff: `FORGEFLY_HANDOFF_V4_12.md` — Phase H (#76–#88) ALL DONE (2026-06-19). All EFs deployed, crons registered, migration 00035 run. One manual step outstanding: DB webhook for `schedule-review-request` (see above).

Load alongside V4 (in /files) + V4_1–V4_11 for full context.
