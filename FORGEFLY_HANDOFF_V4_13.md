# Forgefly Handoff — V4.13
**Date:** 2026-07-02  
**Branch:** main  
**Previous handoff:** FORGEFLY_HANDOFF_V4_12.md (Phase H, #76–#88 done)

---

## What changed this session (uncommitted)

All 8 files are modified but not yet committed.

### 1. Unified AI surface (`AppShell`, `BusinessBand`, `AICopilot`, `CommandBar`)

**Before:** Two separate writing surfaces — floating green Copilot button (bottom-right) + inline CommandBar that expanded below the header.

**After:**
- Floating copilot button removed entirely
- `BusinessBand` now has **two buttons** in the header: `[AI Copilot]` `[Update OS]`
- Both open a shared **right-side panel overlay** (`absolute right-2 top-[48px] bottom-2 w-[360px]`) inside the content column — 90%+ height, no modal
- Clicking the active button again closes the panel (toggle)
- **Copilot panel** — same chat UI as before, no external component changes to the logic
- **Update OS panel** — big textarea + "Update OS" button; after AI extraction the panel switches **inline** from textarea view → diff review view (with a scrollable list of `+`/`~` changes and Back/Apply buttons)
- **No more center Dialog** for diff confirmation — entirely in-panel

Key files:
- `src/components/shell/AppShell.tsx` — manages `panelType: 'copilot' | 'upgrade' | null`, renders `<UpgradePanel>` inline, removed `<AICopilot />` from bottom
- `src/components/shell/BusinessBand.tsx` — stripped to two-button header; no state of its own; accepts `activePanel` + `onOpenPanel` props
- `src/components/layouts/AICopilot.tsx` — removed floating button + `isOpen` state; now just the panel body, accepts `onClose` prop
- `src/components/shell/CommandBar.tsx` — removed `DiffConfirmModal` (Dialog); return switches between input view and review view based on `pending` state; uses `ScrollArea` for diff lines

### 2. Dashboard analytics (`DashboardPage.tsx`)

- Extended `OverviewData` with: `winRate`, `avgProjectValue`, `repeatClientPct`, `reviewScore`, `reviewCount`, `portalVisits30d`, `projectsThisMonth`, `projectsCompleted`
- `loadOverviewData(userId, businessId?)` now takes optional `businessId` and fetches reviews + portal_events in `Promise.all`
- `useEffect` deps updated to `[user, business?.id]`
- Layout restructured:
  - Row 1: 2-col grid (Cash position + Needs attention)
  - Row 2 (conditional): Full-width Quick Win row card — only shown when `showMilestone || showNudge || milestonesComplete`
  - Row 3: 3-col grid (Active work + Pipeline momentum + Upcoming)
  - Row 4: 4-chip analytics strip (Win Rate | Avg Deal | Repeat Clients | Review Score)
  - Row 5: Full-width portal funnel card (Visits → Proposals → Projects with CVR %)
- **Pending:** Migration `00037_portal_events.sql` needs to be confirmed run in Supabase SQL editor

### 3. Pipeline (`PipelinePage.tsx`)

- **Layout fix:** Removed `lg:grid lg:grid-cols-6` — previously "Lost" column wrapped onto a second row under "Prospect" on large screens. Now always `flex gap-4 min-w-max` inside `overflow-x-auto`. All 7 columns in one horizontal row; scroll right to reach Closed Won → Lost.
- **Wider columns:** `220px` → `270px`
- **New Lead → also creates a Client:** When saving a new pipeline lead, a `clients` record is now inserted with `status: 'lead'` alongside existing `contacts` + `pipeline_leads` inserts. Client gets a note like "Pipeline lead – service: X" for traceability. Requires `useAuth()` for `user.id`.

### 4. Client badges (`ClientsPage.tsx`)

New `getClientBadge(client)` helper — computes badge from `client.status` + `client.last_interaction`:

| Badge | Condition | Color |
|-------|-----------|-------|
| Lead | `status === 'lead'` | gray |
| Engaged | `status === 'engaged'` or `'active'`, last_interaction ≤ 30d | green |
| Cold | `status === 'engaged'`/`'active'` but last_interaction > 30d ago | blue |
| Won | `status === 'won'` | amber |
| Repeat | `status === 'repeat'` | violet |

Badge renders as a small pill next to the client name on every client card. Existing clients with `status: 'active'` show "Engaged" automatically.

**No DB migration needed** — uses existing `clients.status` text field (was 'active'/'inactive', now extended to 'lead'/'engaged'/'cold'/'won'/'repeat').

### 5. Messages fix (`MessagesPage.tsx`)

`contactsWithMeta` now filters to `.filter(c => c.lastMessage !== null)` before rendering the sidebar list. Pipeline leads (which create a `contacts` record for portal FK) no longer appear as empty ghost conversations.

---

## Pending / not yet done

- [ ] **Commit all uncommitted changes** (8 files, no tests broken, `tsc --noEmit` passes)
- [ ] **Run `00037_portal_events.sql`** in Supabase SQL editor if not already done:
  ```sql
  CREATE TABLE IF NOT EXISTS portal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS portal_events_biz_created_idx
    ON portal_events (business_id, created_at DESC);
  ```
- [ ] **DB webhook for `schedule-review-request`** (from Phase H, still outstanding)
- [ ] **Client badge status transitions** are currently manual (no automation sets a client from 'lead' → 'engaged' → 'won'). Future: auto-promote on proposal acceptance, portal reply, etc.
- [ ] **Phase I** — not yet specced

---

## Architecture snapshot

```
src/
  components/
    layouts/AICopilot.tsx       ← panel body only, accepts onClose prop
    shell/
      AppShell.tsx              ← panelType state, UpgradePanel inline, no floating copilot
      BusinessBand.tsx          ← 2-button header, pure display, no local state
      CommandBar.tsx            ← input view / review view, no Dialog
  pages/
    DashboardPage.tsx           ← full analytics, portal funnel, quick win row
    PipelinePage.tsx            ← horizontal scroll, 270px cols, leads create clients
    ClientsPage.tsx             ← getClientBadge(), badge pill on every card
    MessagesPage.tsx            ← contacts filtered to message-having only
supabase/migrations/
  00037_portal_events.sql       ← needs to be run if not yet
```

---

## Load alongside

- `FORGEFLY_HANDOFF_V4_12.md` — Phase H full context (reviews, testimonials, brand kit, public portfolio)
- All prior handoffs `V4_1` through `V4_11` in `/files` directory
