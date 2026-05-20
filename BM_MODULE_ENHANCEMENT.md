# BM Module Enhancement — 상세 설계 문서
**대상:** DSC FMS Portal — Breakdown Management (BM) 강화  
**작성:** 2026-05-19  
**완료 목표:** 2026-05-30  
**데이터 기준:** bm_events 353건 (2025-01 ~ 2026-04), Supabase live DB

---

## 1. 현황 분석 — DB/코드 갭 진단

### 1-1. bm_events 실 데이터 품질 (353건 기준)

| 항목 | 현재값 | 목표값 | 갭 |
|------|--------|--------|-----|
| status 분포 | resolved 100% | open/in_progress 포함 | 신규 입력 플로우 개선 필요 |
| severity 분포 | normal 100% | 4단계 활용 | 신고 폼 단계별 선택 강제 필요 |
| priority 분포 | medium 100% | 4단계 활용 | 동일 |
| resolved_at 입력률 | 0% (0/353) | 100% | resolve API에서 자동 기록 필요 |
| cause_code 입력률 | 0% (0/353) | 80%+ | 코드 마스터 없음 — 신규 생성 필요 |
| technician_id 입력률 | 0% (0/353) | 80%+ | technicians 테이블 없음 — 신규 생성 필요 |
| parts_used 입력률 | 0% (0/353) | 30%+ | 부품 마스터 없음 — Phase 2 |
| symptom_ta 입력률 | 0% (0/353) | 현장 입력분부터 | 신고 폼 연결 필요 |
| downtime_minutes 정합률 | 64% 정합 (126건 불일치) | 95%+ | 수동 입력값 vs 계산값 불일치 — 재계산 마이그레이션 필요 |

**헤드라인:** 353건 전체가 resolved임에도 resolved_at = NULL — MTTR 계산이 현재 downtime_start/end 기반으로 우회 중. resolved_at 소급 입력 또는 downtime_end를 resolved_at으로 사용하는 정책 명확화 필요.

### 1-2. 월별 고장 현황 (2025-01 ~ 2026-04)

| 월 | 건수 | 총 다운타임(h) | 가동 설비 수 |
|----|------|---------------|-------------|
| 2025-01 | 6 | 10.2 | 6 |
| 2026-01 | 97 | 70.6 | 67 |
| 2026-02 | 108 | 66.8 | 72 |
| 2026-03 | 141 | 105.7 | 80 |
| 2026-04 | 1 | 0.0 | 1 |

2026-03: 최다 월 141건, 105.7시간 다운타임. 2026-04 급감은 데이터 미입력 가능성 높음.

### 1-3. 최다 고장 설비 Top 10 (전 기간)

| 순위 | 설비코드 | 설비명 | 라인 | 건수 | 총 다운타임(h) | 평균 MTTR(분) |
|------|---------|--------|-----|------|--------------|-------------|
| 1 | 06.001.050 | ASSEMBLY UNIT | AI3 | 16 | 9.0 | 34 |
| 2 | 04.001.050 | ARC WELD ROBOT - FIXED | SU2I | 14 | 7.2 | 31 |
| 3 | 04.001.129 | ARC WELD ROBOT - FIXED | SU2I | 12 | 11.8 | 59 |
| 4 | 04.001.047 | ARC WELD ROBOT - FIXED | SU2I | 10 | 5.1 | 31 |
| 5 | 05.001.005 | PROJECTION WELDING | PROJECTION | 9 | 4.9 | 33 |
| 6 | 04.001.120 | ARC WELD ROBOT - FIXED | AI3 | 8 | 6.7 | 50 |
| 7 | 04.001.128 | ARC WELD ROBOT - FIXED | SU2I | 8 | 4.7 | 35 |
| 8 | 04.001.040 | ARC WELD ROBOT - FIXED | AI3 | 7 | 4.0 | 34 |
| 9 | 04.001.067 | ARC WELD ROBOT - TURN TABLE | AI3 | 7 | 2.9 | 25 |
| 10 | (b7ca1e95) | — | — | 6 | 3.9 | 39 |

ARC WELD ROBOT (04.001.xxx) 계열이 7/10위 — 동일 고장 패턴 원인분석 집중 필요.

### 1-4. 현재 구현 파일 상태 (2026-05-19 기준)

