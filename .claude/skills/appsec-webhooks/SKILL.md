---
name: appsec-webhooks
description: Use when creating or modifying any edge function that receives a webhook from an external provider (Stripe, Meta/WhatsApp, or any future provider) — stripe-webhook, subscription-webhook, whatsapp-webhook, or a new one. Also fires when touching supabase/functions/_shared/verifyMetaSignature.ts.
---

# Webhook signature verification review

Read `sec-rev/APPSEC.md` §2 first. A webhook function deployed with `--no-verify-jwt` (needed because the caller isn't a logged-in Supabase user) is not the same as "no verification at all" — the provider's own signature scheme must fill that gap, or anyone who can guess/know an identifier in the payload (a phone_number_id, a customer id) can forge requests.

## What to check

1. **Is there a signature check before the payload is trusted?** Stripe: `stripe.webhooks.constructEvent(body, signature, secret)`. Meta: `X-Hub-Signature-256` HMAC-SHA256, verified via `supabase/functions/_shared/verifyMetaSignature.ts`.
2. **Is the signature computed over the RAW request body**, read via `req.text()` before any `JSON.parse`? Re-serializing the parsed object and hashing that produces different bytes than what the provider actually signed — this is the most common way a "verification" check silently does nothing.
3. **Does verification failure return a 4xx before any database call?** Not after — check the code path doesn't insert/update anything first and only reject at the end.
4. **Is the comparison constant-time** (not `===` on the two hex strings directly, which leaks timing information about how many leading bytes matched)? See `verifyMetaSignature.ts` for the reference pattern.
5. **New provider?** Check that provider's documented webhook-security scheme (nearly every major provider has one — Stripe, Meta, GitHub, Twilio, etc. all use HMAC-over-raw-body) and implement the equivalent before shipping, following the same shape as the existing two.

Report findings as: which function, what's missing, and the concrete forgery scenario (what would a forged request let an attacker do — insert a fake message, mark something paid, etc.).
