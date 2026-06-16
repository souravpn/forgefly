# Forgefly — Full Architecture & Product Handoff v4
> Supersedes FORGEFLY_HANDOFF_V3.md entirely.
> Load this at the start of every Claude Code CLI session and every new claude.ai session.
> Read completely before touching any code or asking questions.
> Companion doc: FORGEFLY_OUTREACH_SPEC.md (load alongside for outreach/visibility work)

---

## What Forgefly is

A SaaS business OS for freelancers and solopreneurs. Core differentiator: a single
natural-language prompt on the landing page generates a complete operational portal —
services catalog, sales pipeline, invoices, CRM contacts, proposal template, and brand
kit — in one shot. No multi-step onboarding forms.

Tagline positioning: "Replaces Linktree, Carrd, HoneyBook, and your business card."

Built for everyone who wants to run their business like an established company, without
the establishment — graphic designers, bakers, CPAs, and every solo operator in between.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React / Vite / TypeScript |
| Backend | Supabase (Postgres + Edge Functions) |
| Payments | Stripe + Stripe Connect |
| Deploy | Vercel / Cloudflare |
| AI | Anthropic API (Sourav's key, all costs absorbed) |
| Models | Haiku (`claude-haiku-4-5-20251001`) for classification/short copy, Sonnet (`claude-sonnet-4-6`) for rich generation |
| Project path | `/Users/souravnayak/forgefly` |

---

## Economics (locked — do not relitigate)

- Sourav owns the Anthropic API key and absorbs all AI costs
- Freelancers pay a fixed monthly SaaS fee via Stripe
- Freelancer clients pay freelancers via Stripe Connect (separate flow)
- AI costs for setup, nudges, re-prompts, outreach kit, visibility copy come out of margin
- Monthly charge must cover: API costs per user + Stripe fees + infra + margin
- Core ops (invoicing, pipeline, contacts) use zero AI tokens

---

## Architecture decisions (locked — do not relitigate)

### Acquisition flow
- "Generate-then-gate" pattern: seed prompt → full portal preview before auth
- `sessionStorage` key: `pending_portal` (no ff_ prefix)
- Preview renders completely; only save/edit requires auth

### AI gateway
- Unified Supabase Edge Function — all Claude calls go through here, never from client
- Classifier-first routing: always Haiku at temp 0 → tier selection → parallel fan-out
- Diff-mode re-prompts — never full re-extraction
- Two output blocks per classifier run:
  1. Existing: tier selection (Haiku vs Sonnet routing)
  2. NEW (v4): `<business_profile>` — motion, vertical, sale_type, presence_tier
     (see FORGEFLY_OUTREACH_SPEC.md §2 for full schema)

### Database
- One active business per user: Postgres partial unique index on `(user_id) WHERE status='active'`
- `businesses.extracted_data` JSONB: single source of truth for all dashboard tabs
- All tabs are views over this JSON — nothing stored redundantly

### Navigation
- Three-row desktop chrome: Forgefly band (32px) → business identity band (48px) → tab nav (38px)
- Mobile: footer tab bar (5 items: Home, Pipeline, Invoices, Clients, More) + bottom sheet
- No hamburger menu anywhere
- Nav constants in `src/config/navigation.ts` — portable to React Native
- Existing `shadcn/sidebar.tsx` retired as nav infrastructure; Sheet primitive reused for mobile More sheet

### Interaction surfaces
- Command bar: writes to `extracted_data` after diff confirmation modal
- AICopilot panel: read-mostly, never silently writes to `extracted_data`

### React Native readiness
- Business logic in hooks only — no DOM-specific APIs in hooks or pages
- `useAppNavigation` abstraction over React Router
- Page components ignorant of their shell

### Client portal
- Public portfolio: `/p/[slug]`
- Per-client authenticated: `/portal/[token]` (invitation-based, email matching)
- PortalShell completely separate from AppShell
- "Powered by Forgefly" footer on client portal only

---

## Build phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Infrastructure: nav config, DB migrations, AI gateway, AppShell | Complete |
| 2 | Acquisition funnel: landing page, preview page, auth callback | Complete |
| 3 | AI pre-population: dashboard, command bar, packages, proposals, pipeline, brand kit | In progress |
| 3.5 | **NEW (v4):** Visibility engine + B2B Outreach Kit | Specced — not started |
| 4 | Client portal: `/p/[slug]` + `/portal/[token]` | Subagent in progress — verify state |
| 5 | Retention: nudge engine, copilot migration (GPT-4o → Claude) | Not started |

---

## Key decisions (do not relitigate)

- sessionStorage key is `pending_portal` (no ff_ prefix)
- One active business per user — Postgres partial unique index
- extracted_data is single source of truth
- API key never in client — all Claude calls through Supabase Edge Function
- AICopilot is read-mostly — never silently writes
- ProjectsPage ≠ PipelinePage — delivery kanban vs pre-sales CRM
- AutomationsPage is a full replace — nudge engine, not manual rules
- No hamburger menu — footer tabs on mobile only
- No editing in preview except font pair selection
- Logo/image upload: post-signin only
- Brand colors in preview: CSS variables, accent elements only (dark bg stays)
- Outreach kit: templates only — Forgefly never sends on the user's behalf
- No scraping of Thumbtack / Yelp / Angi — ToS risk
- No LinkedIn OAuth — copy only, user sends manually
- Reply classification: always Claude API, never keyword matching
- Client portal auth: invitation-based, email matching, not role-based hiding
- "Powered by Forgefly" footer: client portal only
- Nav items in navigation.ts constant — portable to React Native

---

## Phase 3.5 — What was designed this session (v4 additions)

### "Let's Make You Visible" tab
- Appears in dashboard after portal generation (post-auth)
- Name is intentional: "Let's Make You Visible" not "Presence" or "Marketing"
- Classifier's `business_profile.presence_tier` determines which playbook loads — no
  user input needed
- Three-tier channel list: Now (generates instantly) / Grow (secondary) / Live signals (Coming Soon)
- Four playbooks: b2b_creative, b2c_local, b2b_professional, hybrid_professional
- All "Now" copy generated via AI gateway; lands in `extracted_data.visibility_kit`

### B2B Outreach Kit
- Entry: visibility tab → outreach card, OR PipelinePage header action
- 5-step flow: paste target → research loading → intel brief → outreach kit (4 tabs) → sequence tracker
- Company research: web_fetch → Sonnet extraction → CompanyIntel object
- Weak match gate: if service_overlap_score < 0.3, show friction modal before drafting
- Pre-warm feature: before sending LinkedIn DM, user can draft a genuine comment on
  the company's recent post (Claude generates it from pasted post content)
- Outreach kit tabs: Cold email / LinkedIn DM / Connection note / Follow-up
- Sequence tracker tabs: Copy for this step / Pipeline card / Got a reply?
- Pipeline card: always lands in **Prospect** stage — never Contacted (that's earned)
- Reply handler: Claude API call (Haiku), returns structured intent classification
- Reply intents: soft_defer / hard_no / interested / wants_material / objection / auto_reply
- Auto-progression: sequence state drives pipeline stage — user never manually drags cards

### Post-step contextual offers (one at a time, context-relevant)
- After connect sent: pre-warm comment drafter
- After DM sent: portfolio tailoring
- Reply wants_material: deck intro generator (3 slides, pre-filled)
- Reply interested: proposal shortcut (one-click to draft proposal)
- Any reply: add contact to CRM from intel brief

### pipeline_leads schema additions
New columns: source, company_url, service_overlap_score, matched_services,
outreach_sequence_step, outreach_sequence_status, last_reply_intent,
next_action_date, reminder_sent_at, company_intel (JSONB)
Full migration SQL in FORGEFLY_OUTREACH_SPEC.md §6.

---

## UI touchpoints designed this session (preserve these)

Three interactive mockups were built in claude.ai and should be referenced when
implementing the frontend. Recreate from the spec — don't start from scratch.

### 1. "Let's Make You Visible" onboarding flow
- Persona switcher: Graphic designer (B2B) / Custom baker (B2C) / CPA (hybrid)
- Each card shows: classifier output tags, headline, sub, channel list with badges
- Channel badges: "now" (green) / "grow" (amber) / "live signals" (purple) / "coming soon"
- Bottom CTA: "Build my kit"
- Classifier output shown as pills: motion tag + vertical tags

### 2. B2B Outreach Kit — full 5-step flow
- Step nav at top: 5 dots with connector lines, done/active/pending states
- Step 1: single input + "Research + draft →" button + "What Forgefly looks for" dashed card
- Step 2: animated loading list (5 steps with icons, progress bar)
- Step 3: company header + intel grid (2×2) + service match pills + live signals row
- Step 4: 4-tab copy kit + pre-warm dashed box below LinkedIn DM tab
- Step 5: sequence track (4 dots) + 3-tab action surface

### 3. Sequence step — full action hub
- Sequence track: 4-dot timeline (Connect → DM → Email → Final nudge)
- Tab 1 "Copy for this step": copy area + actions + pre-warm box (step-specific)
- Tab 2 "Pipeline card": preview of the lead card with all pre-filled fields + "Add to pipeline" CTA
- Tab 3 "Got a reply?": textarea + "Draft my response" → Claude API → classified response
  with label + draft copy + pipeline action button
- "Mark as dead" → confirmation modal → graceful close copy
- Bottom dashed card: 4 contextual post-step offers (2×2 grid)

---

## Reply handler — key behavioral rules

1. Always Claude API (Haiku) — never keyword matching
2. Input: freelancer context (name, services) + lead context (company, step, step copy) + reply text
3. Output: structured JSON — intent, timing_signal, tone, confidence,
   recommended_pipeline_action, reminder_weeks, draft_response, user_facing_label
4. soft_defer: pipeline stays Prospect, next_action_date set to today + (reminder_weeks × 7)
5. hard_no: pipeline → Lost, sequence closed, graceful close copy surfaced
6. interested / wants_material: pipeline → Contacted, sequence advances
7. auto_reply: no pipeline change, no sequence advance, inform user

Tested case (from screenshot): "a little late this quarter for contractor changes"
→ must classify as soft_defer / this_quarter / warm / pause_with_reminder / 10 weeks
→ must NOT classify as interested
→ pipeline stays Prospect, reminder in 10 weeks

---

## Client portal subagent status (from v3 — verify before Phase 4 work)

A subagent was running on Phase 4 (client portal) at end of v3 session. Before
resuming Phase 4, run:

```bash
claude "Read FORGEFLY_HANDOFF_V4.md and FORGEFLY_OUTREACH_SPEC.md. Then check
subagent status: read ClientPortalPage.tsx and check if a messages table migration
exists. Report what was completed before we continue."
```

---

## CLI session discipline

- Start every session: read this file + CLAUDE.md + MEMORY.md + FORGEFLY_OUTREACH_SPEC.md
- Run `find src -type f` before editing anything
- Check subagent status before starting new client portal work
- Keep sessions scoped to one phase — never mix Phase 1 and Phase 3.5
- End every session: update MEMORY.md with what was completed
- If a decision is made mid-session: add to CLAUDE.md with # inline
- Never mix infrastructure (shell, nav, DB) with feature (outreach kit, visibility) work
- Phase 3.5 sessions: always load FORGEFLY_OUTREACH_SPEC.md alongside this file

---

## Files to have in project root

```
/Users/souravnayak/forgefly/
├── CLAUDE.md                      # Project-level instructions (auto-injected)
├── MEMORY.md                      # Session completion log (auto-injected)
├── FORGEFLY_HANDOFF_V4.md         # This file
└── FORGEFLY_OUTREACH_SPEC.md      # Phase 3.5 feature spec
```

---

## v4.1 amendments (same session — June 14, 2026)

### Portfolio link in outreach copy
Every visibility/outreach copy surface must inject the real `/p/[slug]` URL — never a
placeholder. Read `businesses.slug` at generation time. Affected: cold email, LinkedIn
About, Behance bio, Nextdoor intro. Omit from connection note (char limit) and initial DM.

### Public portfolio — Bio/About added before services
New field: `businesses.bio` (text, ~500 chars, nullable). AI pre-populated from seed
prompt at portal generation (Haiku). Editable in Business Settings.
Portfolio render order: Header → **Bio/About** → Services → Portfolio → Contact/CTA.

### Business Settings additions
Settings tab → Business Settings now owns identity-level fields:
Business name, Slug (with availability check + change warning), Bio/About (new),
Logo, Contact email. All write directly to `businesses` table — not extracted_data,
not command bar flow.

### Brand Kit consistency bug — fix before Phase 4
Brand Kit page (old layout) and Preview tab (4 colors + font families) are out of sync.
Preview is correct. Brand Kit page must match. Use shared components — never duplicate
display logic. Must be fixed before Phase 4 ships (client portal inherits brand values).

CLAUDE.md entry to add:
# KNOWN BUG: Brand Kit page and preview tab are out of sync.
# Preview (4 colors + font families) is correct. Brand Kit page must be updated to match.
# Fix before Phase 4. Shared component approach — do not duplicate display logic.

### Pre-warm — AI finds the post automatically
Corrected: user should never have to open LinkedIn before the pre-warm step.
Edge Function web-searches for the company's recent LinkedIn post, fetches content,
drafts a craft-level peer comment (not a compliment — engages with specific detail).
Fallback: if LinkedIn page is gated, show paste input for degraded experience.
Comment quality rule: engage as a peer, never as an admirer. No "great post!" ever.
Same Edge Function as company research — add `action: "prewarm_comment"` branch.
Full spec in FORGEFLY_OUTREACH_SPEC.md §10e.

### QR code + Apple Wallet pass (v4.2 addition)
Two new sharing artifacts. Strategic distinction:
- QR code = in-person tool (networking, market stall, coffee meeting)
- Wallet pass = persistence tool (lives in Apple Wallet forever)
- Natural chain: owner shows QR → visitor scans → lands on /p/[slug] → adds to Wallet

Four touch points:
1. Share modal (owner) — new "QR code" tab: canvas-rendered QR in brand colors,
   3 color chips, PNG/SVG download, "Wallet →" shortcut button
2. /p/[slug] (visitor) — "Add to Apple Wallet" on iOS / "Save contact" (.vcf) on Android,
   below proposal CTA — for the visitor after scanning, not the owner
3. Brand Kit page (owner) — QR download section alongside logo downloads:
   PNG brand color, PNG white-on-dark, SVG — for print/packaging use
4. Business Settings (owner) — wallet pass preview under new Sharing subsection,
   "Add to my own Wallet" CTA, regenerate on brand kit change

Wallet pass contents: business name, tagline, logo, brand color background, QR → /p/[slug],
contact email, portfolio URL. NOT prices or services list.
.pkpass: server-side only via Supabase Edge Function `generate-wallet-pass`.
Requires Apple Developer account, Pass Type ID cert, passkit-generator (npm).
Android: .vcf download, same CTA slot, UA detection to switch.

QR contrast rule: if brand primary luminance > 0.4, auto-fallback to black on white.
Never white-on-light — must scan reliably.

Full spec in FORGEFLY_OUTREACH_SPEC.md §11. Build estimate: +5 days full, +1.5 days MVP.

### QR code + Apple Wallet pass (v4.2)
Three new tabs in share modal: Share (existing) / QR code (new) / Wallet pass (new).
QR = in-person sharing tool. Wallet pass = persistence artifact the visitor keeps.
The chain: owner shows QR → visitor scans → /p/[slug] → visitor adds to wallet.

Touchpoints:
- Share modal QR tab: owner accesses, color-customizes, downloads QR
- Share modal Wallet tab: owner previews pass, adds to own wallet
- /p/[slug] visitor CTA: "Add to Apple Wallet" (iOS) / "Save contact .vcf" (Android)
- Brand Kit: QR download assets (PNG brand color, PNG white bg, SVG)
- Business Settings: live pass preview, auto-updates on brand color change

QR always renders dark color on white. If brand primary luminance > 0.4, auto-fallback
to #1a1a1a. Never white-on-light.

Wallet pass generated server-side via Edge Function using `passkit-generator`.
Pass type: generic. Brand primary = pass background. QR embedded natively via
barcode field. Apple certs stored as Supabase secrets.
Full .pkpass structure + build order in FORGEFLY_OUTREACH_SPEC.md §11.

### Merged proposals page (v4.3)
"Proposals" and "Requests" pages merged into one: Proposals.
Single `proposals` table with `initiated_by` field: 'freelancer' | 'client' | 'pipeline'.
Old Requests table migrated — client submissions become proposals with initiated_by='client', status='draft'.

Filter axes: Origin (All / Created by me / Created by others) + Status + Client name + search.
Row action buttons are contextual to initiated_by × status — never a generic "View" when
a better action exists. "Create invoice" shortcut pre-fills from proposal line items.

AI generation branches on initiated_by:
- freelancer: confident, value-forward, selling tone
- client: responsive, confirmatory, acknowledges their brief
- pipeline: company-specific, uses CompanyIntel object, matched services only
All branches: Sonnet 4.6, never auto-generates price (leaves [amount] token),
diff-confirmation modal before saving, portfolio URL injected from businesses.slug.

Viewed tracking: server-side only via POST /api/proposals/[id]/viewed from portal.
Never client-side — bot/email preview must not trigger it.

Pipeline auto-progression: proposal sent → 'Proposal Sent', accepted → 'Negotiating',
declined → 'Lost'. All via Edge Function triggers, never client-side.

Full spec: FORGEFLY_OUTREACH_SPEC.md §12.