| 파일 | 상태 | 누락/개선 필요 사항 |
|------|------|-------------------|
| pages/bm/index.js | 구현됨 | BMFilterPanel 연결됨, BMKpiSummary 미연결 |
| pages/bm/new.js | 구현됨 | 변경 불필요 |
| pages/bm/[id].js | 구현됨 | resolved_at 자동기록 미연결, TechnicianSelect 미구현 |
| pages/bm/edit/[id].js | 구현됨 | work_hours 필드 없음, cause_code 드롭다운 없음 |
| pages/bm/stats.js | 구현됨 | Top5만 — Top10 확장, MTBF 추가, 원인별 집계 없음 |
| pages/bm/import.js | 구현됨 | 변경 불필요 |
| components/bm/BMStatusBadge.js | 구현됨 | 완료 |
| components/bm/BMFilterPanel.js | 구현됨 | severity 필터 없음 |
| components/bm/BMSeverityBar.js | 미구현 | 신규 생성 필요 |
| components/bm/TechnicianSelect.js | 미구현 | technicians 테이블 의존 |
| components/bm/BMKpiSummary.js | 미구현 | 신규 생성 필요 |
| components/bm/BMCard.js | 미구현 | index.js 인라인 렌더링 리팩토링 |
| pages/api/bm/resolve.js | 구현됨 | work_hours 파라미터 없음 |
| pages/api/bm/analysis.js | 구현됨 | cause_code 집계 없음 |
| pages/api/bm/records.js | 구현됨 | severity 필터 없음 |
| pages/api/bm/record.js | 구현됨 | 상태 확인 필요 |
| db/04_bm_module_v2.sql | 구현됨 | 기반 스키마 |
| db/11_bm_missing_columns.sql | 구현됨 | technicians/cause_codes 테이블 없음 |

---

## 2. DB 스키마 추가 설계 (신규 테이블 + 갭 보정)

### 2-1. 누락 테이블 — technicians

```sql
-- 12_bm_technicians.sql
CREATE TABLE IF NOT EXISTS technicians (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  name_ta      text,
  employee_no  text UNIQUE,
  team         text NOT NULL DEFAULT 'general'
    CHECK (team IN ('mechanical','electrical','general','welding')),
  phone        text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technicians_team_idx ON technicians(team);
CREATE INDEX IF NOT EXISTS technicians_active_idx ON technicians(is_active);

ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_technicians" ON technicians
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed data (DSC Mannur 보전팀 기본 구성)
INSERT INTO technicians (name, name_ta, employee_no, team) VALUES
  ('SARAVANARAJ',  'சரவணராஜ்',   'TECH-001', 'mechanical'),
  ('MURUGAN',      'முருகன்',      'TECH-002', 'welding'),
  ('KUMAR',        'குமார்',        'TECH-003', 'electrical'),
  ('RAJENDRAN',    'ராஜேந்திரன்',  'TECH-004', 'mechanical'),
  ('SENTHIL',      'செந்தில்',     'TECH-005', 'general')
ON CONFLICT (employee_no) DO NOTHING;
```

### 2-2. 누락 테이블 — cause_codes

```sql
-- 12_bm_technicians.sql (계속)
CREATE TABLE IF NOT EXISTS cause_codes (
  code        text PRIMARY KEY,
  category    text NOT NULL
    CHECK (category IN ('mechanical','electrical','tooling','operator','material','unknown')),
  label_en    text NOT NULL,
  label_ko    text NOT NULL,
  label_ta    text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0
);

ALTER TABLE cause_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all_cause_codes" ON cause_codes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_write_cause_codes" ON cause_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed data (DSC Mannur 현장 패턴 기반)
INSERT INTO cause_codes (code, category, label_en, label_ko, sort_order) VALUES
  ('MECH-WEAR',   'mechanical',  'Component Wear',          '부품 마모',       10),
  ('MECH-BREAK',  'mechanical',  'Mechanical Breakage',     '기계적 파손',     11),
  ('MECH-LOOSE',  'mechanical',  'Loose Fastener/Coupling', '체결부 이완',     12),
  ('MECH-ALIGN',  'mechanical',  'Misalignment',            '축 정렬 불량',    13),
  ('MECH-LUB',    'mechanical',  'Lubrication Failure',     '윤활 불량',       14),
  ('MECH-AIR',    'mechanical',  'Air/Pneumatic Failure',   '에어 압력 이상',  15),
  ('ELEC-SENSOR', 'electrical',  'Sensor Fault',            '센서 불량',       20),
  ('ELEC-CABLE',  'electrical',  'Cable/Connector Fault',   '케이블/커넥터',   21),
  ('ELEC-CTRL',   'electrical',  'Controller Fault',        '제어기 불량',     22),
  ('ELEC-MOTOR',  'electrical',  'Motor/Drive Fault',       '모터/드라이브',   23),
  ('ELEC-POWER',  'electrical',  'Power Supply Issue',      '전원 이상',       24),
  ('TOOL-WEAR',   'tooling',     'Tool/Torch Wear',         '공구/토치 마모',  30),
  ('TOOL-SETUP',  'tooling',     'Setup/Adjustment Error',  '설정/조정 불량',  31),
  ('TOOL-DAMAGE', 'tooling',     'Tool Damage',             '공구 손상',       32),
  ('OPR-SETTING', 'operator',    'Wrong Setting',           '설정 오류',       40),
  ('OPR-MISUSE',  'operator',    'Improper Operation',      '취급 불량',       41),
  ('MAT-DEFECT',  'material',    'Material Defect',         '자재 불량',       50),
  ('MAT-SPEC',    'material',    'Material Out of Spec',    '자재 규격 이탈',  51),
  ('UNKN-OTHERS', 'unknown',     'Other / Unknown',         '기타/미상',       99)
ON CONFLICT (code) DO NOTHING;
```

