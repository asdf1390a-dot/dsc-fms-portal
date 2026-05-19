-- Create checkpoint_logs table for daily checkpoint tracking
-- This table tracks all daily checkpoint executions (08:00, 09:00, 12:00, 14:00, 15:00, 18:00 KST)

CREATE TABLE IF NOT EXISTS public.checkpoint_logs (
  id BIGSERIAL PRIMARY KEY,

  -- Timing information
  date DATE NOT NULL,
  scheduled_time VARCHAR(5) NOT NULL, -- HH:MM format (e.g., "08:00")
  actual_time VARCHAR(5) NOT NULL,    -- HH:MM format (e.g., "08:03")
  status VARCHAR(20) NOT NULL,        -- 'completed', 'delayed', 'missed'
  delay_minutes INTEGER DEFAULT 0,    -- minutes late (0 if on-time)

  -- Metadata
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,

  -- Indexing for fast queries
  CONSTRAINT checkpoint_logs_status_check
    CHECK (status IN ('completed', 'delayed', 'missed'))
);

-- Create indexes for performance
CREATE INDEX idx_checkpoint_logs_date ON public.checkpoint_logs(date);
CREATE INDEX idx_checkpoint_logs_status ON public.checkpoint_logs(status);
CREATE INDEX idx_checkpoint_logs_scheduled_time ON public.checkpoint_logs(scheduled_time);
CREATE INDEX idx_checkpoint_logs_timestamp ON public.checkpoint_logs(timestamp DESC);

-- Daily reliability view
CREATE OR REPLACE VIEW public.checkpoint_daily_reliability AS
SELECT
  date,
  COUNT(*) as total_checkpoints,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed_count,
  SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed_count,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as reliability_percent
FROM public.checkpoint_logs
GROUP BY date
ORDER BY date DESC;

-- Monthly reliability view
CREATE OR REPLACE VIEW public.checkpoint_monthly_reliability AS
SELECT
  DATE_TRUNC('month', date)::DATE as month,
  COUNT(*) as total_checkpoints,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed_count,
  SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed_count,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as reliability_percent
FROM public.checkpoint_logs
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC;

-- Enable RLS
ALTER TABLE public.checkpoint_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow service role to insert/read (for automation)
CREATE POLICY checkpoint_logs_service_role_all ON public.checkpoint_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policy: Allow authenticated users to read
CREATE POLICY checkpoint_logs_authenticated_read ON public.checkpoint_logs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT SELECT, INSERT ON public.checkpoint_logs TO anon, authenticated, service_role;
GRANT SELECT ON public.checkpoint_daily_reliability TO anon, authenticated;
GRANT SELECT ON public.checkpoint_monthly_reliability TO anon, authenticated;
