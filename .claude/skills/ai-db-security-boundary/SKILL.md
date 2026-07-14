---
name: ai-db-security-boundary
description: Use when writing, modifying, or reviewing any Supabase edge function, RLS policy, or frontend code path where AI/LLM output (ai-gateway extract/chat/query/action modes, or any other model call) influences a database read, write, or side-effecting action. Also use proactively before adding new AI-driven query or action capability to Freeda/CommandBar. Reviews the change against Forgefly's AI-to-database security boundary: LLM output must be treated as data, never as query logic.
---

# AI-to-database security boundary review

Forgefly lets AI-generated content (Claude via `ai-gateway`) reach the database — the "Upgrade my Business" extract flow, the AI Copilot chat, and any future query/action capability. The property that keeps this safe from prompt injection is documented in `CLAUDE.md` under "AI-to-database security boundary." This skill is the enforcement pass: read that section first, then check the change in front of you against it.

## What to check

For any code path where LLM output (JSON extraction, tool-call arguments, chat responses with an `action` field, etc.) ends up influencing a DB operation:

1. **Ownership fields never come from the model.** `user_id` / `business_id` on any insert or update must be hardcoded from the authenticated session (`business.user_id`, `useBusiness()`, the JWT-derived `auth.uid()`), never read from a field the model's JSON happened to include — even if that field exists in the schema the model was prompted with. Grep the write for where each column's value originates.
2. **RLS is the real boundary, not app-code discipline.** Confirm the target table has an RLS policy scoped to `auth.uid()` (or an equivalent ownership chain, e.g. `services`'s policy joining through `businesses.user_id`). If a new table is being added for AI-writable data, it needs RLS before this ships, not after.
3. **The model selects among fixed operations, never constructs one.** It should never be in a position to choose an arbitrary table, arbitrary row id, or raw SQL/filter. For query or tool-calling capability, the allow-listed function set must be fixed in application code, with the `business_id`/`user_id` filter injected server-side — the model only supplies which allow-listed function and what value-level parameters.
4. **Side-effecting actions require a confirm step.** Anything that sends a message, emails a client, marks something paid, or touches more than one row as a bulk operation must render a review/confirm UI before executing — never fire directly off a classified intent. Reuse the existing "Review changes → Apply to all tabs" pattern from `src/components/shell/CommandBar.tsx` rather than building a new confirmation flow from scratch.
5. **Check for injected untrusted text riding along.** If any part of the context fed to the model includes text from a third party (a client's message, a proposal a client submitted, an inbound WhatsApp message) alongside the user's own instructions, treat that as untrusted input — the model should not be able to be steered by it into invoking a different allow-listed function or targeting a different business than the one the authenticated caller owns.

## Reporting

If reviewing an existing diff, report findings the same way `/code-review` does: concrete file/line, what's violated, and the realistic exploit scenario (attacker input → what actually happens), not just "this could theoretically be unsafe." If scoping new work (e.g. adding query/action modes to `ai-gateway`), state the design up front — which allow-listed functions are being added, what each is scoped by, and where the confirm-before-execute step lives — before writing the implementation.
