# Session Handoff — Phase 6: Design System Pass
> Load this file + CLAUDE.md + all memory files at the start of each new session.
> Previous handoff doc: `SESSION_HANDOFF_PHASE5_COMPLETE.md` (phases 1–5 context)

---

## What Was Done This Session (2026-06-12)

### Global Design System Changes

#### 1. Font — Noto Sans
- `index.html`: Google Fonts preconnect + stylesheet link (weights 300/400/500/600/700/800, regular + italic)
- `tailwind.config.js`: `fontFamily.sans → ["Noto Sans", "system-ui", "sans-serif"]`
- `src/index.css`: `font-family: 'Noto Sans', system-ui, sans-serif` on `body`

#### 2. Background — Black (dark) / Very Light Grey (light)
All CSS variables in `src/index.css` updated:

| Token | Light (`:root`) | Dark (`.dark`) |
|---|---|---|
| `--background` | `0 0% 97%` (#F7F7F7) | `0 0% 0%` (black) |
| `--foreground` | `0 0% 6%` | `0 0% 100%` |
| `--card` | `0 0% 100%` (white) | `0 0% 6%` |
| `--primary` | `160 75% 35%` (darker green) | `160 80% 45%` (brighter green) |
| `--muted-foreground` | `0 0% 42%` | `0 0% 58%` |
| `--border` | `0 0% 88%` | `0 0% 16%` |
| sidebar tokens | white sidebar, dark text | near-black sidebar |

#### 3. Content Width — 60vw centered, full-width on mobile
Pattern used everywhere: `w-full md:max-w-[60vw] mx-auto px-4 md:px-6`

Applied to:
- `AppShell.tsx` — main page content wrapper
- `ForgeflyBand.tsx` — inner content (band bg stays full-width)
- `BusinessBand.tsx` — inner content
- `DesktopTabNav.tsx` — inner content
- `LandingPage.tsx` — all `max-w-7xl`/`max-w-5xl` section containers
- `GeneratedPortalPage.tsx` — all section containers
- `ClientPortalPage.tsx` — main content container
- `PublicPortfolioPage.tsx` — main content container

#### 4. Light / Dark Mode Toggle
**New file:** `src/contexts/ThemeContext.tsx`
- `ThemeProvider` — wraps entire app in `App.tsx`
- Reads/writes `localStorage.theme` ('dark' | 'light'), default 'dark'
- Toggles `dark` class on `document.documentElement`
- `useTheme()` hook exports `{ theme, toggleTheme, isDark }`

**FOUC prevention:** Inline `<script>` in `index.html` `<head>` reads localStorage and adds `dark` class before React hydrates. `html` element no longer has hardcoded `class="dark"`.

**Toggle UI:** Sun/Moon icon button in `ForgeflyBand` (right side, before bell icon)

**Note:** LandingPage, LoginPage, SignupPage use hardcoded dark styles — they always appear dark regardless of theme setting. Only the authenticated app shell respects the toggle.

---

### Header / Shell Refinements

#### ForgeflyBand (`src/components/shell/ForgeflyBand.tsx`)
- Text: `text-sm` → `text-base`, split into `Forge` (foreground/80) + `fly` (emerald-500 light / emerald-400 dark)
- Height: `h-8` → `h-10` (+2px padding each side)

#### BusinessBand (`src/components/shell/BusinessBand.tsx`)
- Removed `border-b` from outer wrapper
- Height: `h-12` → `h-14` (+2px padding each side)
- CommandBar when open now wrapped in `md:max-w-[60vw] mx-auto` so it aligns with header content (was overflowing full-width)

#### CommandBar (`src/components/shell/CommandBar.tsx`)
- Input area: `bg-muted/20 px-4` → `bg-background px-4 pt-3 pb-3` with `border-t border-border/60`
- Textarea: `bg-background` → `bg-muted/40 border-border/50`, slightly smaller (`min-h-[44px]`)
- Action buttons: `h-8 w-8` → `h-7 w-7` (cleaner proportion)

#### Login / Signup page cards
- Outer bg: `#020810` → `#000000`
- Card surface: `rgba(4,12,30,0.8)` → `rgba(255,255,255,0.06)` (visible against pure black)

---

### Bug Fix — Public Portfolio 404 (`/p/:slug`)

**File:** `src/pages/PublicPortfolioPage.tsx`

**Root cause:** Query used `businesses.select('...profiles!inner(username)')` — PostgREST can't join `businesses → profiles` directly because there's no FK between them. Both link via `auth.users.id` through `user_id`, which PostgREST can't traverse automatically.

**Fix:** Two-step query:
1. `profiles.select('user_id').eq('username', slug)` — resolve slug → user_id
2. `businesses.select('*').eq('user_id', ...).eq('status', 'active')` — fetch business

---

## Architecture Notes Added This Session

### How the business data loads on every protected page

```
Page load
  └─ CurrentBusinessProvider (AppShell → MainLayout)
       └─ useCurrentBusiness() → fetchBusiness()
            └─ supabase.from('businesses')
                 .select('*')
                 .eq('user_id', user.id)
                 .eq('status', 'active')
                 .maybeSingle()
```

Returns a single row with `extracted_data` JSONB — all AI-generated sections in one blob (identity, services, pipeline, brand, metrics, proposal, settings). Written by `ai-gateway` Edge Function or auto-saved from `sessionStorage.pending_portal`. **No Edge Function on read — pure PostgREST.**

### How to find your user ID
- **Supabase Dashboard** → Authentication → Users → find email → copy UUID
- **Browser console** on any authenticated page:
  ```js
  (await supabase.auth.getUser()).data.user.id
  ```
- In code: `const { user } = useAuth()` → `user?.id`

---

## Current File Locations (updated)

| Purpose | Path |
|---|---|
| Theme context + hook | `src/contexts/ThemeContext.tsx` |
| Global CSS variables | `src/index.css` |
| Tailwind config | `tailwind.config.js` |
| App shell (content wrapper) | `src/components/shell/AppShell.tsx` |
| Top header band | `src/components/shell/ForgeflyBand.tsx` |
| Business/brand band | `src/components/shell/BusinessBand.tsx` |
| Update OS input | `src/components/shell/CommandBar.tsx` |
| Tab navigation | `src/components/shell/DesktopTabNav.tsx` |
| Public portfolio page | `src/pages/PublicPortfolioPage.tsx` |

All other file locations unchanged — see `SESSION_HANDOFF_PHASE5_COMPLETE.md`.

---

## Pending / Still To Do

| Item | Priority | Notes |
|---|---|---|
| **Subscription price** | **CRITICAL** | Change `unit_amount: 100` → `2900`/`29000` in `create-subscription-checkout/index.ts` |
| **Stripe webhook registration** | **CRITICAL** | Register `stripe-webhook` URL in Stripe Dashboard |
| **Resend SMTP in Supabase Auth** | **HIGH** | host `smtp.resend.com`, port 465, user `resend`, password = Resend API key |
| **pg_cron schedule** | **HIGH** | Enable pg_cron + pg_net, run `cron.schedule` SQL for daily nudges |
| **Storage bucket RLS** | **MEDIUM** | INSERT (authenticated) + SELECT (anon + authenticated) for `avatars` bucket |
| **Terms of Service + Privacy Policy** | **MEDIUM** | `/terms` and `/privacy` pages — linked from signup but don't exist |
| **Landing page hero screenshot** | **LOW** | Save to `public/dashboard-screenshot.png`, update `src` in `LandingPage.tsx` |
| **Landing/auth page light mode** | **NEXT DESIGN PASS** | LandingPage, LoginPage, SignupPage use hardcoded dark colors — need a separate theming pass to support light mode |
| **Color hierarchy / typography pass** | **NEXT DESIGN PASS** | Text is all white (dark) / near-black (light) as a baseline — color hierarchy, size scale, weight decisions pending |
| **Apple OAuth secret renewal** | **RECURRING** | JWT expires ~Dec 2026 |

---

## Supabase Project
- **Project ref:** `oqwgssdmrauhhiiaxryg`
- **Production URL:** `https://oqwgssdmrauhhiiaxryg.supabase.co`
- **Frontend production:** `https://www.forgefly.io`
- **Deploy edge function:** `npx supabase functions deploy <function-name>`

## Key Conventions (unchanged)
- Path alias `@` → `src/`
- Motion: `import { motion } from 'motion/react'` (NOT framer-motion)
- Biome linter: no CommonJS `require`, no undeclared deps
- `cn()` from `src/lib/utils.ts` for conditional Tailwind classes
- ProposalStatus: `'draft' | 'sent' | 'accepted' | 'rejected'`
- Stripe API version: `'2025-08-27.basil'`
- Content width pattern: `w-full md:max-w-[60vw] mx-auto px-4 md:px-6`
- Theme toggle: `useTheme()` from `src/contexts/ThemeContext.tsx`
