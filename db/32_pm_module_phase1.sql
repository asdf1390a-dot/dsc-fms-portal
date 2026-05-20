-- PM Module (예방보전) Phase 1: Schema Extension
-- Adds 7 columns to pm_plans, 1 column to pm_schedules, creates pm_work_logs and pm_parts_used tables
-- Timeline: 2026-05-23 (Day 2 of PM Module Phase 1 implementation)

-- ============================================================================
-- PART 1: Add columns to existing pm_plans table
-- ============================================================================

ALTER TABLE pm_plans
ADD COLUMN frequency_label TEXT CHECK (frequency_label IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual')),
ADD COLUMN category TEXT CHECK (category IN ('lubrication', 'inspection', 'calibration', 'cleaning', 'general')),
ADD COLUMN checklist JSONB DEFAULT '[]'::jsonb,
ADD COLUMN created_by UUID REFERENCES auth.users(id),
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Create trigger for auto-update of updated_at
CREATE TRIGGER pm_plans_updated_at
BEFORE UPDATE ON pm_plans
FOR EACH ROW
EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================================================
-- PART 2: Add column to existing pm_schedules table
-- ============================================================================

ALTER TABLE pm_schedules
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Create trigger for auto-update of updated_at
CREATE TRIGGER pm_schedules_updated_at
BEFORE UPDATE ON pm_schedules
FOR EACH ROW
EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================================================
-- PART 3: Create pm_work_logs table
-- ============================================================================

CREATE TABLE pm_work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES pm_schedules(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  checked_list JSONB DEFAULT '[]'::jsonb,
  work_notes TEXT,
  photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  performed_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for schedule_id lookup
CREATE INDEX idx_pm_work_logs_schedule_id ON pm_work_logs(schedule_id);
CREATE INDEX idx_pm_work_logs_performed_by ON pm_work_logs(performed_by);
CREATE INDEX idx_pm_work_logs_created_at ON pm_work_logs(created_at DESC);

-- Create trigger for auto-update of updated_at
CREATE TRIGGER pm_work_logs_updated_at
BEFORE UPDATE ON pm_work_logs
FOR EACH ROW
EXECUTE FUNCTION moddatetime(updated_at);

-- Enable RLS on pm_work_logs
ALTER TABLE pm_work_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view work logs for their own company
CREATE POLICY "Users can view pm_work_logs for their company"
ON pm_work_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'company' = (
      SELECT raw_user_meta_data->>'company' FROM auth.users WHERE id = performed_by
    )
  )
);

-- RLS Policy: Users can insert pm_work_logs for their own company
CREATE POLICY "Users can insert pm_work_logs for their company"
ON pm_work_logs FOR INSERT
WITH CHECK (
  performed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
  )
);

-- ============================================================================
-- PART 4: Create pm_parts_used table
-- ============================================================================

CREATE TABLE pm_parts_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_log_id UUID NOT NULL REFERENCES pm_work_logs(id) ON DELETE CASCADE,
  spare_part_id UUID NOT NULL REFERENCES spare_parts(id),
  quantity_used INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for work_log_id lookup
CREATE INDEX idx_pm_parts_used_work_log_id ON pm_parts_used(work_log_id);
CREATE INDEX idx_pm_parts_used_spare_part_id ON pm_parts_used(spare_part_id);

-- Create trigger for auto-update of updated_at
CREATE TRIGGER pm_parts_used_updated_at
BEFORE UPDATE ON pm_parts_used
FOR EACH ROW
EXECUTE FUNCTION moddatetime(updated_at);

-- Enable RLS on pm_parts_used
ALTER TABLE pm_parts_used ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view pm_parts_used for their company's work logs
CREATE POLICY "Users can view pm_parts_used for their company"
ON pm_parts_used FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM pm_work_logs
    WHERE pm_work_logs.id = work_log_id
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'company' = (
        SELECT raw_user_meta_data->>'company' FROM auth.users WHERE id = pm_work_logs.performed_by
      )
    )
  )
);

-- RLS Policy: Users can insert pm_parts_used for their own company's work logs
CREATE POLICY "Users can insert pm_parts_used for their company"
ON pm_parts_used FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pm_work_logs
    WHERE pm_work_logs.id = work_log_id
    AND pm_work_logs.performed_by = auth.uid()
  )
);

-- ============================================================================
-- PART 5: Verify migration success
-- ============================================================================

-- Post-migration validation queries (run these to verify successful execution):
-- SELECT COUNT(*) FROM pm_plans WHERE frequency_label IS NULL; -- Should return 0 or count of existing records
-- SELECT COUNT(*) FROM pm_schedules WHERE updated_at IS NULL; -- Should return 0
-- SELECT COUNT(*) FROM pm_work_logs; -- Should return 0 (empty initially)
-- SELECT COUNT(*) FROM pm_parts_used; -- Should return 0 (empty initially)
