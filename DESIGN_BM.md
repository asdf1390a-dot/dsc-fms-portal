# BM 이력 모듈 — 플레너 설계서

> 작성일: 2026-05-12  
> 작성자: Web App Designer/Planner (DSC FMS Portal)  
> 대상 개발자: web-builder  
> 포털: https://dsc-fms-portal.vercel.app

---

## 0. 현황 분석 (기존 코드 기반)

기존 3개 파일이 이미 구현되어 있음:
- `pages/bm/index.js` — 목록 페이지 (카드형, 탭 필터, 검색 존재)
- `pages/bm/new.js` — 고장 신고 폼 (4단계 계층형 자산 선택, 다국어 EN/KO/TA/HI)
- `pages/bm/[id].js` — 상세/수정 페이지 (상태 전환, 조치 내용 저장, 사진 lightbox)

DB도 `04_bm_module_v2.sql`에 상당 부분 구현되어 있음:
- `bm_events` 테이블 (v2 컬럼 포함)
- `cause_codes`, `technicians` 마스터 테이블
- `bm_kpi` 뷰 (MTTR/MTBF 자동 계산)
- RLS 정책, 인덱스, updated_at 트리거

**결론: 신규 개발보다 "빠진 기능 보완 + 미구현 페이지 추가"가 핵심.**

---

## 1. 기능 목적

설비 고장 발생 시 수리 이력을 기록·조회하는 모듈.  
공장 생산관리·보전팀이 매일 사용. 현장 작업자(인도, 타밀나두)가 스마트폰(Telegram 링크)으로 신고.

---

## 2. DB 스키마

### 2-1. bm_events (기존 + 보완)

기존 `04_bm_module_v2.sql`에 핵심 컬럼은 이미 있음.  
아래는 **현재 누락된 컬럼**만 추가 ALTER로 반영할 내용.

```sql
-- 파일명: 11_bm_missing_columns.sql
-- 기존 bm_events에서 [id].js가 참조하지만 스키마에 없는 컬럼

alter table bm_events
  add column if not exists action_taken   text,          -- 조치 내용 (보전팀 입력)
  add column if not exists cause          text,          -- 자유 형식 원인 기술 (현장용)
  add column if not exists resolved_by    uuid references auth.users(id),
  add column if not exists resolver_name  text,          -- 수리 완료자 이름
  add column if not exists reported_by    uuid references auth.users(id),
  add column if not exists symptom_ta     text,          -- 타밀어 증상 (현장 입력용)
  add column if not exists photos         text[] default '{}',  -- Storage URL 배열
  add column if not exists downtime_minutes integer      -- 계산값 캐시 (resolved 시 자동 계산)
    generated always as (
      case
        when downtime_end is not null and downtime_start is not null
        then extract(epoch from (downtime_end - downtime_start))::integer / 60
        else null
      end
    ) stored;

-- wontfix 상태 허용 (기존 제약에 없음)
alter table bm_events
  drop constraint if exists bm_events_status_check;
alter table bm_events
  add constraint bm_events_status_check
    check (status in ('open','in_progress','pending_parts','resolved','cancelled','wontfix'));

-- Severity 컬럼 (신고 폼에서 사용)
alter table bm_events
  add column if not exists severity text not null default 'normal'
    check (severity in ('minor','normal','major','line_down'));

-- reporter_name (신고자 이름 텍스트)
alter table bm_events
  add column if not exists reporter_name text;

-- symptom (증상 설명 텍스트)
alter table bm_events
  add column if not exists symptom text;
```

