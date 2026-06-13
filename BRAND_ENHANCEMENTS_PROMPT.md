# Brand Kit + Confidence System — Implementation Prompt
# Scope: targeted additions only. Read existing files before touching anything.
# Do NOT rewrite GeneratedPortalPage, ai-gateway, or LandingPage from scratch.

---

## Pre-flight: read these files in full before writing any code

1. src/pages/LandingPage.tsx (or LandingPageV2.tsx — whichever is active)
2. src/pages/GeneratedPortalPage.tsx
3. src/components/preview/BrandKitTab.tsx
4. supabase/functions/ai-gateway/index.ts
5. src/pages/DashboardPage.tsx

Produce a one-paragraph summary of what each file currently does before starting.
Then implement the changes below in order.

---

## Change 1 — Client-side validation before Generate click (LandingPage)

File: src/pages/LandingPage.tsx (or active landing page file)

Current behavior: user clicks Generate → gateway called immediately.

New behavior: validate the prompt client-side BEFORE calling the gateway.
Show inline hints below the textarea — never a modal, never a blocking gate.

Validation rules (check in order, show the first failing hint only):

```ts
function validatePrompt(prompt: string): string | null {
  const trimmed = prompt.trim()
  if (trimmed.length < 30) {
    return "Tell us a bit more — what do you do and who do you work with?"
  }
  const hasService = /\b(offer|service|speciali[sz]|package|consult|design|develop|write|photo|coach|audit|sprint|retainer)\b/i.test(trimmed)
  if (!hasService) {
    return "Mention at least one service you offer to get the best results."
  }
  return null  // valid
}
```

UI: show the hint as a small inline warning directly below the textarea,
styled with amber/warning color. Not a toast. Not a modal.
The Generate button stays enabled — this is guidance, not a gate.
The hint disappears as soon as the prompt passes validation.

```tsx
{validationHint && (
  <p style={{ fontSize: 12, color: 'var(--color-text-warning)', marginTop: 6 }}>
    <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
    {validationHint}
  </p>
)}
```

---

## Change 2 — Gateway confidence map + estimated values

File: supabase/functions/ai-gateway/index.ts

### 2a — Extend the classifier output schema

The classifier (Haiku, temp 0) currently returns prompt_type, complexity,
token_estimate, sections_needed, has_pricing, language, target.

Add two new fields to the classifier JSON schema and system prompt:

```
"confidence_map": {
  "identity": "high" | "medium" | "low",
  "services": "high" | "medium" | "low",
  "pricing": "high" | "medium" | "low",
  "location": "high" | "medium" | "low",
  "niche": "high" | "medium" | "low",
  "brand": "high" | "medium" | "low"
},
"completeness_score": number  // 0–100, computed from confidence_map
```

Scoring logic for completeness_score (compute in the Edge Function after
classifier returns, not inside Claude):

```ts
function computeCompleteness(map: ConfidenceMap): number {
  const weights: Record<string, number> = {
    identity: 20,
    services:  25,
    pricing:   25,
    location:  10,
    niche:     10,
    brand:     10,
  }
  const scores = { high: 1, medium: 0.5, low: 0 }
  let total = 0
  for (const [key, weight] of Object.entries(weights)) {
    total += weight * scores[map[key as keyof ConfidenceMap]]
  }
  return Math.round(total)
}
```

### 2b — Extend the extraction system prompt for low-confidence fields

When a field has low confidence, the extractor should still populate it
with a clearly-marked estimated value rather than omitting it or hallucinating.

Add this instruction to the extraction system prompt:

```
For fields where you have low confidence (not explicitly mentioned in the prompt):
- Still populate them with a reasonable inferred value
- Prefix the value with "[estimated] " so the UI can detect and style it differently
- Example: if no location is given, use "[estimated] Remote"
- Example: if no price is given, use "[estimated] Contact for pricing"
- Never leave a field null or empty — always provide something usable
```

### 2c — Include confidence_map and completeness_score in the gateway response

The gateway response currently returns the extracted JSON.
Add confidence_map and completeness_score to the response envelope:

```ts
return new Response(JSON.stringify({
  extractedData: mergedOutput,
  confidence_map: classifierResult.confidence_map,
  completeness_score: completenessScore,
}), { headers: { 'Content-Type': 'application/json' } })
```

### 2d — Store confidence data in sessionStorage and businesses table

In GeneratedPortalPage.tsx (or wherever the gateway response is processed):
Store the full response including confidence_map and completeness_score
in the pending_portal sessionStorage object:

