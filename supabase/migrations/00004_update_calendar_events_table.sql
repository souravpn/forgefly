-- Add missing columns to calendar_events table
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS meeting_link text;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS color text;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_client_id ON calendar_events(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON calendar_events(event_type);

-- Enable realtime if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'calendar_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
  END IF;
END $$;