### 2-3. bm_events 컬럼 갭 보정

**현재 live 컬럼 vs 설계 비교:**

| 컬럼 | live DB | 설계 요구 | 조치 |
|------|---------|----------|------|
| action_taken | O | O | 완료 |
| cause | O | O | 완료 |
| symptom | O | O | 완료 |
| symptom_ta | O | O | 완료 |
| reported_by | O | O | 완료 |
| reported_name | reporter_name | reporter_name | 완료 (이름 다름 주의) |
| resolved_by | O | O | 완료 |
| resolver_name | O | O | 완료 |
| technician_id | O | O | 완료 (FK 미연결 상태) |
| photos | O | O | 완료 |
| downtime_minutes | O (수동) | GENERATED | **불일치 — 재계산 마이그레이션 필요** |
| severity | O | O | 완료 |
| parts_used | O (text[]) | 설계 문서에 없음 | 유지 (확장용) |
| work_hours | O | O | 완료 |
| resolved_at | O (null) | 자동 기록 | **resolve API 수정 필요** |
| cause_code | O (null) | FK → cause_codes | **cause_codes 테이블 생성 후 FK 추가** |

### 2-4. 보정 마이그레이션 쿼리

```sql
-- 13_bm_data_fixes.sql
-- 실행 순서: 12_bm_technicians.sql 이후

-- (1) technician_id FK 연결 (테이블 생성 후)
ALTER TABLE bm_events
  DROP CONSTRAINT IF EXISTS bm_events_technician_id_fkey;
ALTER TABLE bm_events
  ADD CONSTRAINT bm_events_technician_id_fkey
    FOREIGN KEY (technician_id) REFERENCES technicians(id)
    ON DELETE SET NULL;

-- (2) cause_code FK 연결 (테이블 생성 후)
ALTER TABLE bm_events
  DROP CONSTRAINT IF EXISTS bm_events_cause_code_fkey;
ALTER TABLE bm_events
  ADD CONSTRAINT bm_events_cause_code_fkey
    FOREIGN KEY (cause_code) REFERENCES cause_codes(code)
    ON DELETE SET NULL;

-- (3) resolved_at 소급 입력 — downtime_end가 있는 resolved 건
UPDATE bm_events
SET resolved_at = downtime_end
WHERE status = 'resolved'
  AND resolved_at IS NULL
  AND downtime_end IS NOT NULL;

-- 영향: 353건 전체 (downtime_end 전부 존재)

-- (4) downtime_minutes 재계산 (downtime_start/end 기반)
-- 주의: downtime_minutes는 현재 일반 integer 컬럼 (GENERATED 아님)
-- 126건 불일치 존재 — downtime_end - downtime_start 기준으로 정정
UPDATE bm_events
SET downtime_minutes = EXTRACT(EPOCH FROM (downtime_end - downtime_start))::integer / 60
WHERE downtime_start IS NOT NULL
  AND downtime_end IS NOT NULL
  AND downtime_end > downtime_start;

-- (5) downtime_end < downtime_start 이상 데이터 처리 (음수 케이스)
-- 현장 입력 오류 — downtime_minutes를 work_hours * 60 으로 대체
UPDATE bm_events
SET downtime_minutes = ROUND(work_hours * 60)::integer
WHERE downtime_start IS NOT NULL
  AND downtime_end IS NOT NULL
  AND downtime_end <= downtime_start
  AND work_hours IS NOT NULL;

-- (6) bm_kpi 뷰 재생성 — resolved_at 기반 MTTR로 전환
DROP VIEW IF EXISTS bm_kpi;
CREATE OR REPLACE VIEW bm_kpi AS
SELECT
  e.asset_id,
  a.machine_asset_number,
  a.name_en,
  DATE_TRUNC('month', e.reported_at) AS month,
  COUNT(*)                            AS breakdown_count,
  ROUND(AVG(e.downtime_minutes)::numeric, 1)  AS mttr_min,
  -- MTBF: (기간 내 가동시간) / (고장건수-1), 단순화 버전
  ROUND(
    CASE WHEN COUNT(*) > 1
    THEN (
      EXTRACT(EPOCH FROM (MAX(e.reported_at) - MIN(e.reported_at))) / 60.0
      / NULLIF(COUNT(*) - 1, 0)
    )
    ELSE EXTRACT(EPOCH FROM (
      DATE_TRUNC('month', e.reported_at) + INTERVAL '1 month' - MIN(e.reported_at)
    )) / 60.0
    END
  ::numeric, 1) AS mtbf_min,
  SUM(e.downtime_minutes)             AS total_downtime_min,
  ROUND(AVG(e.work_hours)::numeric, 2) AS avg_work_hours
FROM bm_events e
JOIN assets a ON a.id = e.asset_id
WHERE e.status = 'resolved'
  AND e.downtime_minutes IS NOT NULL
GROUP BY e.asset_id, a.machine_asset_number, a.name_en, DATE_TRUNC('month', e.reported_at);

-- (7) 추가 인덱스 (bm_kpi 집계 성능)
CREATE INDEX IF NOT EXISTS bm_events_asset_month_idx
  ON bm_events(asset_id, DATE_TRUNC('month', reported_at));
CREATE INDEX IF NOT EXISTS bm_events_cause_code_idx ON bm_events(cause_code);
CREATE INDEX IF NOT EXISTS bm_events_technician_idx ON bm_events(technician_id);
```

