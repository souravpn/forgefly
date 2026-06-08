# Preview Page — Implementation Prompt
> Load this file at the start of a Claude Code session focused on the preview page.
> Reference: FORGEFLY_HANDOFF.md for full architecture context.

---

## Context

The preview page is the most important screen in Forgefly's acquisition funnel.
It renders immediately after the AI extraction completes — before the user has signed in.
The user must feel like they've been handed a real, populated business portal,
not a summary card or a receipt.

The current build (localhost:5173/preview) shows:
- Services list ✓
- Brand panel with colors + keywords ✓
- Business name / tagline ✓
- "Save my business OS" bottom CTA ✓

What it is missing (required for this sprint):
- Tabbed navigation across all 7 portal sections
- Metric cards (revenue, clients, pipeline, avg project)
- Pipeline / hot leads kanban preview
- Recent invoices section
- Contacts preview
- Proposal template preview
- Persistent top-bar save gate (not a bottom CTA)
- Brand Kit as a dedicated tab (colors + fonts + tone + keywords + live preview strip)

---

## Page structure

The preview page must feel like a real authenticated dashboard,
with a non-intrusive but persistent save prompt.
It is NOT a landing page. It is NOT a summary card.
It is a full portal with real data in every section.

### URL
`/preview` (no auth required to view)

### Data source
All data comes from a single `extracted_data` JSON object stored in:
- `sessionStorage` key: `ff_pending_portal`
- Shape: see FORGEFLY_HANDOFF.md → "The extracted_data JSON shape"

Parse it on mount. If missing or expired (timestamp > 24h), redirect to `/`.

---

## Layout structure

```
┌─────────────────────────────────────────────────────────┐
│  TOPBAR: [Avatar] [Business name + tagline]  [SAVE CTA] │
├─────────────────────────────────────────────────────────┤
│  PROMPT ECHO BAR (collapsible, shows original prompt)   │
├─────────────────────────────────────────────────────────┤
│  TABS: Overview │ Services │ Pipeline │ Invoices │       │
│        Contacts │ Proposals │ Brand Kit                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TAB CONTENT (see each section below)                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Topbar

```tsx
<topbar>
  <Avatar initials={extracted_data.identity.initials} color={brand.primaryColor} />
  <div>
    <h1>{extracted_data.identity.businessName}</h1>
    <p>{extracted_data.identity.tagline}</p>
  </div>
  <spacer />
  <SaveGateBadge />   // see Save Gate section below
</topbar>
```

The topbar is sticky. It must stay visible on scroll.

---

## Save gate (persistent, top-right)

Do NOT use a bottom CTA. Do NOT use a modal that blocks content.

Use a pill/badge in the top-right corner of the topbar:

```tsx
// Unauthenticated state (default on preview page)
<div className="save-gate">
  <LockIcon />
  <span>Sign in to save your portal</span>
  <button onClick={handleGoogleAuth}>Save with Google</button>
</div>
```

Styling: light teal background, teal border, teal text.
The badge must be visible but must not interrupt reading the portal content.

On any edit action (clicking a field, dragging a pipeline card, etc.),
if the user is not authed, fire the auth modal instead.
The badge is passive — auth fires on intent, not on page load.

---

## Prompt echo bar

Sits between topbar and tabs. Collapsible. Shows the original seed prompt.

```tsx
<div className="prompt-echo">
  <span className="label">Your prompt:</span>
  <p className="prompt-text">{sessionStorage prompt text, truncated to 2 lines}</p>
  <CopyIcon onClick={copyPrompt} />
</div>
```

Collapsed by default on mobile. Expanded by default on desktop.
This reminds the user what generated the portal and reinforces the AI-native feel.

---

## Tab 1 — Overview

Four metric cards in a 4-column grid:

| Card | Value source |
|------|-------------|
| Monthly revenue | `extracted_data.metrics.monthlyRevenue` |
| Active clients | `extracted_data.metrics.activeClients` |
| Pipeline value | `extracted_data.metrics.pipelineValue` |
| Avg. project | `extracted_data.metrics.avgProjectValue` |

Below the metric cards, two columns:

**Left column — Recent invoices (3 rows)**
Each row: client name, service name + invoice number, status badge, amount
Status badges: Paid (green), Outstanding (amber), Overdue (red)
Data: `extracted_data.invoices` (first 3 items)

**Right column — Hot pipeline (3 rows)**
Each row: company name, service, deal value, stage badge
Data: `extracted_data.pipeline.leads` (first 3 items, sorted by stage proximity to Closed Won)

---

## Tab 2 — Services

Grid of service cards, 2 columns.

Each card:
```
[Service name]
[Price]          [type badge: project | retainer | hourly]
[2-sentence description]
✓ Deliverable 1
✓ Deliverable 2
✓ Deliverable 3
```

Data: `extracted_data.services` (all items)

Highlight the retainer service with a slightly accented border (brand primary color, 1.5px).
Retainers are recurring revenue — they deserve visual emphasis.

---

## Tab 3 — Pipeline

Full-width horizontal Kanban board.

Stages (fixed, always in this order):
1. Prospect
2. Qualified
3. Proposal Sent
4. Negotiating
5. Closed Won

Each column renders leads from `extracted_data.pipeline.leads` filtered by `stage`.

Each lead card:
```
[Company name]
[Service name · Deal value]
```

Show total pipeline value above the kanban:
`extracted_data.metrics.pipelineValue`

Note at bottom: "In the full portal, cards are draggable. Sign in to activate."

---

## Tab 4 — Invoices

Full-width table with columns:
`#` | `Client` | `Service` | `Date` | `Amount` | `Status`

