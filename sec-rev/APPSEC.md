# Forgefly Application Security Reference

This is the standing security reference for Forgefly, referenced from root `CLAUDE.md`. It covers every sensitive area of the codebase — what the rule is, why it exists, and where to look. It's written to be read by both humans and Claude Code sessions; individual sections back the auto-firing skills in `.claude/skills/appsec-*`.

For the AI-specific data-boundary rules (LLM output as data, never query logic), see `.claude/skills/ai-db-security-boundary/SKILL.md` and the "AI-to-database security boundary" section of root `CLAUDE.md` — this document complements that one rather than duplicating it, and adds the injection-specific and broader-appsec material.

Last full review: 2026-07-22 (see `sec-rev/findings/2026-07-22-full-review.md` for the complete findings log from that pass).

---

## 1. Prompt injection

**Threat model — who actually controls the input matters more than whether input is "user-provided."** Every prompt surface where the *account owner* is the one typing is low-stakes: they already have full access to their own account and data. The surfaces that matter are where someone *other than* the account owner controls text that reaches a model whose output can influence that account owner's data.

| Surface | Who controls the input | Risk |
|---|---|---|
| `ai-gateway` `mode: extract`/`classify`/`freeda` | Account owner | Low |
| `generate-promotion`, `trigger-nudges`, `generate-visibility-kit`, `quarterly-review-insight` | Account owner's own business data | Low |
| `extract-receipt` (vision) | Account owner's uploaded image | Low-medium |
| **`research-company` / `research-competitor`** | **A third party's website content**, fetched server-side | **High** — indirect prompt injection via scraped content |
| **`handle-reply-intent`** | **Inbound WhatsApp messages from clients** | **High** — a client can craft an adversarial message |

### Rules

1. **Model output is only ever data, never query logic.** This is the primary defense and applies regardless of injection — see the AI-DB boundary skill. Even a fully successful injection can't reach the database maliciously if this holds.
2. **Wrap third-party content in an explicit untrusted-content frame** before it enters a system/user prompt: state plainly that the content may contain instructions and those instructions must be ignored — it's data to analyze/summarize, not directions to follow. Apply this to `research-company`, `research-competitor`, and `handle-reply-intent`.
3. **Any external fetch derived from user/business input needs the SSRF guard** (`supabase/functions/_shared/safeFetch.ts`) — see §3. Injection and SSRF are separate vulnerability classes that happen to share a code path here.
4. **Validate/schema-check extracted structured output before writing it** — an extraction result's fields should be type/shape-checked (a price should look like a price, a date should parse) before landing in the database, independent of whether the source was adversarial.
5. **Never let a model-controlled string become a UI action without going through a fixed allow-list.** The `action` field pattern in `ai-gateway` (a closed enum of literal strings) is correct; any new AI-surfaced "pick something to do" capability must follow the same shape, never accept an arbitrary string as a code path.
6. **Rendering AI or scraped-content output must not enable HTML/script execution.** `react-markdown` is used without `rehype-raw` throughout (`AICopilot.tsx`, `DocumentationPage.tsx`) — keep it that way. Never add a raw-HTML plugin to a surface that renders model or third-party content.

---

## 2. Webhooks — signature verification is mandatory

