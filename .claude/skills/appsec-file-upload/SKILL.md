---
name: appsec-file-upload
description: Use when writing or modifying any code path that accepts a file/image upload from a user or client — upload-portal-file, extract-receipt, avatar/work-sample uploads, or src/hooks/use-supabase-upload.ts. Fires on any new Supabase Storage .upload() call or file-input handling code.
---

# File upload review

Read `sec-rev/APPSEC.md` §6 first.

## What to check

1. **Size cap** — is there an explicit maximum, checked before the expensive part of the upload (before a byte-by-byte decode loop, not after)? An unbounded upload is a cost/DoS vector regardless of what the file contains.
2. **Content-type handling** — is the stored content-type restricted to an allow-list appropriate for the upload's purpose (images, PDF, common office formats), with anything else forced to `application/octet-stream`? Storing an attacker-chosen MIME type verbatim (e.g. `text/html`) is a stored-XSS vector if that file is ever served inline from the app's own origin — see `upload-portal-file`'s `SAFE_CONTENT_TYPES` for the reference pattern.
3. **Filename → storage path** — is the filename sanitized (strip anything outside `[a-zA-Z0-9._-]`) before it becomes part of a storage path? An unsanitized filename containing `../` is a path-traversal vector.
4. **Storage path namespacing** — is the path scoped per-owner (e.g. `${contact.id}/${timestamp}_${name}`) so one user's upload can't collide with or overwrite another's?
5. **If reaching for `src/hooks/use-supabase-upload.ts`:** don't rely on its defaults alone for anything public-facing. Pass explicit `maxFileSize`/`allowedMimeTypes` matching the specific upload's purpose — its defaults are a safety net, not a substitute for call-site-specific limits.

Report findings as: which upload path, which of the 4 protections above is missing, and the concrete exploit (e.g. "no size cap → a single request can push a 2GB payload, run up storage cost, or exhaust the function's memory").
