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

---

## 12. Merged proposals page — full spec

### 12a. The merge rationale (locked)

Two pages ("Proposals" + "Requests") collapse into one: **Proposals**.
The split was the app's internal architecture leaking into the UI. One concept,
one place. The merged page shows the full proposal pipeline regardless of origin.

---

### 12b. Data model

#### Unified `proposals` table

```sql
CREATE TABLE proposals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid REFERENCES businesses(id) ON DELETE CASCADE,
  client_id           uuid REFERENCES contacts(id),           -- nullable until linked
  client_name         text NOT NULL,                          -- denormalized for display
  client_email        text,
  title               text NOT NULL,
  description         text,
  line_items          jsonb DEFAULT '[]',                     -- [{label, qty, unit_price}]
  total_amount        numeric(10,2),
  currency            text DEFAULT 'USD',

  -- origin
  initiated_by        text NOT NULL CHECK (
                        initiated_by IN ('freelancer','client','pipeline')
                      ),
  pipeline_lead_id    uuid REFERENCES pipeline_leads(id),     -- set if initiated_by='pipeline'

  -- state machine
  status              text NOT NULL DEFAULT 'draft' CHECK (
                        status IN (
                          'draft','sent','viewed','accepted',
                          'declined','expired','withdrawn'
                        )
                      ),

  -- AI generation metadata
  ai_generated        boolean DEFAULT false,
  ai_generation_tone  text,                                   -- 'outbound'|'response'|'b2b_tailored'
  ai_model_used       text,

  -- timestamps
  created_at          timestamptz DEFAULT now(),
  sent_at             timestamptz,
  viewed_at           timestamptz,                            -- set on first public view
  responded_at        timestamptz,
  expires_at          timestamptz,                            -- optional expiry
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX ON proposals (business_id, status);
CREATE INDEX ON proposals (business_id, initiated_by);
CREATE INDEX ON proposals (pipeline_lead_id) WHERE pipeline_lead_id IS NOT NULL;
```

#### What happened to the old "Requests" table

