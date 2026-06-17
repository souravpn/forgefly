-- Migration 00026: Daily digest cron job (#31)
-- Calls send-daily-digest edge function every hour at :00.
-- The function itself checks each business's local time and only fires
-- when it's 8am in their timezone.
--
-- Requires pg_cron + pg_net extensions (enabled in Supabase Dashboard →
-- Database → Extensions). Also requires SUPABASE_URL and SERVICE_ROLE_KEY
-- to be available — replace the placeholder values below with your project's.
--
-- Find your project URL: Dashboard → Project Settings → API
-- Service role key:      Dashboard → Project Settings → API → service_role key

DO $$
DECLARE
  v_project_url  text := current_setting('app.supabase_url',  true);
  v_service_key  text := current_setting('app.service_role_key', true);
BEGIN
  -- Use pg_cron + pg_net to hit the edge function every hour if both
  -- extensions are available.
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
  AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    PERFORM cron.schedule(
      'send-daily-digest',   -- job name (unique, idempotent)
      '0 * * * *',           -- every hour on the hour
      format(
        $sql$
          SELECT net.http_post(
            url     := %L || '/functions/v1/send-daily-digest',
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

    RAISE NOTICE 'Daily digest cron job scheduled (every hour).';
  ELSE
    RAISE NOTICE 'pg_cron or pg_net not available — schedule send-daily-digest manually in the Dashboard.';
  END IF;
END $$;
