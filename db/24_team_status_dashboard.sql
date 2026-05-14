-- Team Status Dashboard Migration
-- Created: 2026-05-14
-- Purpose: Enable team status tracking, blocking reason logging, and activity timeline

-- ============================================================================
-- 1. team_members 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  department VARCHAR(50),
  role VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_department CHECK (
    department IN ('생산', '기술', '보전', '생산관리', NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_team_members_department ON team_members(department);
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON team_members(is_active);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

-- ============================================================================
-- 2. team_status_updates 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  reason VARCHAR(500),
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (
    new_status IN ('진행중', '대기', '완료', '유휴')
  )
);

CREATE INDEX IF NOT EXISTS idx_team_status_updates_member_id
  ON team_status_updates(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_status_updates_created_at
  ON team_status_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_status_updates_new_status
  ON team_status_updates(new_status);
CREATE INDEX IF NOT EXISTS idx_team_status_updates_member_created
  ON team_status_updates(team_member_id, created_at DESC);

-- ============================================================================
-- 3. team_blocking_reasons 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_blocking_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  blocking_reason VARCHAR(255) NOT NULL,
  required_info VARCHAR(500),
  blocked_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_blocking_reasons_member_id
  ON team_blocking_reasons(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_blocking_reasons_resolved_at
  ON team_blocking_reasons(resolved_at);
CREATE INDEX IF NOT EXISTS idx_team_blocking_reasons_active
  ON team_blocking_reasons(team_member_id)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_blocking_reasons_blocked_since
  ON team_blocking_reasons(blocked_since DESC);

-- ============================================================================
-- 4. team_task_assignments 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  task_name VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expected_completion_at TIMESTAMP WITH TIME ZONE,
  actual_completion_at TIMESTAMP WITH TIME ZONE,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) NOT NULL DEFAULT '진행중',
  assigned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_priority CHECK (priority IN ('낮음', '보통', '높음')),
  CONSTRAINT valid_task_status CHECK (status IN ('진행중', '완료'))
);

CREATE INDEX IF NOT EXISTS idx_team_task_assignments_member_id
  ON team_task_assignments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_task_assignments_status
  ON team_task_assignments(status);
CREATE INDEX IF NOT EXISTS idx_team_task_assignments_expected_completion_at
  ON team_task_assignments(expected_completion_at);
CREATE INDEX IF NOT EXISTS idx_team_task_assignments_member_status
  ON team_task_assignments(team_member_id, status);
CREATE INDEX IF NOT EXISTS idx_team_task_assignments_in_progress
  ON team_task_assignments(team_member_id)
  WHERE status = '진행중';

-- ============================================================================
-- 5. team_metrics 테이블 (선택사항)
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE DEFAULT CURRENT_DATE,
  total_members INT,
  active_members INT,
  members_in_progress INT,
  members_waiting INT,
  members_completed INT,
  members_idle INT,
  total_blocking_count INT,
  avg_completion_time_hours NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(metric_date)
);

CREATE INDEX IF NOT EXISTS idx_team_metrics_metric_date
  ON team_metrics(metric_date DESC);

-- ============================================================================
-- 6. Row Level Security (RLS) 정책
-- ============================================================================

-- team_members RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 모든 활성 팀원 조회 가능
CREATE POLICY "Select active team members"
  ON team_members FOR SELECT
  USING (is_active = true);

-- 자신의 정보만 업데이트 가능
CREATE POLICY "Update own team member info"
  ON team_members FOR UPDATE
  USING (auth.uid() = id);

-- team_status_updates RLS
ALTER TABLE team_status_updates ENABLE ROW LEVEL SECURITY;

-- 모든 팀원은 상태 업데이트 로그 조회 가능
CREATE POLICY "View all status updates"
  ON team_status_updates FOR SELECT
  USING (true);

-- 자신의 상태만 업데이트 가능
CREATE POLICY "Insert own status updates"
  ON team_status_updates FOR INSERT
  WITH CHECK (auth.uid() = team_member_id);

-- team_blocking_reasons RLS
ALTER TABLE team_blocking_reasons ENABLE ROW LEVEL SECURITY;

-- 모든 팀원은 블로킹 사유 조회 가능
CREATE POLICY "View all blocking reasons"
  ON team_blocking_reasons FOR SELECT
  USING (true);

