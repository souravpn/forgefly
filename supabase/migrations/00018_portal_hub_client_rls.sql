-- Migration 00018: Client-read RLS for portal hub
-- Allows authenticated clients to read their own proposals and invoices.
-- Scoped to non-draft statuses only — clients never see internal drafts.

-- ─── proposals: client read ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Client reads own sent proposals" ON proposals;
CREATE POLICY "Client reads own sent proposals"
  ON proposals FOR SELECT
  USING (
    status IN ('sent','viewed','accepted','declined','rejected','expired')
    AND client_email = auth.email()
  );

-- ─── invoices: client read ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Client reads own invoices" ON invoices;
CREATE POLICY "Client reads own invoices"
  ON invoices FOR SELECT
  USING (
    contact_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = invoices.contact_id AND c.email = auth.email()
    )
  );