Existing client request form submissions map to `proposals` with:
- `initiated_by = 'client'`
- `status = 'draft'` (the freelancer hasn't responded yet)
- `client_name`, `client_email` from the request form
- `description` from the request message field

Migration: one-time script, no data loss.

---

### 12c. Status state machine

```
FREELANCER-INITIATED:
  draft → sent → viewed → accepted
                        → declined
                        → expired (cron, if expires_at passes with no response)
              → withdrawn (freelancer pulls it back)

CLIENT-INITIATED:
  draft (= new request, freelancer hasn't responded)
      → sent (freelancer sends their proposal response)
      → viewed → accepted
               → declined
               → expired

PIPELINE-TRIGGERED:
  Same as freelancer-initiated. initiated_by='pipeline', pipeline_lead_id set.
  Pipeline card auto-advances to 'Proposal Sent' when status moves draft→sent.
```

---

### 12d. Page layout

```
Proposals                                          [+ New proposal]

┌─ filters ──────────────────────────────────────────────────────┐
│ [All] [Created by me] [Created by others]                      │
│ Status ▾   Client ▾   (search by name)                        │
└────────────────────────────────────────────────────────────────┘

┌─ proposal row ─────────────────────────────────────────────────┐
│ [avatar]  Client name · Title              $amount             │
│           Created by [me|them] · [time ago]     [action btns] │
│           Status badge                                         │
└────────────────────────────────────────────────────────────────┘
```

**Filter axes:**
- Origin: All / Created by me / Created by others
- Status: All / Draft / Sent / Viewed / Accepted / Declined / Expired
- Client: dropdown of unique client names on this business's proposals
- Search: freetext on client name or proposal title

**Sort:** Most recent first (default). No other sort needed at MVP.

**Empty states per filter:**
- "Created by others" + empty: "No one has requested a proposal yet.
  Share your portfolio link to start getting requests."
- "Created by me" + empty: "You haven't created any proposals yet.
  Start one or generate from a pipeline lead."

---

### 12e. Row-level action buttons

Action buttons are contextual — driven by `initiated_by` × `status`.
Never show a generic "View" when a more useful action exists.

| initiated_by | status | Primary action | Secondary action |
|---|---|---|---|
| client | draft | Draft response | Decline |
| client | sent | View | Follow up |
| client | viewed | Follow up | View |
| client | accepted | View | Create invoice |
| client | declined | View | — |
| freelancer | draft | Edit | Send |
| freelancer | sent | View | Follow up |
| freelancer | viewed | Follow up | View |
| freelancer | accepted | Create invoice | View |
| freelancer | declined | View | Archive |
| freelancer | expired | View | Reopen |
| pipeline | draft | Edit | Send |
| pipeline | sent | View | Follow up |
| pipeline | accepted | Create invoice | View |

**"Create invoice" shortcut:** Pre-fills invoice with client name, line items, and
total from the proposal. User confirms before saving. Never auto-creates silently.

**"Follow up" action:** Opens a compose surface with a pre-drafted follow-up message
(via Claude — see §12g). User edits and copies. Forgefly never sends.

---

### 12f. Proposal detail view

Single proposal page (slide-over panel or full page — match existing pattern).

Sections:
1. Header: client name, title, status badge, amount, dates
2. Origin note: "You created this" / "Requested by [client]" / "From pipeline: [company]"
3. Line items table
4. Cover message / description
5. Activity timeline: created → sent → viewed → responded (with timestamps)
6. Action bar (same logic as row actions, promoted to full buttons)

**Viewed tracking:** When the client opens `/portal/[token]` and the proposal is
rendered, set `viewed_at = now()` via a server-side Edge Function call.
Never trust client-side for this — a bot or email preview shouldn't trigger it.
Use a purpose-built endpoint: `POST /api/proposals/[id]/viewed` called from the
portal page's server component or a Supabase Edge Function after auth check.

---

### 12g. AI generation — branching by initiation type

All generation goes through the existing AI gateway Edge Function.
Add a new action: `generate_proposal`. Branch on `initiated_by`.

#### Branch 1: Freelancer-initiated (outbound)

```typescript
// Tone: confident, value-forward, selling
// Structure: problem understanding → proposed solution → scope → investment → CTA

system: `You are writing a business proposal for a freelancer.
This proposal is outbound — the freelancer is initiating contact.
Tone: confident, specific, peer-level. Not pitchy. Not humble.
Lead with demonstrating you understand the client's situation.
Then position the solution. Then scope, timeline, investment.
Never use the word 'deliverables'. Never say 'I hope this finds you well'.
Output clean prose sections with clear headers. No filler.`

context injected:
- freelancer services + bio (from extracted_data)
- client name + any known context
- business_profile.motion (b2b vs b2c) → adjusts formality
- If b2b: more formal, ROI-framed
- If b2c: warmer, outcome-framed
```

#### Branch 2: Client-initiated (response to request)

```typescript
// Tone: responsive, confirmatory, reassuring
// Structure: acknowledge brief → confirm scope → timeline → investment → next step

system: `You are writing a proposal in response to a client request.
The client has already expressed interest — this is a response, not a pitch.
Tone: reassuring, specific, professional. They reached out; they want this.
Lead by acknowledging exactly what they asked for. Confirm you can do it.
Then scope, timeline, price. Close with a clear next step.
Do not oversell. They're already interested.`

context injected:
- client's original request message (the form submission)
- freelancer services + bio
- Any services mentioned in the request → highlight those specifically
```

#### Branch 3: Pipeline-triggered (B2B tailored)

```typescript
// Tone: researched, peer-level, specific to the company
// Structure: company-specific framing → matched services → scope → investment

system: `You are writing a B2B proposal for a specific target company.
You have research on this company. Use it. Be specific — name their product,
their industry, their apparent need. Generic proposals lose to specific ones.
Tone: peer-level, direct, no fluff. This person gets pitched constantly.
Show you did your homework. Lead with what you know about them.`

context injected:
- Full CompanyIntel object (from outreach kit research)
- Matched services only (unmatched services never appear)
- freelancer bio + portfolio URL
- Any prior outreach sequence context (what step they're at)
```

#### Shared generation rules (all branches)

- Model: `claude-sonnet-4-6` (proposals need quality, not speed)
- Always inject `businesses.slug` as the portfolio URL — never a placeholder
- Never generate pricing automatically — leave `[amount]` tokens for the freelancer
  to fill in. Price is the freelancer's call, not the AI's.
- After generation, show a diff-confirmation modal before saving (same pattern as
  command bar). User must confirm before the proposal is stored.
- Store `ai_generated: true`, `ai_generation_tone`, `ai_model_used` on the row.

---

### 12h. "+ New proposal" flow

When the freelancer clicks "+ New proposal":

```
Step 1: Who is this for?
  [Select existing client ▾]  or  [New client — enter name + email]

Step 2: How do you want to start?
  ◉ Generate with AI  (recommended)
  ○ Start from blank template
  ○ Duplicate an existing proposal

Step 3 (if AI selected):
  Optional context box: "Anything specific to include?"
  placeholder: "e.g. they mentioned a tight timeline, or they have a fixed budget of $2k"
  [Generate proposal →]
```

If triggered from a pipeline lead card (the "Proposal shortcut" offer), skip steps 1
and 2 — jump straight to generation with `initiated_by='pipeline'` and
`CompanyIntel` pre-loaded. The freelancer sees the draft immediately.

---

### 12i. Connection to pipeline auto-progression

When a proposal's status changes:

| Proposal status change | Pipeline card action |
|---|---|
| draft → sent (proposal_lead_id set) | pipeline_leads.status → 'Proposal Sent' |
| accepted | pipeline_leads.status → 'Negotiating' (or 'Closed Won' if no negotiation step) |
| declined | pipeline_leads.status → 'Lost' |
| expired (no pipeline link) | no pipeline change |

These are Edge Function triggers on `proposals` status update — not client-side.
Never update pipeline stage from the client.

---

### 12j. Build order addition

| # | Task | Effort | Depends on |
|---|---|---|---|
| 18 | Unified proposals table migration | 0.5 days | Existing proposals + requests tables |
| 19 | Merge UI — single Proposals page with filter axes | 1.5 days | #18 |
| 20 | Row-level contextual action buttons | 1 day | #19 |
| 21 | Proposal detail view + viewed tracking endpoint | 1 day | #19 |
| 22 | AI generation — three-branch Edge Function | 2 days | #18, existing AI gateway |
| 23 | "+ New proposal" flow + pipeline shortcut | 1 day | #18, #22 |
| 24 | Pipeline auto-progression triggers | 0.5 days | #18, pipeline_leads table |

Total: ~7.5 days. Can start immediately — no dependency on Phase 3.5 outreach kit.

---

## 13. Client handling + client portal — full spec

### 13a. Client lifecycle states

```sql
-- Add to contacts table (or clients table if separate)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS
  lifecycle_status text NOT NULL DEFAULT 'prospect' CHECK (
    lifecycle_status IN ('prospect', 'engaged', 'archived')
  ),
  portal_token     text UNIQUE,           -- invitation token for portal access
  portal_last_seen timestamptz,           -- last authenticated portal visit
  unread_count     int DEFAULT 0;         -- badge count for freelancer dashboard
```

**State definitions:**

| State | Meaning | Trigger |
|---|---|---|
| prospect | In conversation, no accepted proposal | Contact created, or proposal requested but not accepted |
| engaged | Active relationship — at least one accepted proposal | Proposal status → accepted |
| archived | Relationship closed | Freelancer manually archives, or 90 days since last activity |

**Transitions:**
- prospect → engaged: automatic when any linked proposal is accepted
- engaged → archived: manual (freelancer action) or automatic after inactivity threshold
- archived → prospect: automatic if client submits a new proposal request
- archived → engaged: automatic if a new proposal is accepted

Client card in the Clients tab shows the lifecycle badge prominently.
Filter by lifecycle_status is the primary filter on the Clients tab.

---

### 13b. Pipeline ↔ proposal ↔ client — unified creation flow

**Every proposal creates a pipeline card if one doesn't exist.**

| Scenario | Pipeline stage on creation |
|---|---|
| Client submits request form (initiated_by='client') | Prospect |
| Freelancer creates outbound proposal (initiated_by='freelancer') | Contacted |
| Pipeline-triggered proposal (initiated_by='pipeline') | stays at current stage |

Reverse linkage: when a pipeline card at 'Contacted' or beyond has no linked
proposal, show a nudge: "Draft a proposal for [company] →" (proposal shortcut).

**Full auto-progression:**

```
proposal created (client-initiated)  → pipeline: Prospect
proposal created (freelancer)        → pipeline: Contacted
proposal sent                        → pipeline: Proposal Sent
proposal viewed                      → no stage change; notification fires
proposal accepted                    → pipeline: Negotiating
                                       contacts.lifecycle_status → engaged
                                       portal_token generated if not exists
invoice created                      → pipeline: Closed Won
proposal declined                    → pipeline: Lost
                                       contacts.lifecycle_status stays prospect
```

All transitions via Edge Function triggers. Never client-side.

---

### 13c. Client card — engaged state

When `lifecycle_status = 'engaged'`, the client card shows:

- Client name + avatar
- Lifecycle badge: "Engaged" (green)
- Unread badge (count of unread messages + unread notifications)
- **Portal link**: "Open portal →" — direct link, opens in new tab
- Quick stats: active proposals count, open invoices, last seen date

**Portal link implementation:**
Freelancer accesses portal via a signed URL with a short-lived bypass token:
`/portal/[client_token]?bypass=[signed_jwt]`

The bypass JWT is generated server-side, expires in 1 hour, scoped to that
business_id. The portal route checks for bypass JWT first, then falls back to
client auth. Never strips auth from the route entirely.

---

### 13d. Client portal — auth flow fix

**Current broken behavior:** throws auth error before attempting auth.
**Correct behavior:**

```
Visit /portal/[token]
  → lookup token in contacts.portal_token
  → if not found: 404 (not an auth error — the URL is wrong)
  → if found:
      → check session cookie
      → if valid session: render portal
      → if no session: show sign-in prompt (not an error)
          → client enters email
          → magic link sent
          → on click: session created, redirect back to portal
      → if session exists but email doesn't match portal: show
          "This portal belongs to a different account" (not a generic auth error)
```

Session persistence: 30-day cookie. Returning clients should never re-auth
unless they explicitly sign out or cookie expires.

---

### 13e. Client portal — UI updates

**Header (top bar):**
- Left: freelancer logo + business name (unchanged)
- Right: notification bell (with unread count badge) + client avatar (initials
  fallback) + dropdown: "Your profile" / "Sign out"

**Footer (bottom of every portal page):**
- "Powered by Forgefly · Get your own →" (link to forgefly.io landing page)
- This replaces any current header/prominent placement of the badge
- The "Get your own →" link is a free acquisition channel — every client is a
  potential freelancer signup

**Portal navigation tabs:**
- Overview (summary of relationship)
- Proposals (all proposals, all time — past and present)
- Invoices
- Projects (read-only delivery status — see §13i)
- Messages
- Files (see §13i)

---

### 13f. Notifications system

#### Data model

```sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES contacts(id),
  recipient_role  text NOT NULL CHECK (recipient_role IN ('freelancer','client')),
  type            text NOT NULL,        -- see event types below
  title           text NOT NULL,
  body            text,
  entity_type     text,                 -- 'proposal'|'invoice'|'message'|'project'|'payment'
  entity_id       uuid,                 -- id of the related record
  read_at         timestamptz,          -- null = unread
  emailed_at      timestamptz,          -- null = not yet emailed
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON notifications (business_id, recipient_role, read_at)
  WHERE read_at IS NULL;
CREATE INDEX ON notifications (client_id, recipient_role, read_at)
  WHERE read_at IS NULL;
```

#### Event → notification matrix

| Event | Freelancer notification | Client notification | Email |
|---|---|---|---|
| Freelancer sends proposal | — | Portal bell + "New proposal from [name]" | Yes |
| Freelancer sends invoice | — | Portal bell + "Invoice ready" | Yes |
| Freelancer updates project status | — | Portal bell + "Project update" | Yes |
| Freelancer sends message | — | Portal bell + message preview | Yes |
| Freelancer uploads file | — | Portal bell + "New file shared" | Yes |
| Client views proposal | Dashboard bell + client card badge | — | No |
| Client accepts proposal | Dashboard bell + client card badge + pipeline advance | — | No |
| Client declines proposal | Dashboard bell + client card badge | — | No |
| Client sends message | Dashboard bell + client tab badge + client card badge | — | No |
| Client pays invoice | Dashboard bell + invoice status update | Portal receipt | No |
| Client submits new proposal request | Dashboard bell + client card badge | — | No |
| Proposal expires (cron) | Dashboard bell | Email reminder 48h before expiry | — |
| Client first portal login | Dashboard bell + "Client accessed portal" | — | No |

#### Client card badge
`contacts.unread_count` is incremented on every client-side event above.
Decrements to 0 when freelancer opens the client card or messages thread.
Shown as a red dot or count badge on the card in the Clients tab.

#### Email delivery
All client-facing emails go through Supabase Edge Function → transactional email
provider (Resend recommended — simple API, good deliverability).
Email templates use freelancer's business name + brand primary color in header.
Never sends from a Forgefly address — sends from `noreply@forgefly.io` with
reply-to set to the freelancer's contact email.

#### Daily digest (freelancer)
Cron job (daily, 8am in freelancer's timezone):
Aggregates unread notifications from the past 24h. If count > 0, sends one
digest email: "You have X unread messages and Y proposals awaiting response."
Freelancer can disable in notification settings.
Do not send digest if freelancer was active in the app in the last 4 hours.

---

### 13g. Messages — unified tab

#### Data model

```sql
CREATE TABLE messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid REFERENCES businesses(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES contacts(id) ON DELETE CASCADE,
  sender_role   text NOT NULL CHECK (sender_role IN ('freelancer','client')),
  body          text NOT NULL,
  read_at       timestamptz,           -- set when recipient reads it
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX ON messages (business_id, client_id, created_at DESC);
```

Same table, two views:
- **Freelancer Messages tab**: all clients grouped in left column, active thread
  on right. Unread threads sorted to top. Standard messenger layout.
- **Client portal Messages tab**: filtered to their client_id only. Same thread,
  different shell.

#### Messages tab layout (freelancer side)

```
Messages

┌─ client list (left) ──┬─ thread (right) ──────────────────────┐
│ ● Sarah M.       2m   │  Sarah M. · Wedding cake inquiry       │
│   "Can we do fondant" │                                        │
│                       │  [Sat 10:32am]                         │
│   Supercell      1d   │  Hi, just wanted to confirm the        │
│   "Thanks for the..." │  tasting is still on for Thursday?     │
│                       │                                        │
│   John B.        3d   │  [You · Sat 11:14am]                   │
│   "Invoice looks..."  │  Yes, confirmed for 2pm. I'll send     │
│                       │  the address shortly.                  │
│                       │                              [Send]    │
└───────────────────────┴────────────────────────────────────────┘
```

#### Message status indicators
- Single checkmark: sent (written to DB)
- Double checkmark: delivered (client's portal has loaded the thread)
- Blue double checkmark: read (read_at timestamp set on the message row)

Status set server-side: read_at is written when the client's portal thread
component mounts and fetches messages — never on the sending side.

#### AI draft assist (optional, low-cost)
A "Draft with AI →" button above the compose box. One Haiku call. Context:
the last 5 messages in the thread + the client's name + any open proposals.
Returns a suggested reply. User edits and sends. Never auto-sends.
This is a §14 enhancement — not MVP.

---

### 13h. Returning client — new proposal request

When an engaged (or archived) client submits a new proposal request via their
existing portal:

1. New `proposals` row created: `initiated_by='client'`, linked to existing
   `client_id` — no new client record, no new portal
2. If `lifecycle_status='archived'`: auto-transition back to `prospect`
3. Pipeline card created at 'Prospect' stage
4. Freelancer notification fires: "Sarah M. has requested a new proposal"
5. Client sees the new request in their Proposals tab alongside all history

The portal is a persistent relationship hub. All proposals — past, active, new —
are visible in the client's Proposals tab with clear status labels and dates.
A client should be able to see their full history with a freelancer in one place.

---

### 13i. Two additions from review — client portal

#### Read-only project status in portal

The freelancer's ProjectsPage (delivery kanban) has internal columns and notes
the client should never see. Surface a simplified read-only status in the portal:

```
Your project
─────────────────────────────────────────────
 Brand Identity Kit        ● In Progress
 Last updated 2 days ago
 → Design exploration complete
 → Awaiting your feedback on concepts
```

Implementation: `projects` table gets a `client_visible_status` field
('not_started'|'in_progress'|'review'|'complete') and a `client_visible_note`
text field (freelancer writes this — it's what the client sees). The freelancer
updates these from their ProjectsPage; the full kanban columns stay internal.
When client_visible_status changes → notification fires to client.

#### File sharing in portal

```sql
CREATE TABLE portal_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid REFERENCES businesses(id),
  client_id     uuid REFERENCES contacts(id),
  uploaded_by   text CHECK (uploaded_by IN ('freelancer','client')),
  file_name     text NOT NULL,
  file_url      text NOT NULL,          -- Supabase Storage signed URL
  file_size     int,
  created_at    timestamptz DEFAULT now()
);
```

Freelancer uploads from client card or portal preview.
Client downloads from portal Files tab.
Notification fires on upload (both directions).
Storage: Supabase Storage bucket `portal-files`, scoped by business_id/client_id.
No size limit defined yet — set 50MB per file as default, configurable later.

---

### 13j. Client profile completion

On first portal login, after auth succeeds, show a one-time prompt (dismissible):

```
Complete your profile — takes 30 seconds
  Phone number      [           ]
  Company / org     [           ]  (optional)
  Timezone          [▾ detect]

  [Save]  [Skip for now]
```

On save: writes to `contacts` table on the freelancer's side automatically.
Freelancer never has to manually update the client record after this.
Timezone used for: notification timing, proposal expiry display, digest emails.

---

### 13k. Build order additions

| # | Task | Effort | Depends on |
|---|---|---|---|
| 25 | contacts lifecycle_status + portal_token fields | 0.5 days | contacts table |
| 26 | Client card engaged state + portal bypass link | 1 day | #25 |
| 27 | Portal auth flow fix (attempt before error) | 0.5 days | portal route |
| 28 | Portal UI: header avatar + bell, footer badge | 1 day | client portal shell |
| 29 | Notifications table + event triggers | 2 days | proposals, messages, projects |
| 30 | Email delivery (Resend integration) | 1 day | #29 |
| 31 | Daily digest cron | 0.5 days | #29, #30 |
| 32 | Messages table + freelancer Messages tab UI | 2.5 days | contacts |
| 33 | Messages in client portal | 1 day | #32 |
| 34 | Message read receipts (read_at) | 0.5 days | #32 |
| 35 | Pipeline ↔ proposal ↔ client auto-progression | 1.5 days | #25, proposals |
| 36 | Returning client new proposal flow | 0.5 days | #25, proposals |
| 37 | Read-only project status in portal | 1 day | projects table |
| 38 | File sharing (portal_files table + UI) | 1.5 days | Supabase Storage |
| 39 | Client profile completion prompt | 0.5 days | #25, portal auth |

Total: ~16 days. Sequence: 25 → 26+27 in parallel → 28+29 in parallel →
30+31 → 32 → 33+34 in parallel → 35+36 in parallel → 37+38+39 in parallel.

---

## 14. Accounting + time tracking — full spec

### 14a. Guiding principles

- Forgefly surfaces numbers and organizes data. It does not give tax advice.
- Every tax-adjacent feature carries a consistent disclaimer:
  "These are estimates based on the information you've provided. Consult a
  qualified tax professional for advice specific to your situation."
- Stay firmly behind the liability line: calculate, flag, remind — never advise,
  file, or guarantee.
- Cash basis accounting throughout. Most freelancers are cash basis; accrual is
  an unnecessary complexity at this stage.
- Expense categories adapt to the freelancer's vertical (from business_profile).
  A baker sees COGS categories. A designer sees software/hardware categories.
  A CPA sees professional liability insurance. Same engine, different defaults.

---

### 14b. Data model

#### Transactions table (income side)

```sql
CREATE TABLE transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('income','expense')),
  amount          numeric(10,2) NOT NULL,
  currency        text DEFAULT 'USD',

  -- income-specific
  invoice_id      uuid REFERENCES invoices(id),     -- linked invoice if applicable
  client_id       uuid REFERENCES contacts(id),
  income_category text,                             -- 'services'|'products'|'licensing'|'royalties'

  -- expense-specific
  expense_category_id uuid REFERENCES expense_categories(id),
  vendor          text,
  receipt_url     text,                             -- Supabase Storage URL
  receipt_extracted boolean DEFAULT false,          -- AI has processed receipt
  is_recurring    boolean DEFAULT false,
  recurrence_rule text,                             -- 'monthly'|'annual' etc

  -- shared
  description     text,
  transaction_date date NOT NULL,                   -- cash basis: when money moved
  tax_year        int GENERATED ALWAYS AS
                    (EXTRACT(year FROM transaction_date)::int) STORED,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX ON transactions (business_id, type, tax_year);
CREATE INDEX ON transactions (business_id, transaction_date DESC);
CREATE INDEX ON transactions (invoice_id) WHERE invoice_id IS NOT NULL;
```

#### Expense categories table

```sql
CREATE TABLE expense_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id),  -- null = system default
  name            text NOT NULL,
  schedule_c_line text,                            -- maps to Schedule C line item
  is_cogs         boolean DEFAULT false,           -- cost of goods sold
  is_default      boolean DEFAULT false,           -- shown by default for this vertical
  vertical        text,                            -- null = all verticals
  sort_order      int DEFAULT 0
);
```

**Default categories by vertical (seeded at business creation):**

All verticals (always included):
- Software & subscriptions (Line 22)
- Hardware & equipment (Line 13 — depreciation or Section 179)
- Phone & internet (Line 25 — business use %)
- Marketing & advertising (Line 8)
- Professional development (Line 27a)
- Bank & payment processing fees (Line 10)
- Office supplies (Line 18)
- Travel — flights & hotels (Line 24a)
- Meals with clients (Line 24b — 50% deductible, flag this)
- Professional services (accountant, lawyer) (Line 17)
- Home office (Line 30 — calculated separately, see §14e)
- Other (Line 27a)

b2c_local additions (baker, photographer, florist):
- Cost of goods — materials (Line 4 — COGS)
- Cost of goods — packaging (Line 4 — COGS)
- Cost of goods — supplies (Line 4 — COGS)
- Vehicle — mileage (Line 9 — see mileage tracker §14f)

b2b_creative additions (designer, developer, videographer):
- Software licenses (Line 22)
- Stock assets (fonts, photos, icons) (Line 22)
- Contractor payments (Line 11 — triggers 1099 flag at $600)
- Equipment rental (Line 20b)

b2b_professional additions (CPA, consultant, coach):
- Professional liability insurance (Line 15)
- Continuing education / licensing (Line 27a)
- Association memberships (Line 27a)
- Contractor payments (Line 11)

#### Mileage log table

```sql
CREATE TABLE mileage_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  trip_date       date NOT NULL,
  miles           numeric(6,1) NOT NULL,
  purpose         text NOT NULL,
  client_id       uuid REFERENCES contacts(id),     -- optional
  project_id      uuid REFERENCES projects(id),     -- optional
  irs_rate        numeric(4,3) NOT NULL,             -- store rate at time of trip
  deductible_amount numeric(8,2) GENERATED ALWAYS AS
                    (miles * irs_rate) STORED,
  tax_year        int GENERATED ALWAYS AS
                    (EXTRACT(year FROM trip_date)::int) STORED,
  created_at      timestamptz DEFAULT now()
);
```

IRS rate stored per-row because it changes annually.
Seed current rate in app config: `IRS_MILEAGE_RATE_2024 = 0.670`.
Update via config (not code) each January.

#### Time entries table

```sql
CREATE TABLE time_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES contacts(id),
  entry_date      date NOT NULL,
  hours           numeric(4,2) NOT NULL,             -- e.g. 1.5 = 1hr 30min
  note            text,
  timer_started_at timestamptz,                      -- set if using live timer
  tax_year        int GENERATED ALWAYS AS
                    (EXTRACT(year FROM entry_date)::int) STORED,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON time_entries (business_id, project_id);