Data: `extracted_data.invoices` (all items)

Status badge colors:
- Paid → green
- Outstanding → amber
- Overdue → red
- Draft → gray

---

## Tab 5 — Contacts

List of contact rows.

Each row:
```
[Initials avatar]  [Name]        [Role · Company]   [Status badge]
```

Status badge options: Active client (green), Prospect (blue), Past client (gray)

Data: `extracted_data.contacts` (all items)

---

## Tab 6 — Proposals

Show the AI-generated proposal template blocks:

1. **Introduction** — `extracted_data.proposal.intro`
2. **Our approach** — `extracted_data.proposal.approach`
3. **Why us** — `extracted_data.proposal.whyUs`
4. **Next steps** — numbered list from `extracted_data.proposal.nextSteps`

Each block is a labeled section with a muted section header.
No editing in preview mode — these are read-only.
Show a banner: "This template pre-populates for every proposal you send. Sign in to customise."

---

## Tab 7 — Brand Kit

Two-column layout.

**Left column:**

Section: Color palette
- Three swatches side by side: Primary, Secondary, Accent
- Each swatch: color square (44×44px, rounded) + label + hex value
- Data: `extracted_data.brand.primaryColor`, `.secondaryColor`, `.accentColor`

Section: Typography
- Two cells: Heading font, Body font
- Data: `extracted_data.brand.fonts.heading`, `.body`
- One cell: Brand tone
- Data: `extracted_data.brand.tone`

Section: Brand keywords
- Pill chips, teal background
- Data: `extracted_data.brand.keywords`

**Right column:**

Section title: Live preview

Sub-label: "Client portal header"
Show a mini preview strip using the brand colors:
```
[Brand color dot] [Business name]    [keyword chip] [keyword chip]
                  [Tagline]
```

Sub-label: "Invoice header"
Show a mini invoice header using brand colors:
```
[Business name in brand color]          INVOICE
[email · location]                      INV-XXX
```

The live preview proves to the user that the brand kit is real and applies to outputs —
not just a settings form.

---

## Visual design requirements

**Color palette for preview page:**
Use the brand's `extracted_data.brand.primaryColor` as the accent color throughout:
- Tab active underline
- Avatar background
- Save gate badge background (lightened)
- Retainer card border
- Pipeline total value badge
- Brand kit keyword chips

If `primaryColor` is unavailable, fall back to teal (#1D9E75).

**Do NOT hardcode Forgefly's green.**
The preview page should feel like the freelancer's brand, not Forgefly's brand.
The brand color extracted from the prompt drives the visual identity of the preview.

**Typography:**
- Business name in topbar: 16px, weight 500
- Tab labels: 12px
- Metric values: 22px, weight 500
- Section titles: 11px, uppercase, letter-spacing 0.06em, muted color
- Body/description text: 12–13px, line-height 1.6

**Borders:**
- All cards: 0.5px solid, border-radius 12px
- Metric cards: no border, secondary background
- Active tab: 2px bottom border in brand color (only exception to 0.5px rule)

**Spacing:**
- Page body padding: 1rem 1.25rem
- Card gap: 10–12px
- Section gap: 1.5rem

---

## Behavior notes

- All data is read-only in preview mode. No edits persist without auth.
- Tab switching is purely client-side (no API calls).
- The active tab state lives in React `useState`, not URL params.
- On mobile: tabs become a horizontal scroll strip, metric grid becomes 2×2.
- "Sign in to save" in the topbar badge triggers Google OAuth.
  After OAuth, `AuthCallbackPage` reads `sessionStorage.ff_pending_portal`,
  saves to `businesses` table, and redirects to `/dashboard`.

---

## What NOT to build in this sprint

- No editing or drag interactions (those come after auth)
- No Stripe integration on this page
- No copilot panel (that's a dashboard feature)
- No command bar (that's a dashboard feature)
- No client portal (separate route)

The preview page has one job: show the user the full value of what was generated,
and make saving feel like the obvious next step — not a barrier.

---

## Files to create or modify

- `src/pages/PreviewPage.tsx` — main page component
- `src/components/preview/MetricCards.tsx` — 4-card grid
- `src/components/preview/ServicesTab.tsx`
- `src/components/preview/PipelineTab.tsx`
- `src/components/preview/InvoicesTab.tsx`
- `src/components/preview/ContactsTab.tsx`
- `src/components/preview/ProposalsTab.tsx`
- `src/components/preview/BrandKitTab.tsx`
- `src/components/preview/SaveGateBadge.tsx`
- Update `src/routes.tsx` to add `/preview` route (public, no auth guard)

