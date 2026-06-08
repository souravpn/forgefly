# Fix prompt — Brand Kit page: 3 targeted fixes only
# Hand this to Claude Code CLI. Do NOT rewrite the preview page or any other component.
# Scope: src/components/preview/BrandKitTab.tsx and GeneratedPortalPage.tsx only.

---

## Context

The preview page (GeneratedPortalPage.tsx) is working correctly.
The Brand Kit tab is mostly correct — swatches, typography, tone, keywords all render.
Three specific things need fixing. Fix only these three. Touch nothing else.

---

## Fix 1 — Brand colors must drive the preview page UI, not just the swatches

The current problem:
The page background stays dark (the app's default dark theme) regardless of
what colors the user specified. Brand colors are extracted correctly into
extracted_data.brand but are only applied to the color swatches.
The preview page should visually reflect the freelancer's brand, not Forgefly's theme.

What to do:
Read extracted_data.brand.primaryColor, secondaryColor, and accentColor from
sessionStorage (key: 'pending_portal', path: parsedData.brand).

Inject them as CSS custom properties on the preview page root element:

```tsx
// In GeneratedPortalPage.tsx, inside the component, after parsing sessionStorage:
useEffect(() => {
  if (!data?.brand) return
  const root = document.getElementById('preview-root') // or the top-level div ref
  if (!root) return
  root.style.setProperty('--preview-primary',   data.brand.primaryColor   || '#1D9E75')
  root.style.setProperty('--preview-secondary', data.brand.secondaryColor || '#085041')
  root.style.setProperty('--preview-accent',    data.brand.accentColor    || '#E1F5EE')
}, [data?.brand])
```

Then apply those CSS variables to these specific elements in the preview page:
- Active tab underline border: `borderColor: 'var(--preview-primary)'`
- Active tab label color: `color: 'var(--preview-primary)'`
- Business avatar background: `background: 'var(--preview-accent)'`, `color: 'var(--preview-primary)'`
- Save gate badge background: lighter version of primary (use accent or 15% opacity primary)
- Save gate badge border: `var(--preview-primary)` at 40% opacity
- Brand Kit keyword chips: `background: 'var(--preview-accent)'`, `color: 'var(--preview-primary)'`
- "Generated in Xs" badge: use accent background + primary text

Do NOT change the page background color or card backgrounds.
Do NOT change body text colors.
Only the accent/highlight elements listed above should use brand colors.
The dark background stays — only accent elements pick up the brand palette.

This way a crimson/pink brand (like the screenshot) gets crimson active tabs,
crimson avatar, crimson keywords — but the page isn't blinding the user
with a full crimson background.

---

## Fix 2 — Client portal header live preview: use business avatar, not a dot

Current problem:
The live preview strip in the Brand Kit tab shows a small colored dot
as the business avatar in the "Client portal header" preview section.

What it should show:
The same avatar treatment used in the main topbar — a rounded square
(border-radius: 10px) showing the business initials, with:
- background: var(--preview-accent) (or primaryColor at 15% opacity)
- color: var(--preview-primary)
- font-weight: 500
- size: 36×36px
- text: extracted_data.identity.initials (e.g. "PF" for Pixel & Flow)

The dot is likely a div with just a background-color and no content or size.
Replace it with the initials avatar component (or inline equivalent).

Exact replacement in BrandKitTab.tsx, in the "Client portal header" preview section:

```tsx
// Replace whatever renders the dot with this:
<div style={{
  width: 36,
  height: 36,
  borderRadius: 10,
  background: brand.accentColor || 'var(--preview-accent)',
  color: brand.primaryColor || 'var(--preview-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 500,
  fontSize: 13,
  flexShrink: 0,
}}>
  {identity.initials}
</div>
```

The client portal header preview should look like:
[ PF avatar ] [ Business name in brand primary color ]    [ keyword chip ] [ keyword chip ]
              [ tagline in muted color ]

---

## Fix 3 — Add "Client Portal" as the 8th tab in the preview page

Current tabs (7): Overview | Services | Pipeline | Invoices | Contacts | Proposals | Brand Kit
Add as 8th tab: Client Portal

Why: The preview page is the freelancer's one chance to see the full value
of Forgefly before signing in. Showing them what their clients will see
removes mystery and increases conversion. It's also consistent with
ClientPortalPage.tsx being a confirmed feature of the app.

What the Client Portal tab should show:
A read-only mockup of the public portfolio page (/p/[slug]) as it would
appear to a client — the freelancer's brand, services, and a
"Request a proposal" CTA. It uses the same extracted_data the rest of
the preview uses, so no new data fetching is needed.

Layout of the Client Portal tab:

Section 1 — Portal header (uses brand colors):
```
┌─────────────────────────────────────────────┐
│  [BizAvatar 52px]  [Business name h2]       │
│                    [Tagline]                 │
│  [keyword chip] [keyword chip] [keyword chip]│
└─────────────────────────────────────────────┘
background: var(--preview-accent) or primaryColor at 8% opacity
border-bottom: 0.5px solid primaryColor at 20% opacity
```

Section 2 — Services list:
Each service as a row:
```
[Service name]  [description, truncated 1 line]  [$price]  [type badge]
```
Divider between rows (0.5px border).
Data: extracted_data.services (all items).

Section 3 — CTA:
```
[  Request a proposal →  ]   (button, brand primary color background)
"Typically responds within 24 hours" (caption below, muted)
```

Section 4 — "Powered by Forgefly" footer note:
Small muted text at bottom: "This is what your clients see at your public portal link."

Add the tab to the tabs array in GeneratedPortalPage.tsx:
```tsx
{ id: 'clientportal', label: 'Client Portal', icon: 'external-link' }
```

Create the tab content as a new component:
src/components/preview/ClientPortalTab.tsx

Props it receives (same pattern as other preview tab components):
```tsx
interface ClientPortalTabProps {
  data: ExtractedData  // the full extracted_data object
}
```

---

## What NOT to change

- Do not touch any other tab components (Overview, Services, Pipeline, etc.)
- Do not change the sessionStorage key name ('pending_portal' is correct)
- Do not change the save gate or auth flow
- Do not change the topbar layout
- Do not modify GeneratedPortalPage.tsx except for:
  (a) adding the CSS variable injection useEffect
  (b) adding the 'Client Portal' tab to the tabs array
  (c) importing and rendering ClientPortalTab
- Do not change any Supabase queries or the ai-gateway

---

## Files to modify

1. src/pages/GeneratedPortalPage.tsx
   - Add CSS variable injection useEffect (Fix 1)
   - Add Client Portal to tabs array (Fix 3)
   - Import and render ClientPortalTab (Fix 3)

2. src/components/preview/BrandKitTab.tsx
   - Apply CSS variables to accent elements (Fix 1)
   - Replace dot with initials avatar in live preview (Fix 2)

## Files to create

3. src/components/preview/ClientPortalTab.tsx (Fix 3)

That is all. Three fixes, three files. Nothing else.
