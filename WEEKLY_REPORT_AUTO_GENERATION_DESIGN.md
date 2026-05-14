# 주간업무양식 자동 생성 설계서

> **요청:** 생산성/품질 보고처럼 "기초자료 입력 → 자동 생성"  
> **상태:** 플레너 설계 (웹개발자 구현 전)  
> **작성일:** 2026-05-14  
> **목표:** 각 부서 실적 데이터 → 주간업무양식 자동 집계 & 생성

---

## 📋 목차

1. [요구사항 분석](#1-요구사항-분석)
2. [데이터 흐름 & 아키텍처](#2-데이터-흐름--아키텍처)
3. [3가지 자동화 수준 비교](#3-3가지-자동화-수준-비교)
4. [권장 구현 방식: 중간 수준 (Mixed Pattern)](#4-권장-구현-방식-중간-수준-mixed-pattern)
5. [DB 설계 (신규 테이블 & 뷰)](#5-db-설계-신규-테이블--뷰)
6. [API 명세 (8개 엔드포인트)](#6-api-명세-8개-엔드포인트)
7. [부서별 데이터 매핑](#7-부서별-데이터-매핑)
8. [자동 생성 로직](#8-자동-생성-로직)
9. [UI/UX 설계](#9-uiux-설계)
10. [구현 로드맵](#10-구현-로드맵)

---

## 1. 요구사항 분석

### 1.1 사용자 요구사항 (Voice)

**원문:**
> "다른 생산성이나 품질자료처럼 기초자료넣으면 생성되는방식"

**의미:**
- **현재:** 주간업무양식을 수동으로 작성 (각 부서에서 텍스트로 입력)
- **요구:** 주간 실적 데이터(기초자료) 입력 → **자동으로 통계 계산 & 양식 생성**
- **패턴:** 생산성/품질 보고서의 자동 집계 방식을 재사용

### 1.2 핵심 비즈니스 프로세스

```
[주 1회 타이밍 (예: 일요일 23:00)]

Step 1. 각 부서가 주간 실적 데이터 입력 (기존)
  ├─ 생산부: 일일 생산량, 계획치 vs 실적 입력
  ├─ 기술팀: 장비 점검/개선 건수 입력
  ├─ 보전팀: 전기/기계 완료건수 입력
  └─ 생산관리: 비용 절감, 일정 준수율 입력

Step 2. 자동 수집 & 집계 (Cron 또는 수동 트리거)
  ├─ 각 부서 테이블에서 주간 데이터 수집
  ├─ 계획치 vs 실적 비교 → 달성율 자동 계산
  ├─ 다른 KPI 통계 생성
  └─ JSON 형태로 집계 결과 저장

Step 3. 주간업무양식 자동 생성
  ├─ 주간_업무_내용 테이블 insert (auto-generated)
  ├─ Excel 다운로드 가능하게 변환
  └─ 부서별 담당자에게 리뷰 알림 (Telegram)

Step 4. 관리자 검토 & 확인
  ├─ 자동 생성된 양식 검토
  ├─ 필요시 수정/추가
  └─ 최종 확정
```

### 1.3 목표 메트릭

| 부서 | 현재 (수동) | 목표 (자동) |
|------|----------|----------|
| **생산** | 담당자가 손으로 계산 | 일일 실적 → 주간 합계 + 달성율 자동 |
| **기술** | 담당자가 정리 | 점검 이력 → 주간 통계 자동 |
| **보전** | 담당자가 집계 | BM/PM 완료건수 → 주간 합계 자동 |
| **생산관리** | 담당자가 기입 | 비용/일정 데이터 → 주간 분석 자동 |

---

## 2. 데이터 흐름 & 아키텍처

### 2.1 현재 데이터 소스 (기존 테이블)

```
1. 생산 실적
   - kpi_actuals (생산량, OEE, 계획달성율)
   - production_reports (월별 생산성) ← management_reports.production jsonb
   - 원본: 일일/주간 입력 (현장 시스템 또는 앱)

2. 기술 (점검/개선)
   - equipment_reports (장비 상태) ← management_reports 에 없음 (신규 필요)
   - 또는 bm_events 에서 추출 (점검 건수, 예방정비 건수)

3. 보전 (BM/PM)
   - bm_events (고장 이력: 건수, downtime, work_hours)
   - pm_worklog (PM 완료 건수)
   - 뷰: bm_kpi (MTTR, MTBF 자동 계산)

4. 생산관리
   - cost_reports (비용 절감, 낭비 제거) ← management_reports.production 일부
   - schedule_reports (일정 준수율) ← management_reports.production 일부
   - 또는 kpi_actuals 에서 추출
```

### 2.2 자동 생성 데이터 흐름

```
┌─────────────────────────────────────────────────────────┐
│                   [주간 데이터 수집]                     │
│  (각 부서 실적 테이블 쿼리)                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              [집계 & 계산 (SQL + RPC)]                  │
│                                                          │
│  ├─ 생산: SUM(일일생산량), AVG(OEE), 달성율 계산        │
│  ├─ 기술: COUNT(점검), COUNT(개선), 부서별 집계         │
│  ├─ 보전: COUNT(완료), AVG(MTTR), 고장 발생건수        │
│  └─ 생산관리: SUM(비용절감), AVG(일정준수율)           │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│          [주간업무 요약 생성 (JSON)]                    │
│                                                          │
│  weekly_reports 테이블 INSERT:                          │
│  {                                                       │
│    year, week, start_date, end_date,                    │
│    production: { ... }, technology: { ... },            │
│    maintenance: { ... }, management: { ... },           │
│    generated_by: 'system', status: 'auto_generated'     │
│  }                                                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         [부서별 리뷰 & 수정 (선택)]                     │
│                                                          │
│  ├─ 자동 생성 확인                                       │
│  ├─ 해석/설명 추가 (수동)                               │
│  ├─ 에러 수정                                           │
│  └─ status: 'approved' 업데이트                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              [Excel/PDF 생성 & 다운로드]               │
│  (기존 quality_reports 패턴 재사용)                     │
└─────────────────────────────────────────────────────────┘
```

### 2.3 주간 기준 정의

**주(Week) 계산 방식:**
- **ISO 8601:** 월요일 시작, 일요일 종료
- **자동 생성 타이밍:** 매주 일요일 23:00 KST
  - 또는 매주 월요일 09:00 (전주 데이터)
- **주간 범위:** `YYYY-Www` 형식
  - 예: `2026-W20` = 2026년 20주 (5월 18~24일)

---

## 3. 3가지 자동화 수준 비교

### 3.1 Option A: 최소 수준 (Read-Only Template)

**개념:** DB에서 데이터만 읽어와 고정 템플릿에 채우기

| 항목 | 설명 |
|------|------|
| **수집 방식** | SQL 쿼리로 주간 데이터 읽기 |
| **계산** | 기본 집계 (SUM, COUNT, AVG) |
| **저장** | DB 저장 안 함 (조회 시마다 계산) |
| **수정** | 불가능 (데이터에만 의존) |
| **복잡도** | 낮음 |
| **성능** | 빠름 (저장소 작음) |
| **이슈** | 데이터 변경 시 재계산 → 일관성 문제 |

**예시 코드:**
```sql
-- 주간 생산 통계 (조회용)
SELECT 
  DATE_TRUNC('week', target_month)::date as week_start,
  SUM(actual_value) as total_production,
  AVG(achievement_rate) as avg_achievement
FROM kpi_actuals
WHERE category_id = 'production_volume'
  AND target_month >= CURRENT_DATE - INTERVAL '6 days'
  AND target_month < CURRENT_DATE + INTERVAL '1 day';
```

### 3.2 Option B: 중간 수준 (Auto-Generated Snapshot) ✓ 권장

**개념:** 정해진 시간에 자동 수집 후 DB에 저장 (스냅샷 생성)

| 항목 | 설명 |
|------|------|
| **수집 방식** | Cron (매주 일요일 23:00) → RPC 호출 → 데이터 수집 |
| **계산** | SQL + 비즈니스 로직 (계획 vs 실적, 달성율, 부서별 통계) |
| **저장** | `weekly_reports` 테이블에 JSON 저장 |
| **수정** | 부서별 담당자가 comment/note 추가 가능 |
| **복잡도** | 중간 |
| **성능** | 좋음 (사전 계산된 데이터) |
| **이점** | 일관성 유지 + 이력 관리 + 부분 수정 가능 |

**아키텍처:**
```
[Vercel Cron] → [RPC: weekly_reports_generate()]
  ↓
[각 부서 테이블 쿼리] → [집계 SQL + 비즈니스 로직]
  ↓
[INSERT weekly_reports] (status='auto_generated')
  ↓
[부서 담당자 검토] → [UPDATE comments/status]
  ↓
[Excel 생성 & 다운로드]
```

### 3.3 Option C: 최대 수준 (Full Workflow)

**개념:** 자동 생성 + AI 해석 + 승인 워크플로우 + 다국어 생성

| 항목 | 설명 |
|------|------|
| **수집 방식** | Option B + 실시간 데이터 추가 |
| **계산** | 고급 통계 (추세, 이상 탐지, 예측) |
| **저장** | `weekly_reports` + `weekly_insights` (AI 분석) |
| **수정** | 자동 생성 → AI 해석 추가 → 부서 검토 → 승인 |
| **복잡도** | 높음 |
| **성능** | 중간 (AI 처리 지연) |
| **추가 기능** | 한글/영어/타밀어 자동 생성, Telegram/Email 자동 알림 |

**워크플로우:**
```
[자동 생성] → [AI 해석] → [번역 (한글↔영어)] → [부서 승인] → [배포]
```

---

## 4. 권장 구현 방식: 중간 수준 (Mixed Pattern)

### 4.1 왜 Option B를 선택하는가?

| 기준 | Option A | **Option B** | Option C |
|------|---------|-----------|---------|
| 구현 난이도 | 쉬움 | **중간** | 어려움 |
| 시간 투자 | 1-2주 | **2-3주** | 4-5주 |
| 유지보수 | 낮음 | **중간** | 높음 |
| 일관성 | 낮음 | **높음** | 높음 |
| 확장성 | 낮음 | **높음** | 높음 |
| 현장 수용도 | 낮음 | **높음** | 매우 높음 |
| ROI | 낮음 | **높음** | 매우 높음 |

**결론:** 실무 적용성 + 유지보수 + ROI 최고

### 4.2 구현 구성

```
┌─────────────────────────────────────────────────────────────────┐
│          Option B (중간) + 선택적 Option C 기능                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Phase 1: 기본 자동 생성 (Option B)                             │
│  ├─ DB 설계 (weekly_reports, weekly_comments 테이블)           │
│  ├─ 자동 수집 RPC (생산, 기술, 보전, 생산관리)                 │
│  ├─ Vercel Cron 설정 (매주 일요일 23:00)                       │
│  └─ UI: 조회 + 기본 수정                                        │
│                                                                  │
│ Phase 2: 부서별 검토 워크플로우 (Option B 심화)                │
│  ├─ Status 추적 (auto_generated → reviewed → approved)         │
│  ├─ 부서별 comment/note 추가                                   │
│  ├─ 변경 이력 추적 (audit log)                                 │
│  └─ UI: 검토 화면 + 승인 버튼                                  │
│                                                                  │
│ Phase 3: 선택 기능 (Option C 일부)                             │
│  ├─ Telegram 자동 알림                                         │
│  ├─ 다국어 자동 생성 (한글 + 영어)                             │
│  └─ Excel/PDF 다운로드                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. DB 설계 (신규 테이블 & 뷰)

### 5.1 신규 테이블: weekly_reports

**목적:** 주간 자동 생성된 보고서 저장

```sql
CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  week INT NOT NULL CHECK (week BETWEEN 1 AND 53),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- 부서별 JSON 데이터 (자동 생성)
  production JSONB DEFAULT '{}'::jsonb,    -- 생산부 데이터
  technology JSONB DEFAULT '{}'::jsonb,    -- 기술팀 데이터
  maintenance JSONB DEFAULT '{}'::jsonb,   -- 보전팀 데이터
  management JSONB DEFAULT '{}'::jsonb,    -- 생산관리 데이터
  
  -- 메타데이터
  status TEXT NOT NULL DEFAULT 'auto_generated'
    CHECK (status IN ('auto_generated', 'reviewed', 'approved', 'rejected')),
  generated_by TEXT DEFAULT 'system',       -- 'system' 또는 user_id
  reviewed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  
  -- 타임스탬프
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (year, week)
);

CREATE INDEX idx_weekly_reports_year_week ON weekly_reports(year DESC, week DESC);
CREATE INDEX idx_weekly_reports_status ON weekly_reports(status);
CREATE INDEX idx_weekly_reports_dates ON weekly_reports(week_start_date DESC);
```

**JSON 구조 예시:**

```json
{
  "production": {
    "plan": 1000,
    "actual": 950,
    "achievement_rate": 95.0,
    "daily_breakdown": [
      { "date": "2026-05-18", "qty": 200 },
      { "date": "2026-05-19", "qty": 180 }
    ],
    "oee": 78.5,
    "notes": ""
  },
  "technology": {
    "equipment_check_count": 12,
    "improvement_count": 3,
    "issues_found": 5,
    "schedule_adherence": 98.0,
    "notes": ""
  },
  "maintenance": {
    "bm_incidents": 2,
    "bm_completed": 2,
    "pm_planned": 8,
    "pm_completed": 7,
    "pm_achievement": 87.5,
    "mttr_hours": 2.3,
    "mtbf_hours": 156.8,
    "total_downtime_hours": 4.6,
    "notes": ""
  },
  "management": {
    "cost_savings": 125000,
    "schedule_achievement": 96.5,
    "safety_incidents": 0,
    "quality_defects": 15,
    "notes": ""
  }
}
```

### 5.2 신규 테이블: weekly_comments

**목적:** 부서별 담당자 코멘트 & 해석 저장

```sql
CREATE TABLE weekly_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  department TEXT NOT NULL
    CHECK (department IN ('production', 'technology', 'maintenance', 'management')),
  comment_type TEXT NOT NULL
    CHECK (comment_type IN ('interpretation', 'finding', 'action', 'note')),
  content TEXT NOT NULL,
  author_name TEXT,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_comments_report ON weekly_comments(weekly_report_id);
CREATE INDEX idx_weekly_comments_dept ON weekly_comments(department);
```

### 5.3 신규 뷰: weekly_reports_summary

**목적:** 주간 보고서 조회 시 메타데이터 + JSON 합쳐서 반환

```sql
CREATE OR REPLACE VIEW weekly_reports_summary AS
SELECT
  wr.id,
  wr.year,
  wr.week,
  wr.week_start_date,
  wr.week_end_date,
  wr.status,
  wr.generated_at,
  wr.reviewed_at,
  wr.approved_at,
  (wr.production->>'achievement_rate')::numeric as production_achievement,
  (wr.technology->>'schedule_adherence')::numeric as tech_schedule,
  (wr.maintenance->>'pm_achievement')::numeric as maintenance_achievement,
  (wr.management->>'schedule_achievement')::numeric as mgmt_schedule,
  COUNT(wc.id) as total_comments,
  STRING_AGG(DISTINCT wc.department, ',') as commented_departments
FROM weekly_reports wr
LEFT JOIN weekly_comments wc ON wc.weekly_report_id = wr.id
GROUP BY wr.id;
```

---

## 6. API 명세 (8개 엔드포인트)

### 6.1 자동 생성 (Cron 호출)

#### `POST /api/weekly-reports/generate`

**목적:** 주간 데이터 자동 수집 & 생성 (Vercel Cron에서 호출)

**요청:**
```json
{
  "year": 2026,
  "week": 20,
  "force": false
}
```

**응답:**
```json
{
  "success": true,
  "report_id": "uuid-...",
  "status": "auto_generated",
  "week": "2026-W20",
  "generated_at": "2026-05-25T23:00:00Z",
  "data_summary": {
    "production": { "actual": 950, "achievement_rate": 95.0 },
    "technology": { "equipment_check_count": 12, "improvement_count": 3 },
    "maintenance": { "bm_incidents": 2, "pm_achievement": 87.5 },
    "management": { "cost_savings": 125000, "safety_incidents": 0 }
  }
}
```

**내부 로직:**
```
1. 주간 범위 계산 (ISO 8601)
2. 각 부서별 RPC 호출:
   - get_weekly_production_data(year, week)
   - get_weekly_technology_data(year, week)
   - get_weekly_maintenance_data(year, week)
   - get_weekly_management_data(year, week)
3. JSON 집계
4. weekly_reports 테이블 INSERT
5. Telegram 알림 (선택)
6. 응답 반환
```

---

### 6.2 조회

#### `GET /api/weekly-reports/[year]/[week]`

**목적:** 특정 주 보고서 조회

**응답:**
```json
{
  "id": "uuid-...",
  "year": 2026,
  "week": 20,
  "week_start_date": "2026-05-18",
  "week_end_date": "2026-05-24",
  "status": "auto_generated",
  "production": { ... },
  "technology": { ... },
  "maintenance": { ... },
  "management": { ... },
  "comments": [
    {
      "id": "uuid-...",
      "department": "production",
      "comment_type": "interpretation",
      "content": "생산량 95% 달성. 금요일 설비 고장으로 10% 감소.",
      "author_name": "김철수",
      "created_at": "2026-05-25T09:30:00Z"
    }
  ],
  "file_status": {
    "excel": null,
    "pdf": null
  }
}
```

---

#### `GET /api/weekly-reports?year=2026&month=5`

**목적:** 월별 주간 보고서 목록 조회

**응답:**
```json
{
  "total": 4,
  "week_reports": [
    {
      "id": "uuid-...",
      "year": 2026,
      "week": 18,
      "week_start_date": "2026-05-04",
      "status": "approved",
      "production_achievement": 98.5,
      "tech_schedule": 100.0,
      "maintenance_achievement": 92.0,
      "mgmt_schedule": 97.0
    },
    ...
  ]
}
```

---

### 6.3 검토 & 승인

#### `PATCH /api/weekly-reports/[id]/review`

**목적:** 부서 담당자가 보고서 검토 (상태 변경)

**요청:**
```json
{
  "status": "reviewed",
  "department_reviewed": ["production", "technology"],
  "reviewed_by_user": "user-id-..."
}
```

**응답:**
```json
{
  "success": true,
  "id": "uuid-...",
  "status": "reviewed",
  "reviewed_at": "2026-05-26T10:00:00Z",
  "reviewed_by": "user-id-..."
}
```

---

#### `PATCH /api/weekly-reports/[id]/approve`

**목적:** 관리자가 최종 승인

**요청:**
```json
{
  "status": "approved",
  "approved_by_user": "admin-user-id"
}
```

**응답:**
```json
{
  "success": true,
  "id": "uuid-...",
  "status": "approved",
  "approved_at": "2026-05-26T14:00:00Z"
}
```

---

### 6.4 코멘트 관리

#### `POST /api/weekly-reports/[id]/comments`

**목적:** 부서별 해석/발견 내용 추가

**요청:**
```json
{
  "department": "production",
  "comment_type": "interpretation",
  "content": "생산량 95% 달성. 금요일 설비 고장으로 인해 10% 감소했으나 월요일 조치로 정상화됨."
}
```

**응답:**
```json
{
  "success": true,
  "comment_id": "uuid-...",
  "created_at": "2026-05-26T09:15:00Z"
}
```

---

#### `GET /api/weekly-reports/[id]/comments?department=production`

**목적:** 부서별 코멘트 조회

**응답:**
```json
{
  "total": 2,
  "comments": [
    {
      "id": "uuid-...",
      "department": "production",
      "comment_type": "interpretation",
      "content": "...",
      "author_name": "김철수",
      "created_at": "2026-05-26T09:15:00Z"
    }
  ]
}
```

---

### 6.5 Excel/PDF 생성

#### `POST /api/weekly-reports/[id]/export`

**목적:** Excel 또는 PDF로 변환 & 다운로드 링크 생성

**요청:**
```json
{
  "format": "excel",
  "language": "ko"
}
```

**응답:**
```json
{
  "success": true,
  "download_url": "https://dsc-fms-portal.vercel.app/downloads/weekly-2026-W20.xlsx",
  "file_name": "weekly-2026-W20.xlsx",
  "generated_at": "2026-05-26T15:30:00Z",
  "expires_in_hours": 24
}
```

---

## 7. 부서별 데이터 매핑

### 7.1 생산부 (Production)

**데이터 소스:**

| 항목 | 테이블 | 쿼리 | 기본값 |
|------|--------|------|--------|
| **일일 생산량** | `kpi_actuals` | `WHERE category_id='production_volume'` | 0 |
| **계획 대비율** | `kpi_targets` + `kpi_actuals` | JOIN on category_id, target_month | null |
| **OEE** | `kpi_actuals` | `WHERE category_id='oee'` | null |
| **달성율** | 계산 | `(actual / plan) * 100` | null |

**집계 로직:**

```sql
-- 생산부 주간 데이터 수집 RPC
CREATE OR REPLACE FUNCTION get_weekly_production_data(
  p_year INT,
  p_week INT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_plan NUMERIC;
  v_actual NUMERIC;
  v_oee NUMERIC;
  v_result JSONB;
BEGIN
  -- ISO 8601 주간 계산
  SELECT 
    date_trunc('week', MAKE_DATE(p_year, 1, 4))::date + (p_week - 1) * 7 INTO v_week_start,
    date_trunc('week', MAKE_DATE(p_year, 1, 4))::date + (p_week) * 7 - 1 INTO v_week_end;

  -- 생산량 합계
  SELECT COALESCE(SUM(actual_value), 0)
  INTO v_actual
  FROM kpi_actuals
  WHERE category_id = 'production_volume'
    AND target_month >= v_week_start
    AND target_month <= v_week_end;

  -- 계획치
  SELECT COALESCE(SUM(target_value), 0)
  INTO v_plan
  FROM kpi_targets
  WHERE category_id = 'production_volume'
    AND target_month >= v_week_start
    AND target_month <= v_week_end;

  -- OEE
  SELECT COALESCE(AVG(actual_value), null)
  INTO v_oee
  FROM kpi_actuals
  WHERE category_id = 'oee'
    AND target_month >= v_week_start
    AND target_month <= v_week_end;

  v_result := JSONB_BUILD_OBJECT(
    'plan', v_plan,
    'actual', v_actual,
    'achievement_rate', ROUND((v_actual::numeric / NULLIF(v_plan, 0) * 100)::numeric, 1),
    'oee', ROUND(v_oee::numeric, 1),
    'notes', ''
  );

  RETURN v_result;
END;
$$;
```

---

### 7.2 기술팀 (Technology)

**데이터 소스:**

| 항목 | 테이블 | 쿼리 | 기본값 |
|------|--------|------|--------|
| **장비 점검 건수** | `bm_events` | `WHERE type='check'` | 0 |
| **개선 건수** | `bm_events` | `WHERE type='improvement'` | 0 |
| **발견 이슈** | `bm_events` | `WHERE status='open'` | 0 |
| **일정 준수율** | `kpi_actuals` | `WHERE category_id='schedule_adherence'` | null |

**집계 로직:**

```sql
CREATE OR REPLACE FUNCTION get_weekly_technology_data(
  p_year INT,
  p_week INT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_check_count INT;
  v_improvement_count INT;
  v_issues INT;
  v_schedule NUMERIC;
  v_result JSONB;
BEGIN
  SELECT 
    date_trunc('week', MAKE_DATE(p_year, 1, 4))::date + (p_week - 1) * 7 INTO v_week_start,
    date_trunc('week', MAKE_DATE(p_year, 1, 4))::date + (p_week) * 7 - 1 INTO v_week_end;

  -- 점검 건수 (bm_events가 없으면 0)
  SELECT COUNT(*) INTO v_check_count
  FROM bm_events
  WHERE reported_at >= v_week_start
    AND reported_at <= v_week_end
    AND status != 'cancelled';

  -- 개선 건수 (추가 로직 필요)
  SELECT COUNT(*) INTO v_improvement_count
  FROM bm_events
  WHERE reported_at >= v_week_start
    AND reported_at <= v_week_end
    AND status = 'resolved';

  -- 열린 이슈
  SELECT COUNT(*) INTO v_issues
  FROM bm_events
  WHERE status IN ('open', 'in_progress');

  -- 일정 준수율
  SELECT COALESCE(AVG(actual_value), null)
  INTO v_schedule
  FROM kpi_actuals
  WHERE category_id = 'plan_achievement'
    AND target_month >= v_week_start
    AND target_month <= v_week_end;

  v_result := JSONB_BUILD_OBJECT(
    'equipment_check_count', v_check_count,
    'improvement_count', v_improvement_count,
    'issues_found', v_issues,
    'schedule_adherence', ROUND(v_schedule::numeric, 1),
    'notes', ''
  );

  RETURN v_result;
END;
$$;
```

---

### 7.3 보전팀 (Maintenance)

**데이터 소스:**

| 항목 | 테이블 | 쿼리 | 기본값 |
|------|--------|------|--------|
| **고장 발생 건수** | `bm_events` | `WHERE status='resolved'` | 0 |
| **고장 완료 건수** | `bm_events` | `WHERE status='resolved'` | 0 |
| **PM 계획 건수** | `pm_worklog` | 주간 계획 | 0 |
| **PM 완료 건수** | `pm_worklog` | `WHERE status='completed'` | 0 |
| **MTTR/MTBF** | `bm_kpi` 뷰 | 자동 계산 | null |

**집계 로직:**

```sql
CREATE OR REPLACE FUNCTION get_weekly_maintenance_data(
  p_year INT,
  p_week INT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_bm_count INT;
  v_pm_planned INT;
  v_pm_completed INT;
  v_mttr NUMERIC;
  v_mtbf NUMERIC;
  v_downtime NUMERIC;
  v_result JSONB;
BEGIN
  SELECT 
    date_trunc('week', MAKE_DATE(p_year, 1, 4))::date + (p_week - 1) * 7 INTO v_week_start,
    date_trunc('week', MAKE_DATE(p_year, 1, 4))::date + (p_week) * 7 - 1 INTO v_week_end;

  -- BM 완료 건수
  SELECT COUNT(*) INTO v_bm_count
  FROM bm_events
  WHERE status = 'resolved'
    AND resolved_at >= v_week_start
    AND resolved_at <= v_week_end;

  -- PM 계획/완료 (pm_worklog 테이블 필요)
  SELECT 
    COUNT(*) INTO v_pm_planned
  FROM pm_worklog
  WHERE planned_date >= v_week_start
    AND planned_date <= v_week_end;

  SELECT COUNT(*) INTO v_pm_completed
  FROM pm_worklog
  WHERE status = 'completed'
    AND completed_at >= v_week_start
    AND completed_at <= v_week_end;

  -- MTTR/MTBF (bm_kpi 뷰에서)
  SELECT 
    AVG(mttr_min / 60.0),
    AVG(mtbf_min / 60.0),
    SUM(total_downtime_min / 60.0)
  INTO v_mttr, v_mtbf, v_downtime
  FROM bm_kpi
  WHERE month >= v_week_start::timestamp
    AND month <= (v_week_end::timestamp + INTERVAL '1 day');

  v_result := JSONB_BUILD_OBJECT(
    'bm_incidents', v_bm_count,
    'bm_completed', v_bm_count,
    'pm_planned', v_pm_planned,
    'pm_completed', v_pm_completed,
    'pm_achievement', ROUND((v_pm_completed::numeric / NULLIF(v_pm_planned, 0) * 100)::numeric, 1),
    'mttr_hours', ROUND(v_mttr::numeric, 2),
    'mtbf_hours', ROUND(v_mtbf::numeric, 1),
    'total_downtime_hours', ROUND(v_downtime::numeric, 2),
    'notes', ''
  );

  RETURN v_result;
END;
$$;
```

---

### 7.4 생산관리 (Management)

**데이터 소스:**

| 항목 | 테이블 | 쿼리 | 기본값 |
|------|--------|------|--------|
| **비용 절감액** | `kpi_actuals` | (추가 필요) | 0 |
| **일정 준수율** | `kpi_actuals` | `WHERE category_id='schedule_achievement'` | null |
| **안전 사고** | `kpi_actuals` | `WHERE category_id='accident_count'` | 0 |
| **품질 불량** | `kpi_actuals` | `WHERE category_id='defect_ppm'` | 0 |

**집계 로직:**

```sql
CREATE OR REPLACE FUNCTION get_weekly_management_data(
  p_year INT,
  p_week INT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_cost_savings NUMERIC;
  v_schedule NUMERIC;
  v_accidents INT;
  v_defects NUMERIC;
  v_result JSONB;
BEGIN
  SELECT 
    date_trunc('week', MAKE_DATE(p_year, 1, 4))::date + (p_week - 1) * 7 INTO v_week_start,
    date_trunc('week', MAKE_DATE(p_year, 1, 4))::date + (p_week) * 7 - 1 INTO v_week_end;

  -- 비용 절감액 (management_reports.production jsonb에서 읽기)
  SELECT COALESCE(SUM((production->>'cost_savings')::numeric), 0)
  INTO v_cost_savings
  FROM management_reports
  WHERE EXTRACT(YEAR FROM created_at) = p_year
    AND created_at >= v_week_start::timestamp
    AND created_at <= v_week_end::timestamp + INTERVAL '1 day';

  -- 일정 준수율
  SELECT COALESCE(AVG(actual_value), null)
  INTO v_schedule
  FROM kpi_actuals
  WHERE category_id = 'plan_achievement'
    AND target_month >= v_week_start
    AND target_month <= v_week_end;

  -- 안전 사고
  SELECT COALESCE(SUM(actual_value), 0)
  INTO v_accidents
  FROM kpi_actuals
  WHERE category_id = 'accident_count'
    AND target_month >= v_week_start
    AND target_month <= v_week_end;

  -- 품질 불량률
  SELECT COALESCE(AVG(actual_value), null)
  INTO v_defects
  FROM kpi_actuals
  WHERE category_id = 'defect_ppm'
    AND target_month >= v_week_start
    AND target_month <= v_week_end;

  v_result := JSONB_BUILD_OBJECT(
    'cost_savings', ROUND(v_cost_savings::numeric, 0),
    'schedule_achievement', ROUND(v_schedule::numeric, 1),
    'safety_incidents', v_accidents,
    'quality_defects', ROUND(v_defects::numeric, 0),
    'notes', ''
  );

  RETURN v_result;
END;
$$;
```

---

## 8. 자동 생성 로직

### 8.1 Vercel Cron Job 설정

**파일:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-reports",
      "schedule": "0 23 * * 0"
    }
  ]
}
```

**설명:**
- `0 23 * * 0` = 매주 일요일 23:00 KST (UTC+9)
- 실제 UTC: 일요일 14:00 UTC

### 8.2 Cron 엔드포인트

**파일:** `app/api/cron/weekly-reports/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  // 1. Vercel Cron 시크릿 검증
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 2. 현재 주 계산 (ISO 8601)
    const today = new Date();
    const year = today.getFullYear();
    const week = getWeekNumber(today);

    // 3. 각 부서별 RPC 호출
    const productionData = await supabase.rpc('get_weekly_production_data', {
      p_year: year,
      p_week: week,
    });

    const technologyData = await supabase.rpc('get_weekly_technology_data', {
      p_year: year,
      p_week: week,
    });

    const maintenanceData = await supabase.rpc('get_weekly_maintenance_data', {
      p_year: year,
      p_week: week,
    });

    const managementData = await supabase.rpc('get_weekly_management_data', {
      p_year: year,
      p_week: week,
    });

    // 4. 주간 범위 계산
    const weekStart = getWeekStart(year, week);
    const weekEnd = getWeekEnd(year, week);

    // 5. weekly_reports 테이블에 INSERT
    const { data, error } = await supabase
      .from('weekly_reports')
      .insert({
        year,
        week,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        production: productionData.data,
        technology: technologyData.data,
        maintenance: maintenanceData.data,
        management: managementData.data,
        status: 'auto_generated',
        generated_by: 'system',
      })
      .select()
      .single();

    if (error) throw error;

    // 6. Telegram 알림 (선택)
    await notifyTelegram({
      message: `주간업무양식 자동 생성 완료\n주: ${year}-W${week}\n상태: auto_generated`,
      reportId: data.id,
    });

    return NextResponse.json({
      success: true,
      report_id: data.id,
      week: `${year}-W${week}`,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Weekly report generation failed:', error);
    return NextResponse.json(
      { error: 'Generation failed', details: error },
      { status: 500 }
    );
  }
}

// 헬퍼 함수
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekStart(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
}

function getWeekEnd(year: number, week: number): Date {
  const start = getWeekStart(year, week);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

async function notifyTelegram({ message, reportId }: any) {
  // Telegram API 호출 (기존 코드 재사용)
  // ...
}
```

---

## 9. UI/UX 설계

### 9.1 주간 보고서 목록 화면

**경로:** `/dsc-hub/fms/weekly-reports` 또는 `/reports/weekly`

**레이아웃:**

```
┌─────────────────────────────────────────────────────────┐
│ WEEKLY REPORTS (주간업무양식)                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Year ▼] [Month ▼]                 [Generate ▶] [↓Download] │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Week | Date Range    | Status        | Actions        │
│  ─────┼─────────────────────────────────────────────── │
│  W20  | May 18-24     | ✓ Approved    | [View] [PDF]  │
│  W19  | May 11-17     | 🔄 Reviewed   | [View] [Edit]  │
│  W18  | May 04-10     | 📝 Generated  | [View] [Approve] │
│       |               |               |                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**컴포넌트:**
- `WeeklyReportList`: 목록 테이블
- `WeeklyReportFilter`: 필터 (년/월)
- `WeeklyReportActions`: 생성/다운로드 버튼

### 9.2 주간 보고서 상세 화면

**경로:** `/dsc-hub/fms/weekly-reports/[year]/[week]`

**탭 구조:**

```
┌─────────────────────────────────────────────────────────┐
│ WEEKLY REPORT 2026-W20 (May 18-24)                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [📊 Summary] [🏭 Production] [🔧 Tech] [🛠 Maint] [📋 Mgmt] │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Status: auto_generated → Reviewed → Approved          │
│  Generated: 2026-05-25 23:00 | Reviewed: - | Approved: - │
│                                                          │
│  [View Timeline] [Add Comment] [Download] [Approve ▶]  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Tab 1: Summary**
```
┌─────────────────────────────────────────┐
│ 생산        95.0%  (950 / 1000)         │
├─────────────────────────────────────────┤
│ 기술        100.0% (12 점검 완료)       │
├─────────────────────────────────────────┤
│ 보전        87.5%  (7 / 8 PM)           │
├─────────────────────────────────────────┤
│ 생산관리    96.5%  (127만원 절감)       │
└─────────────────────────────────────────┘
```

**Tab 2: Production**
```
┌─────────────────────────────────────────┐
│ 생산 실적                               │
├─────────────────────────────────────────┤
│                                         │
│  Plan       1000 EA                     │
│  Actual     950 EA  (95.0%)            │
│  OEE        78.5%                       │
│                                         │
│  일일 차단:                             │
│  ┌─────────────────────────────────────┐│
│  │ 18 | 19 | 20 | 21 | 22 | 23 | 24  ││
│  │200 |180 |150 |200 |220 | 0 | 0  ││
│  └─────────────────────────────────────┘│
│                                         │
│  [✏️ Edit Note]                         │
│  ┌─────────────────────────────────────┐│
│  │ 금요일 설비 고장으로 50개 감소      ││
│  │ 월요일 정상화됨                     ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Tab 3-5: 동일 패턴**

### 9.3 코멘트 추가 모달

```
┌──────────────────────────────────────────────┐
│ ADD COMMENT - Production                    │
├──────────────────────────────────────────────┤
│                                              │
│  Type: [해석 ▼] [발견] [조치] [노트]       │
│                                              │
│  Content:                                    │
│  ┌──────────────────────────────────────────┐│
│  │ 금요일 설비 고장으로 인해 생산량 감소... ││
│  └──────────────────────────────────────────┘│
│                                              │
│  [Cancel]  [Save]                            │
│                                              │
└──────────────────────────────────────────────┘
```

### 9.4 상태 전환 플로우 (Status Machine)

```
┌─────────────────────┐
│ auto_generated       │ ← Cron 자동 생성
│ (시스템 생성)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ reviewed            │ ← 부서 담당자 검토
│ (검토 완료)         │    (코멘트 추가)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ approved            │ ← 관리자 최종 승인
│ (최종 확정)         │    (배포 가능)
└─────────────────────┘
```

---

## 10. 구현 로드맵

### Phase 1: 기초 설정 (1주)

- [x] DB 테이블 생성 (weekly_reports, weekly_comments)
- [x] 부서별 RPC 함수 작성 (get_weekly_*_data 4개)
- [x] Vercel Cron 설정
- [ ] `/api/cron/weekly-reports` 엔드포인트 구현
- [ ] `/api/weekly-reports/generate` 수동 트리거 API

**기한:** 2026-05-31

---

### Phase 2: API 개발 (1주)

- [ ] CRUD 엔드포인트 (GET, PATCH)
- [ ] 코멘트 관리 API
- [ ] Export (Excel/PDF) API
- [ ] 에러 처리 & 로깅

**기한:** 2026-06-07

---

### Phase 3: UI 개발 (1.5주)

- [ ] 목록 화면 (`WeeklyReportList`)
- [ ] 상세 화면 + 탭 (`WeeklyReportDetail`, 5개 Tab)
- [ ] 코멘트 UI
- [ ] 상태 전환 버튼
- [ ] 모바일 반응형 최적화

**기한:** 2026-06-14

---

### Phase 4: 테스트 & 배포 (0.5주)

- [ ] E2E 테스트
- [ ] 성능 테스트 (대용량 데이터)
- [ ] Vercel 배포 & 모니터링

**기한:** 2026-06-18

---

### Phase 5: 선택 기능 (향후)

- [ ] Telegram 자동 알림
- [ ] 다국어 (한글/영어/타밀어)
- [ ] AI 해석 추가
- [ ] PDF 레이아웃 커스터마이징

**기한:** 2026-07-15

---

## 부록: 데이터 예시

### 자동 생성된 주간 보고서 JSON

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "year": 2026,
  "week": 20,
  "week_start_date": "2026-05-18",
  "week_end_date": "2026-05-24",
  "status": "auto_generated",
  "generated_at": "2026-05-25T23:00:00Z",
  "production": {
    "plan": 1000,
    "actual": 950,
    "achievement_rate": 95.0,
    "oee": 78.5,
    "daily_breakdown": [
      { "date": "2026-05-18", "qty": 200, "oee": 85.0 },
      { "date": "2026-05-19", "qty": 180, "oee": 80.5 },
      { "date": "2026-05-20", "qty": 150, "oee": 75.0 },
      { "date": "2026-05-21", "qty": 200, "oee": 82.0 },
      { "date": "2026-05-22", "qty": 220, "oee": 88.0 },
      { "date": "2026-05-23", "qty": 0, "oee": 0 },
      { "date": "2026-05-24", "qty": 0, "oee": 0 }
    ],
    "notes": ""
  },
  "technology": {
    "equipment_check_count": 12,
    "improvement_count": 3,
    "issues_found": 2,
    "schedule_adherence": 100.0,
    "notes": ""
  },
  "maintenance": {
    "bm_incidents": 2,
    "bm_completed": 2,
    "pm_planned": 8,
    "pm_completed": 7,
    "pm_achievement": 87.5,
    "mttr_hours": 2.3,
    "mtbf_hours": 156.8,
    "total_downtime_hours": 4.6,
    "notes": ""
  },
  "management": {
    "cost_savings": 125000,
    "schedule_achievement": 96.5,
    "safety_incidents": 0,
    "quality_defects": 15,
    "notes": ""
  },
  "comments": [
    {
      "id": "comment-uuid-1",
      "department": "production",
      "comment_type": "interpretation",
      "content": "금요일 설비 고장(DCMI-UTL-PSF-01) 발생으로 생산량 50개 감소. 토요일 보전팀 대응으로 월요일 정상화. 주간 달성율 95% 유지.",
      "author_name": "김철수",
      "author_id": "user-uuid-1",
      "created_at": "2026-05-25T09:30:00Z"
    },
    {
      "id": "comment-uuid-2",
      "department": "maintenance",
      "comment_type": "finding",
      "content": "MTTR 2.3시간으로 전월(3.1시간) 대비 26% 개선. 예방정비 달성율 87.5%는 계획(90%) 대비 약간 낮음 → PM 스케줄 재검토 필요.",
      "author_name": "박영수",
      "author_id": "user-uuid-2",
      "created_at": "2026-05-25T10:15:00Z"
    }
  ],
  "file_status": {
    "excel": null,
    "pdf": null
  }
}
```

---

## 요약

**권장 방식:** Option B (중간 수준, Mixed Pattern)

**3주 개발 일정:**
- Week 1: DB + API 기초
- Week 2: API 완성 + UI 설계
- Week 3: UI 구현 + 테스트

**핵심 가치:**
- 각 부서의 실적 데이터 → 자동 집계
- 일관성 있는 주간 보고서 생성
- 부서별 리뷰 & 코멘트 추가 (선택)
- Excel/PDF 다운로드 가능
- 향후 AI 해석, 다국어 확장 용이
