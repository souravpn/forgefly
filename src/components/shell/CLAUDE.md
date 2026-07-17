# CLAUDE.md — src/components/shell/

Guidance specific to this directory — the app chrome every protected page renders inside.

## Desktop vs. mobile is a real split, not responsive CSS on one component

- **Desktop**: `AppSidebar.tsx` — the full left nav, grouped into sections (see below).
- **Mobile**: `MobileTopBar.tsx` + `MobileFooterNav.tsx` (bottom tab bar) + `MobileMoreSheet.tsx` (overflow sheet for items that don't fit the footer) + `DesktopMoreDropdown.tsx`'s mobile counterpart. `DesktopTabNav.tsx` and `NavIcon.tsx` are small shared pieces both surfaces pull from.
- If you're adding a new top-level destination, it needs to be added to **both** the desktop sidebar and whichever mobile surface (footer vs. more-sheet) makes sense for it — there's no single shared nav-config file that drives both today.

## Sidebar grouping convention (`AppSidebar.tsx`)

Four labeled sections plus a footer, each a separate exported const array (`MAIN_NAV`, `TOOLS_NAV`, `CLIENTELE_NAV`, `PROJECT_NAV`) rendered under a `SectionLabel`:
- **Overview** — Dashboard only.
- **Tools** — Calendar, Visibility, Automations, Brand Kit, Outreach Kit.
- **Clientele** — Clients, Messages, Reviews.
- **Project** — Leads, Services, Proposals, Finances, Project.
- Footer — Settings, Public Portfolio (conditional on the business having a `slug`), and **Social** (`SOCIAL_ITEM`) rendered standalone below the divider rather than inside any of the four groups — it's the newest top-level surface and hasn't been folded into a themed section yet. When adding a new nav item, put it in the section whose name best matches the mental model (a client-communication feature → Clientele, a project-lifecycle feature → Project) rather than defaulting to a standalone footer item the way Social currently is.

## `AppShell.tsx` also owns things beyond layout

- The Freeda side panel (`AICopilot`) — its open/closed state and resizable width (`PANEL_MIN_WIDTH`/`PANEL_MAX_WIDTH`/`PANEL_DEFAULT_WIDTH`) live here, not inside `AICopilot` itself.
- The `NoBusinessPage` fallback — if `useBusiness()` resolves to no business for an authenticated user, `AppShell` renders that instead of the requested page. Don't re-implement a "no business" guard inside individual pages; it's already handled at this layer.
