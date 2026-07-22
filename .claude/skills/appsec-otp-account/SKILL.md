---
name: appsec-otp-account
description: Use when writing or modifying any one-time-code verification flow (account deletion, future MFA/email-verification, password reset) — request-deletion-otp, confirm-account-deletion, or any new endpoint that generates and later checks a short code. Also fires when touching account-deletion or account-recovery logic generally.
---

# OTP / sensitive-verification-code review

Read `sec-rev/APPSEC.md` §7 first. A one-time code flow needs three properties together — missing any one of them defeats the point of having a code at all:

1. **Sufficient entropy** — a 6-digit code (10^6 keyspace) is fine, but *only* combined with #3 below. Alone, it's brute-forceable within any reasonable expiry window.
2. **A short expiry window.**
3. **A hard attempt cap that invalidates the code** — not just a delay, an actual lockout (delete/invalidate the code) after a small number of wrong guesses. Without this, an "email me a code" step doesn't actually verify email access at all — an attacker with a stolen/valid session but no email access can just brute-force past it, collapsing what looks like two-factor verification into one factor.

## What to check

1. Is there an `attempts` counter (or equivalent), incremented on every wrong guess, checked **before** the comparison (not after)?
2. Does exceeding the cap actually invalidate the code (delete the row / mark it unusable), not just return an error while leaving the code guessable?
3. Does requesting a fresh code reset the attempt counter, and is *requesting* a fresh code itself gated behind a real session/identity check (not something an unauthenticated caller can trigger to grief someone else's account, and not something that lets an attacker re-arm their own brute-force budget without any real friction)?
4. Is the code single-use — deleted/invalidated immediately on successful verification, not just on expiry?

Report findings as: which endpoint, which of the 3 properties is missing, and the concrete bypass (e.g. "no attempt cap → the session-holder alone can delete the account without ever receiving/reading the email, since the code can be brute-forced in the 10-minute window").