Any endpoint that accepts a webhook from an external provider must verify the request actually came from that provider before touching the database. "No JWT verification" (a Supabase edge function deployed with `--no-verify-jwt`, needed because the caller isn't a logged-in user) is **not** the same thing as "no verification at all" — the provider's own signature scheme must fill that gap.

| Function | Provider | Verification |
|---|---|---|
| `stripe-webhook`, `subscription-webhook` | Stripe | `stripe.webhooks.constructEvent(body, signature, secret)` — reference pattern |
| `whatsapp-webhook` | Meta | `X-Hub-Signature-256` HMAC-SHA256 over the **raw** body, via `supabase/functions/_shared/verifyMetaSignature.ts` |

**Rule:** any new webhook-receiving function must verify a provider signature before parsing/trusting the payload, computed over the raw request body (not a re-serialized object — re-serialization can produce different bytes than what was signed). Reject with a 4xx on failure, before any database call.

---

## 3. Server-side fetches of external/user-supplied URLs (SSRF)

Any edge function that fetches a URL derived from user or business input (researching a company website, fetching an og:image, resolving a webhook callback URL, etc.) is a potential SSRF vector — the edge runtime's network can reach internal services and cloud metadata endpoints (`169.254.169.254`) that should never be reachable from a client-supplied URL.

**Rule:** route every such fetch through `supabase/functions/_shared/safeFetch.ts`, which:
- allows only `http:`/`https:` schemes,
- blocks loopback/private/link-local IP ranges and the metadata endpoint, checked against both the literal hostname and its DNS-resolved address (defeats a hostname that resolves to a private IP),
- disables automatic redirect-following and re-validates each hop manually (a validated URL can't redirect its way past the guard).

Currently applied to: `research-company`, `research-competitor`. Any new function that fetches an external URL from input must use `safeFetch`, not raw `fetch()`.

---

## 4. Row-level security (RLS)

**RLS is the actual enforcement boundary** for every table holding business or user data — not app-code discipline, not "the frontend only queries with the right filter." A `using (true)` policy grants access to *any* caller regardless of what the client-side query filters on.

**Rules:**
1. Every table added via migration that holds business/user/client data needs `alter table ... enable row level security` plus a policy scoped to `auth.uid()` (directly, or via an ownership chain like `services`/`engagements` joining through `businesses.user_id`).
2. A `using (true)` policy is only acceptable for genuinely public content with no secrets in any column (e.g. `documentation_sections`). If a table has a secret/token column (a `portal_token`, an API key, etc.), `using (true)` on SELECT leaks that secret to anyone with the anon key — that's the whole internet, since the anon key ships in the frontend bundle.
3. **"Anyone who holds token X can read row X" is not expressible as `using (true)`** — RLS evaluates per-row, not per-query-shape, so a blanket-true policy doesn't care what the client filtered on. The correct pattern is either (a) move the read behind an edge function that validates the token server-side with the service-role client, or (b) have the RLS policy check the token against a value the client sends via a custom header, read through `current_setting('request.headers', true)::json->>'x-your-token'`. See `supabase/migrations/00051_engagements_rls_fix.sql` and `src/pages/ClientPortalPage.tsx`'s `engagementClientFor()` for the reference implementation of (b).

---

## 5. Edge function caller identity

Every edge function that reads or writes business-scoped data needs to know *whose* business it's touching, verified from the caller, not trusted from the request body. The reference dual-client pattern (see `mark-milestone/index.ts` or `generate-visibility-kit/index.ts`):

```ts
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
});
const { data: { user }, error } = await authClient.auth.getUser();
// then verify business.user_id === user.id before proceeding,
// using a separate service-role client for the actual read/write.
```

**Exceptions that don't need this** (and why):
- **Public-intake endpoints** gated by their own token/secret instead of a Supabase session — `upload-portal-file` (portal_token), `portal-create-checkout` (token), `submit-review` (signed JWT in the body), `portal-approve-proposal` (portal-session flow). These are legitimately unauthenticated by design; verify the token/secret check is real and actually queried against the database, not just present syntactically.
- **Function-to-function only calls** — `select-portal-testimonials` is invoked only by `submit-review`, never by an end user. It's gated by requiring the caller's `Authorization` header to equal the service-role key exactly, since the anon key (public, embedded in the frontend) doesn't gate anything on its own.
- **Cron-triggered functions** (`trigger-nudges`, `send-daily-digest`, `send-review-requests`, `schedule-review-request`, `quarterly-review-insight`) — confirm these are only reachable via Supabase's scheduled trigger, not directly callable with attacker-supplied parameters that change whose data gets processed.

**Rule when adding a new function:** if it takes a `business_id`/`user_id` in the request body and does anything beyond reading data that's already meant to be fully public (like the public portfolio's own fields), it needs the dual-client ownership check. Default to requiring it; only skip it with a documented reason matching one of the exceptions above.

---

## 6. File uploads

**Rules:**
1. **Cap size explicitly** — never trust an unbounded payload. `upload-portal-file` caps at 25MB (decoded byte length, checked before the upload call).
2. **Never store an attacker-controlled content-type verbatim.** Use an allow-list of expected MIME types for the upload's purpose (images, PDF, common office formats); anything else gets forced to `application/octet-stream` so a browser downloads rather than renders it — this closes the "upload an .html file with an attacker-chosen Content-Type, get it served inline" stored-XSS path.
3. **Sanitize filenames used to construct storage paths** — strip anything but `[a-zA-Z0-9._-]` before it becomes part of a path, closing path-traversal via `../` in a client-supplied filename.
4. **Namespace storage paths per-owner** (e.g. `${contact.id}/${timestamp}_${filename}`) so one user's upload can't collide with or overwrite another's.
5. If reaching for `src/hooks/use-supabase-upload.ts`, don't rely on its defaults alone for anything public-facing — pass explicit `maxFileSize`/`allowedMimeTypes` for the specific upload's purpose.

---

## 7. OTP / account-sensitive verification codes

Any one-time code flow (account deletion, future MFA, etc.) needs three properties together, not just one:
1. **Sufficient entropy** — 6 random digits (10^6 keyspace) is acceptable *only* combined with rate limiting; it is not acceptable alone.
2. **A short expiry window.**
3. **A hard attempt cap that invalidates the code** (not just slows down guessing) — `confirm-account-deletion` locks out and deletes the OTP after 5 wrong guesses (`supabase/migrations/00052_deletion_otp_attempts.sql`). Without this, an unlimited-attempt 6-digit code is brute-forceable well within any reasonable expiry window, and — critically — it collapses a two-factor-feeling flow (session + email access) down to one factor (session alone), since email access was never actually checked.

**Rule:** any new OTP/code-verification endpoint needs an `attempts` counter checked and incremented atomically with the comparison, reset only when a fresh code is legitimately issued.

---

## 8. CORS

Every edge function currently sets `Access-Control-Allow-Origin: '*'`. This is **low risk specifically because** every authenticated function relies on a bearer token forwarded explicitly by the client, not on browser-managed cookies/credentialed requests — wildcard CORS is dangerous mainly in combination with cookie-based session auth, which this codebase doesn't use anywhere.

**Rule:** if any future function ever adopts cookie-based/credentialed auth, it must not also use wildcard CORS — that combination is the classic CSRF-via-CORS hole. Until then, wildcard CORS here is an accepted, understood tradeoff, not an oversight — but tightening to an explicit origin allow-list remains a reasonable defense-in-depth backlog item, especially for any function found to skip caller-identity verification (§5).

---

## 9. OAuth flows

`social-oauth-callback` (Instagram/Facebook/WhatsApp token exchange) requires an authenticated Supabase session and checks `business.user_id === user.id` before storing a connection — this bounds the blast radius of a replayed authorization code to the attacker's own session, not a victim's. It does **not** currently generate/verify a `state` parameter on the Meta-side OAuth redirect.

**Backlog item:** add and verify a `state` parameter on the frontend-initiated OAuth redirect for defense-in-depth against authorization-code-replay/session-fixation-style attacks, even though the existing session + ownership check already meaningfully bounds the risk.

---

## Known accepted-risk backlog (not blocking, tracked here)

- CORS tightening to an explicit origin allow-list (§8) — currently accepted given the bearer-token auth model.
- OAuth `state` parameter (§9) — currently accepted given the session + ownership check.
- Confirm cron-only functions (§5) aren't independently callable with attacker-controlled targeting parameters — needs a Supabase-platform-level check, not just a code check.
- `extract-receipt` has no explicit image size limit before base64 decode (cost/DoS, low severity) — allow-listed MIME types are enforced, size is not yet.