CREATE INDEX ON time_entries (business_id, tax_year);
```

#### Contractor payments table

```sql
CREATE TABLE contractor_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  contractor_name text NOT NULL,
  contractor_email text,
  w9_on_file      boolean DEFAULT false,
  payment_date    date NOT NULL,
  amount          numeric(10,2) NOT NULL,
  description     text,
  tax_year        int GENERATED ALWAYS AS
                    (EXTRACT(year FROM payment_date)::int) STORED,
  ytd_total       numeric(10,2),                     -- updated via trigger
  threshold_flag  boolean DEFAULT false,             -- true when ytd_total >= 600
  created_at      timestamptz DEFAULT now()
);
```

Trigger: after INSERT or UPDATE on contractor_payments, recalculate ytd_total
for that contractor + tax_year combination and set threshold_flag if >= 600.

---

### 14c. Invoice → transaction link

When an invoice is marked paid (status → 'paid'), an Edge Function auto-creates
a transaction row:

```typescript
// Triggered by: invoices.status update to 'paid'
// Action: create income transaction

await supabase.from('transactions').insert({
  business_id:      invoice.business_id,
  type:             'income',
  amount:           invoice.total_amount,
  currency:         invoice.currency,
  invoice_id:       invoice.id,
  client_id:        invoice.client_id,
  income_category:  'services',           // default; user can change
  transaction_date: new Date().toISOString().split('T')[0],  // cash basis: today
  description:      `Invoice #${invoice.number} — ${invoice.client_name}`
})
```

If Stripe webhook fires (payment_intent.succeeded), the transaction_date is set
to the Stripe payment timestamp — not the webhook arrival time.

User can edit income_category after the fact (services / products / licensing /
royalties). The default 'services' covers 95% of cases.

---

### 14d. Receipt capture → AI extraction

When a user uploads a receipt image or PDF to an expense:

```typescript
// Edge Function: extract-receipt
// Model: claude-sonnet-4-6 (needs vision for receipt images)
// Input: base64 image or PDF