```ts
sessionStorage.setItem('pending_portal', JSON.stringify({
  prompt: originalPrompt,
  timestamp: Date.now(),
  extractedData: response.extractedData,
  confidence_map: response.confidence_map,
  completeness_score: response.completeness_score,
}))
```

In AuthCallbackPage.tsx, when saving to the businesses table, also save:

```ts
await supabase.from('businesses').upsert({
  user_id: user.id,
  seed_prompt: pending.prompt,
  extracted_data: pending.extractedData,
  confidence_map: pending.confidence_map,    // add this column if not exists
  completeness_score: pending.completeness_score,  // add this column if not exists
  status: 'active',
})
```

Add the two columns to the businesses table if not already present:

```sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS confidence_map JSONB,
  ADD COLUMN IF NOT EXISTS completeness_score INT DEFAULT 0;
```

---

## Change 3 — Color roles: plain-English labels in BrandKitTab

File: src/components/preview/BrandKitTab.tsx

Replace the current color label/description system with plain-English roles.
The four color slots and their labels, descriptions, and usage chips:

```ts
const COLOR_ROLES = [
  {
    key: 'primaryColor',
    role: 'Text & icons',
    desc: 'Main brand color — used for all interactive and branded elements',
    usedIn: ['tab underline', 'avatar text', 'buttons', 'links'],
  },
  {
    key: 'secondaryColor',
    role: 'Soft background',
    desc: 'Light tint for badges, chips, avatar backgrounds, hover states',
    usedIn: ['avatar bg', 'keyword chips', 'save gate bg'],
  },
  {
    key: 'accentColor',
    role: 'Page background',
    desc: 'Base background for cards, modals, and content areas',
    usedIn: ['cards', 'invoices', 'proposals'],
  },
  {
    key: 'ctaColor',  // derive from primaryColor if not in extracted_data
    role: 'Buttons & CTAs',
    desc: 'Action buttons — "Request a proposal", "Save", "Send invoice"',
    usedIn: ['client portal CTA', 'save btn'],
  },
]
```

For ctaColor: if extracted_data.brand does not have a ctaColor field,
derive it as the primaryColor. Do not add a new field to the extraction schema —
just use primaryColor as the fallback in the UI.

Each color slot layout:
```
[Color swatch 40×40px, rounded, with ✎ icon on hover]
[Role label — 12px, font-weight 500]
[Description — 10px, muted]
[Hex value — 10px, monospace]
[Used in chips — 9px, secondary bg, border, borderRadius 4px]
```

Add an "Edit" affordance to the section header:
```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
  <SectionLabel>Color palette</SectionLabel>
  <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
    <i className="ti ti-pencil" style={{ fontSize: 11 }} />
    Click any swatch to edit
  </span>
</div>
```

Color editing (post-signin only for now — preview is read-only):
In the preview, swatches are display-only.
Add a small note: "Sign in to edit colors and fonts"
This is a deliberate decision — editing deferred to dashboard Brand Kit.

Add an info note below the color grid:
```tsx
<div style={{ fontSize: 11, color: 'var(--color-text-secondary)', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '9px 12px', marginTop: 10 }}>
  <i className="ti ti-info-circle" style={{ fontSize: 13, marginRight: 5 }} />
  These colors are applied across your portal and client-facing pages. Your clients
  see the same palette on proposals, invoices, and your public portfolio.
</div>
```

---

## Change 4 — Font pair selector in BrandKitTab

File: src/components/preview/BrandKitTab.tsx

Add a font pair selector section below the color palette.
Replace whatever typography display currently exists with 6 clickable cards.

Font pair data (hardcode this — do not fetch):

