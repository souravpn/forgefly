-- Migration 00040: WhatsApp portal-parity — tag every message with its channel
-- so inbound WhatsApp messages and outbound WhatsApp notifications show up
-- alongside portal chat in the existing messages hub.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'portal'
  CHECK (channel IN ('portal', 'whatsapp', 'email'));
