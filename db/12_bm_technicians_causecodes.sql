-- 12_bm_technicians_causecodes.sql
-- BM 모듈 강화 — technicians + cause_codes 마스터 테이블 신규 생성
-- 실행 전제: 04_bm_module_v2.sql, 11_bm_missing_columns.sql 완료
-- 실행 위치: Supabase SQL Editor (service_role)
-- 작성: 2026-05-19

-- ═══════════════════════════════════════════════════════
-- 1. TECHNICIANS 테이블
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS technicians (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  name_ta      text,                              -- Tamil 이름 (현장 표시용)
  employee_no  text UNIQUE,                       -- 사원번호
  team         text NOT NULL DEFAULT 'general'
    CHECK (team IN ('mechanical', 'electrical', 'general', 'welding')),
  phone        text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technicians_team_idx   ON technicians(team);
CREATE INDEX IF NOT EXISTS technicians_active_idx ON technicians(is_active);

ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_technicians" ON technicians;
CREATE POLICY "auth_all_technicians" ON technicians
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 비인증 사용자는 읽기만 허용 (신고 폼에서 목록 로드용)
DROP POLICY IF EXISTS "anon_read_technicians" ON technicians;
CREATE POLICY "anon_read_technicians" ON technicians
  FOR SELECT TO anon USING (is_active = true);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS technicians_updated_at ON technicians;
CREATE TRIGGER technicians_updated_at
  BEFORE UPDATE ON technicians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Seed 데이터 (DSC Mannur 보전팀 기본 5명) ────────────────────
-- 주의: SARAVANARAJ는 기존 resolver_name으로 353건에 등록된 실 인원
-- 나머지 4명은 현장 확인 후 수정 필요
INSERT INTO technicians (name, name_ta, employee_no, team) VALUES
  ('SARAVANARAJ', 'சரவணராஜ்',  'TECH-001', 'mechanical'),
  ('MURUGAN',     'முருகன்',     'TECH-002', 'welding'),
  ('KUMAR',       'குமார்',       'TECH-003', 'electrical'),
  ('RAJENDRAN',   'ராஜேந்திரன்', 'TECH-004', 'mechanical'),
  ('SENTHIL',     'செந்தில்',    'TECH-005', 'general')
ON CONFLICT (employee_no) DO UPDATE SET
  name = EXCLUDED.name,
  name_ta = EXCLUDED.name_ta,
  team = EXCLUDED.team;

-- ═══════════════════════════════════════════════════════
-- 2. CAUSE_CODES 테이블
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cause_codes (
  code        text PRIMARY KEY,
  category    text NOT NULL
    CHECK (category IN ('mechanical', 'electrical', 'tooling', 'operator', 'material', 'unknown')),
  label_en    text NOT NULL,
  label_ko    text NOT NULL,
  label_ta    text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0
);

ALTER TABLE cause_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all_cause_codes" ON cause_codes;
CREATE POLICY "read_all_cause_codes" ON cause_codes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_write_cause_codes" ON cause_codes;
CREATE POLICY "auth_write_cause_codes" ON cause_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Seed 데이터 (19개 코드 — DSC Mannur 현장 고장 패턴 기반) ───
INSERT INTO cause_codes (code, category, label_en, label_ko, sort_order) VALUES
  -- 기계
  ('MECH-WEAR',   'mechanical', 'Component Wear',            '부품 마모',       10),
  ('MECH-BREAK',  'mechanical', 'Mechanical Breakage',       '기계적 파손',     11),
  ('MECH-LOOSE',  'mechanical', 'Loose Fastener/Coupling',   '체결부 이완',     12),
  ('MECH-ALIGN',  'mechanical', 'Misalignment',              '축 정렬 불량',    13),
  ('MECH-LUB',    'mechanical', 'Lubrication Failure',       '윤활 불량',       14),
  ('MECH-AIR',    'mechanical', 'Air/Pneumatic Failure',     '에어 압력 이상',  15),
  -- 전기
  ('ELEC-SENSOR', 'electrical', 'Sensor Fault',              '센서 불량',       20),
  ('ELEC-CABLE',  'electrical', 'Cable/Connector Fault',     '케이블/커넥터',   21),
  ('ELEC-CTRL',   'electrical', 'Controller/PLC Fault',      '제어기/PLC 불량', 22),
  ('ELEC-MOTOR',  'electrical', 'Motor/Drive Fault',         '모터/드라이브',   23),
  ('ELEC-POWER',  'electrical', 'Power Supply Issue',        '전원 이상',       24),
  -- 공구/지그
  ('TOOL-WEAR',   'tooling',    'Tool/Torch Wear',           '공구/토치 마모',  30),
  ('TOOL-SETUP',  'tooling',    'Setup/Adjustment Error',    '설정/조정 불량',  31),
  ('TOOL-DAMAGE', 'tooling',    'Tool Damage',               '공구 손상',       32),
  -- 작업자
  ('OPR-SETTING', 'operator',   'Wrong Setting',             '설정 오류',       40),
  ('OPR-MISUSE',  'operator',   'Improper Operation',        '취급 불량',       41),
  -- 자재
  ('MAT-DEFECT',  'material',   'Material Defect',           '자재 불량',       50),
  ('MAT-SPEC',    'material',   'Material Out of Spec',      '자재 규격 이탈',  51),
  -- 기타
  ('UNKN-OTHERS', 'unknown',    'Other / Unknown',           '기타/미상',       99)
ON CONFLICT (code) DO UPDATE SET
  label_en   = EXCLUDED.label_en,
  label_ko   = EXCLUDED.label_ko,
  sort_order = EXCLUDED.sort_order;

-- ═══════════════════════════════════════════════════════
-- 3. bm_events FK 연결
-- ═══════════════════════════════════════════════════════

-- technician_id FK
ALTER TABLE bm_events
  DROP CONSTRAINT IF EXISTS bm_events_technician_id_fkey;
ALTER TABLE bm_events
  ADD CONSTRAINT bm_events_technician_id_fkey
    FOREIGN KEY (technician_id)
    REFERENCES technicians(id)
    ON DELETE SET NULL;

-- cause_code FK
ALTER TABLE bm_events
  DROP CONSTRAINT IF EXISTS bm_events_cause_code_fkey;
ALTER TABLE bm_events
  ADD CONSTRAINT bm_events_cause_code_fkey
    FOREIGN KEY (cause_code)
    REFERENCES cause_codes(code)
    ON DELETE SET NULL;

-- 추가 인덱스 (집계 성능)
CREATE INDEX IF NOT EXISTS bm_events_cause_code_idx   ON bm_events(cause_code);
CREATE INDEX IF NOT EXISTS bm_events_technician_idx   ON bm_events(technician_id);
CREATE INDEX IF NOT EXISTS bm_events_asset_month_idx
  ON bm_events(asset_id, DATE_TRUNC('month', reported_at));

-- 완료 확인
DO $$
BEGIN
  RAISE NOTICE '12_bm_technicians_causecodes.sql 완료';
  RAISE NOTICE 'technicians: % 건', (SELECT COUNT(*) FROM technicians);
  RAISE NOTICE 'cause_codes: % 건', (SELECT COUNT(*) FROM cause_codes);
END$$;