### 2-2. 전체 bm_events 컬럼 목록 (신규 프로젝트 기준)

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid PK | gen_random_uuid() |
| asset_id | uuid FK → assets | NOT NULL |
| reported_at | timestamptz | 신고 시각, default now() |
| reporter_name | text | 신고자 이름 |
| reported_by | uuid FK → auth.users | Supabase 로그인 UID |
| severity | text | minor/normal/major/line_down |
| priority | text | low/medium/high/critical |
| status | text | open/in_progress/pending_parts/resolved/cancelled/wontfix |
| symptom | text | 증상 (영어) |
| symptom_ta | text | 증상 (타밀어) |
| cause_code | text FK → cause_codes | 고장 원인 코드 |
| cause | text | 자유 형식 원인 기술 |
| action_taken | text | 조치 내용 |
| technician_id | uuid FK → technicians | 담당 보전원 |
| downtime_start | timestamptz | 실제 기계 정지 시각 |
| downtime_end | timestamptz | 실제 기계 재가동 시각 |
| downtime_minutes | integer GENERATED | 자동 계산 (분) |
| work_hours | numeric(5,2) | 실 투입 공수 (h) |
| resolved_at | timestamptz | 완료 처리 시각 |
| resolved_by | uuid FK → auth.users | 완료 처리자 UID |
| resolver_name | text | 완료 처리자 이름 |
| photos | text[] | Storage public URL 배열 |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | trigger 자동 갱신 |

### 2-3. 인덱스 (추가분)

```sql
create index if not exists bm_events_severity_idx  on bm_events(severity);
create index if not exists bm_events_resolved_at_idx on bm_events(resolved_at desc);
-- 복합: KPI 집계용
create index if not exists bm_events_asset_month_idx
  on bm_events(asset_id, date_trunc('month', reported_at));
```

### 2-4. RLS 정책

```sql
-- bm_events: 인증 사용자 전체 허용 (현장 작업자 포함)
alter table bm_events enable row level security;
drop policy if exists "auth_all_bm_events" on bm_events;
create policy "auth_all_bm_events" on bm_events
  for all to authenticated using (true) with check (true);

-- bm_photos Storage bucket (Supabase Dashboard에서 직접 설정)
-- Bucket: bm-photos, Public read, Authenticated write
```

### 2-5. bm_kpi 뷰 (기존 유지, 보완 불필요)

이미 `04_bm_module_v2.sql`에 구현됨. MTTR/MTBF 자동 집계.

---

## 3. 페이지 구조

```
pages/bm/
  index.js          [기존 - 보완 필요]  목록 페이지
  new.js            [기존 - 완성됨]     신고 폼
  [id].js           [기존 - 보완 필요]  상세/수정
  edit/
    [id].js         [신규]              수정 전용 폼 (관리자용)
  stats.js          [신규]              월별 KPI 요약 (MTTR/MTBF)
```

---

## 4. 각 페이지 상세 설계

### 4-1. 목록 페이지 (`pages/bm/index.js`) — 보완

**현황:** 카드형 목록, 탭 필터(OPEN/IN PROGRESS/ALL/RESOLVED), 검색 바 구현됨.

**추가 필요한 기능:**

#### 4-1-A. 날짜 범위 필터 (접기/펼치기)
```
[필터 아이콘] 필터  ▼
  기간:  [이번 달] [지난 달] [직접 입력]
  설비:  [전체 ▼] (자산 드롭다운)
```
- 기본: 접힌 상태, 탭 바 아래 "필터" 버튼으로 토글
- 날짜 미선택 시 최근 500건 (기존 동일)
- 날짜 선택 시 Supabase query에 `.gte('reported_at', startISO).lte('reported_at', endISO)` 추가

#### 4-1-B. KPI 요약 배너
```
[이번 달 고장 12건]  [해결 9건]  [평균 MTTR 47분]
```
- 목록 최상단, 카드 형태
- 데이터: `bm_kpi` 뷰에서 현재 월 집계

#### 4-1-C. 정렬 옵션
- 기본: 최신순 (기존 동일)
- 추가: `우선순위 높은 순` 토글 버튼

### 4-2. 신고 폼 (`pages/bm/new.js`) — 완성됨, 변경 없음

현재 구현 완성도 높음. 유지.

