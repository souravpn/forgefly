-- SECURITY FIX: confirm-account-deletion had no rate limit on OTP
-- verification — a 6-digit code (10^6 keyspace) with unlimited guesses
-- reduces the "session + email OTP" deletion flow to just "have a
-- session," since the email step can be brute-forced around entirely.
-- Add an attempt counter so the edge function can lock out after a
-- small number of wrong guesses and force a fresh OTP request.

alter table deletion_otps add column if not exists attempts int not null default 0;