```ts
const FONT_PAIRS = [
  {
    id: 'clean-modern',
    name: 'Clean & modern',
    heading: 'Inter',
    body: 'Inter',
    headingStyle: { fontFamily: 'sans-serif', fontWeight: 500 },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'SaaS, tech, dev agencies',
    exampleText: 'Design that works',
    bodyText: 'Clear, functional, built for digital-first businesses.',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    heading: 'DM Serif Display',
    body: 'Plus Jakarta Sans',
    headingStyle: { fontFamily: 'Georgia, serif', fontWeight: 400 },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'Photographers, writers, brand strategists',
    exampleText: 'Design that works',
    bodyText: 'Refined, considered. A voice that earns attention.',
  },
  {
    id: 'warm-professional',
    name: 'Warm professional',
    heading: 'Playfair Display',
    body: 'Lato',
    headingStyle: { fontFamily: 'Georgia, serif' },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'Coaches, consultants, therapists',
    exampleText: 'Design that works',
    bodyText: 'Approachable and trustworthy, without losing authority.',
  },
  {
    id: 'bold-studio',
    name: 'Bold studio',
    heading: 'Syne',
    body: 'DM Sans',
    headingStyle: { fontFamily: 'sans-serif', fontWeight: 500, letterSpacing: '-0.03em' },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'Designers, creative directors, agencies',
    exampleText: 'Design that works',
    bodyText: 'Confident, direct. Says "we have a point of view".',
  },
  {
    id: 'classic-trust',
    name: 'Classic trust',
    heading: 'Merriweather',
    body: 'Source Sans 3',
    headingStyle: { fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 14 },
    bodyStyle: { fontFamily: 'sans-serif' },
    bestFor: 'Lawyers, financial advisors, accountants',
    exampleText: 'Design that works',
    bodyText: 'Steady, authoritative. Signals longevity and expertise.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    heading: 'Geist',
    body: 'Geist Mono',
    headingStyle: { fontFamily: 'monospace', fontSize: 14 },
    bodyStyle: { fontFamily: 'monospace' },
    bestFor: 'Engineers, developers, technical freelancers',
    exampleText: 'Design that works',
    bodyText: 'Precise. No decoration. The work speaks for itself.',
  },
]
```

Claude should infer the best font pair from the niche in extracted_data.identity.niche.
Inference rules (simple string matching, no AI call needed):

```ts
function inferFontPair(niche: string): string {
  const n = niche.toLowerCase()
  if (/photo|film|brand|strat|writ|content|copy/.test(n)) return 'editorial'
  if (/coach|consult|therap|wellnes|health/.test(n)) return 'warm-professional'
  if (/design|creative|studio|art/.test(n)) return 'bold-studio'
  if (/law|legal|financ|account|audit/.test(n)) return 'classic-trust'
  if (/engineer|dev|code|software|tech/.test(n)) return 'minimal'
  return 'clean-modern'  // default
}
```

State: selectedFontPair lives in React useState, initialized from inferFontPair().
In preview mode (no auth): selecting a font pair updates the pending_portal
sessionStorage object immediately:

```ts
const updateFont = (pairId: string) => {
  setSelectedFontPair(pairId)
  const pending = JSON.parse(sessionStorage.getItem('pending_portal') || '{}')
  if (pending.extractedData?.brand) {
    pending.extractedData.brand.fontPairId = pairId
    sessionStorage.setItem('pending_portal', JSON.stringify(pending))
  }
}
```

Selected card styling: border 1.5px solid brand primaryColor, "Selected ✓" badge
top-right (brand soft bg + brand text color).

Below the grid, show Claude's recommendation note:
```tsx
<div style={{ fontSize: 11, ... }}>
  <i className="ti ti-sparkles" /> Claude selected{' '}
  <strong>{FONT_PAIRS.find(p => p.id === inferredPair)?.name}</strong>{' '}
  based on your {extracted_data.identity.niche}. Switch any time —
  changes apply across proposals, invoices, and your client portal.
</div>
```

---

## Change 5 — Post-signin completion nudge in DashboardPage

File: src/pages/DashboardPage.tsx

Show a dismissible banner at the top of the dashboard on first load
IF completeness_score < 90.

### 5a — Read the score

```ts
// In DashboardPage, after loading the business record:
const { data: business } = await supabase
  .from('businesses')
  .select('completeness_score, confidence_map, extracted_data')
  .eq('user_id', user.id)
  .eq('status', 'active')
  .single()

const showNudge = (business?.completeness_score ?? 0) < 90
```

Track dismissal in localStorage so it doesn't reappear after dismiss:
```ts
const isDismissed = localStorage.getItem('nudge_dismissed_' + business.id) === 'true'
```

### 5b — Generate nudge items from confidence_map

```ts
function getNudgeItems(map: ConfidenceMap, extractedData: any): NudgeItem[] {
  const items: NudgeItem[] = []

  if (map.pricing === 'low') items.push({
    priority: 1,
    title: 'Add pricing to your services',
    desc: 'Your services were extracted but no prices were found. Clients can\'t request a proposal without knowing your rates.',
    action: 'Add prices',
    route: '/dashboard/services',
    color: 'warning',
  })
  if (map.location === 'low') items.push({
    priority: 2,
    title: 'Tell us your location',
    desc: 'We estimated "Remote" — your public portfolio will be more trustworthy with a real city or region.',
    action: 'Add location',
    route: '/dashboard/settings',
    color: 'warning',
  })
  if (map.brand === 'low') items.push({
    priority: 3,
    title: 'Refine your brand colors',
    desc: 'We generated a color palette — but if you have brand colors in mind, update them in Brand Kit.',
    action: 'Open Brand Kit',
    route: '/dashboard/brand',
    color: 'info',
  })
  if (map.niche === 'low') items.push({
    priority: 4,
    title: 'Describe your ideal client',
    desc: 'Knowing your niche helps Forgefly generate better proposals and nudges.',
    action: 'Refine in command bar',
    isCommandBar: true,
    color: 'info',
  })

  return items.slice(0, 3)  // show max 3 items
}
```