**참고 (기존 동작):**
1. 부서 선택 (Machine/Mould/JIG)
2. 카테고리 or 차종 선택
3. 공정 선택 (Mould/JIG)
4. 자산 선택
5. 심각도 (low/medium/high/critical)
6. 증상 입력 (영어 + 타밀어)
7. 고장 발생 시각
8. 원인 코드
9. 신고자 이름
10. 사진 첨부
11. 제출 → Discord 알림 → `/bm` 리다이렉트

### 4-3. 상세 페이지 (`pages/bm/[id].js`) — 보완

**현황:** 상태 전환, 조치 내용 저장, 사진 lightbox, Timeline 구현됨.

**추가 필요한 기능:**

#### 4-3-A. 수리 완료 시 downtime_end 자동 기록
```javascript
// resolveNow() 함수에 추가
const patch = {
  ...기존,
  downtime_end: new Date().toISOString(),  // 추가
};
```

#### 4-3-B. 담당 보전원 지정
```
Section "담당자 / Technician"
  [드롭다운: 보전팀 목록] → technician_id 업데이트
  표시: 이름 + 팀(mechanical/electrical/general)
```

#### 4-3-C. 실 투입 공수 입력
```
Section "투입 공수"
  [숫자 입력: 시간] h  → work_hours 저장
```

#### 4-3-D. 수정 페이지 링크 (관리자용)
```
헤더 우측: [편집] 버튼 → /bm/edit/[id]
isAuthed 조건으로만 표시
```

### 4-4. 수정 폼 (`pages/bm/edit/[id].js`) — 신규

**목적:** 관리자/보전팀이 기존 BM 이력 전체를 수정하는 페이지.

**화면 구성:**
```
헤더: ← BM #xxxxxx  |  수정 / Edit
─────────────────────────────────
Section: 자산 (읽기 전용, 변경 불가)
  자산번호 + 이름 표시

Section: 상태
  [드롭다운: open/in_progress/pending_parts/resolved/wontfix]

Section: 심각도
  [4버튼: minor/normal/major/line_down] (기존 new.js 스타일)

Section: 증상
  [textarea: symptom]
  [textarea: symptom_ta]

Section: 고장 발생 시각
  [datetime-local: downtime_start]

Section: 수리 완료 시각
  [datetime-local: downtime_end]

Section: 원인 코드
  [드롭다운: cause_codes grouped]

Section: 원인 상세
  [textarea: cause]

Section: 조치 내용
  [textarea: action_taken]

Section: 담당자
  [드롭다운: technicians]

Section: 투입 공수 (h)
  [number input: work_hours]

[취소]  [저장]
```

**사용자 흐름:**
1. `/bm/[id]` 에서 [편집] 버튼 클릭
2. 기존 데이터 prefill
3. 수정 후 [저장] → PATCH → `/bm/[id]` 리다이렉트
4. 저장 성공 시 `savedFlash` 표시

**엣지 케이스:**
- `downtime_end < downtime_start` → 에러 표시, 저장 차단
- `status: resolved`로 변경 시 `resolved_at` 자동 세팅
- 비인증 접근 → `/login?next=/bm/edit/[id]` 리다이렉트

### 4-5. 월별 KPI 페이지 (`pages/bm/stats.js`) — 신규

**목적:** 관리자가 MTTR/MTBF/월별 고장 건수를 조회.

**화면 구성:**
```
헤더: ← BM  |  BM 통계  |  [월 선택]

─── 요약 카드 (3개, 가로 배열) ────
[이번 달 고장]  [평균 MTTR]  [평균 MTBF]
   12건           47분          580시간

─── 설비별 테이블 ────────────────
자산번호 | 이름 | 고장건 | MTTR | MTBF | 총다운타임
DCMI-001 | Press A | 3 | 52분 | 189h | 156분
...

─── 원인별 파이 차트 (텍스트 버전) ─
MECH-WEAR: 4건 (33%)
ELEC-SHORT: 3건 (25%)
...
```

