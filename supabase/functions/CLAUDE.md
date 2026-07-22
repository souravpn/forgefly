# CLAUDE.md — supabase/functions/

Guidance specific to this directory. Read the root `CLAUDE.md` first, especially the AI-to-database security boundary section — everything below assumes it.

## Conventions

- **Deno + `serve`**, one function per directory, `index.ts` as the entry point. Imports come from `https://deno.land/std@0.168.0/...` or `jsr:@supabase/supabase-js@2` — no npm-style local `node_modules`.
- **CORS**: every function defines its own `corsHeaders` const and returns it on the `OPTIONS` preflight and on every response, including errors. Copy the existing block from a neighboring function rather than reinventing it.
- **Two Supabase clients, two different jobs** — this is the standard shape (see `mark-milestone/index.ts` for the canonical example):
  - A **service-role client** (`SUPABASE_SERVICE_ROLE_KEY`) for the actual privileged read/write. This bypasses RLS, so the function itself is the enforcement boundary for whatever it touches.
  - A separate **anon-key client with the caller's `Authorization` header forwarded**, used only to call `.auth.getUser()` and confirm who's calling. Never trust a `user_id`/`business_id` passed in the request body — always resolve it from this verified session, then use that resolved id in the service-role client's query.
- **Shared code** lives in `_shared/` (`email-templates.ts`, `whatsappSend.ts`, `verifyMetaSignature.ts`, `safeFetch.ts`) — reach for it before duplicating logic across functions; it's imported directly (not via HTTP) to avoid a round-trip, e.g. `ai-gateway` imports `whatsappSend.ts`'s send/lookup helpers directly rather than invoking `send-whatsapp-message` over HTTP.
- **Webhooks** (`whatsapp-webhook`, `stripe-webhook`, `subscription-webhook`) are the exception to the JWT-verification pattern above — they're called by Meta/Stripe, not a logged-in user, and are deployed with `--no-verify-jwt`. That does **not** mean unverified: each one must check the provider's own signature (`verifyMetaSignature.ts` for Meta, `stripe.webhooks.constructEvent` for Stripe) over the **raw** request body before trusting the payload — see `sec-rev/APPSEC.md` §2.
- **Any function fetching a URL derived from user/business input** (researching a company, resolving a callback URL) must route through `safeFetch.ts`, not raw `fetch()` — it blocks SSRF against the edge runtime's internal network and the cloud metadata endpoint. See `research-company`/`research-competitor` and `sec-rev/APPSEC.md` §3.

## Deploying

```bash
supabase functions deploy <name>   # single function
supabase db push                   # migrations
```

This project has one Supabase environment — **Forgefly-prod** — no separate local/staging DB. Always confirm with the user before pushing a migration or deploying a function; don't assume a prior "yes" carries over to a new change.

## Where things live (by area — see root CLAUDE.md for the full function list)

- `ai-gateway` is the only function that calls an LLM and writes/reads based on its output — any new AI-driven capability belongs here, following the same intent-routing + allow-listed-action shape already established, not as a new standalone function.
- Social/promotions functions (`social-*`, `generate-promotion`, `check-video-render`) all key off `social_connections` / `social_posts` / `social_post_targets`, all RLS-scoped to the owning business.
- Payment functions talk to Stripe; `stripe-webhook` and `subscription-webhook` are separate because they handle different event families (one-off payments vs. subscription lifecycle) — don't merge them.