const system = `You are extracting data from a receipt or invoice.
Return ONLY valid JSON, no preamble, no markdown fences.
{
  "vendor": "business name on the receipt",
  "amount": number (total amount paid, excluding any refunds),
  "date": "YYYY-MM-DD",
  "description": "brief description of what was purchased",
  "suggested_category": "one of: software_subscriptions | hardware_equipment |
    phone_internet | marketing_advertising | professional_development |
    bank_fees | office_supplies | travel | meals_clients | professional_services |
    cogs_materials | cogs_packaging | contractor_payments | other",
  "confidence": "high" | "medium" | "low",
  "notes": "anything unusual or worth flagging (e.g. 'meal receipt — 50% deductible')"
}`
```

After extraction:
- Pre-fill the expense form (vendor, amount, date, category)
- User reviews and confirms — never auto-saves a receipt extraction
- Set receipt_extracted = true on the transaction row
- Store extracted data in transaction.notes as audit trail

**Meals flag:** if suggested_category = 'meals_clients', show inline note:
"Meals with clients are 50% deductible. Forgefly will calculate the correct
deductible amount automatically."

---

### 14e. P&L dashboard

**Page: Finances** (new top-level nav item, replaces nothing — sits after Invoices)

Tab structure: Overview / Income / Expenses / Time / Tax / Export

#### Overview tab

```
[Year ▾ 2024]  [Month ▾ All]