**데이터 소스:** `bm_kpi` 뷰 + 직접 `bm_events` 집계 쿼리  
**월 선택:** `<select>` 드롭다운 (최근 12개월)

---

## 5. 컴포넌트 구조

### 5-1. 기존 컴포넌트 (변경 없음)

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| `BottomNav` | `components/BottomNav.js` | 하단 네비게이션 (6탭) |
| `PhotoUploader` | `components/PhotoUploader.js` | 사진 업로드 (현재 미사용) |

### 5-2. 신규 컴포넌트

#### `components/bm/BMCard.js`
```
props:
  event: {
    id, asset_id, reported_at, reporter_name,
    severity, priority, symptom, status, resolved_at,
    assets: { machine_asset_number, name_en, location }
  }
  onClick?: () => void

역할: 목록 페이지의 카드 1개. index.js에서 인라인으로 렌더링하던 것을 컴포넌트로 분리.
```

#### `components/bm/BMStatusBadge.js`
```
props:
  status: 'open' | 'in_progress' | 'pending_parts' | 'resolved' | 'wontfix'
  size?: 'sm' | 'md'

역할: 상태 pill (색상 뱃지). index.js, [id].js, edit/[id].js에서 공통 사용.
```

#### `components/bm/BMSeverityBar.js`
```
props:
  severity: 'minor' | 'normal' | 'major' | 'line_down'
  orientation?: 'vertical' | 'horizontal'

역할: 카드 좌측 4px 색상 바. severity → 색상 매핑 로직 중앙화.
```

#### `components/bm/TechnicianSelect.js`
```
props:
  value: string (technician_id)
  onChange: (id: string) => void
  disabled?: boolean

역할: technicians 테이블 로드 + 드롭다운 렌더링.
      팀 그룹별로 <optgroup> 구분 (mechanical/electrical/general).
```

#### `components/bm/BMFilterPanel.js`
```
props:
  open: boolean
  onClose: () => void
  startDate: string
  endDate: string
  assetId: string
  onApply: ({ startDate, endDate, assetId }) => void

역할: 기간/설비 필터 패널 (목록 페이지 토글 UI).
      접기/펼치기 애니메이션 없이 조건부 렌더링.
```

#### `components/bm/BMKpiSummary.js`
```
props:
  month: string (YYYY-MM)
  assetIds?: string[]  // 필터된 설비만 집계 시

역할: 목록 페이지 상단 KPI 배너 (이번 달 고장 N건, 평균 MTTR Nm).
      bm_kpi 뷰에서 데이터 로드.
```

---

## 6. API Routes

### 현재 없음 → Supabase PostgREST 직접 사용이 기본 패턴

기존 pages/api/ 구조를 보면 `discord-notify.js`, `photos/` 등 특수 목적에만 API route 사용.  
BM 모듈도 동일 패턴 유지 — 일반 CRUD는 Supabase client 직접 호출.

### 신규 API Routes (서버사이드 처리 필요한 것만)

#### `pages/api/bm/resolve.js`
```
POST /api/bm/resolve
Body: { id, action_taken, cause, work_hours, downtime_end }
역할: 수리 완료 처리 원자적 실행.
      status=resolved, resolved_at=now(), downtime_end 동시 업데이트.
      Discord Webhook 알림 발송 (선택).

응답:
  200: { success: true, event: {...} }
  400: { error: 'validation message' }
  401: 미인증
```

#### `pages/api/bm/stats.js`
```
GET /api/bm/stats?month=2026-05
역할: 해당 월의 bm_kpi 뷰 데이터 + cause_code별 집계 반환.
      Supabase service_role key 사용 (집계 쿼리 권한 필요 시).

응답:
  200: {
    summary: { total, resolved, avg_mttr_min },
    by_asset: [ { asset_id, name_en, breakdown_count, mttr_min, mtbf_min, total_downtime_min } ],
    by_cause: [ { cause_code, count, pct } ]
  }
```

