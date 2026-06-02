-- Team Dashboard Phase 2 — Milestones & Portfolio Extensions
-- Created: 2026-06-01
-- Purpose: Project milestones management and portfolio enhancements

-- Add missing columns to portfolio_items if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='portfolio_items' AND column_name='skills_used'
  ) THEN
    ALTER TABLE portfolio_items ADD COLUMN skills_used TEXT[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='portfolio_items' AND column_name='impact'
  ) THEN
    ALTER TABLE portfolio_items ADD COLUMN impact TEXT;
  END IF;
END $$;

-- Add additional indexes for portfolio_items
CREATE INDEX IF NOT EXISTS idx_portfolio_items_status ON portfolio_items(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_created_at ON portfolio_items(created_at DESC);

-- Milestones Table
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completion_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Milestones Indexes
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_owner_id ON milestones(owner_id);

-- Enable RLS
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies — Milestones
DROP POLICY IF EXISTS "milestones_all" ON milestones;
CREATE POLICY "milestones_all" ON milestones
  FOR ALL USING (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_milestones_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS milestones_update_timestamp ON milestones;
CREATE TRIGGER milestones_update_timestamp
BEFORE UPDATE ON milestones
FOR EACH ROW
EXECUTE FUNCTION update_milestones_timestamp();
