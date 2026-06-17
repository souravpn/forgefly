-- Migration 00020: Notifications table + event trigger nudges
-- Creates the notifications table (used by #30 email system and future client bell).
-- Adds DB triggers that auto-insert freelancer nudges on key client events.

-- ─── notifications table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        REFERENCES businesses(id) ON DELETE CASCADE,
  client_id      uuid        REFERENCES contacts(id)   ON DELETE CASCADE,
  recipient_role text        NOT NULL CHECK (recipient_role IN ('freelancer', 'client')),
  type           text        NOT NULL,
  title          text        NOT NULL,
  body           text,
  entity_type    text,
  entity_id      uuid,
  read_at        timestamptz,
  emailed_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_freelancer_idx
  ON notifications (business_id, created_at DESC)
  WHERE read_at IS NULL AND recipient_role = 'freelancer';

CREATE INDEX IF NOT EXISTS notifications_client_idx
  ON notifications (client_id, created_at DESC)
  WHERE read_at IS NULL AND recipient_role = 'client';

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Freelancer: read + mark-read own notifications
CREATE POLICY "Freelancer reads own notifications"
  ON notifications FOR SELECT
  USING (
    recipient_role = 'freelancer'
    AND business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Freelancer marks own notifications read"
  ON notifications FOR UPDATE
  USING (
    recipient_role = 'freelancer'
    AND business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  )
  WITH CHECK (
    recipient_role = 'freelancer'
    AND business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

-- Client: read + mark-read own notifications
CREATE POLICY "Client reads own notifications"
  ON notifications FOR SELECT
  USING (
    recipient_role = 'client'
    AND client_id IN (SELECT id FROM contacts WHERE email = auth.email())
  );

CREATE POLICY "Client marks own notifications read"
  ON notifications FOR UPDATE
  USING (
    recipient_role = 'client'
    AND client_id IN (SELECT id FROM contacts WHERE email = auth.email())
  )
  WITH CHECK (
    recipient_role = 'client'
    AND client_id IN (SELECT id FROM contacts WHERE email = auth.email())
  );

-- ─── contacts: allow client to update portal_last_seen on their own row ───────
-- Needed so the portal can record first-visit, which the DB trigger picks up.

CREATE POLICY "Client can update own portal_last_seen"
  ON contacts FOR UPDATE
  USING  (email = auth.email())
  WITH CHECK (email = auth.email());

-- ─── Trigger: nudge freelancer when client sends a message ───────────────────

CREATE OR REPLACE FUNCTION nudge_on_client_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.sender_role = 'client' AND NEW.business_id IS NOT NULL THEN
    INSERT INTO nudges (user_id, business_id, type, title, body, action_url)
    SELECT
      b.user_id,
      NEW.business_id,
      'client_message',
      COALESCE(c.name, 'A client') || ' sent you a message',
      LEFT(NEW.body, 120),
      '/dashboard/messages'
    FROM businesses b
    LEFT JOIN contacts c ON c.id = NEW.client_id
    WHERE b.id = NEW.business_id;

    -- Also write to notifications for email tracking (#30)
    INSERT INTO notifications (business_id, client_id, recipient_role, type, title, body, entity_type, entity_id)
    SELECT
      NEW.business_id,
      NEW.client_id,
      'freelancer',
      'client_message',
      COALESCE(c.name, 'A client') || ' sent you a message',
      LEFT(NEW.body, 120),
      'message',
      NEW.id
    FROM businesses b
    LEFT JOIN contacts c ON c.id = NEW.client_id
    WHERE b.id = NEW.business_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nudge_on_client_message ON messages;
CREATE TRIGGER trg_nudge_on_client_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION nudge_on_client_message();

-- ─── Trigger: nudge freelancer when client opens portal for the first time ───

CREATE OR REPLACE FUNCTION nudge_on_portal_first_visit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.portal_last_seen IS NULL AND NEW.portal_last_seen IS NOT NULL THEN
    INSERT INTO nudges (user_id, business_id, type, title, body, action_url)
    SELECT
      b.user_id,
      NEW.business_id,
      'portal_visit',
      NEW.name || ' opened their portal',
      'Your client accessed their portal for the first time.',
      '/dashboard/clients'
    FROM businesses b
    WHERE b.id = NEW.business_id;

    INSERT INTO notifications (business_id, client_id, recipient_role, type, title, body, entity_type, entity_id)
    SELECT
      NEW.business_id,
      NEW.id,
      'freelancer',
      'portal_visit',
      NEW.name || ' opened their portal',
      'Your client accessed their portal for the first time.',
      'contact',
      NEW.id
    FROM businesses b
    WHERE b.id = NEW.business_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nudge_on_portal_first_visit ON contacts;
CREATE TRIGGER trg_nudge_on_portal_first_visit
  AFTER UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION nudge_on_portal_first_visit();
