-- Migration 00022: Add phone + timezone to contacts for client profile completion (#39)

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone    text,
  ADD COLUMN IF NOT EXISTS timezone text;
