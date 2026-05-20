-- BM Phase 1: Add 'team' column to technicians table for TechnicianSelect grouping
-- Resolves schema collision between 09_technicians.sql (deployed) and 12_bm_technicians_causecodes.sql (pending)
-- Timeline: 2026-05-20 17:45~18:45 KST (pre-work before BM-P1 Web-Builder implementation)

-- Add 'team' column to existing technicians table
ALTER TABLE technicians
ADD COLUMN team TEXT DEFAULT 'general' NOT NULL;

-- Map existing role + department to standardized team categories
UPDATE technicians
SET team = CASE
  WHEN role = 'Mechanical Technician' OR department = 'Mechanical' THEN 'mechanical'
  WHEN role = 'Electrical Technician' OR department = 'Electrical' THEN 'electrical'
  ELSE 'general'
END;

-- Create index for TechnicianSelect grouping queries
CREATE INDEX idx_technicians_team ON technicians(team);

-- Add check constraint
ALTER TABLE technicians
ADD CONSTRAINT technicians_team_check
CHECK (team IN ('mechanical', 'electrical', 'general'));

-- Add description comment
COMMENT ON COLUMN technicians.team IS 'Team category for TechnicianSelect grouping (mechanical/electrical/general)';
