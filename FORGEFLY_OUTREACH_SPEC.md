# Forgefly — Outreach & Visibility Feature Spec
> Session: June 14, 2026  
> Status: Ready for build planning  
> Supersedes: nothing — this is net-new feature scope  
> Load alongside FORGEFLY_HANDOFF_V4.md

---

## 1. Strategic frame

Forgefly serves every solo operator — graphic designers pitching game studios (B2B),
bakers taking wedding orders (B2C), CPAs working with individual clients (hybrid). The
product must handle all three without asking the user to self-categorize.

Two new feature areas come out of this session:

- **"Let's Make You Visible"** — persona-aware presence engine that tells users where
  they should show up and generates the copy to do it
- **B2B Outreach Kit** — URL/name paste → company research → personalized multi-step
  outreach sequence, tracked in the pipeline

These are Phase 3.5 features — they slot between AI pre-population (Phase 3) and client
portal (Phase 4) in the existing build order.

---

## 2. Classifier schema addition

### Current classifier output (Haiku, temp 0)
The classifier already fires on the seed prompt and routes to tier selection. It needs
one additional output block: `business_profile`.

### New output schema

```typescript
interface BusinessProfile {
  motion: "b2b" | "b2c" | "hybrid"
  industry_vertical: string          // e.g. "creative_design", "food_beverage", "professional_services"
  sale_type: "portfolio_forward" | "review_driven" | "trust_referral" | "direct_search"
  client_decision_maker: string      // e.g. "art_director", "couple_planning_wedding", "individual_taxpayer"
  sales_cycle: "async_long" | "urgency_driven" | "relationship_slow"
  presence_tier: "b2b_creative" | "b2c_local" | "b2b_professional" | "hybrid_professional"
}
```

### Classifier prompt addition

Append to the existing Haiku classifier system prompt:

```
After your existing tier classification, output a second JSON block tagged
<business_profile> with these fields:
- motion: is this user selling to businesses, consumers, or both?
- industry_vertical: one snake_case label for their sector
- sale_type: what primarily drives their new client acquisition?
- client_decision_maker: who is the person writing the check?
- sales_cycle: how does the buying decision typically work?
- presence_tier: which of the four presence playbooks applies?

Base this entirely on the seed prompt. Do not ask clarifying questions.
If ambiguous, pick the most likely interpretation and flag with
"confidence": "low".
```

### Where it lands

Store in `businesses.extracted_data` under key `business_profile`. All downstream
features (visibility engine, outreach kit, nudge engine) read from here. Never
re-classify unless the user explicitly re-runs their seed prompt.

### Presence tier → playbook mapping

| presence_tier | Primary channels | Sales motion |
|---|---|---|
| b2b_creative | Behance/Dribbble, LinkedIn, cold outreach kit, Reddit demand signals | Portfolio-forward, async |
| b2c_local | Instagram, Google Business, The Knot/WeddingWire, Nextdoor | Review-driven, urgency |
| b2b_professional | LinkedIn, Alignable, referral networks, Google Business | Trust-forward, slow |
| hybrid_professional | LinkedIn + Google Business + trust signals + referral copy | Both motions |

---

## 3. "Let's Make You Visible" — presence engine

### Entry point

After portal generation (post-auth), a new tab appears in the dashboard:
**"Let's Make You Visible"** — not "Presence" or "Marketing." The name is the feature.

### UX flow

1. User lands on the tab
2. Classifier output (already run) determines which playbook loads — no user input needed
3. Three-tier channel list renders:
   - **Now** — copy generates instantly (bio, profile blurb, Google Business description)
   - **Grow** — secondary channels, slightly more effort (SEO copy, trust signal kit)
   - **Live signals** — demand feed (Reddit, Twitter API) — **COMING SOON badge for MVP**

### Channel list per presence_tier

**b2b_creative**
- Behance/Dribbble profile bio + case study structure template (Now)
- LinkedIn headline + About + Featured section copy (Now)
- Cold outreach kit entry point → B2B Outreach Kit feature (Now)
- Google/SEO bio, keyword-aligned (Grow)
- Reddit demand signal feed: r/gamedev, r/gamedesign, r/forhire (Coming Soon)