---

## 3. 신규/수정 페이지 설계

### 3-1. pages/bm/edit/[id].js — 수정 필요 사항

현재 구현 완료 상태. 다음 항목만 추가 필요:

**추가 필드 (현재 누락):**
```
[현재 없음] work_hours — number input (0.5 단위 step)
[현재 없음] cause_code — SELECT from cause_codes table (grouped by category)
[현재 없음] technician_id — SELECT from technicians table (grouped by team)
[현재 없음] priority — 4버튼 선택 (low/medium/high/critical)
```

**Props 변경 없음** — 모든 필드는 기존 form state에 추가.

**수정 섹션 위치:**
- cause_code: cause textarea 상단에 드롭다운 추가
- technician_id: resolver_name 입력 위에 TechnicianSelect 컴포넌트 삽입
- work_hours: downtime_end 아래 추가
- priority: severity 버튼 바로 아래 추가

**Validation 추가:**
```javascript
// work_hours: 0~24 범위
if (workHours !== '' && (parseFloat(workHours) < 0 || parseFloat(workHours) > 24)) {
  setError('작업시간은 0~24 사이여야 합니다');
  return;
}
```

### 3-2. pages/bm/stats.js — 수정 필요 사항

현재: Top5 설비, 기간별 KPI 카드 4개 구현됨.

**추가 섹션 (6개 추가):**

**섹션 A: 월별 트렌드 테이블** (12개월)
```
| 월 | 건수 | 총 다운타임(h) | 해결율(%) | 평균 MTTR(분) |
```
데이터 소스: bm_events groupBy month, 최신 12개월

**섹션 B: 원인 분류별 집계 테이블**
```
| cause_code | 카테고리 | 설명 | 건수 | 비율(%) | 평균 MTTR(분) |
```
데이터 소스: bm_events groupBy cause_code, JOIN cause_codes

**섹션 C: 담당 기술자별 처리 현황**
```
| 기술자명 | 처리건수 | 평균 MTTR(분) | 평균 작업시간(h) |
```
데이터 소스: bm_events groupBy resolver_name (technician_id가 채워지기 전 임시)

**섹션 D: 설비 Top10 (기존 Top5 확장)**
```
| 순위 | 설비코드 | 설비명 | 라인 | 건수 | 총 다운타임(h) | 평균 MTTR(분) | MTBF(h) |
```

**섹션 E: severity 분포 바**
```
라인다운: ■■■■ N건 (X%)
주요:     ■■■■■■ N건 (X%)
정상:     ■■■■■■■■■■■■ N건 (X%)
경미:     ■■■ N건 (X%)
```

**섹션 F: 최근 미해결 건 (open/in_progress/pending_parts)**
```
| 설비 | 증상 | 심각도 | 경과시간 |
```

### 3-3. pages/bm/index.js — 수정 필요 사항

**추가: BMKpiSummary 컴포넌트 연결**
```javascript
// 헤더 아래에 삽입
{isAuthed && <BMKpiSummary month={currentMonth} />}
```

**추가: severity 필터 탭**
현재 FILTERS = [open, in_progress, all, resolved]
추가: line_down 탭 (라인다운 우선 표시)

```javascript
const FILTERS = [
  { key: 'open',        label: '접수' },
  { key: 'in_progress', label: '진행중' },
  { key: 'line_down',   label: '라인다운' },  // 신규
  { key: 'all',         label: '전체' },
  { key: 'resolved',    label: '완료' },
];
```

line_down 탭 처리:
```javascript
if (filter === 'line_down') {
  q = q.eq('severity', 'line_down').in('status', ['open','in_progress','pending_parts']);
}
```

---

## 4. 신규 컴포넌트 설계

### 4-1. components/bm/BMSeverityBar.js (신규)

**역할:** 카드 왼쪽 4px 컬러 바 + severity 레이블. index.js에서 인라인으로 처리하던 것을 컴포넌트화.

**Props:**
```typescript
{
  severity: 'minor' | 'normal' | 'major' | 'line_down',  // required
  orientation?: 'vertical' | 'horizontal',                // default: 'vertical'
  showLabel?: boolean,                                    // default: false
}
```

