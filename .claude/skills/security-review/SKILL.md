---
name: security-review
description: Run a full multi-stage security review of the Forgefly codebase (not just a diff) — recon across auth, RLS, secrets, webhooks, SSRF, uploads, OTP flows, and prompt-injection surfaces; classify findings by severity; explain each as an attacker path; fix CRITICAL/HIGH; independently re-review; loop until clean. Invoke this any time — after a batch of edge-function changes, before a release, or on a schedule. For a single diff instead of the whole codebase, use /security-review (the built-in one) or /code-review instead.
---

# Security review — full multi-stage loop

This is Forgefly's standing security-review process, not a one-off prompt. It's designed to be re-run — after a batch of edge-function changes, before a release, or just periodically. Read `sec-rev/APPSEC.md` first; it's the substantive reference this skill enforces. Past runs are logged in `sec-rev/findings/<date>-full-review.md` — check the most recent one before starting, so you're not re-litigating already-fixed items from scratch.

## The loop

```
STAGE 1 — RECON
STAGE 2 — IDENTIFY & CLASSIFY
STAGE 3 — EXPLAIN
STAGE 4 — FIX
STAGE 5 — RE-REVIEW
STAGE 6 — LOOP or STOP
```

### Stage 1 — Recon

Enumerate the attack surface systematically. Don't skip areas because they "were probably fine last time" — re-verify. Cover, at minimum:

- **Webhook signature verification** — every function receiving a webhook (Stripe, Meta, and any future provider) must verify a provider signature before trusting the payload. See `sec-rev/APPSEC.md` §2.
- **RLS coverage** — every table added since the last review: does it have RLS enabled, and is every policy scoped to `auth.uid()` or an ownership chain (not a blanket `using (true)` on anything with a secret column)? §4.
- **SSRF** — any new or changed function that fetches a URL derived from user/business input: does it route through `supabase/functions/_shared/safeFetch.ts`? §3.
- **Prompt injection** — any new AI-calling code path: does it ingest third-party content (scraped web content, inbound client messages, client-submitted text)? If so, is it framed as untrusted? §1.
- **Edge function caller identity** — does every business-scoped function verify the caller owns the business_id it's touching, or fall into one of the documented exceptions (public-intake-by-token, function-to-function via service-role check, cron-only)? §5.
- **File uploads** — size caps, content-type allow-listing, filename sanitization, per-owner storage-path namespacing. §6.
- **OTP / sensitive verification codes** — entropy, expiry, and a hard attempt cap that invalidates the code. §7.
- **Secrets handling** — no hardcoded keys, no secrets in `console.log`, no tracked `.env` files.
- **XSS** — no `dangerouslySetInnerHTML`/`rehype-raw` on any surface rendering AI or third-party content.
- **CORS / OAuth** — confirm the accepted tradeoffs in §8/§9 still hold (no new cookie-based auth introduced, which would make wildcard CORS dangerous).

Delegate recon to parallel research agents grouped by area (2-3 agents covering different areas each) rather than reading everything in the main thread — this is what worked well in the 2026-07-22 pass. Ask each agent for concrete file:line findings, not general commentary, and to flag anything it can't fully verify rather than guessing.

### Stage 2 — Identify & classify

Every finding needs: file:line, a severity (CRITICAL / HIGH / MEDIUM / LOW / INFO), and a one-sentence description of what's actually wrong. No hypothetical findings — if you can't point to the exact code, it's not a finding yet, it's a question to go verify.

Severity guide:
- **CRITICAL** — unauthenticated access to secrets/PII across all tenants, or a fully unauthenticated write/RCE-adjacent path (SSRF reaching internal services, forged webhook payloads, RLS bypass on a secret-bearing table).
- **HIGH** — exploitable with some precondition (a valid-but-unprivileged session, a guessable ID), meaningful impact (account takeover via brute force, cost-abuse at scale, cross-tenant data trigger).
- **MEDIUM** — real but bounded impact, or requires an unusual precondition (a misconfigured bucket, a specific upload path).
- **LOW/INFO** — hardening, defense-in-depth, or a gap with no realistic exploit path today. These do not block the loop — log them to the accepted-risk backlog in `sec-rev/APPSEC.md` instead of chasing them to zero.

### Stage 3 — Explain

For each CRITICAL/HIGH/MEDIUM finding, write the attacker's path in one or two sentences: precondition → action → impact. This is what makes the fix obviously correct (or reveals that the "finding" isn't actually exploitable, which happens — see the `generate-wallet-pass` "reviewed, not changed" example in `sec-rev/findings/2026-07-22-full-review.md`).

### Stage 4 — Fix

Apply the minimal surgical fix per finding. Prefer reusing existing patterns (`supabase/functions/_shared/safeFetch.ts`, `verifyMetaSignature.ts`, the dual-client auth-check pattern in `mark-milestone`/`generate-visibility-kit`) over inventing new ones. After fixing, typecheck (`pnpm type-check` or `npx tsc --noEmit -p tsconfig.json`) and lint the changed files before moving on. Push any new migrations and redeploy any changed edge functions — a fix that isn't deployed isn't a fix.

### Stage 5 — Re-review

Spawn a fresh agent with **no memory of the fixes** — it should read the current file state cold and independently verify each claimed fix, the same way the `archflow` skill's reviewer agent works. Ask it to:
- Confirm each fix is actually enforced (not just present but unreachable/dead code).
- Check for anything the fix might have broken (a legitimate call site that now fails).
- Do a final sweep for the same vulnerability class elsewhere in the codebase that the recon might have missed (e.g. "grep for any other unguarded external fetch besides the ones just fixed").

### Stage 6 — Loop or stop

- Any new or unresolved CRITICAL/HIGH → back to Stage 4 for those specific items.
- Cap at **4 cycles**. If CRITICAL/HIGH findings remain after 4 cycles, stop and escalate the full list to the user rather than continuing to loop — something is more structurally wrong than a surgical fix can address.
- MEDIUM/LOW/INFO findings do not gate the loop — log them to the accepted-risk backlog in `sec-rev/APPSEC.md` §"Known accepted-risk backlog" and move on.
- Write up the cycle in `sec-rev/findings/<date>-full-review.md` (or append a new dated section if one exists for today), following the format in `2026-07-22-full-review.md`.

## What "done" means

Not literally zero findings of every severity — that's not a real claim any honest review can make. Done means: zero CRITICAL, zero HIGH, and every MEDIUM either fixed or explicitly logged as an accepted tradeoff with a reason. Say this to the user plainly rather than implying a stronger guarantee than the process actually provides.