**b2c_local**
- Instagram bio + highlights structure + 5 caption templates (Now)
- Google Business description + services + FAQ copy (Now)
- The Knot / WeddingWire profile blurb + package descriptions (Now)
- Nextdoor neighborhood intro post, ready to paste (Now)
- Local Reddit + Facebook group demand signals (Coming Soon)

**b2b_professional**
- LinkedIn authority kit: profile + 3 thought leadership post templates (Now)
- Google Business + Yelp professional description (Now)
- Alignable profile + referral intro message (Now)
- Credentials + testimonial request template kit (Grow)
- r/personalfinance, r/smallbusiness demand signals (Coming Soon)

**hybrid_professional**
- Combination of b2b_professional + b2c_local relevant channels
- Surfaces both LinkedIn and Google Business as primary (Now)

### Copy generation

All "Now" channel copy is generated via the existing AI gateway (Haiku for short-form
copy, Sonnet for longer structured pieces like case study templates). Generated copy
lands in `extracted_data.visibility_kit` as a keyed object per channel. Never
regenerates unless the user explicitly requests a refresh.

### AI token cost per user (one-time, on tab open)

- Haiku calls: ~4–6 for short-form channel copy (bio, blurb, caption set)
- Sonnet call: 1 for case study / authority kit structure
- Estimate: ~$0.008–0.014 per user activation. Absorbed in Sourav's margin.

---

## 4. B2B Outreach Kit

### Entry point

Available from:
1. "Let's Make You Visible" tab → cold outreach kit channel card
2. PipelinePage header action: "Research a company"
3. Future: nudge engine suggestion ("You haven't added a new prospect this week")

### Full 5-step UX flow

#### Step 1 — Paste target
User pastes a company name, website URL, or LinkedIn company URL into a single input.
No other form fields. One button: "Research + draft →"

#### Step 2 — Research loading
Animated progress list, ~10–15 seconds:
1. Fetching company website
2. Extracting team + contact signals
3. Scanning for hiring activity
4. Matching to your service portfolio
5. Drafting outreach copy

**Implementation:** Single Supabase Edge Function call. Internally:
- `web_fetch` the URL (or Google search the company name to get URL first)
- Extract: company description, team page signals, contact email, open roles
- Pass to Sonnet with the user's `extracted_data.services` for match analysis
- Return structured `CompanyIntel` object (see schema below)

#### Step 3 — Intel brief
Displays:
- Company avatar (initials fallback), name, meta line (type · location · size)
- Match badge: "Strong match" / "Partial match" / "Weak match" — calculated from
  service overlap score
- 4-cell intel grid: what they do / brand approach / best contact / best channel
- Service match pills: green checkmark for matched services, gray ✗ for non-matches
- Live signals row: hiring activity, recent announcements (Coming Soon badge for MVP)

**Weak match gate:** If `service_overlap_score < 0.3`, show a friction modal:
"Only 1 of your services seems relevant here. Still want to draft outreach?"
User confirms or goes back. Prevents wasted copy generation.

#### Step 4 — Outreach kit (4 tabs)

| Tab | Content | Notes |
|---|---|---|
| Cold email | Subject line + full email body | Lead with matched services only |
| LinkedIn DM | Short DM, 300 char awareness | For post-connection send |
| Connection note | Ultra-short, <300 chars | For connection request itself |
| Follow-up | Day 5–7 follow-up email | Assumes no reply |

**Pre-warm suggestion** (inline, below LinkedIn DM tab):
Dashed border box — "Pre-warm first? (recommended)" — explains that commenting on
their recent post before DMing converts 2–3× better. CTA: "Draft a comment →" which
triggers a separate Claude call with the company's recent LinkedIn post content
(user pastes it in) and returns a genuine, craft-level comment.

**Tone adjustment:** "Adjust tone ↗" button → sendPrompt to regenerate with
user-specified tone modifier.

#### Step 5 — Sequence tracker + actions (3 tabs)

