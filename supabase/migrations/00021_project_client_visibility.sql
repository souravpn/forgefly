-- Migration 00021: Project client-visible status + portal link
-- Adds client_visible_status, client_visible_note, and contact_id to projects.
-- contact_id links a project to the hub contacts table so the portal can query it.
-- RLS policy lets authenticated portal clients read their own projects (when status is set).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS contact_id           uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_visible_status text
    CHECK (client_visible_status IN ('not_started', 'in_progress', 'review', 'complete')),
  ADD COLUMN IF NOT EXISTS client_visible_note  text;

CREATE INDEX IF NOT EXISTS projects_contact_id_idx
  ON projects (contact_id)
  WHERE contact_id IS NOT NULL;

-- Allow portal clients to read their own projects when the freelancer has set a visible status
CREATE POLICY "Client can read own project status"
  ON projects FOR SELECT
  USING (
    client_visible_status IS NOT NULL
    AND contact_id IN (
      SELECT id FROM contacts WHERE email = auth.email()
    )
  );
