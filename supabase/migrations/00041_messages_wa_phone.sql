-- Migration 00041: track the raw WhatsApp phone number on each message.
-- client_id only resolves to a saved contact — freelancer-facing WhatsApp
-- notifications (sent to businesses.contact_phone) have no contact row, and
-- the 24h session-vs-template send decision needs the actual number on both
-- sides of a conversation, not just a contact link.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS wa_phone text;

CREATE INDEX IF NOT EXISTS messages_wa_phone_idx
  ON messages (business_id, wa_phone, created_at DESC)
  WHERE wa_phone IS NOT NULL;
