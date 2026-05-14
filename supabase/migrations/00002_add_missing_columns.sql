-- Add missing columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add missing columns to proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS introduction text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS services text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS deliverables text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS pricing numeric;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS timeline text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Add missing columns to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date date DEFAULT CURRENT_DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Rename paid_date to paid_at for consistency
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'paid_date') THEN
    ALTER TABLE invoices RENAME COLUMN paid_date TO paid_at;
  END IF;
END $$;

-- Enable realtime for all tables if not already enabled
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE clients;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE projects;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;