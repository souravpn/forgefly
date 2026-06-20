# Forgefly Landing Page — Design Handoff
> File: `forgefly_landing.html` (single self-contained file)
> Status: Design-complete prototype. Ready for production implementation.
> Do NOT load this alongside FORGEFLY_HANDOFF_V4.md — this is a standalone
> frontend document for whoever implements the marketing site.

---

## What this file is

A fully functional single-file HTML landing page for forgefly.io. It contains
all HTML, CSS, and JS inline. No build step, no dependencies except two Google
Fonts imports (Sora + Inter). It is a design-complete prototype — wire it directly
into the production stack or use it as the pixel-perfect spec.

---

## Design tokens

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#080D0B` | Page background — near-black with green undertone |
| `--bg2` | `#0D1512` | Card/surface background |
| `--emerald` | `#10B981` | Primary accent — CTA buttons, active indicators, links |
| `--emerald2` | `#059669` | Emerald gradient dark stop |
| `--text` | `#E8EDE8` | Primary text — off-white with faint green warmth |
| `--text-mid` | `#8FA98A` | Secondary text, descriptions |
| `--text-dim` | `#4A5C4A` | Tertiary text, placeholders, disabled |
| `--border` | `rgba(16,185,129,0.12)` | Emerald-tinted borders |
| `--border2` | `rgba(232,237,232,0.07)` | Neutral subtle borders |

**Typefaces:**
- Display / headlines: `Sora` — weights 300, 400, 500, 600
- Body / UI: `Inter` — weights 300, 400, 500
- Google Fonts import already in `<head>`

---

## Page structure

```
<nav>                          Fixed, transparent → frosted glass on scroll
<section id="hero">            Full-viewport, seed prompt + emerald bloom
<section id="how">             Sticky split-screen, 4 steps
<section id="features">        Alternating left-right, 6 feature pairs
<section id="pricing">         3-column pricing cards
<section id="closing">         Centered CTA + testimonial pull-quote
<footer>                       Copyright + links
```

---

## Section specs

### Nav
- Fixed, `z-index: 100`
- Transparent at top, transitions to `rgba(8,13,11,0.85)` + `backdrop-filter: blur(16px)` on scroll
- Triggered by `window.scrollY > 40` — JS class `scrolled` on `<nav>`
- Links: How it works / Features / Pricing / Sign in / Get started (emerald CTA pill)
- Mobile: nav links hidden (hamburger menu is a production TODO)

### Hero
- Min-height: 100vh, vertically centered
- **Do not change the prompt area** — seed prompt + Generate button + three example pills
  are locked. This was explicitly signed off as-is.
- Two ambient layers:
  1. Dot grid: `radial-gradient` 1px dots at 28px spacing, masked to ellipse,
     `driftGrid` animation at 20s linear infinite (CSS background-position)
  2. Emerald bloom: `.bloom` div, `filter: blur(90px)`, `breathe` animation
     (opacity 0.16↔0.22, scale 1↔1.04, 9s ease-in-out)
- Prompt examples: clicking a `.prompt-example` pill populates `#promptInput`
  via `setPrompt()` and focuses the field

### How it works — sticky split
- CSS grid: `1fr 1fr`, `min-height: 400vh`
- Left column: `position: sticky; top: 0; height: 100vh` — stays fixed while right scrolls
- Right column: 4 `.how-panel` divs, each `min-height: 100vh`
- Step indicator sync: `IntersectionObserver` at `threshold: 0.5` on each panel.
  When a panel enters view → sets `active` class on the matching `.how-step-indicator`
  in the left column + adds `visible` to the panel (fade-up)
- Mobile: sticky layout disabled, both columns stack vertically

**Panel content (in order):**
1. Describe what you do — prompt mock with classifier output tags
2. Watch it assemble — generation steps mock with color palette reveal
3. Your business is live — portal preview mock (PacUX Studio)
4. Run everything from one place — dashboard overview mock (4 cells)

### Features — alternating pairs
- 6 `.feature-pair` divs, alternating with `.reverse` class
- `.reverse` uses `order` on children to flip visual/text sides
- Scroll reveal: `IntersectionObserver` at `threshold: 0.15`, adds `visible`
  class → opacity 0→1, translateY 40px→0, duration 0.7s ease
- Each pair has a `.feature-visual` (product mock) and `.feature-text` (copy)
- The `::after` pseudo on `.feature-visual` adds a subtle emerald gradient overlay

**Feature order (visual side noted):**
1. Generate-then-gate — visual LEFT — generation steps mock
2. Let's Make You Visible — visual RIGHT — visibility channel list
3. Client portal — visual LEFT — portal with proposal + messages
4. Proposals — visual RIGHT — proposals list with three origin types
5. Finances — visual LEFT — P&L cells + tax warning + SEP-IRA nudge
6. Time tracking — visual RIGHT — project profitability + AI insight

### Pricing
- 3 cards: Solo ($19/mo), Studio ($49/mo — featured), Pro ($89/mo)
- `.featured` card has emerald border + gradient background + "Most popular" badge
- Badge positioned absolutely at `top: -12px` — needs parent `position: relative`
  and sufficient `margin-top` on the grid when stacked on mobile