┌──────────────────┬──────────────────┬──────────────────┐
│  Gross Income    │  Total Expenses  │  Net Profit      │
│  $48,200         │  $12,340         │  $35,860         │
│  +12% vs last yr │  ─               │  74% margin      │
└──────────────────┴──────────────────┴──────────────────┘

Monthly P&L bar chart (income vs expenses, 12 bars)

Top expense categories (donut or ranked list)
  Software & subscriptions    $2,100  17%
  Home office                 $1,800  15%
  Professional development    $1,400  11%
  ...

Unpaid invoices affecting cash flow
  3 invoices totaling $6,400 outstanding
```

#### Income tab
- Transaction list filtered to type='income'
- Grouped by month, then by client
- Filter by income_category
- Shows: invoice link, client, date, amount, category
- 1099 threshold tracker inline: clients with YTD > $600 flagged with
  "May require 1099-NEC" badge (disclaimer: "Consult a tax professional")

#### Expenses tab
- Transaction list filtered to type='expense'
- Grouped by category
- Filters: category, date range, vendor search
- Running total per category vs prior year
- Meals column shows 50% adjusted deductible amount automatically
- Mileage section shows total miles, IRS rate, total deductible amount

#### Tax tab (see §14f)

#### Export tab (see §14g)

---

### 14f. Tax estimate engine

**Disclaimer shown prominently at top of Tax tab:**
> "These are estimates based on the information you've entered. Tax law is complex
> and varies by situation. Consult a qualified tax professional before making
> financial decisions based on these figures."

**Calculations performed:**

```typescript
// All figures for current tax year to date

