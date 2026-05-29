-- 33_bm_phase1_technicians_team_extend.sql
-- BM Phase 1 — technicians.team CHECK 제약에 'welding' 추가 + employee_no 백필
-- 배경:
--   • 09_technicians.sql (배포됨) 는 employee_id 기반, team 컬럼 없음
--   • 12_bm_technicians_causecodes.sql 는 employee_no + team CHECK ('mechanical','electrical','general','welding')
--   • 14_technicians_team_migration.sql 는 team 컬럼만 추가 (CHECK 'mechanical','electrical','general')
--   → 'welding' 누락 + 12의 시드 INSERT 가 컬럼 미스매치로 실패할 가능성
-- 실행 전제: 09 + 14 완료 후 실행 가능. 멱등성 보장.
-- 작성: 2026-05-22 (BM-P1 DAY1)

-- ═══════════════════════════════════════════════════════
-- 1. CHECK 제약 재정의 ('welding' 포함)
-- ═══════════════════════════════════════════════════════
ALTER TABLE technicians
  DROP CONSTRAINT IF EXISTS technicians_team_check;

ALTER TABLE technicians
  ADD CONSTRAINT technicians_team_check
    CHECK (team IN ('mechanical', 'electrical', 'general', 'welding'));

-- ═══════════════════════════════════════════════════════
-- 2. employee_no 컬럼 (UNIQUE) — 09 스키마에 누락된 경우 추가
--    09_technicians.sql 의 employee_id 와는 별개의 인덱싱 컬럼
-- ═══════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'technicians' AND column_name = 'employee_no'
  ) THEN
    ALTER TABLE technicians ADD COLUMN employee_no TEXT;
    -- 기존 employee_id 가 있으면 그대로 동기화 (없는 컬럼이면 noop)
    BEGIN
      EXECUTE 'UPDATE technicians SET employee_no = employee_id WHERE employee_no IS NULL';
    EXCEPTION WHEN undefined_column THEN
      RAISE NOTICE 'employee_id 컬럼 없음 — employee_no 백필 스킵';
    END;
    -- UNIQUE 제약 (NULL 다중 허용)
    BEGIN
      ALTER TABLE technicians ADD CONSTRAINT technicians_employee_no_key UNIQUE (employee_no);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END$$;

-- ═══════════════════════════════════════════════════════
-- 3. name_ta 컬럼 (TechnicianSelect 표시용) — 없으면 추가
-- ═══════════════════════════════════════════════════════
ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS name_ta TEXT;

-- ═══════════════════════════════════════════════════════
-- 4. is_active 컬럼 — 없으면 추가
-- ═══════════════════════════════════════════════════════
ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS technicians_active_idx ON technicians(is_active);

-- ═══════════════════════════════════════════════════════
-- 5. anon read 정책 (TechnicianSelect 가 anon으로도 로드 가능하게)
-- ═══════════════════════════════════════════════════════
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_technicians" ON technicians;
CREATE POLICY "anon_read_technicians" ON technicians
  FOR SELECT TO anon USING (is_active = true);

-- ═══════════════════════════════════════════════════════
-- 6. 검증
-- ═══════════════════════════════════════════════════════
DO $$
DECLARE
  v_total integer;
  v_active integer;
  v_teams text;
BEGIN
  SELECT COUNT(*) INTO v_total FROM technicians;
  SELECT COUNT(*) INTO v_active FROM technicians WHERE is_active = true;
  SELECT string_agg(DISTINCT team, ', ' ORDER BY team) INTO v_teams FROM technicians;

  RAISE NOTICE '=== 33_bm_phase1_technicians_team_extend 완료 ===';
  RAISE NOTICE 'technicians 전체: %건 / active: %건', v_total, v_active;
  RAISE NOTICE 'teams 분포: %', v_teams;
END$$;