- Scroll reveal: same `IntersectionObserver` as features, `transition-delay` on each
  card (0s, 0.1s, 0.2s) for staggered entrance
- "–" items use `.dim` class on `<li>` — signals unavailable features without ❌

**Pricing tiers:**

| Plan | Price | Key differentiator |
|---|---|---|
| Solo | $19/mo | Core ops — portal, pipeline, proposals, invoices, brand kit |
| Studio | $49/mo | Full AI suite — client portals, visibility engine, outreach, finances, time tracking |
| Pro | $89/mo | Power users — Opus tier AI, custom domain, demand signals, tax export |

All plans: 14-day free trial, no credit card required.

### Closing CTA
- Full-width section, same `--bg` background
- Emerald bloom at top (mirrored from hero — `top: -20%` instead of `bottom: -10%`)
- **No seed prompt repeated** — replaced with:
  - Headline: "Stop running your business from a dozen different tabs."
  - Sub: problem-statement copy about consolidation
  - Two buttons: primary "Generate my business →" (links to `#hero` — scrolls back
    up to the prompt), ghost "See how it works" (links to `#how`)
  - Testimonial pull-quote card: Clara Lim, 5 stars, Brand designer on Studio plan
- The testimonial is a placeholder — replace with real review once the testimonial
  engine (§17 of FORGEFLY_OUTREACH_SPEC.md) has collected real data

### Footer
- `border-top: 1px solid var(--border2)`
- Left: `© 2026 Forgefly. Built for the solo operator.`
- Right: Privacy / Terms / Contact links
- Year is static in the prototype — production should use `new Date().getFullYear()`

---

## Animations

| Name | Element | Behavior |
|---|---|---|
| `driftGrid` | `#hero::before` | Background-position shift 0→28px, 20s linear infinite |
| `breathe` | `.bloom`, `.closing-bloom` | Opacity 0.16↔0.22, scale 1↔1.04, 9s ease-in-out |
| `blink` | `.cursor` | Opacity step-end 1↔0, 1.1s (simulates text cursor) |
| `pulse` | `.gen-icon.active` | Opacity 1↔0.4, 1.5s ease-in-out (active generation step) |
| `popIn` | `.cpill` | Scale 0→1 + opacity 0→1, 0.4s ease, staggered delays |
| `scrollBob` | `.hero-scroll-hint` | translateY 0→4px, opacity 0.5→0.9, 2.5s ease-in-out |
| Scroll reveal | `.how-panel`, `.feature-pair`, `.fade-up`, `.pricing-card` | IntersectionObserver → adds `.visible` class → CSS transition |

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables all animations
and sets all scroll-reveal elements to `opacity: 1; transform: none` immediately.

---

## JavaScript

Three functions, all inline in `<script>` at bottom of `<body>`:

```javascript
// 1. Nav scroll class
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40)
})

// 2. Prompt example pills
function setPrompt(el) {
  document.getElementById('promptInput').value = el.textContent
  document.getElementById('promptInput').focus()
}

// 3. How-it-works step sync (IntersectionObserver, threshold 0.5)
// Watches .how-panel elements, updates .how-step-indicator active state

// 4. General scroll reveal (IntersectionObserver, threshold 0.15)
// Watches .feature-pair, .fade-up, .pricing-card — adds .visible class
```

No external JS libraries. No frameworks. Vanilla only.

---

## Responsive breakpoints

| Breakpoint | Changes |
|---|---|
| `max-width: 900px` | Pricing grid → single column (max-width: 420px centered) |
| `max-width: 768px` | Nav links hidden; how-it-works sticky layout disabled (both columns stack); feature pairs → single column (visual always above text); footer stacks vertically |

Mobile hamburger menu is not implemented — production TODO. On mobile the nav
shows logo + "Get started" button only.

---

## Production TODOs (not in prototype)

- [ ] Mobile hamburger / drawer nav
- [ ] Connect "Generate my business →" buttons to actual generation flow
- [ ] Connect "Sign in" to auth
- [ ] Connect pricing CTAs to Stripe checkout
- [ ] Replace testimonial placeholder with real review data from reviews table
- [ ] Footer year: `new Date().getFullYear()` instead of static 2026
- [ ] "Compare plans in detail →" link — full pricing comparison page
- [ ] Add UTM `?ref=landing_hero` to CTA links for conversion tracking
- [ ] OG tags / meta description / favicon
- [ ] Performance: self-host Sora + Inter fonts (eliminate Google Fonts round-trip)
- [ ] Add `#pricing` link to the nav `Pricing` anchor (already in HTML, just needs
  the section to exist — it does)

---

## What not to change without design sign-off

- The hero seed prompt area (textarea + Generate button + example pills) — locked
- The `--bg` color (`#080D0B`) — the green undertone is intentional
- The Sora typeface — do not swap for Inter or any other geometric sans
- The emerald bloom treatment — blur value (90px), opacity range (0.16–0.22),
  and breathe animation timing are calibrated. Changing any one affects the feel.
- The alternating left-right feature layout order — the visual rhythm is deliberate
- The closing CTA copy — "Stop running your business from a dozen different tabs"
  is the signed-off direction. Do not revert to a prompt repeat.