### 5c — Nudge banner layout

Position: top of DashboardPage, below the command bar, above metric cards.
Not a modal. Not a toast. A dismissible panel.

```
┌────────────────────────────────────────────────────────────────┐
│  Your portal is [score]% complete   ━━━━━━━━━━━━░░░  [score]% │
│  3 things that would make it significantly stronger        [×] │
├────────────────────────────────────────────────────────────────┤
│  [1] [Title]                                                   │
│      [Description]                              [Action btn]  │
│  [2] [Title]                                                   │
│      [Description]                              [Action btn]  │
│  [3] [Title]                                                   │
│      [Description]                              [Action btn]  │
├────────────────────────────────────────────────────────────────┤
│  Or use the command bar above to describe any changes          │
└────────────────────────────────────────────────────────────────┘
```

Dismiss behavior:
```ts
const dismiss = () => {
  localStorage.setItem('nudge_dismissed_' + business.id, 'true')
  setShowNudge(false)
}
```

Action buttons:
- If item has `route`: navigate to that route
- If item has `isCommandBar: true`: focus the command bar input

Do NOT show this banner if completeness_score >= 90.
Do NOT show if already dismissed (localStorage check).
Do NOT show on mobile if viewport < 768px — too cramped. Show as a
collapsed "Complete your profile →" link instead that expands inline.

---

## Change 6 — Estimated value display in preview tabs

File: src/components/preview/ (all tab components that render extracted_data)

When a value starts with "[estimated] ", render it differently:

```tsx
function renderValue(value: string) {
  if (value?.startsWith('[estimated] ')) {
    const actual = value.replace('[estimated] ', '')
    return (
      <span>
        {actual}
        <span style={{
          fontSize: 10,
          color: 'var(--color-text-secondary)',
          marginLeft: 5,
          fontStyle: 'italic',
        }}>
          estimated
        </span>
      </span>
    )
  }
  return value
}
```

Apply this to: service prices, location in identity, any metric values.
Do NOT apply to: business name, tagline, service names, contact names —
these are always rendered as-is even if estimated.

---

## What NOT to change

- Do not rename the sessionStorage key (stays as 'pending_portal')
- Do not change the auth flow or OAuth callback logic (except the upsert
  in 5b to include confidence_map and completeness_score columns)
- Do not change any other preview tabs (Overview, Pipeline, Invoices,
  Contacts, Proposals, Client Portal)
- Do not change the ai-gateway classifier model (stays claude-haiku-4-5-20251001)
- Do not change the extraction tier logic
- Do not add color editing to the preview (post-signin only)
- Do not add logo/image upload anywhere in this sprint

---

## Files to modify

1. src/pages/LandingPage.tsx — add validatePrompt + inline hint (Change 1)
2. supabase/functions/ai-gateway/index.ts — confidence_map, completeness_score,
   estimated value instruction, response envelope (Change 2)
3. src/pages/AuthCallbackPage.tsx — save confidence_map + completeness_score (Change 2d)
4. src/pages/GeneratedPortalPage.tsx — store full response in pending_portal (Change 2d)
5. src/components/preview/BrandKitTab.tsx — color roles + font pair selector (Changes 3 + 4)
6. src/pages/DashboardPage.tsx — completion nudge banner (Change 5)

## Files to modify (all preview tab components, minor)

7. src/components/preview/ServicesTab.tsx — renderValue for prices
8. src/components/preview/OverviewTab.tsx — renderValue for metrics

## SQL to run

```sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS confidence_map JSONB,
  ADD COLUMN IF NOT EXISTS completeness_score INT DEFAULT 0;
```

Run this migration before deploying the AuthCallbackPage changes.

---

## Implementation order

Do these in order. Test each before moving to the next.

1. SQL migration (no code, lowest risk)
2. Change 1 — landing validation (isolated, zero DB touch)
3. Change 2a+2b — gateway classifier + extractor changes
4. Change 2c+2d — gateway response + sessionStorage + AuthCallback
5. Change 3 — color roles in BrandKitTab
6. Change 4 — font pairs in BrandKitTab
7. Change 6 — estimated value rendering (all preview tabs)
8. Change 5 — dashboard nudge banner (last — needs real data from DB)

