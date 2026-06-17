-- Migration 00025: Contact lifecycle auto-archival (#35)
-- Contacts with lifecycle_status = 'engaged' and no activity for 90+ days
-- are automatically transitioned to 'archived'.
--
-- "Activity" = any of:
--   • message in messages table (created_at)
--   • invoice created or paid (created_at / updated_at)
--   • proposal updated (updated_at)
--   • contact's own updated_at
--
-- Runs nightly via pg_cron at 02:00 UTC.
-- Requires pg_cron extension (enabled in Supabase dashboard under Database → Extensions).

-- ─── 1. Archive function ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION archive_inactive_contacts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cutoff  timestamptz := now() - interval '90 days';
  v_updated integer;
BEGIN
  WITH last_activity AS (
    -- Latest message per contact (matched by contact email)
    SELECT c.id AS contact_id, max(m.created_at) AS last_at
    FROM contacts c
    JOIN messages m
      ON m.business_id = c.business_id
     AND m.contact_email = c.email
    WHERE c.lifecycle_status = 'engaged'
    GROUP BY c.id

    UNION ALL

    -- Latest invoice activity per contact (via clients email → contacts email)
    SELECT c.id AS contact_id,
           greatest(max(i.created_at), max(i.updated_at)) AS last_at
    FROM contacts c
    JOIN clients cl ON cl.email = c.email AND cl.business_id = c.business_id
    JOIN invoices i ON i.client_id = cl.id
    WHERE c.lifecycle_status = 'engaged'
    GROUP BY c.id

    UNION ALL

    -- Latest proposal activity per contact
    SELECT c.id AS contact_id, max(p.updated_at) AS last_at
    FROM contacts c
    JOIN proposals p
      ON p.business_id = c.business_id
     AND p.client_email = c.email
    WHERE c.lifecycle_status = 'engaged'
    GROUP BY c.id
  ),
  most_recent AS (
    SELECT contact_id, max(last_at) AS last_activity
    FROM last_activity
    GROUP BY contact_id
  )
  UPDATE contacts ct
  SET    lifecycle_status = 'archived',
         updated_at = now()
  FROM   most_recent mr
  WHERE  ct.id = mr.contact_id
    AND  ct.lifecycle_status = 'engaged'
    AND  mr.last_activity < v_cutoff;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Also archive engaged contacts with NO activity rows at all,
  -- using the contact's own updated_at as the last-known timestamp.
  UPDATE contacts
  SET    lifecycle_status = 'archived',
         updated_at = now()
  WHERE  lifecycle_status = 'engaged'
    AND  updated_at < v_cutoff
    AND  id NOT IN (
           SELECT DISTINCT contact_id FROM (
             SELECT c.id AS contact_id
             FROM contacts c
             JOIN messages m
               ON m.business_id = c.business_id AND m.contact_email = c.email
             UNION ALL
             SELECT c.id
             FROM contacts c
             JOIN clients cl ON cl.email = c.email AND cl.business_id = c.business_id
             JOIN invoices i ON i.client_id = cl.id
             UNION ALL
             SELECT c.id
             FROM contacts c
             JOIN proposals p
               ON p.business_id = c.business_id AND p.client_email = c.email
           ) sub
         );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- ─── 2. Schedule via pg_cron (nightly at 02:00 UTC) ──────────────────────────
-- NOTE: pg_cron must be enabled in Supabase dashboard → Database → Extensions
-- If pg_cron is not available, call archive_inactive_contacts() from the
-- daily-digest edge function (#31) instead.

SELECT cron.schedule(
  'archive-inactive-contacts',   -- job name (idempotent)
  '0 2 * * *',                   -- every day at 02:00 UTC
  $$ SELECT archive_inactive_contacts(); $$
)
WHERE EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
);