**구현 명세:**
```javascript
const SEVERITY_COLOR = {
  line_down: '#dc2626',
  major:     '#f97316',
  normal:    '#2563eb',
  minor:     '#64748b',
};
const SEVERITY_LABEL_KO = {
  line_down: '라인다운',
  major:     '주요',
  normal:    '정상',
  minor:     '경미',
};

export default function BMSeverityBar({ severity, orientation = 'vertical', showLabel = false }) {
  const color = SEVERITY_COLOR[severity] || SEVERITY_COLOR.normal;
  if (orientation === 'horizontal') {
    return (
      <div style={{ height: 4, background: color, borderRadius: 2 }}>
        {showLabel && <span style={{ fontSize: 10, color, marginLeft: 4 }}>
          {SEVERITY_LABEL_KO[severity]}
        </span>}
      </div>
    );
  }
  // vertical (default — card left bar)
  return (
    <div style={{
      width: 4, alignSelf: 'stretch',
      background: color, borderRadius: '4px 0 0 4px', flexShrink: 0,
    }} />
  );
}
```

**사용처:**
- `pages/bm/index.js` — 카드 좌측 바 (현재 인라인 borderLeft로 처리 중 → 교체)
- `pages/bm/[id].js` — 상세 페이지 severity 표시
- `pages/bm/stats.js` — severity 분포 바에서 수평 모드 사용

---

### 4-2. components/bm/TechnicianSelect.js (신규)

**역할:** technicians 테이블에서 기술자 목록 로드, 팀별 그룹화 드롭다운.

**Props:**
```typescript
{
  value: string | null,             // technician uuid
  onChange: (id: string) => void,   // required
  disabled?: boolean,               // default: false
  placeholder?: string,             // default: '기술자 선택'
}
```

**구현 명세:**
```javascript
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const TEAM_LABEL = {
  mechanical: '기계',
  electrical: '전기',
  welding:    '용접',
  general:    '일반',
};

export default function TechnicianSelect({ value, onChange, disabled = false, placeholder = '기술자 선택' }) {
  const [techs, setTechs] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('technicians')
        .select('id, name, name_ta, team')
        .eq('is_active', true)
        .order('team', { ascending: true })
        .order('name', { ascending: true });
      setTechs(data || []);
    })();
  }, []);

  // Group by team
  const groups = techs.reduce((acc, t) => {
    const g = t.team || 'general';
    if (!acc[g]) acc[g] = [];
    acc[g].push(t);
    return acc;
  }, {});

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      style={inputStyle}
    >
      <option value="">{placeholder}</option>
      {Object.entries(groups).map(([team, list]) => (
        <optgroup key={team} label={TEAM_LABEL[team] || team}>
          {list.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}{t.name_ta ? ` · ${t.name_ta}` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
```

**사용처:**
- `pages/bm/edit/[id].js` — 담당 기술자 선택
- `pages/bm/[id].js` — 상세 페이지 기술자 표시 (읽기 전용 시 disabled=true)

---

### 4-3. components/bm/BMKpiSummary.js (신규)

**역할:** index.js 상단 KPI 요약 배너 — 이번 달 고장건수, 해결율, 평균 MTTR.

**Props:**
```typescript
{
  month?: string,   // 'YYYY-MM', default: current month
}
```

**구현 명세:**
```javascript
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function BMKpiSummary({ month }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const ym = month || new Date().toISOString().slice(0, 7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const start = `${ym}-01T00:00:00.000Z`;
      const end = new Date(
        parseInt(ym.slice(0, 4)),
        parseInt(ym.slice(5, 7)),  // month+1 for end
        0, 23, 59, 59
      ).toISOString();

      const { data } = await supabase
        .from('bm_events')
        .select('status, downtime_minutes')
        .gte('reported_at', start)
        .lte('reported_at', end)
        .limit(2000);

      if (cancelled) return;
      const rows = data || [];
      const total = rows.length;
      const resolved = rows.filter(r => r.status === 'resolved').length;
      const dts = rows.map(r => r.downtime_minutes).filter(v => v != null);
      const avgMttr = dts.length ? Math.round(dts.reduce((a,b)=>a+b,0)/dts.length) : null;

      setStats({ total, resolved, resolveRate: total ? Math.round(resolved/total*100) : 0, avgMttr });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ym]);

  if (loading) return <div style={bannerStyle}><span style={dimStyle}>집계 중…</span></div>;
  if (!stats || stats.total === 0) return null;

  return (
    <div style={bannerStyle}>
      <KpiItem label={`${ym.slice(5)}월 고장`} value={`${stats.total}건`} color="#dc2626" />
      <KpiItem label="해결율" value={`${stats.resolveRate}%`} color="#22c55e" />
      <KpiItem label="평균 MTTR" value={stats.avgMttr != null ? `${stats.avgMttr}분` : '—'} color="#2563eb" />
    </div>
  );
}

function KpiItem({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const bannerStyle = {
  display: 'flex', gap: 0,
  background: '#1e293b', borderBottom: '1px solid #1f2937',
  padding: '10px 14px',
};
const dimStyle = { fontSize: 12, color: '#64748b' };
```

