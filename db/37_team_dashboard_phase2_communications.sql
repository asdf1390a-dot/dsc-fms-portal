-- Team Dashboard Phase 2 — Communications & Performance Metrics
-- Created: 2026-06-01
-- Purpose: Team communication threads/messages tracking + performance metrics

-- ============================================================================
-- 1. team_performance_metrics 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  tasks_completed INT DEFAULT 0,
  tasks_in_progress INT DEFAULT 0,
  blocking_hours INT DEFAULT 0,
  utilization_percentage INT DEFAULT 0,
  quality_score NUMERIC(3, 2),
  efficiency_score NUMERIC(3, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(member_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_team_performance_metrics_member_id
  ON team_performance_metrics(member_id);
CREATE INDEX IF NOT EXISTS idx_team_performance_metrics_week_start
  ON team_performance_metrics(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_team_performance_metrics_member_week
  ON team_performance_metrics(member_id, week_start DESC);

-- ============================================================================
-- 2. team_resource_allocations 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_resource_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  project_id VARCHAR(100),
  allocated_hours INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  allocation_percentage INT DEFAULT 100,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_resource_allocations_member_id
  ON team_resource_allocations(member_id);
CREATE INDEX IF NOT EXISTS idx_team_resource_allocations_start_date
  ON team_resource_allocations(start_date);
CREATE INDEX IF NOT EXISTS idx_team_resource_allocations_end_date
  ON team_resource_allocations(end_date);
CREATE INDEX IF NOT EXISTS idx_team_resource_allocations_status
  ON team_resource_allocations(status);
CREATE INDEX IF NOT EXISTS idx_team_resource_allocations_member_date
  ON team_resource_allocations(member_id, start_date, end_date);

-- ============================================================================
-- 3. team_message_threads 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('slack', 'discord', 'telegram')),
  topic TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(channel, topic)
);

CREATE INDEX IF NOT EXISTS idx_team_message_threads_channel
  ON team_message_threads(channel);
CREATE INDEX IF NOT EXISTS idx_team_message_threads_created_at
  ON team_message_threads(created_at DESC);

-- ============================================================================
-- 4. team_messages 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES team_message_threads(id) ON DELETE CASCADE,
  member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('slack', 'discord', 'telegram')),
  message_content TEXT NOT NULL,
  message_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  external_message_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_messages_thread_id
  ON team_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_member_id
  ON team_messages(member_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_channel
  ON team_messages(channel);
CREATE INDEX IF NOT EXISTS idx_team_messages_message_timestamp
  ON team_messages(message_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_thread_timestamp
  ON team_messages(thread_id, message_timestamp DESC);

-- ============================================================================
-- 5. Row Level Security (RLS) 정책
-- ============================================================================

-- team_performance_metrics RLS
ALTER TABLE team_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View all performance metrics"
  ON team_performance_metrics FOR SELECT
  USING (true);

CREATE POLICY "Insert performance metrics"
  ON team_performance_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Update performance metrics"
  ON team_performance_metrics FOR UPDATE
  USING (true);

-- team_resource_allocations RLS
ALTER TABLE team_resource_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View all resource allocations"
  ON team_resource_allocations FOR SELECT
  USING (true);

CREATE POLICY "Insert resource allocations"
  ON team_resource_allocations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Update resource allocations"
  ON team_resource_allocations FOR UPDATE
  USING (true);

-- team_message_threads RLS
ALTER TABLE team_message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View all message threads"
  ON team_message_threads FOR SELECT
  USING (true);

CREATE POLICY "Insert message threads"
  ON team_message_threads FOR INSERT
  WITH CHECK (true);

-- team_messages RLS
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View all messages"
  ON team_messages FOR SELECT
  USING (true);

CREATE POLICY "Insert messages"
  ON team_messages FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 6. 함수 및 트리거
-- ============================================================================

-- team_performance_metrics updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_team_performance_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_performance_metrics_updated_at_trigger
BEFORE UPDATE ON team_performance_metrics
FOR EACH ROW
EXECUTE FUNCTION update_team_performance_metrics_updated_at();

-- team_resource_allocations updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_team_resource_allocations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_resource_allocations_updated_at_trigger
BEFORE UPDATE ON team_resource_allocations
FOR EACH ROW
EXECUTE FUNCTION update_team_resource_allocations_updated_at();

-- team_message_threads updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_team_message_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_message_threads_updated_at_trigger
BEFORE UPDATE ON team_message_threads
FOR EACH ROW
EXECUTE FUNCTION update_team_message_threads_updated_at();

-- team_messages updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_team_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_messages_updated_at_trigger
BEFORE UPDATE ON team_messages
FOR EACH ROW
EXECUTE FUNCTION update_team_messages_updated_at();

-- ============================================================================
-- 7. 권한 설정
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON team_performance_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON team_resource_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON team_message_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON team_messages TO authenticated;

-- ============================================================================
-- 8. Realtime 구독 설정
-- ============================================================================

ALTER TABLE team_performance_metrics REPLICA IDENTITY FULL;
ALTER TABLE team_resource_allocations REPLICA IDENTITY FULL;
ALTER TABLE team_message_threads REPLICA IDENTITY FULL;
ALTER TABLE team_messages REPLICA IDENTITY FULL;
