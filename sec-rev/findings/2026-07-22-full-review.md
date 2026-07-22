# Security review — 2026-07-22

Full-codebase pass following the loop in `.claude/skills/security-review/SKILL.md`. One cycle; re-review came back clean on the items fixed (see bottom of this file once the re-review lands).

## CRITICAL

1. **`whatsapp-webhook` — no signature verification.** Any caller who knew/guessed a valid `phone_number_id` already present in `social_connections` could POST forged messages, inserted as real client messages, auto-creating contacts/leads. No `X-Hub-Signature-256` check existed anywhere.
   **Fix:** added `supabase/functions/_shared/verifyMetaSignature.ts` (HMAC-SHA256 over the raw body, constant-time compare), wired into `whatsapp-webhook/index.ts` before the payload is parsed. Deployed.

2. **SSRF in `research-company` / `research-competitor`.** Both fetched an arbitrary user/business-supplied URL server-side with zero validation — no scheme allow-list, no private/loopback/link-local IP blocking, no metadata-endpoint (`169.254.169.254`) blocking, followed redirects automatically. Fetched content was returned to the caller embedded in AI output.
   **Fix:** added `supabase/functions/_shared/safeFetch.ts` (scheme + IP-range validation against both literal hostname and DNS-resolved address, manual redirect re-validation). Both functions now route through it. Deployed.

3. **`engagements` table RLS: `using (true)` on SELECT.** Anyone with just the anon key could dump the entire table across every business — including the `portal_token` secret itself, the credential the policy was supposed to be gating on.
   **Fix:** `supabase/migrations/00051_engagements_rls_fix.sql` replaces the policy to require the request's `x-portal-token` header to match the row's own token. `src/pages/ClientPortalPage.tsx`'s one legacy anonymous-read call site (`engagementClientFor()`) now sends that header. Confirmed no other anonymous reads of this table exist — all other call sites (`ProposalsPage.tsx`, `InvoicesPage.tsx`) are authenticated-owner reads already covered by the existing owner policy. Migration pushed.

## HIGH

4. **OTP brute-force on `confirm-account-deletion`.** No rate limit on a 6-digit code (10^6 keyspace) within a 10-minute window — reduces the intended "session + email access" two-factor-feeling deletion flow to one factor (session alone), since the email step could be bypassed entirely by guessing.
   **Fix:** `supabase/migrations/00052_deletion_otp_attempts.sql` adds an `attempts` column; `confirm-account-deletion/index.ts` locks out (deletes the OTP) after 5 wrong guesses; `request-deletion-otp/index.ts` resets `attempts: 0` when a fresh code is issued. Migration pushed, both functions deployed.

5. **Unauthenticated `business_id` trust** in `generate-visibility-kit` and `select-portal-testimonials` — any caller could trigger AI generation / read testimonial-selection logic for any business by guessing a UUID, no ownership check (cost-abuse risk primarily).
   **Fix:** `generate-visibility-kit` now requires a valid session (dual-client pattern) and checks `business.user_id === user.id`, returning 404 (not 403) on mismatch to avoid confirming existence. `select-portal-testimonials` (function-to-function only, called exclusively by `submit-review`) now requires the caller's `Authorization` header to exactly equal the service-role key. Both deployed; confirmed `submit-review`'s existing service-role-keyed client will still authenticate correctly with no changes needed there.
   **Reviewed and NOT changed:** `generate-wallet-pass`'s "owner" vs. "public visitor" branches both only expose fields already shown on the public portfolio page — there's no actual sensitivity difference between the two lookup paths, so adding an auth requirement would break the legitimate public "add to wallet" feature for no real security benefit.

## MEDIUM

6. **`upload-portal-file`** had no file size cap and stored any client-supplied `mimeType` verbatim (stored-XSS risk if ever served inline from the app's own origin).
   **Fix:** added a 25MB cap on decoded byte length (checked before the upload call) and a `SAFE_CONTENT_TYPES` allow-list — anything else is forced to `application/octet-stream`. Deployed.

7. **`src/hooks/use-supabase-upload.ts`** defaulted `maxFileSize` to `Infinity`. Confirmed this hook currently has no real call sites in the app (only referenced by the unused `dropzone.tsx` component) — low live risk, hardened anyway as a safe-by-default baseline for whenever it is wired up.
   **Fix:** default changed to 10MB, overridable per call site.

## Accepted-risk backlog (not fixed this pass, tracked in APPSEC.md)

- CORS wildcard across all edge functions — low risk given bearer-token (not cookie) auth model; tightening to an explicit allow-list is a reasonable future hardening step.
- No OAuth `state` parameter on the Meta social-connect flow — the existing session + ownership check already bounds the blast radius; `state` would be defense-in-depth.
- Cron-only functions' reachability outside the scheduler wasn't independently verified at the Supabase-platform level.
- `extract-receipt` has no explicit image size cap before base64 decode (MIME allow-list is enforced; size is not).

## Re-review

Independent re-review (fresh agent, no memory of these fixes) verified all 7 items above as fixed. Two low-severity informational notes came back, both closed or accepted:
- **`safeFetch` didn't unwrap IPv4-mapped IPv6 literals** (`::ffff:127.0.0.1`) before checking against the IPv4 private-range regexes — fixed immediately (dotted-quad form now unwrapped before the range checks; the rarer pure-hex mapped form, e.g. `::ffff:7f00:1`, is left as residual/accepted risk given its rarity). Redeployed.
- **`use-supabase-upload.ts`'s hardened default is currently moot** — confirmed the hook has no real call sites anywhere in `src/` (dead code). No action needed; noted so a future integrator doesn't assume it's exercised.

Also confirmed by the re-review: `social-publish-facebook/index.ts:151` fetches an `upload_url` returned by Meta's own API response (not attacker-controlled under normal operation) — structurally similar to the research-* pattern but not a live finding; left as-is.

**Loop terminated after 1 cycle** — 0 CRITICAL, 0 HIGH remaining. Two INFO-level notes closed same-day; nothing gates further looping per the review protocol (CRITICAL/HIGH only).
