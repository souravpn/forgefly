-- Migration 00042: WhatsApp messages have no Supabase Auth user behind them —
-- neither the external WhatsApp contact (inbound) nor the automated lifecycle
-- notifications (outbound) are an authenticated sender_id. sender_id was NOT
-- NULL (a holdover from portal chat, where both sides are anon-auth users),
-- which silently failed every insert from whatsapp-webhook and whatsappSend.ts.

ALTER TABLE messages
  ALTER COLUMN sender_id DROP NOT NULL;