**"Copy for this step" tab**
- Shows the 4-step sequence (Connect → LinkedIn DM → Cold email → Final nudge)
- Active step has the copy ready
- Marking a step done auto-advances to next step

**"Pipeline card" tab**
- Preview of the lead card that will be created
- Stage: always **Prospect** (never Contacted — that's earned by actually sending)
- Pre-filled fields: company name, contact, service fit, next action, reminder date, source: "Outreach kit"
- CTA: "Add to pipeline" → creates `pipeline_leads` row (see schema below)
- Info note: "As you mark steps done, the card moves automatically. You never drag it."

**"Got a reply?" tab**
- Textarea: user pastes the reply they received
- CTA: "Draft my response →" → calls Claude API (see §5 below)
- Secondary CTA: "Mark as dead" → confirmation modal → closes sequence, moves
  pipeline card to Lost

---

## 5. Reply handler — API spec

### Why Claude, not keyword matching

The reply handler must be a real Claude API call. Keyword matching produces wrong
classifications (tested: "a little late this quarter for contractor changes" classified
as "interested" with keyword logic). A misread reply that tells the user to move fast
when they should wait quietly is worse than no AI at all.

### API call spec

```typescript
// Called from: Supabase Edge Function `handle-reply-intent`
// Triggered by: user clicking "Draft my response" in Got a reply? tab
// Model: claude-haiku-4-5-20251001 (short input/output, cost-sensitive)

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: `You are a reply classifier and response drafter for a freelancer outreach tool.

Given a reply from a prospective client, you must:
1. Classify the intent precisely
2. Draft the ideal response for the freelancer to send

Output ONLY valid JSON. No preamble, no markdown fences.

Classification schema:
{
  "intent": "soft_defer" | "hard_no" | "interested" | "wants_material" | "objection" | "auto_reply",
  "timing_signal": "this_quarter" | "next_quarter" | "specific_date" | "no_timeline" | null,
  "tone": "warm" | "neutral" | "cold",
  "confidence": "high" | "medium" | "low",
  "recommended_pipeline_action": "pause_with_reminder" | "close_lost" | "advance_to_contacted" | "send_material" | "address_objection",
  "reminder_weeks": number | null,
  "classification_reasoning": "one sentence explaining the call",
  "draft_response": "the full response text the freelancer should send — no [placeholder] except [Your name]",
  "draft_subject": "email subject if this warrants an email reply, else null",
  "user_facing_label": "short label shown above the draft, e.g. 'Q3 hold — keep warm, don't push'"
}`,
    messages: [{
      role: "user",
      content: `Freelancer context:
- Name: ${freelancer.name}
- Services: ${freelancer.services.join(", ")}
- Target company: ${lead.company_name}
- Outreach step they replied to: ${lead.current_step} (${lead.step_copy_summary})

Reply received:
"${replyText}"`
    }]
  })
})
```

### Classification → UI mapping

| intent | user_facing_label pattern | pipeline action | sequence action |
|---|---|---|---|
| soft_defer | "{timing} hold — keep warm, don't push" | pause, set reminder_weeks | Stay on current step |
| hard_no | "Graceful close — leave the door open" | move to Lost | Close sequence |
| interested | "They're open — move fast" | advance to Contacted | Advance step |
| wants_material | "They want a deck — strike now" | advance to Contacted | Advance + offer deck CTA |
| objection | "Address this before moving on" | stay in Prospect | Surface objection copy |
| auto_reply | "Auto-reply detected — wait for a human response" | no change | No change |

### Example: the screenshot reply

Input: "Hi Mr FFtest, Thanks for reaching out to us. Unfortunately, its a little late
for us this quarter, to be making contractor changes. Thanks again for reach out and
looking out for us."

Expected classification output:
```json
{
  "intent": "soft_defer",
  "timing_signal": "this_quarter",
  "tone": "warm",
  "confidence": "high",
  "recommended_pipeline_action": "pause_with_reminder",
  "reminder_weeks": 10,
  "classification_reasoning": "Politely declines due to timing, not fit — warm tone and 'looking out for us' signals the door is open next cycle.",
  "draft_response": "Hi [name],\n\nTotally understand — timing is everything with these decisions. I'll check back in early next quarter so you have context before planning conversations start.\n\nAppreciate you taking the time to respond.\n\n[Your name]",
  "draft_subject": null,
  "user_facing_label": "Q this quarter — follow up in 10 weeks"
}
```

Note: pipeline card stays in **Prospect**. Next action date sets to `today + 70 days`.
Sequence pauses — does not advance. Reminder fires automatically via nudge engine.

---

## 6. Pipeline integration — schema additions

### New fields on `pipeline_leads`

```sql
ALTER TABLE pipeline_leads ADD COLUMN IF NOT EXISTS
  source text DEFAULT 'manual',            -- 'outreach_kit' | 'manual' | 'visibility_kit'
  company_url text,                         -- the URL that was researched
  service_overlap_score float,              -- 0.0–1.0, from intel brief
  matched_services text[],                  -- array of service names that matched
  outreach_sequence_step int DEFAULT 0,     -- 0=not started, 1=connect, 2=dm, 3=email, 4=followup
  outreach_sequence_status text DEFAULT 'not_started',  -- 'not_started' | 'in_progress' | 'paused' | 'complete' | 'dead'
  last_reply_intent text,                   -- last classified intent from reply handler
  next_action_date date,                    -- auto-set by sequence progression and reply handler
  reminder_sent_at timestamptz,             -- tracks nudge engine delivery
  company_intel jsonb;                      -- full CompanyIntel object from research step
```

### Auto-progression rules

| Event | Pipeline stage change | sequence_status change |
|---|---|---|
| "Add to pipeline" clicked | Prospect | not_started → in_progress |
| Step 1 marked sent | Prospect (no change) | step 0 → 1 |
| Step 2 marked sent | Prospect → Contacted | step 1 → 2 |
| Reply classified as `interested` or `wants_material` | Prospect → Contacted | advance |
| Reply classified as `soft_defer` | no change | paused, next_action_date set |
| Reply classified as `hard_no` | Contacted → Lost | dead |
| "Mark as dead" clicked | → Lost | dead |
| Proposal sent manually | Contacted → Proposal Sent | complete |

User never manually drags the pipeline card. Stage is always derived from sequence state.

### CompanyIntel object (stored in company_intel JSONB)

```typescript
interface CompanyIntel {
  company_name: string
  company_url: string
  description: string
  industry: string
  size_estimate: string
  location: string
  brand_approach: string
  best_contact_point: string
  best_channel: "linkedin_dm" | "email" | "linkedin_then_email"
  open_roles: string[]
  recent_signals: string[]          // announcements, launches, news
  service_overlap_score: number     // 0.0–1.0
  matched_services: string[]
  unmatched_services: string[]
  match_label: "Strong match" | "Partial match" | "Weak match"
  researched_at: string             // ISO timestamp
}
```

---

## 7. Additional offers after sequence steps

After each step is copied/sent, surface contextual offers (not a wall of options —
show the one most relevant to the current step):

| After step | Offer | Action |
|---|---|---|
| Connect sent | Pre-warm comment draft | User pastes company's recent post → Claude drafts comment |
| DM sent | Portfolio tailoring | Reorder case studies to lead with matched services |
| Reply: wants_material | Deck intro generator | 3-slide intro pre-filled with company context |
| Reply: interested | Proposal shortcut | One-click to proposal draft pre-filled with company + matched services + suggested rate |
| Any reply | Add contact to CRM | Creates contact row from the intel brief data |

---

## 8. What is explicitly NOT being built

- No scraping of Thumbtack / Yelp / Angi / Nextdoor — ToS and legal risk
- No sending emails or DMs on the user's behalf — Forgefly never touches the sending chain
- No LinkedIn OAuth or API integration — copy only, user sends manually
- No lead data purchasing or third-party enrichment APIs (post-MVP consideration only)
- No keyword-based reply classification — always Claude API

---

## 9. Build order recommendation

| # | Task | Effort | Depends on |
|---|---|---|---|
| 1 | Classifier schema addition (`business_profile` output) | 0.5 days | Existing classifier |
| 2 | Presence tier lookup table + playbook rules | 0.5 days | #1 |
| 3 | "Let's Make You Visible" tab UI shell | 1 day | #2 |
| 4 | Visibility copy generation (Haiku calls per channel) | 1.5 days | #3 |
| 5 | `pipeline_leads` schema additions + migration | 0.5 days | Existing schema |
| 6 | B2B Outreach Kit — steps 1–3 (paste → research → intel brief) | 3 days | #5 |
| 7 | B2B Outreach Kit — steps 4–5 (copy tabs + sequence tracker) | 2 days | #6 |
| 8 | Pipeline card creation from outreach kit | 1 day | #5, #7 |
| 9 | Reply handler — Edge Function + Claude API call | 1.5 days | #5, #8 |
| 10 | Auto-progression rules (sequence state → pipeline stage) | 1 day | #8, #9 |
| 11 | Contextual post-step offers | 1 day | #7 |
| 12 | Pre-warm comment drafter | 0.5 days | #7 |

Total estimate: ~14 days for full feature set. MVP (steps 1–9, no post-step offers):
~11 days.

---

## 10. Amendments — v4.1 (June 14, 2026 follow-up)

### 10a. Public portfolio link in all outreach channels

Every channel that generates copy must auto-inject the user's live public portfolio URL
(`/p/[slug]`). This is already generated at portal creation — do not use a placeholder.

**Affected surfaces:**
- Cold email: replace `[Portfolio link]` placeholder with real `businesses.slug` URL
- LinkedIn About copy: append portfolio URL to the generated bio
- Behance / Dribbble bio: include as "See full portfolio at [url]"
- Nextdoor intro post: include as a natural closing line
- Connection note: omit (too short, URL kills the character limit)
- LinkedIn DM: omit from initial DM, include in follow-up if they engage

**Implementation:** At copy generation time, read `businesses.slug` from the DB and
inject as `https://[domain]/p/[slug]`. Never hardcode or leave as placeholder.

---

### 10b. Public portfolio — Bio/About section addition

**Change:** Add a Bio/About section to the public portfolio (`/p/[slug]`) that renders
*before* the services section.

**Why:** The service list without context reads like a menu. A short bio first answers
"who is this person" before "what do they offer."

**Data source:** New field `businesses.bio` (text, nullable, max ~500 chars). Separate
from `extracted_data` — this is identity-level data, not operational data.

**AI pre-population:** At portal generation time, Haiku generates a short bio from the
seed prompt and stores it in `businesses.bio`. User can edit via Business Settings.

**Public portfolio render order:**
1. Header (name, logo, tagline)
2. **Bio/About** ← new, before services
3. Services / packages
4. Portfolio / case studies (if present)
5. Contact / CTA

---

### 10c. Business Settings — Brand Name & Bio editable fields

**Location:** Settings tab → Business Settings section (not command bar, not
extracted_data flow — this is identity data).

**Fields to add to Business Settings:**
| Field | DB column | Notes |
|---|---|---|
| Business name | `businesses.name` | Already exists, make editable here |
| Public URL slug | `businesses.slug` | Show live URL preview, availability check on change |
| Bio / About | `businesses.bio` | New field — plain text, ~500 char limit, no markdown |
| Logo | `businesses.logo_url` | Already exists, upload trigger here |
| Contact email (public) | `businesses.contact_email` | Shown on portfolio |

**Writes:** Directly to `businesses` table. Not through `extracted_data`. Not through
the command bar flow. These are always intentional, explicit user edits.

**Slug change:** If user changes slug, show warning: "Your current portfolio link will
stop working. Anyone with the old link won't be able to find you." Require confirmation.
Update `businesses.slug` and redirect `/p/[old]` → `/p/[new]` with 301 if feasible.

---

### 10d. Brand Kit — consistency fix (known bug)

**Problem:** Brand Kit page renders the old layout. Preview tab renders the new layout
(4 colors + font families). These are out of sync.

**Rule:** Preview is the source of truth. The Brand Kit page must match it exactly:
- 4 color swatches (primary, secondary, accent, background) — same as preview
- Font families displayed as named pairs with specimen text — same as preview
- No other layout differences

**Fix approach:** Extract the color/font display components from the preview into shared
components. Both Brand Kit page and preview tab import from the same component. Never
let them diverge again.

**Priority:** Fix before Phase 4 (client portal) ships. The client portal inherits brand
kit values — a mismatch here causes visible inconsistencies in the client-facing portal.

Add to CLAUDE.md:
```
# KNOWN BUG: Brand Kit page and preview tab are out of sync.
# Preview (4 colors + font families) is correct. Brand Kit page must be updated to match.
# Fix before Phase 4. Shared component approach — do not duplicate display logic.
```

---

### 10e. Pre-warm — AI finds the post, user never has to

**Corrected behavior (replaces previous spec):**

The pre-warm feature should find the relevant company post automatically. The user
should never have to open LinkedIn before the pre-warm step. That defeats the purpose.

**Flow:**
1. User clicks "Pre-warm first?" in the outreach kit
2. Edge Function fires a web search: `"[company name]" LinkedIn post site:linkedin.com`
3. Fetch the top result URL, extract the post content
4. Pass to Haiku with freelancer's service context → draft a genuine, craft-level comment
5. Surface to user: post snippet/title (so they can verify it's real) + drafted comment
6. User copies comment, opens LinkedIn, pastes — that's the only manual step

**Fallback (LinkedIn login wall):**
LinkedIn public post pages are sometimes gated. If the fetch fails or returns a login
redirect:
- Show: "We couldn't pull a recent post automatically — paste it here and we'll draft
  the comment."
- Textarea appears for user to paste post content
- Same Claude call fires once content is pasted
- This is a clean degraded experience, not a silent failure

**Comment quality bar:** The drafted comment must read as craft-level, not a compliment.
It should engage with a specific decision, technique, or detail in the post — the kind
of comment a professional peer would leave, not a fan. Haiku system prompt should
explicitly say: "Do not compliment. Engage with a specific detail, technique, or
decision visible in the post. Write as a peer, not an admirer."

**Updated API call for pre-warm:**

```typescript
// Model: claude-haiku-4-5-20251001
// System prompt key instruction:
`You are drafting a LinkedIn comment for a freelancer who is about to cold DM this company.
The goal is to appear on their radar as a genuine peer before the DM lands.

Rules:
- Do NOT compliment or flatter. No "great post!" or "love this!"
- Engage with a SPECIFIC detail, decision, or technique mentioned in the post
- Write as a peer — someone who works in the same space and has an informed opinion
- 2–3 sentences maximum
- Natural, conversational — not polished or corporate
- Must make the commenter look like they actually read and thought about the post

Freelancer context: {services}, {industry_vertical}
Company: {company_name}
Post content: {post_content}`
```

**Build note:** This is the same Edge Function as company research — add a
`action: "prewarm_comment"` branch. No new function needed.


---

## 11. QR code + Apple Wallet pass — sharing touchpoints

### Strategic distinction
- QR code = in-person sharing tool (networking event, market stall, coffee meeting)
- Wallet pass = persistence tool (lives in Apple Wallet, survives phone upgrades)
- Natural chain: QR code → person scans → lands on /p/[slug] → prompted to Add to Wallet

### Touch point 1 — Share modal (owner-facing): QR code tab
Location: existing share modal, new third tab alongside Share.
Content:
- 160×160 QR rendered on canvas, white background, brand color foreground
- 3 color chips: brand primary, brand dark, black — user picks
- Caption includes real /p/[slug] URL (never placeholder)
- Download buttons: PNG, SVG
- "Wallet →" shortcut button to navigate to Wallet pass tab
Implementation: use `qrcode` library + canvas, draw brand color over white.
Contrast rule: if brand primary luminance > 0.4, auto-fallback to black. Never
white-on-light or low-contrast QR — must scan reliably.

### Touch point 2 — Public portfolio page (visitor-facing): Add to Wallet
Location: /p/[slug] — below the proposal/contact CTA, persistent.
Behavior:
- iOS Safari: "Add to Apple Wallet" button → generates .pkpass on demand → download
- Android / other: same slot becomes "Save contact" → .vcf download
- Detection: navigator.userAgent check (UA string or navigator.platform)
This CTA is for the visitor, not the owner. It is what they get after scanning.

### Touch point 3 — Brand Kit page (owner-facing): downloadable QR assets
Location: Brand Kit page, alongside logo download section.
Offer: "Download QR code" — three variants:
- PNG in brand primary color on white
- PNG white on dark (for dark backgrounds)
- SVG (scalable for print)
Use case: business cards, packaging inserts, stickers, invoice footers.

### Touch point 4 — Business Settings (owner-facing): wallet pass preview + setup
Location: Settings tab → Sharing section (new subsection).
Content:
- Live preview of the .pkpass card (pulls from brand kit + bio + contact fields)
- "Add to my own Wallet" CTA — lets owner demo the experience
- "Regenerate pass" if brand kit changes
Pass preview renders as a visual card in the settings UI, not a modal.

### Wallet pass contents (.pkpass)
- Business name (from businesses.name)
- Tagline (from extracted_data.tagline)
- Logo (from businesses.logo_url)
- Brand primary color as pass background
- QR code linking to /p/[slug]
- Contact email (from businesses.contact_email)
- Portfolio URL in brand primary color
- Pass subtext: "Tap to open portfolio"

Does NOT include: prices, services list (too volatile / too much text for a pass card)

### .pkpass generation
Server-side only — never client-side. Supabase Edge Function:
`generate-wallet-pass` action in the existing AI gateway Edge Function.
Requires: Apple Developer account, Pass Type ID certificate, team identifier.
Signing: p12 certificate + passphrase stored in Supabase secrets.
Library: `passkit-generator` (npm) in the Edge Function.

### Android equivalent
Same "Save contact" CTA generates a .vcf file with:
- FN (full name / business name)
- ORG (business name)
- URL (portfolio link)
- EMAIL (contact email)
- NOTE (tagline)
No Apple-specific dependencies. Pure text format, universally supported.

### Build order addition (append to §9 build order)
| # | Task | Effort | Depends on |
|---|---|---|---|
| 13 | QR code tab in share modal (canvas render + color chips + download) | 1 day | businesses.slug |
| 14 | Add to Wallet / Save contact CTA on /p/[slug] | 0.5 days | #13 |
| 15 | Brand Kit QR download section | 0.5 days | #13 |
| 16 | .pkpass Edge Function + Apple Dev account setup | 2 days | businesses, brand kit |
| 17 | Wallet pass preview in Business Settings | 1 day | #16 |

Total Phase 3.5 revised estimate: ~19 days full / ~14 days MVP (without wallet pass).

---

## 11. QR code + Apple Wallet pass (v4.2 addition)

### Strategic framing

QR code and wallet pass are distinct artifacts serving different moments:
- QR code = in-person sharing tool (networking, market stall, coffee meeting)
- Wallet pass = persistence tool (lives in client's phone forever, survives upgrades)

The ideal chain: owner shows QR → visitor scans → lands on /p/[slug] → prompted to
"Add to Wallet." QR gets the scan. Wallet pass is what they keep.

### Touchpoint map

| Surface | Who sees it | What it does |
|---|---|---|
| Share modal → QR tab | Owner | Access, color-customize, download QR |
| Share modal → Wallet pass tab | Owner | Preview pass, add to own wallet, one-time setup |
| Public portfolio /p/[slug] | Visitor (after scanning) | "Add to Apple Wallet" / "Save contact" (.vcf) |
| Brand Kit page | Owner | Download QR as print-ready asset (PNG, SVG) |
| Business Settings | Owner | Live pass preview, auto-updates on brand color change |

### Share modal — new tabs

Add two tabs alongside existing Copy / Email / Message:

**QR code tab**
- Renders QR in brand primary color on white background
- Color picker: brand primary (default) + 3 presets (purple, teal, black)
- Rule: always dark color on white — never white-on-light, never low-contrast
  If brand primary is too light (luminance > 0.4), auto-fallback to dark on white
- Download options: PNG (transparent bg), PNG (white bg), SVG
- Footer note: "Also available in Brand Kit as a downloadable asset"
- QR encodes: https://forgefly.io/p/[slug]

**Wallet pass tab**
- Live preview of the pass card using brand primary color + logo
- Pass contents: business name, tagline, portfolio URL, contact email, QR (embedded)
- Pass does NOT include: prices, services list (too volatile / too long)
- CTA: "Add to Apple Wallet" (generates .pkpass)
- Secondary: "Save contact (.vcf)" for Android
- Footer: "Pass uses your brand primary color. Edit in Business Settings → Brand."
- Auto-regenerates when brand color or logo changes — no manual re-setup

### Public portfolio — visitor-facing wallet CTA

Location: below the "Request a Proposal" CTA on /p/[slug]
- iOS Safari: "Add to Apple Wallet" button (renders .pkpass)
- Android / other: "Save contact" (.vcf download)
- Detection: `navigator.userAgent` check, render appropriate button
- This is the conversion point of the QR → scan → save chain

### Brand Kit — QR download assets

In Brand Kit page, alongside logo downloads:
- QR code PNG (brand primary color, white background)
- QR code PNG (white, transparent background — for dark surfaces)
- QR code SVG (scalable, for print)
- Label: "Use on business cards, packaging, invoice footers, stickers"

### Business Settings — wallet pass management

Location: Settings → Business Settings → Sharing section
- Live pass preview using current brand color + logo
- "Add to my own wallet" CTA — useful for owner to demo to clients
- One-time setup; no re-entry needed unless brand changes
- Auto-updates: brand color or logo change → pass regenerates on next open

### QR code generation

Library: `qrcode` npm package on the Edge Function side for server-side generation,
or `qrcodejs` / canvas for client-side preview in the modal.

Color contrast enforcement:
```typescript
function getQRColor(brandPrimary: string): string {
  const luminance = getLuminance(brandPrimary)
  return luminance > 0.4 ? '#1a1a1a' : brandPrimary
}
```

### Apple Wallet pass (.pkpass) — implementation notes

- Generate server-side via Supabase Edge Function using `passkit-generator` npm package
- Required Apple certs: Pass Type ID cert + WWDR cert (stored as Supabase secrets)
- Pass type: `generic` (most flexible for business cards)
- Pass structure:
  ```json
  {
    "formatVersion": 1,
    "passTypeIdentifier": "pass.io.forgefly.portfolio",
    "teamIdentifier": "[APPLE_TEAM_ID]",
    "backgroundColor": "[brand_primary]",
    "logoText": "[business_name]",
    "generic": {
      "primaryFields": [{ "key": "name", "value": "[business_name]" }],
      "secondaryFields": [{ "key": "url", "value": "forgefly.io/p/[slug]" }],
      "auxiliaryFields": [{ "key": "email", "value": "[contact_email]" }],
      "backFields": [{ "key": "tagline", "value": "[tagline]" }]
    },
    "barcode": { "message": "https://forgefly.io/p/[slug]", "format": "PKBarcodeFormatQR" }
  }
  ```
- QR is embedded in the pass natively via the `barcode` field — no separate QR image needed

### Build additions to order (append to §9)

| # | Task | Effort | Depends on |
|---|---|---|---|
| 13 | QR code generator — modal tab + brand color logic | 1 day | businesses.slug, brand_kit |
| 14 | Brand Kit — QR download assets | 0.5 days | #13 |
| 15 | Apple Wallet .pkpass Edge Function | 2 days | Apple certs, passkit-generator |
| 16 | Public portfolio — Add to Wallet / Save contact CTA | 1 day | #15, /p/[slug] page |
| 17 | Business Settings — wallet pass preview section | 0.5 days | #15 |

Total additions: ~5 days. Can run in parallel with outreach kit build after #13.
