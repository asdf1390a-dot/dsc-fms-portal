-- db/45: Add active column to team_members for resource filtering

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Update any NULL values to true
UPDATE team_members SET active = true WHERE active IS NULL;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(active);