const grossIncome = sum(transactions.income)
const totalExpenses = sum(transactions.expense.deductible_amount)
  // meals counted at 50%
  // mileage counted at (miles × IRS_rate)
  // home office calculated separately (see below)

const netProfit = grossIncome - totalExpenses

// Self-employment tax (Schedule SE)
const seAdjustedIncome = netProfit * 0.9235      // IRS formula
const seTax = seAdjustedIncome * 0.153           // 15.3%
const seDeduction = seTax * 0.5                  // deductible half of SE tax

// Estimated income tax (simplified)
// Use standard deduction + SE deduction, single filer as default
// User can set filing status in settings
const standardDeduction = 14600                  // 2024, single
const taxableIncome = netProfit - seDeduction - standardDeduction
const estimatedIncomeTax = calculateBrackets(taxableIncome, filingStatus)
  // 2024 brackets: 10/12/22/24/32/35/37%

const totalEstimatedTax = seTax + estimatedIncomeTax

// Safe harbor (avoid underpayment penalty)
// = lesser of 90% of current year OR 100% of prior year liability
// Prior year liability entered by user in settings (or 0 if first year)
const safeHarbor = Math.min(
  totalEstimatedTax * 0.90,
  priorYearLiability
)
```

**Home office deduction (simplified method):**
IRS simplified method: $5 per square foot, max 300 sq ft = max $1,500/year.
User enters sq footage of dedicated office space.
Forgefly uses simplified method only — the regular method requires too many
inputs (mortgage interest, utilities breakdown) for MVP.

**Tax tab display:**

```
Estimated tax summary — 2024                    [disclaimer link]

Net profit (YTD)                         $35,860
Self-employment tax (15.3%)              − $5,077
SE deduction (½ SE tax)                  − $2,539
Standard deduction                       − $14,600
────────────────────────────────────────────────
Estimated taxable income                  $18,721
Estimated income tax                      + $2,086
────────────────────────────────────────────────
Total estimated tax liability             $7,163

Already paid (estimated payments)         $3,200   [edit]
Remaining balance                         $3,963

──────────────────────────────────────────────────────
Quarterly payment schedule

  Q1  Jan 1 – Mar 31    Due Apr 15    $1,791   ✓ Paid
  Q2  Apr 1 – May 31    Due Jun 15    $1,791   ✓ Paid
  Q3  Jun 1 – Aug 31    Due Sep 15    $1,791   ⚠ Due in 23 days
  Q4  Sep 1 – Dec 31    Due Jan 15    $1,790   — Upcoming
──────────────────────────────────────────────────────

💡 SEP-IRA opportunity
   Based on your net profit, you could contribute up to $8,965 to a SEP-IRA
   and reduce your tax bill by approximately $2,152.
   [Learn more →]  (links to IRS SEP-IRA page — no product recommendation)
