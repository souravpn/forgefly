# Session start prompt — run this BEFORE touching any code

Read FORGEFLY_HANDOFF_V2.md completely.
Then read CLAUDE.md and MEMORY.md.

Before writing a single line of code, do a read-only audit:

1. Run: find src -type f -name "*.tsx" | sort
   and find supabase -type f | sort (if supabase dir exists)

2. Read these specific files in full if they exist:
   - src/pages/LandingPage.tsx (or LandingPageV2.tsx — whichever is active)
   - src/pages/PreviewPage.tsx
   - src/pages/AuthCallbackPage.tsx
   - src/components/layouts/MainLayout.tsx
   - src/components/layouts/AICopilot.tsx
   - src/routes.tsx
   - Any file in supabase/functions/

3. After reading, produce a written inventory in this format:

ALREADY BUILT (do not overwrite):
- [feature]: [file] — [what it does]

PARTIALLY BUILT (extend, do not replace):
- [feature]: [file] — [what exists vs what's missing]

NOT BUILT YET (safe to create):
- [feature]: per handoff spec

CONFLICTS WITH HANDOFF (flag before proceeding):
- [anything where the handoff spec contradicts what's already built]

4. Only after producing that inventory, ask: "Ready to proceed with Phase 1?
   Here are the conflicts I found, if any: [list]"

Do NOT start Phase 1 until the inventory is complete and conflicts are surfaced.
