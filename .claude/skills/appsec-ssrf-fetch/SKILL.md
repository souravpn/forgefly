---
name: appsec-ssrf-fetch
description: Use when writing or modifying any edge function that fetches a URL derived from user or business input — a company website to research, a webhook callback URL, an og:image, anything where the URL (or its host) isn't a hardcoded first-party constant. Fires on research-company, research-competitor, supabase/functions/_shared/safeFetch.ts, or any new function calling fetch() with a non-literal URL.
---

# SSRF review for external fetches

Read `sec-rev/APPSEC.md` §3 first. Any edge function that fetches a URL derived from user/business input can reach the edge runtime's internal network — private services, and the cloud metadata endpoint (`169.254.169.254`) which typically holds cloud-provider credentials. This is a genuinely dangerous class of bug, not a theoretical one.

## What to check

1. **Is the fetch routed through `supabase/functions/_shared/safeFetch.ts`** rather than raw `fetch()`? If not, that's the finding — add it, following `research-company`/`research-competitor` as the reference call sites.
2. **If you're modifying `safeFetch.ts` itself:** does the scheme check still only allow `http:`/`https:`? Does the private/loopback/link-local/metadata IP-range check still cover: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0`, IPv6 `::1`/`fe80::/10`/`fc00::/7`, and IPv4-mapped IPv6 literals (`::ffff:127.0.0.1`)? Is the check applied to **both** the literal hostname/IP **and** the DNS-resolved address (the second is what defeats a hostname that resolves to a private IP — "DNS rebinding")? Are redirects re-validated per hop rather than auto-followed?
3. **Is a first-party/hardcoded URL actually safe to leave unguarded?** A URL returned by a trusted API's own response (e.g. Meta's resumable-upload `upload_url`) is lower risk than a user-typed URL, but note it in code as reviewed rather than silently assuming — see the `social-publish-facebook` note in `sec-rev/findings/2026-07-22-full-review.md` for the precedent judgment call.
4. **Does the caller ever return the fetched content back to the requester** (embedded in an AI summary, in a raw response field)? If so, this may also be an `appsec-prompt-injection` surface — check that skill too.

Report findings as: which function, whether it routes through safeFetch, and the concrete internal-network target an attacker could reach if it doesn't (e.g. "http://169.254.169.254/latest/meta-data/iam/security-credentials/ — could exfiltrate the edge runtime's own cloud credentials").