```

**Quarterly reminders:**
Notification + email 30 days before each quarterly due date, 7 days before,
and on the due date. Uses the notification system from §13f.

**Filing status setting:**
In Finances settings: single / married filing jointly / married filing separately /
head of household. Affects standard deduction and bracket calculation.
Default: single. User sets once, persists.

---

### 14g. Year-end export

**Export tab generates a single PDF package:**

```
[Year ▾ 2024]          [Generate tax package →]
```

PDF contains (in order):
1. Cover page: business name, tax year, generated date, disclaimer
2. P&L summary: gross income, expense totals by category, net profit
3. Income detail: all transactions, sorted by date, with invoice references
4. Expense detail: all transactions by category, with receipt references
5. Mileage log: all trips, total miles, IRS rate, total deduction
6. Home office summary: sq footage, method used, deduction amount
7. Contractor payments: list with YTD totals, threshold flags
8. Time summary: hours by project (for home office substantiation)
9. 1099 threshold report: clients who crossed $600 (with disclaimer)
10. Quarterly payment record: what was paid and when

Footer on every page: "Generated by Forgefly. These figures are for informational
purposes only. Consult a qualified tax professional before filing."

**CSV exports (separate, for accountant handoff):**
- All income transactions (CSV)
- All expense transactions (CSV)
- Mileage log (CSV)

**"Send to my accountant" flow:**
Generates a secure download link (expires 72 hours) containing the PDF + CSVs.
User pastes their accountant's email → Forgefly sends the link.
No Forgefly account required for the accountant to download.

---

### 14h. Time tracking

**Entry points:**
- From a project card (ProjectsPage or project detail): "Log time"
- From Finances → Time tab: manual entry or timer
- Mobile: floating "Start timer" action (Phase 2)

**Log time — two modes:**

```
Mode 1: Manual entry
  Project  [▾ Brand Identity — Supercell]
  Date     [Today ▾]
  Hours    [  2.5  ]
  Note     [Brand exploration, round 2 concepts     ]
  [Save]

Mode 2: Timer
  Project  [▾ Brand Identity — Supercell]
  Note     [                                        ]
  [▶ Start timer]
  → Timer runs, shows elapsed time
  → [■ Stop] → hours calculated, entry saved
```

**Project profitability card (on project detail page):**

```
Time & profitability

Quoted price          $4,000
Hours logged          23.5 hrs
Effective rate        $170 / hr
───────────────────────────
Project budget        [not set]   [Set budget →]
Estimated completion  ~6 hrs remaining at current pace
```

If project has a `budget_hours` set, show a progress bar:
"23.5 of 30 hours used (78%)" — turns amber at 80%, red at 95%.

**Post-project insight (fires when project marked complete):**

AI nudge (Haiku, no user prompt needed):

```typescript
// Context: project hours, quoted price, project type, business vertical
// Only fires if >= 3 completed projects exist (need baseline to compare)

prompt: `A freelancer just completed a project. Here is the data:
Project type: ${project.type}
Quoted price: $${project.price}
Hours logged: ${project.total_hours}
Effective hourly rate: $${effectiveRate}/hr
Their last 3 similar projects averaged ${avgHours} hours at $${avgRate}/hr.
Their current pricing for this type: $${currentPrice}.

Write a single, specific, non-preachy insight (2 sentences max) about what
this data suggests for their future pricing. Be direct. No fluff.`
```

Example output surfaced to freelancer:
> "This project took 38 hours — 12 more than your last two brand sprints.
> At your current rate, that gap costs you $2,040. Consider building a buffer
> into your next brand sprint quote."

**Time tab in Finances:**

```
Time tracking                    [+ Log time]

[Year ▾]  [Project ▾]  [Client ▾]

Total hours logged this year: 847 hrs
Across 12 projects · 8 clients

Project breakdown:
  Brand Identity — Supercell    38 hrs   $4,000   $105/hr
  UX Audit — Metacore           22 hrs   $2,200   $100/hr
  Design Sprint — Studio A      41 hrs   $4,500   $110/hr
  ...

[This data is included in your year-end tax export for home office substantiation]
```

---

### 14i. Contractor payment tracker

In Finances → Expenses tab, a dedicated "Contractors" section:

```
Contractor payments

  Alex Rivera        $1,240   ⚠ W-9 needed · May require 1099-NEC
  Sarah Kim          $480     $120 until 1099 threshold
  Dev Studio LLC     $3,600   ⚠ W-9 needed · May require 1099-NEC

[+ Add contractor payment]
```

**W-9 reminder:** when threshold_flag flips to true, notification fires:
"[Contractor name] has crossed $600 in payments this year. You may be required
to issue a 1099-NEC. Collect their W-9 if you haven't already."
Disclaimer: "Consult a tax professional to confirm your filing obligations."

**w9_on_file toggle:** freelancer can mark "W-9 collected" to clear the flag.
Forgefly does not store or process W-9 documents — just tracks the flag.

---

### 14j. Finances nav placement

Finances becomes a top-level nav item alongside Pipeline, Proposals, Invoices,
Clients. On mobile footer tab bar it replaces the least-used current item
(evaluate after beta — likely "More" expands to include it).

Sub-navigation within Finances page (tabs):
Overview / Income / Expenses / Time / Tax / Export

Invoices page remains as its own page — it's operational (send, track, get paid).
Finances is analytical (understand, plan, report). Different jobs, both needed.

---

### 14k. Build order additions

| # | Task | Effort | Depends on |
|---|---|---|---|
| 40 | expense_categories seed data per vertical | 0.5 days | business_profile classifier |
| 41 | transactions table + invoice→transaction trigger | 1 day | invoices table |
| 42 | Expense entry UI (manual) + category assignment | 1.5 days | #40, #41 |
| 43 | Receipt upload → AI extraction Edge Function | 1.5 days | #42, Sonnet vision |
| 44 | Mileage log table + UI | 1 day | #41 |
| 45 | Contractor payments table + threshold trigger | 1 day | #41 |
| 46 | P&L dashboard — Overview + Income + Expenses tabs | 2 days | #41, #42 |
| 47 | Tax estimate engine + Tax tab | 2.5 days | #41, #42, #44 |
| 48 | Quarterly reminder notifications | 0.5 days | #47, notifications system |
| 49 | Time entries table + log time UI (manual) | 1 day | projects table |
| 50 | Timer mode (start/stop) | 1 day | #49 |
| 51 | Project profitability card | 1 day | #49 |
| 52 | Post-project AI insight (Haiku nudge) | 0.5 days | #49, #51 |
| 53 | Time tab in Finances | 0.5 days | #49 |
| 54 | Year-end PDF export | 2.5 days | #41–#49 |
| 55 | CSV exports + "Send to accountant" link | 1 day | #54 |
| 56 | Filing status + home office settings | 0.5 days | #47 |

Total: ~20 days. Recommended sequence:
40+41 (schema foundation) →
42+44+45 in parallel (data entry surfaces) →
43 (receipt AI, depends on 42) →
46 (P&L dashboard, depends on 41+42+44) →
47+56 in parallel (tax engine + settings) →
48 (reminders, depends on 47) →
49+50 in parallel (time tracking) →
51+52+53 in parallel (time insights) →
54+55 (export, depends on everything above)

---

## 15. Time tracking — Toggl integration (v4.6 amendment)

### 15a. Decision: native timer by default, Toggl as optional sync

Building Forgefly's own timer only is too narrow — freelancers who already live
in Toggl (cross-device sync, mobile app, idle detection) won't switch and will
under-track if forced into a second tool. Forcing Toggl on everyone adds an
external account requirement that contradicts Forgefly's zero-friction principle
for the baker/CPA persona who just wants a quick manual log.

**Resolution:** time_entries table (§14, table already specced) is source-agnostic.
Native timer remains the default, zero-setup path. Toggl becomes an optional
sync for freelancers who already use it. Same downstream logic — profitability
card, tax export, AI insight — regardless of source.

### 15b. Schema amendment

```sql
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS
  source            text NOT NULL DEFAULT 'native' CHECK (
                      source IN ('native', 'toggl')
                    ),
  external_id       text,              -- Toggl time entry ID, for dedup on re-sync
  synced_at         timestamptz;       -- last sync timestamp, null for native entries