-- 자신의 블로킹만 생성 가능
CREATE POLICY "Insert own blocking reasons"
  ON team_blocking_reasons FOR INSERT
  WITH CHECK (auth.uid() = team_member_id);

-- 관리자만 해결 마크 가능 (나중에 role 기반으로 변경 가능)
CREATE POLICY "Resolve blocking reasons"
  ON team_blocking_reasons FOR UPDATE
  USING (true);

-- team_task_assignments RLS
ALTER TABLE team_task_assignments ENABLE ROW LEVEL SECURITY;

-- 모든 팀원은 작업 할당 조회 가능
CREATE POLICY "View all task assignments"
  ON team_task_assignments FOR SELECT
  USING (true);

-- 할당받은 팀원만 자신의 작업 상태 업데이트 가능
CREATE POLICY "Update own task assignments"
  ON team_task_assignments FOR UPDATE
  USING (auth.uid() = team_member_id);

-- 관리자는 작업 할당 가능
CREATE POLICY "Insert task assignments"
  ON team_task_assignments FOR INSERT
  WITH CHECK (true);

-- team_metrics RLS
ALTER TABLE team_metrics ENABLE ROW LEVEL SECURITY;

-- 모든 팀원은 메트릭 조회 가능
CREATE POLICY "View team metrics"
  ON team_metrics FOR SELECT
  USING (true);

-- ============================================================================
-- 7. 함수 및 트리거
-- ============================================================================

-- 팀원 정보 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_members_updated_at_trigger
BEFORE UPDATE ON team_members
FOR EACH ROW
EXECUTE FUNCTION update_team_members_updated_at();

-- 블로킹 정보 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_team_blocking_reasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_blocking_reasons_updated_at_trigger
BEFORE UPDATE ON team_blocking_reasons
FOR EACH ROW
EXECUTE FUNCTION update_team_blocking_reasons_updated_at();

-- 작업 할당 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_team_task_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_task_assignments_updated_at_trigger
BEFORE UPDATE ON team_task_assignments
FOR EACH ROW
EXECUTE FUNCTION update_team_task_assignments_updated_at();

-- ============================================================================
-- 8. 초기 데이터 (선택사항 - 테스트용)
-- ============================================================================

-- 팀원 추가 (실제 환경에서는 API를 통해 추가)
INSERT INTO team_members (name, email, department, role, is_active)
VALUES
  ('김철수', 'kim.chulsu@dsc.com', '생산', '엔지니어', TRUE),
  ('이영희', 'lee.younghee@dsc.com', '기술', '분석가', TRUE),
  ('박준호', 'park.junho@dsc.com', '보전', '기술자', TRUE),
  ('최민지', 'choi.minji@dsc.com', '생산관리', '플레너', TRUE),
  ('정수진', 'jung.sujin@dsc.com', '생산', '엔지니어', TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 9. 권한 및 접근 제어
-- ============================================================================

-- 읽기 권한 (모든 인증된 사용자)
GRANT SELECT ON team_members TO authenticated;
GRANT SELECT ON team_status_updates TO authenticated;
GRANT SELECT ON team_blocking_reasons TO authenticated;
GRANT SELECT ON team_task_assignments TO authenticated;
GRANT SELECT ON team_metrics TO authenticated;

-- 쓰기 권한 (필요에 따라 API를 통해 제어)
GRANT INSERT, UPDATE ON team_status_updates TO authenticated;
GRANT INSERT, UPDATE ON team_blocking_reasons TO authenticated;
GRANT INSERT, UPDATE ON team_task_assignments TO authenticated;

-- ============================================================================
-- 10. 실시간 구독 설정 (Supabase Realtime)
-- ============================================================================

-- team_status_updates를 Realtime으로 구독
ALTER TABLE team_status_updates REPLICA IDENTITY FULL;

-- team_blocking_reasons를 Realtime으로 구독
ALTER TABLE team_blocking_reasons REPLICA IDENTITY FULL;

-- team_task_assignments를 Realtime으로 구독
ALTER TABLE team_task_assignments REPLICA IDENTITY FULL;

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================
-- 다음 단계:
-- 1. web-builder가 API 라우트 구현
-- 2. evaluator가 기능 검증
-- 3. 필요시 스키마 조정