**사용처:** `pages/bm/index.js` — 헤더 바로 아래

---

### 4-4. components/bm/BMCard.js (리팩토링)

**역할:** index.js 인라인 카드 렌더링 → 독립 컴포넌트 추출.

**Props:**
```typescript
{
  event: {
    id: string,
    asset_id: string,
    reported_at: string,
    status: 'open' | 'in_progress' | 'pending_parts' | 'resolved' | 'wontfix' | 'cancelled',
    severity: 'minor' | 'normal' | 'major' | 'line_down',
    priority: 'low' | 'medium' | 'high' | 'critical',
    symptom: string | null,
    resolver_name: string | null,
    downtime_minutes: number | null,
    assets: { machine_asset_number: string, name_en: string, location: string } | null,
  },
  onClick: (id: string) => void,   // required
}
```

**구현 주의사항:**
- BMSeverityBar 컴포넌트 사용 (vertical, 카드 좌측)
- BMStatusBadge 컴포넌트 사용 (size='sm')
- 라인다운(line_down) 시 카드 배경 `rgba(220,38,38,0.06)` — 시각적 강조
- touch target 최소 44px 보장

---

### 4-5. BMFilterPanel.js — severity 필터 추가 (기존 수정)

**현재 누락:** severity 필터 없음.

**추가 Props:**
```typescript
severity?: 'minor' | 'normal' | 'major' | 'line_down' | '',  // default: ''
```

**추가 UI 섹션:**
```javascript
<div style={S.row}>
  <span style={S.label}>심각도 / Severity</span>
</div>
<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
  {[
    { v: '', label: '전체' },
    { v: 'line_down', label: '라인다운', color: '#dc2626' },
    { v: 'major',     label: '주요',     color: '#f97316' },
    { v: 'normal',    label: '정상',     color: '#2563eb' },
    { v: 'minor',     label: '경미',     color: '#64748b' },
  ].map(opt => (
    <button
      key={opt.v}
      type="button"
      style={{
        ...S.presetBtn,
        ...(sev === opt.v ? { borderColor: opt.color || '#94a3b8', color: opt.color || '#f8fafc' } : {}),
      }}
      onClick={() => setSev(opt.v)}
    >{opt.label}</button>
  ))}
</div>
```

**onApply 변경:**
```javascript
onApply({ startDate: sd, endDate: ed, assetId: aid, severity: sev })
```

---

## 5. API 수정 설계

### 5-1. pages/api/bm/resolve.js — work_hours 추가

**현재 누락:** work_hours 파라미터 처리 없음.

**수정 내용:**
```javascript
// 기존
const { id, resolver_name, action_taken, resolved_at } = req.body || {};

// 수정
const { id, resolver_name, action_taken, resolved_at, work_hours, technician_id } = req.body || {};

// patch 객체에 추가
if (work_hours !== undefined && work_hours !== null) {
  const wh = parseFloat(work_hours);
  if (!isNaN(wh) && wh >= 0 && wh <= 24) patch.work_hours = wh;
}
if (technician_id !== undefined) patch.technician_id = technician_id || null;
```

### 5-2. pages/api/bm/analysis.js — cause_code 집계 추가

**현재 누락:** cause_code 집계 없음.

**추가 집계 로직:**
```javascript
// 기존 select에 cause_code 추가
.select('id, asset_id, reported_at, resolved_at, severity, priority, status,
         downtime_start, downtime_end, work_hours, cause_code,
         assets(id, machine_asset_number, name_en)')

// 집계 섹션에 추가
stats.byCauseCode = {};
events.forEach(evt => {
  const code = evt.cause_code || 'UNKN-OTHERS';
  if (!stats.byCauseCode[code]) {
    stats.byCauseCode[code] = { count: 0 };
  }
  stats.byCauseCode[code].count += 1;
});
// 퍼센트 계산
Object.values(stats.byCauseCode).forEach(v => {
  v.pct = events.length ? Math.round(v.count / events.length * 100) : 0;
});
```

### 5-3. GET /api/bm/stats — 신규 (설계 문서 원안)

**현재:** 없음 (analysis.js가 유사 역할).  
**판단:** analysis.js가 이미 month 기반 집계를 처리 중. stats.js 신규 생성 대신 analysis.js를 확장하는 것이 중복 제거 관점에서 적합.

**analysis.js 응답 스키마 확장:**
```json
{
  "month": "2026-03",
  "totalBreakdowns": 141,
  "resolvedCount": 141,
  "openCount": 0,
  "inProgressCount": 0,
  "pendingPartsCount": 0,
  "averageDowntimeMinutes": 45,
  "totalDowntimeMinutes": 6345,
  "averageWorkHours": 0.72,
  "totalWorkHours": 101.5,
  "bySeverity": { "critical": 3, "high": 12, "medium": 121, "low": 5 },
  "byPriority": { "critical": 0, "high": 5, "medium": 136, "low": 0 },
  "byCauseCode": {
    "MECH-WEAR": { "count": 23, "pct": 16 },
    "ELEC-SENSOR": { "count": 18, "pct": 13 }
  },
  "byTechnician": {
    "SARAVANARAJ": { "count": 45, "avgMttr": 38 }
  },
  "byAsset": {
    "uuid": { "assetNumber": "04.001.050", "assetName": "ARC WELD ROBOT", "count": 14 }
  }
}
```