#### `pages/api/bm/notify.js` (기존 discord-notify.js 확장 또는 신규)
```
POST /api/bm/notify
Body: { type: 'bm_resolved', id, asset_label, downtime_min, action_taken }
역할: BM 해결 시 Discord 알림 (bm_created는 new.js에서 직접 발송 중 → 이미 구현됨).
```

---

## 7. UI/UX 요구사항

### 7-1. 디자인 시스템 (기존 패턴 유지)

| 항목 | 값 |
|------|-----|
| 배경 | `#0f172a` (다크 네이비) |
| 카드 배경 | `#1e293b` |
| 섹션 헤더 배경 | `#0f172a` |
| 입력 필드 배경 | `#0b1220` |
| 테두리 | `#1f2937`, `#334155` |
| 주 텍스트 | `#e2e8f0`, `#f8fafc` |
| 보조 텍스트 | `#94a3b8`, `#64748b` |
| 강조색 (레드) | `#dc2626` |
| 성공색 | `#16a34a`, `#22c55e` |
| 폰트 스택 | `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", "Noto Sans KR", sans-serif` |
| 최대 너비 | `480px`, `margin: 0 auto` |
| 최소 탭 높이 | `44px` (iOS touch target) |
| 하단 패딩 | `calc(60px + env(safe-area-inset-bottom, 0px) + 24px)` |

### 7-2. 모바일 우선 원칙

- **Telegram 링크** 진입: `?asset=DCMI-XXX` 파라미터로 자산 자동 선택 (기존 구현됨)
- **터치 타겟** 최소 44px (기존 준수)
- **폰트 크기** input 최소 16px (iOS auto-zoom 방지, 기존 준수)
- **스크롤** 단방향 (세로), 수평 스크롤 탭바만 허용
- **오프라인 고려** 필요 없음 (공장 내 WiFi 환경)

### 7-3. 언어 정책

| 화면 | 언어 |
|------|------|
| 신고 폼 (new.js) | EN/KO/TA/HI 다국어 토글 (기존) |
| 목록 (index.js) | 한국어 레이블 + 영어 상태 pill |
| 상세 (id.js) | 한국어/영어 혼용 (Section 타이틀 "Action Taken / 조치 내용" 패턴) |
| 수정 폼 (edit/id.js) | 한국어 레이블 (관리자 사용) |
| 통계 (stats.js) | 한국어 레이블 |

### 7-4. 상태 전환 흐름

```
open
  ├─→ in_progress
  ├─→ pending_parts
  ├─→ resolved
  └─→ wontfix

in_progress
  ├─→ pending_parts
  ├─→ resolved
  └─→ open

pending_parts
  ├─→ in_progress
  └─→ resolved

resolved
  └─→ in_progress  (재개 처리)

wontfix
  └─→ open
```

---

## 8. 엣지 케이스

### 8-1. 데이터 관련

| 상황 | 처리 방법 |
|------|-----------|
| asset_id 없는 고아 이벤트 | `assets(...)` JOIN 결과 null 처리, `'—'` 표시 |
| photos 배열 null | `Array.isArray(event?.photos) ? event.photos : []` 패턴 (기존 적용됨) |
| downtime_end < downtime_start | edit 폼에서 submit 전 validation, 에러 표시 |
| 이미 resolved 상태에서 재편집 | 허용 (재개 가능), 단 `resolved_at`은 유지 |
| cause_codes 마스터 없을 때 | cause select 비활성화 또는 빈 옵션 표시 |
| technicians 테이블 비어있을 때 | "담당자 미지정" 옵션으로 처리 |

### 8-2. 인증 관련

