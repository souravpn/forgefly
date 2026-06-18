-- Migration 00033: Nightly Toggl sync cron job (#61)
-- Calls sync-toggl-entries every night at 03:00 UTC.
-- The function iterates all businesses with toggl_token in extracted_data.
--
-- Requires pg_cron + pg_net extensions (enabled in Supabase Dashboard →
-- Database → Extensions).
-- Find your project URL: Dashboard → Project Settings → API
-- Service role key:      Dashboard → Project Settings → API → service_role key

DO $$
DECLARE
  v_project_url  text := current_setting('app.supabase_url',  true);
  v_service_key  text := current_setting('app.service_role_key', true);
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
  AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    PERFORM cron.schedule(
      'sync-toggl-entries',  -- job name (unique, idempotent)
      '0 3 * * *',           -- 03:00 UTC nightly
      format(
        $sql$
          SELECT net.http_post(
            url     := %L || '/functions/v1/sync-toggl-entries',
            headers := jsonb_build_object(
                         'Content-Type',  'application/json',
                         'Authorization', 'Bearer ' || %L
                       ),
            body    := '{}'::jsonb
          );
        $sql$,
        v_project_url,
        v_service_key
      )
    );

    RAISE NOTICE 'Toggl sync cron job scheduled (03:00 UTC nightly).';
  ELSE
    RAISE NOTICE 'pg_cron or pg_net not available — schedule sync-toggl-entries manually in the Dashboard.';
  END IF;
END $$;