---

## 6. UI 와이어프레임 — 텍스트 기반

### 6-1. BM 목록 (index.js) — 상단 KPI 배너 추가 후

```
┌──────────────────────────────────────┐
│ ← [로고]     BM 고장관리    [+신규]  │  ← 헤더 (sticky)
├──────────────────────────────────────┤
│    14건        86%       42분        │  ← BMKpiSummary (이번 달)
│   04월 고장   해결율    평균 MTTR    │
├──────────────────────────────────────┤
│ [접수][진행중][라인다운][전체][완료] │  ← 탭 (라인다운 탭 추가)
│                         [필터▼][정렬]│
├──────────────────────────────────────┤
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│ │ [BMFilterPanel] (토글 시 표시)  │  │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
├──────────────────────────────────────┤
│ ■ 04.001.050 ARC WELD ROBOT  [라인다운] │ ← BMSeverityBar (빨간 4px 좌측 바)
│   증상: M/W TOURCH PROBLEM            │
│   2026-03-15 08:30  SARAVANARAJ  30분 │
├──────────────────────────────────────┤
│ ■ 04.001.129 ARC WELD ROBOT  [주요]   │
│   ...                                 │
└──────────────────────────────────────┘
```

### 6-2. BM 수정 페이지 (edit/[id].js) — 추가 섹션

```
[현재 구현된 섹션들]
  ① 자산 정보 (읽기 전용)
  ② 상태 선택
  ③ 심각도 4버튼

[신규 추가]
  ④ 우선순위 4버튼
     [낮음][보통*][높음][긴급]   ← priority 현재 누락

[현재 구현된 섹션들 계속]
  ⑤ 증상 (영문/타밀어)
  ⑥ 다운타임 시작/종료

[신규 추가]
  ⑦ 작업시간 (h)
     [____0.5___] h  ← work_hours 현재 누락

[현재 구현된 섹션들 계속]
  ⑧ 원인코드 드롭다운 (cause_code)  ← cause_code 드롭다운 현재 누락
     [─기계─] MECH-WEAR: 부품 마모 ▼
  ⑨ 원인 상세 텍스트
  ⑩ 조치 내용

[신규 추가]
  ⑪ 담당 기술자 (TechnicianSelect)
     [─기계─] SARAVANARAJ ▼       ← technician_id 현재 누락

[현재 구현된 섹션들 계속]
  ⑫ 처리자명 (resolver_name)
  ⑬ [취소] [저장]
```

### 6-3. BM 통계 (stats.js) — 전체 레이아웃

```
┌──────────────────────────────────────┐
│ ← BM    BM 통계    2026-03-01~31     │
├──────────────────────────────────────┤
│ [이번 달] [지난 달] [최근 3개월]     │
├──────────────────────────────────────┤
│ [141건]  [141건]  [0건]  [45분]      │
│ 총고장    해결     진행중  평균MTTR   │
├──────────────────────────────────────┤
│ 월별 트렌드 (최근 6개월)             │  ← 신규 섹션 A
│  월    건수  다운타임  해결율  MTTR  │
│  03월   141   105.7h   100%   45분  │
│  02월   108    66.8h   100%   37분  │
│  01월    97    70.6h   100%   44분  │
├──────────────────────────────────────┤
│ 최다 고장 설비 Top10                 │  ← 기존 Top5 → Top10 확장
│  #  설비코드    이름       건수 MTTR │
│  1  06.001.050  ASSY UNIT  16   34분│
│  2  04.001.050  ARC WELD   14   31분│
│  ...                                 │
├──────────────────────────────────────┤
│ 원인 분류별 집계                     │  ← 신규 섹션 B (cause_code 데이터 채워지면 활성화)
│  MECH-WEAR  부품마모  23건  16%  38분│
│  ELEC-SENS  센서불량  18건  13%  45분│
│  (데이터 없을 시: "원인코드 미입력") │
├──────────────────────────────────────┤
│ 심각도 분포                          │  ← 신규 섹션 E
│  라인다운 ████ 3건 (2%)              │
│  주요     ████████ 12건 (9%)         │
│  정상     ████████████████ 121건(86%)│
│  경미     ████ 5건 (4%)              │
├──────────────────────────────────────┤
│ 담당 기술자별 처리 현황              │  ← 신규 섹션 C
│  기술자            건수  MTTR  작업h │
│  SARAVANARAJ        89   38분  0.6h │
│  MURUGAN            31   51분  0.8h │
└──────────────────────────────────────┘
```

---

## 7. 구현 로드맵 — 2026-05-30 완료 기준