CREATE UNIQUE INDEX ON time_entries (business_id, external_id)
  WHERE external_id IS NOT NULL;       -- prevents duplicate import on re-sync
```

### 15c. Connection flow

**Entry point:** Finances → Time tab → "Connect Toggl" (secondary action, native
timer remains primary CTA).

This follows the standard MCP App connector pattern already used elsewhere in
Forgefly's tooling philosophy — search the registry, present the connector via
suggest_connectors equivalent (an OAuth-style "Connect Toggl" button), never
auto-connect without explicit user action.

```
Time tracking                              [+ Log time]  [Connect Toggl ⇄]

  ℹ Already tracking time in Toggl? Connect your account to pull entries
    in automatically — no need to log time twice.
```

On connect: Toggl OAuth flow → store API token encrypted in Supabase secrets,
scoped per business_id. Never store Toggl credentials in plaintext.

### 15d. Project name matching

Toggl's `start_timer` and reporting tools key off project name strings, not IDs
shared with Forgefly. On connection, run a one-time mapping step:

```
Match your Toggl projects to Forgefly projects

  Toggl: "Supercell Branding"      →  Forgefly: [▾ Brand Identity — Supercell]
  Toggl: "Cake — Sarah wedding"    →  Forgefly: [▾ Wedding Cake — Sarah M.]
  Toggl: "Misc / Admin"            →  [Don't import]
```

Stored as a `toggl_project_map` table:

```sql
CREATE TABLE toggl_project_map (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE,
  toggl_project_name text NOT NULL,
  forgefly_project_id uuid REFERENCES projects(id),  -- null = don't import
  UNIQUE (business_id, toggl_project_name)
);
```

New Toggl projects not yet mapped are held in a "Needs mapping" queue, surfaced
as a notification — never silently imported into the wrong project.

### 15e. Sync behavior

**Pull-based, not push-based.** Forgefly does not need write access to Toggl for
MVP — `get_recent_entries` and `get_summary` are read tools, which is exactly the
direction of data flow needed. No need to grant Forgefly the ability to start/stop
timers in Toggl on the user's behalf at this stage.

**Sync trigger:**
- Manual: "Sync now" button on Time tab
- Automatic: nightly cron per connected business (cheap call, low volume)

**Sync logic:**
```typescript
// Edge Function: sync-toggl-entries
// Calls toggl:get_recent_entries (days=7, covers gaps from missed nightly runs)

for (const entry of togglEntries) {
  const mappedProjectId = projectMap[entry.project_name]
  if (!mappedProjectId) {
    flagForMapping(entry)  // surfaces in "Needs mapping" queue
    continue
  }
  await supabase.from('time_entries').upsert({
    business_id,
    project_id: mappedProjectId,
    entry_date: entry.date,
    hours: entry.duration_hours,
    note: entry.description,
    source: 'toggl',
    external_id: entry.id,
    synced_at: new Date().toISOString()
  }, { onConflict: 'business_id,external_id' })
}
```

Idempotent via the unique index on `(business_id, external_id)` — re-running
sync never creates duplicates.

### 15f. UI treatment

- Time entries from Toggl show a small Toggl icon badge next to the entry in
  the Time tab list — transparency on data origin, doesn't need to be loud
- Project profitability card combines native + Toggl entries seamlessly —
  the freelancer just sees total hours, doesn't need to think about source
- "Needs mapping" queue: a dismissible banner on Time tab when unmapped Toggl
  projects exist: "3 Toggl entries need a project match → Review"

### 15g. What this does NOT do (explicitly out of scope for MVP)

- No write-back to Toggl (no starting/stopping Toggl timers from Forgefly)
- No support for other time trackers (Harvest, Clockify) at MVP — Toggl only,
  given the existing working MCP server
- No automatic project creation in Forgefly from unmapped Toggl projects —
  always requires explicit user mapping

### 15h. Build order addition

| # | Task | Effort | Depends on |
|---|---|---|---|
| 57 | time_entries schema amendment (source, external_id) | 0.5 days | #49 (existing time_entries table) |
| 58 | Toggl OAuth connection flow + encrypted token storage | 1 day | #57 |
| 59 | Project mapping UI + toggl_project_map table | 1 day | #58 |
| 60 | Sync Edge Function (pull, upsert, idempotent) | 1.5 days | #59 |
| 61 | Nightly sync cron + manual "Sync now" | 0.5 days | #60 |
| 62 | "Needs mapping" queue + notification | 0.5 days | #60 |
| 63 | UI: source badge, combined profitability calc | 0.5 days | #60 |

Total: ~5.5 days. Fully additive to the native time tracking build (#49–#53) —
does not block it and can ship after the native timer is live.