| 상황 | 처리 방법 |
|------|-----------|
| 미인증 상태에서 `/bm` 접근 | 목록 조회는 허용 (공개 조회), 신고 버튼 숨김 |
| 미인증 상태에서 `/bm/new` | 로그인 리다이렉트 (기존 구현됨) |
| 미인증 상태에서 `/bm/[id]` | 조회만 허용, 수정 UI 숨김 (기존 `isAuthed` 조건 적용됨) |
| 미인증 상태에서 `/bm/edit/[id]` | 로그인 리다이렉트 |
| 미인증 상태에서 `/bm/stats` | 로그인 리다이렉트 (관리자 전용) |

### 8-3. 네트워크/로딩 관련

| 상황 | 처리 방법 |
|------|-----------|
| Supabase 응답 지연 | loading 스켈레톤 또는 "불러오는 중…" 텍스트 |
| 중복 제출 | `busy` 상태로 버튼 비활성화 (기존 패턴) |
| 사진 업로드 실패 | 콘솔 경고 + 계속 진행 (사진 없이 저장, 기존 패턴) |
| Discord 알림 실패 | fire-and-forget, 무시 (기존 패턴) |

### 8-4. stats 페이지 특수 케이스

| 상황 | 처리 방법 |
|------|-----------|
| 해당 월 고장 0건 | "이번 달 고장 없음" 메시지 |
| MTBF 계산 불가 (건수 0) | `—` 표시 |
| bm_kpi 뷰 데이터 없음 | "데이터 없음" 표시 |

---

## 9. 구현 우선순위 (web-builder용)

### Phase 1 — 즉시 (기존 버그/누락 수정)
1. `11_bm_missing_columns.sql` Supabase에 실행
   - `action_taken`, `cause`, `resolved_by`, `resolver_name`, `reported_by`, `symptom_ta`, `photos`, `symptom`, `reporter_name`, `severity` 컬럼 추가
   - `wontfix` status 허용 (제약 변경)
2. `[id].js` resolveNow()에 `downtime_end: new Date().toISOString()` 추가
3. `[id].js`에 TechnicianSelect 컴포넌트 연결 (technician_id 저장)

### Phase 2 — 단기 (핵심 신규 기능)
4. `components/bm/TechnicianSelect.js` 신규 작성
5. `pages/bm/edit/[id].js` 신규 작성
6. `pages/api/bm/resolve.js` 신규 작성 (원자적 완료 처리)
7. `index.js` 날짜 필터 패널 추가 (BMFilterPanel)

### Phase 3 — 중기 (관리자 기능)
8. `pages/api/bm/stats.js` 신규 작성
9. `pages/bm/stats.js` 신규 작성 (KPI 대시보드)
10. `components/bm/BMKpiSummary.js` — 목록 상단 KPI 배너

---

## 10. 파일 목록 최종 정리

```
pages/bm/
  index.js          기존 (Phase 2에서 필터 추가)
  new.js            기존 (변경 없음)
  [id].js           기존 (Phase 1에서 보완)
  edit/
    [id].js         신규 (Phase 2)
  stats.js          신규 (Phase 3)

pages/api/bm/
  resolve.js        신규 (Phase 2)
  stats.js          신규 (Phase 3)
  notify.js         신규 (Phase 2, 선택)

components/bm/
  BMCard.js         신규 (Phase 2, 선택적 리팩터)
  BMStatusBadge.js  신규 (Phase 2)
  BMSeverityBar.js  신규 (Phase 2)
  TechnicianSelect.js  신규 (Phase 1)
  BMFilterPanel.js  신규 (Phase 2)
  BMKpiSummary.js   신규 (Phase 3)

db/
  11_bm_missing_columns.sql  신규 (Phase 1, Supabase에서 직접 실행)
```

---

## 11. Supabase Storage 설정 (체크리스트)

- [ ] Bucket `bm-photos` 생성 (이미 있으면 skip)
- [ ] Public read 허용
- [ ] Authenticated write 허용
- [ ] 최대 파일 크기: 10MB
- [ ] 허용 MIME: `image/jpeg, image/png, image/webp, image/heic, image/heif`