### Phase 1: DB + 마스터 데이터 (2026-05-20 ~ 05-22, 3일)

| 작업 | 파일 | 우선순위 | 소요(h) |
|------|------|---------|---------|
| 12_bm_technicians.sql 실행 | Supabase SQL Editor | P0 | 1 |
| cause_codes seed 데이터 입력 | Supabase SQL Editor | P0 | 1 |
| 13_bm_data_fixes.sql 실행 | Supabase SQL Editor | P0 | 2 |
| bm_kpi 뷰 재생성 | Supabase SQL Editor | P0 | 1 |
| TechnicianSelect.js 컴포넌트 생성 | components/bm/ | P0 | 3 |
| BMSeverityBar.js 컴포넌트 생성 | components/bm/ | P0 | 2 |

### Phase 2: Edit + API 보강 (2026-05-23 ~ 05-26, 4일)

| 작업 | 파일 | 우선순위 | 소요(h) |
|------|------|---------|---------|
| edit/[id].js — 4개 필드 추가 | pages/bm/edit/ | P0 | 4 |
| resolve.js — work_hours 추가 | pages/api/bm/ | P1 | 1 |
| analysis.js — cause_code 집계 추가 | pages/api/bm/ | P1 | 2 |
| BMFilterPanel.js — severity 필터 추가 | components/bm/ | P1 | 2 |
| BMKpiSummary.js 컴포넌트 생성 | components/bm/ | P1 | 3 |
| index.js — BMKpiSummary 연결 + 라인다운 탭 | pages/bm/ | P1 | 2 |

### Phase 3: Stats 강화 + 마무리 (2026-05-27 ~ 05-30, 4일)

| 작업 | 파일 | 우선순위 | 소요(h) |
|------|------|---------|---------|
| stats.js — 월별 트렌드 섹션 추가 | pages/bm/ | P1 | 4 |
| stats.js — Top5 → Top10 확장 | pages/bm/ | P1 | 1 |
| stats.js — 원인분류 섹션 추가 | pages/bm/ | P2 | 3 |
| stats.js — severity 분포 바 추가 | pages/bm/ | P2 | 2 |
| stats.js — 기술자별 현황 추가 | pages/bm/ | P2 | 2 |
| BMCard.js 리팩토링 (선택) | components/bm/ | P3 | 3 |
| 전체 테스트 + 배포 | — | P0 | 4 |

**총 예상 작업량:** 47h (10일 × ~5h/일)

---

## 8. 완료 기준 체크리스트

### DB
- [ ] technicians 테이블 생성 + seed 5명 입력
- [ ] cause_codes 테이블 생성 + seed 19개 코드 입력
- [ ] bm_events.technician_id FK 연결
- [ ] bm_events.cause_code FK 연결
- [ ] resolved_at 소급 입력 (353건)
- [ ] downtime_minutes 재계산 (126건 불일치 해소)
- [ ] bm_kpi 뷰 재생성

### 컴포넌트
- [ ] BMSeverityBar.js — vertical/horizontal 양방향 동작
- [ ] TechnicianSelect.js — 팀별 그룹화, optgroup 정상 렌더
- [ ] BMKpiSummary.js — 이번 달 KPI 3개 표시
- [ ] BMFilterPanel.js — severity 필터 추가

### 페이지
- [ ] edit/[id].js — work_hours, cause_code, technician_id, priority 필드 동작
- [ ] index.js — BMKpiSummary 표시, 라인다운 탭 필터 동작
- [ ] stats.js — 월별 트렌드 테이블, Top10, severity 분포, 기술자 현황

### API
- [ ] resolve.js — work_hours, technician_id 파라미터 처리
- [ ] analysis.js — byCauseCode 집계 응답 포함

---

## 9. 주의사항 및 리스크

| 항목 | 내용 | 대응 |
|------|------|------|
| downtime_minutes GENERATED 충돌 | 현재 일반 컬럼 — GENERATED로 전환 시 기존값 삭제됨 | GENERATED 전환 금지, 수동 재계산 유지 |
| resolved_at 소급 입력 | downtime_end = resolved_at 정책 선언 필요 | 13번 마이그레이션에서 일괄 처리 |
| technicians seed 데이터 | SARAVANARAJ 외 4명은 추정 — 실 인원 확인 후 수정 | Phase 1 완료 후 현장 검증 필요 |
| cause_codes 데이터 없는 기존 353건 | 소급 분류 불가 — 신규 입력분부터 적용 | stats 페이지에서 "원인코드 미입력" 별도 표시 |
| bm_kpi 뷰 재생성 시 기존 참조 확인 | stats.js는 직접 bm_events 집계 중 — 뷰 미사용 | 뷰 재생성 후 stats.js도 뷰로 전환 검토 |

---

**소스:** Supabase live DB (bm_events 353건, 2025-01 ~ 2026-04), dsc-fms-portal 코드베이스  
**분석 기준일:** 2026-05-19
