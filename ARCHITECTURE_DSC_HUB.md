# DSC Hub 아키텍처 설계서

> 상태: **최종 설계** (웹개발자 구현 전 확인용)
> 작성일: 2026-05-13
> 담당: 비서 (플레너)

---

## 1. 시스템 개요

### 1.1 구조 변경

**기존 상태:**
- dsc-fms-portal = 단일 FMS 시스템
- Career 모듈은 별도 탭
- 여행기록은 미구현

**변경 후:**
- **DSC Hub** (메인 앱) — 통합 메뉴/인증
  - 탭 1: Personal History (개인이력)
  - 탭 2: DSC FMS (기존 모듈들)
  - 탭 3: Travel Records (신규)

### 1.2 핵심 특징

- **Next.js 14 + Supabase** (기존 스택 유지)
- **모바일 퍼스트** (인도 현장 작업자 폰 사용)
- **영어 + 타밀어** (현장), 한국어 + 영어 (관리자)
- **단순한 UI** — 탭 기반 네비게이션
- **기존 스타일 유지** — 색상/레이아웃 통일성

---

## 2. 페이지 라우팅 구조

```
/
├── /login                          (기존)
├── /index                          (홈 / 대시보드)
│   └── 3개 탭 렌더링 (Client-side routing)
│
├── [TAB 1] Personal History
│   ├── /career                     (회사/프로젝트/성과 목록)
│   ├── /career/companies           (회사 목록 + 추가)
│   ├── /career/companies/[id]      (회사 상세 + 편집)
│   ├── /career/projects            (프로젝트 목록)
│   ├── /career/projects/[id]       (프로젝트 상세 + 편집)
│   └── /career/achievements        (성과/스킬 목록)
│
├── [TAB 2] DSC FMS (기존 모듈)
│   ├── /assets                     (자산 마스터)
│   ├── /bm                         (BM 이력)
│   ├── /inventory                  (재고)
│   ├── /pm                         (보전계획)
│   ├── /kpi                        (KPI 대시보드)
│   ├── /wo                         (작업지시)
│   └── /reports                    (경영실적)
│
├── [TAB 3] Travel Records
│   ├── /travel                     (여행 목록)
│   ├── /travel/[id]                (여행 상세 + 편집)
│   ├── /travel/[id]/schedule       (일정 관리)
│   ├── /travel/[id]/costs          (비용 관리)
│   └── /travel/[id]/map            (지도 - 이동 경로)
│
├── /api/*                          (모든 API 엔드포인트)
└── /status                         (기존)
```

### 2.1 탭 네비게이션 구현

**위치:** 최상단 (모든 페이지 공통)

```
┌─────────────────────────────────────────────────────┐
│ DSC Hub    [🏠] [Personal] [DSC FMS] [Travel] [👤]  │
└─────────────────────────────────────────────────────┘
```

- 로고: "DSC Hub"
- 3개 탭 버튼 + 프로필 메뉴
- 활성 탭 표시 (배경색/밑줄)
- 모바일: 스택 가능한 메뉴 + 햄버거 아이콘

---

## 3. 컴포넌트 계층 구조

### 3.1 레이아웃 컴포넌트

```
components/
├── Layout.jsx                      (루트 레이아웃 - 헤더/탭/푸터)
├── TabNavigation.jsx               (탭 버튼 + 활성 상태)
├── Header.jsx                      (로고 + 프로필 메뉴)
└── Footer.jsx                      (저작권)
```

### 3.2 Tab 1: Personal History

```
components/career/
├── CareerDashboard.jsx             (3개 섹션: 회사/프로젝트/성과)
├── CompanyCard.jsx                 (회사 요약 카드)
├── CompanyForm.jsx                 (회사 추가/편집 폼)
├── ProjectCard.jsx                 (프로젝트 요약)
├── ProjectForm.jsx                 (프로젝트 추가/편집 폼)
├── AchievementCard.jsx             (성과 태그)
└── AchievementForm.jsx             (성과 추가 폼)
```

### 3.3 Tab 2: DSC FMS

**기존 컴포넌트 유지:**
```
components/
├── assets/                         (자산 CRUD, QR)
├── bm/                             (BM 이력 폼 + 대시보드)
├── inventory/                      (재고 관리)
├── pm/                             (보전 계획)
├── kpi/                            (KPI 차트)
├── wo/                             (작업지시)
└── reports/                        (경영실적)
```

### 3.4 Tab 3: Travel Records

```
components/travel/
├── TravelDashboard.jsx             (여행 목록 + 요약)
├── TravelCard.jsx                  (여행 요약 카드)
├── TravelForm.jsx                  (여행 추가/편집 폼)
├── TravelDetail.jsx                (여행 상세 조회)
├── ScheduleEditor.jsx              (일정 추가/편집)
├── CostTracker.jsx                 (비용 입력/조회)
└── TravelMap.jsx                   (Google Maps - 이동경로)
```

---

## 4. Supabase DB 스키마 설계

### 4.1 기존 테이블 (유지)

```
✓ categories, asset_classes, assets
✓ bm_history, bm_events
✓ spare_parts, stock_movements, vendors
✓ pm_plans, pm_schedules, pm_work_logs, pm_parts_used
✓ kpi_categories, kpi_targets, kpi_actuals
✓ work_orders
✓ career_companies, career_projects, career_achievements, career_skills
```

### 4.2 신규 테이블: Travel Module

#### Table: `travel_records`
```sql
CREATE TABLE travel_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 기본 정보
  title TEXT NOT NULL,                  -- "India Visit 2026-05"
  description TEXT,                    -- 목적/메모
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  country TEXT DEFAULT 'India',
  
  -- 통계
  total_distance_km INT DEFAULT 0,      -- 이동 거리 (km)
  total_cost_inr DECIMAL(10,2) DEFAULT 0,  -- 총 비용 (INR)
  total_cost_krw DECIMAL(12,2) DEFAULT 0,  -- 총 비용 (KRW)
  
  -- 상태
  status TEXT DEFAULT 'planning' 
    CHECK (status IN ('planning', 'ongoing', 'completed', 'cancelled')),
  
  -- 첨부
  photos TEXT[] DEFAULT '{}',          -- URLs
  documents TEXT[] DEFAULT '{}',       -- 여행 문서 URLs
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_travel_user ON travel_records(user_id);
CREATE INDEX idx_travel_date ON travel_records(start_date DESC);
```

#### Table: `travel_schedules`
```sql
CREATE TABLE travel_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id UUID NOT NULL REFERENCES travel_records(id) ON DELETE CASCADE,
  
  -- 일정
  date DATE NOT NULL,
  event_name TEXT NOT NULL,           -- "회사 방문", "Seoul HQ 회의"
  location TEXT NOT NULL,             -- "Seoul", "Hyderabad"
  description TEXT,
  
  -- 시간
  start_time TIME,
  end_time TIME,
  
  -- 지도 좌표 (구글맵용)
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  
  -- 순서
  sort_order INT DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_schedules_travel ON travel_schedules(travel_id);
CREATE INDEX idx_schedules_date ON travel_schedules(date ASC);
```

#### Table: `travel_costs`
```sql
CREATE TABLE travel_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id UUID NOT NULL REFERENCES travel_records(id) ON DELETE CASCADE,
  
  -- 비용
  cost_type TEXT NOT NULL,             -- "flight", "hotel", "meal", "transport", "other"
  description TEXT,                   -- "Seoul-Busan flight ticket"
  
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'INR'          -- INR, KRW, USD
    CHECK (currency IN ('INR', 'KRW', 'USD')),
  
  -- 환율 (기록 시점의 환율)
  exchange_rate DECIMAL(8,4),          -- INR→KRW 기준값 저장
  
  -- 결재 상태
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- 첨부
  receipt_url TEXT,                   -- 영수증 이미지
  
  -- 날짜
  date DATE NOT NULL,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_costs_travel ON travel_costs(travel_id);
CREATE INDEX idx_costs_date ON travel_costs(date DESC);
CREATE INDEX idx_costs_type ON travel_costs(cost_type);
```

#### Table: `travel_routes`
```sql
CREATE TABLE travel_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id UUID NOT NULL REFERENCES travel_records(id) ON DELETE CASCADE,
  
  -- 이동 경로
  from_location TEXT NOT NULL,        -- "Chennai"
  to_location TEXT NOT NULL,          -- "Hyderabad"
  
  -- 좌표
  from_lat DECIMAL(9,6) NOT NULL,
  from_lon DECIMAL(9,6) NOT NULL,
  to_lat DECIMAL(9,6) NOT NULL,
  to_lon DECIMAL(9,6) NOT NULL,
  
  -- 거리/시간
  distance_km INT,
  duration_hours DECIMAL(5,2),
  transport_mode TEXT DEFAULT 'car'    -- car, flight, train, bus
    CHECK (transport_mode IN ('car', 'flight', 'train', 'bus', 'other')),
  
  -- 날짜
  travel_date DATE NOT NULL,
  
  -- Polyline (구글맵 경로 인코딩)
  polyline TEXT,                      -- encoded polyline from Google Directions API
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_routes_travel ON travel_routes(travel_id);
CREATE INDEX idx_routes_date ON travel_routes(travel_date);
```

### 4.3 RLS (Row Level Security) 정책

```sql
-- travel_records: 사용자 본인만 조회/편집
ALTER TABLE travel_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY travel_select ON travel_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY travel_insert ON travel_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY travel_update ON travel_records FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY travel_delete ON travel_records FOR DELETE
  USING (user_id = auth.uid());

-- travel_schedules, travel_costs, travel_routes
-- (travel_id를 통해 간접 필터링)
ALTER TABLE travel_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedule_access ON travel_schedules FOR ALL
  USING (travel_id IN (SELECT id FROM travel_records WHERE user_id = auth.uid()));

-- (비용, 경로도 동일하게)
```

### 4.4 Views (선택사항)

```sql
-- 여행별 비용 요약
CREATE VIEW v_travel_cost_summary AS
  SELECT 
    travel_id,
    COUNT(*) as cost_count,
    SUM(amount) as total_amount,
    STRING_AGG(DISTINCT currency, ',') as currencies
  FROM travel_costs
  GROUP BY travel_id;

-- 여행별 일정 개수
CREATE VIEW v_travel_schedule_count AS
  SELECT 
    travel_id,
    COUNT(*) as schedule_count,
    MIN(date) as first_day,
    MAX(date) as last_day
  FROM travel_schedules
  GROUP BY travel_id;
```

---

## 5. API 엔드포인트 설계

### 5.1 Travel API (`/api/travel/*`)

#### GET /api/travel
**목록 조회** (페이지네이션 선택사항)
```
응답:
{
  data: [
    {
      id: "...",
      title: "India Visit 2026-05",
      start_date: "2026-05-10",
      end_date: "2026-05-17",
      total_cost_inr: 50000,
      status: "completed",
      schedule_count: 8,
      cost_count: 15
    }
  ],
  count: 3
}
```

#### POST /api/travel
**여행 추가**
```
요청:
{
  title: "...",
  description: "...",
  start_date: "2026-05-10",
  end_date: "2026-05-17",
  country: "India"
}

응답:
{ id: "...", created_at: "..." }
```

#### GET /api/travel/[id]
**여행 상세** (schedules, costs, routes 포함)
```
응답:
{
  id: "...",
  title: "...",
  start_date: "...",
  end_date: "...",
  total_cost_inr: 50000,
  total_cost_krw: 775000,
  total_distance_km: 1200,
  schedules: [...],
  costs: [...],
  routes: [...]
}
```

#### PUT /api/travel/[id]
**여행 편집**

#### DELETE /api/travel/[id]
**여행 삭제** (cascading: schedules, costs, routes 함께 삭제)

---

### 5.2 Schedule API (`/api/travel/[travel_id]/schedule`)

#### GET /api/travel/[travel_id]/schedule
**일정 목록** (날짜순 정렬)

#### POST /api/travel/[travel_id]/schedule
**일정 추가**
```
요청:
{
  date: "2026-05-10",
  event_name: "Seoul HQ 회의",
  location: "Seoul",
  latitude: 37.5665,
  longitude: 126.9780,
  start_time: "10:00",
  end_time: "11:30"
}
```

#### PUT /api/travel/[travel_id]/schedule/[id]
**일정 편집**

#### DELETE /api/travel/[travel_id]/schedule/[id]
**일정 삭제**

---

### 5.3 Cost API (`/api/travel/[travel_id]/cost`)

#### GET /api/travel/[travel_id]/cost
**비용 목록** (날짜/타입 필터 선택사항)

#### POST /api/travel/[travel_id]/cost
**비용 추가**
```
요청:
{
  cost_type: "flight",
  description: "Seoul-Chennai flight",
  amount: 85000,
  currency: "KRW",
  date: "2026-05-10",
  exchange_rate: 15.5
}
```

#### PUT /api/travel/[travel_id]/cost/[id]
**비용 편집**

#### DELETE /api/travel/[travel_id]/cost/[id]
**비용 삭제**

---

### 5.4 Map API (`/api/travel/[travel_id]/map`)

#### GET /api/travel/[travel_id]/map/polyline
**경로 데이터** (Google Maps 그리기용)
```
응답:
{
  routes: [
    {
      from: "Chennai",
      to: "Hyderabad",
      polyline: "encoded string...",
      distance_km: 600,
      date: "2026-05-10"
    }
  ]
}
```

#### POST /api/travel/[travel_id]/map/route
**경로 추가** (Google Directions API 연동)
```
요청:
{
  from_location: "Chennai",
  to_location: "Hyderabad",
  date: "2026-05-10"
}

응답:
{
  polyline: "...",
  distance_km: 600,
  duration_hours: 6.5
}
```

---

## 6. UI/UX 설계

### 6.1 Tab 1: Personal History

#### 화면: /career (대시보드)

```
┌─────────────────────────────────────────────────────┐
│ Personal History                         [+ Add New] │
└─────────────────────────────────────────────────────┘

[Companies]
┌─────────────────┬─────────────────┬─────────────────┐
│ DSC Ltd         │ DAEWOO E&E      │ (Add New)       │
│ 2024 - Present  │ 2022 - 2024     │                 │
│ Chennai, India  │ Seoul, Korea    │ [+]             │
│ Tech Lead       │ Manager         │                 │
│ (2)             │ (1)             │                 │
└─────────────────┴─────────────────┴─────────────────┘

[Projects]
┌──────────────────────────────────────────────────────┐
│ ▸ FMS Portal Automation (DSC, 2024)                  │
│   Status: In Progress  |  Skills: Next.js, React    │
│   (2 achievements)                                   │
│ ▸ ERP Migration (DAEWOO E&E, 2023)                   │
│   Status: Completed  |  Impact: +30% efficiency     │
│   (1 achievement)                                    │
└──────────────────────────────────────────────────────┘

[Skills & Achievements]
┌──────────────────────────────────────────────────────┐
│ #Full-Stack-Development #Leadership #Process-Improvement
│ #Data-Analytics #Cost-Reduction
└──────────────────────────────────────────────────────┘
```

**컴포넌트:**
- 3개 섹션 (Companies, Projects, Skills)
- 회사 카드 (로고 + 직책 + 기간 + 프로젝트 개수)
- 프로젝트 리스트 (회사별 그룹)
- 스킬 태그 클라우드

**상호작용:**
- [+ Add New] → Company Form 팝업
- 회사 카드 클릭 → 편집 모드
- 프로젝트 항목 클릭 → 상세 보기
- 삭제 버튼 (휴지통 아이콘)

---

### 6.2 Tab 2: DSC FMS

**기존 레이아웃 유지**

```
┌─────────────────────────────────────────────────────┐
│ DSC FMS Dashboard                                   │
└─────────────────────────────────────────────────────┘

[Quick Actions]
┌──────┬──────┬──────┬──────┬──────┬──────┐
│ BM   │ PM   │ KPI  │ Inv  │ WO   │ +    │
└──────┴──────┴──────┴──────┴──────┴──────┘

[Cards / Charts - 기존 그대로]
```

---

### 6.3 Tab 3: Travel Records

#### 화면: /travel (목록)

```
┌─────────────────────────────────────────────────────┐
│ Travel Records                           [+ New Trip]│
└─────────────────────────────────────────────────────┘

[Filters]  [All] [Planning] [Ongoing] [Completed]

┌─────────────────────────────────────────────────────┐
│ India Visit 2026-05                                │
│ May 10 - May 17, 2026                             │
│ 8 days  |  1200 km  |  ₹50,000 (~₹775,000)        │
│                                                    │
│ [Schedule: 8] [Costs: 15] [View Map] [Edit]       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Seoul HQ Trip 2026-04                              │
│ Apr 15 - Apr 20, 2026                              │
│ 6 days  |  500 km  |  ₹120,000 (~₹1,860,000)      │
│ [Schedule: 5] [Costs: 12] [View Map] [Edit]       │
└─────────────────────────────────────────────────────┘
```

**모바일 레이아웃:**
```
┌─────────────────────┐
│ Travel Records  [+] │
├─────────────────────┤
│ India Visit 2026-05 │
│ May 10-17, 2026     │
│ 8 days, 1200km      │
│ ₹50,000             │
│ [Schedule][Costs]   │
│ [Map] [Edit]        │
└─────────────────────┘
```

---

#### 화면: /travel/[id] (상세)

```
┌─────────────────────────────────────────────────────┐
│ ◄ India Visit 2026-05                         [Edit]│
└─────────────────────────────────────────────────────┘

[3 Tabs: Schedule | Costs | Map]

[Schedule Tab]
┌─────────────────────────────────────────────────────┐
│ Day 1 (May 10) — Chennai to Hyderabad              │
│ ├─ 10:00 - 11:30: Depart Chennai (Airport)        │
│ ├─ 13:30 - 14:00: Arrive Hyderabad (Airport)      │
│ └─ 15:00 - 16:00: Check-in Hotel Taj              │
│ [+ Add Event]                                       │
│                                                    │
│ Day 2 (May 11) — Hyderabad                        │
│ ├─ 09:00 - 12:00: DSC Plant Tour                  │
│ └─ 14:00 - 16:00: Meeting with Plant Manager      │
│ [+ Add Event]                                       │
│                                                    │
│ ... (Days 3-8)                                      │
└─────────────────────────────────────────────────────┘

[Costs Tab]
┌─────────────────────────────────────────────────────┐
│ Total: ₹50,000 (~₹775,000 KRW)                     │
│ [Filter by Type] [All] [Flight] [Hotel] [Food]     │
│                                                    │
│ May 10: Flight Chennai-Hyderabad                   │
│   ₹22,000 (flight) | Receipt: [📎]                 │
│ May 10: Hotel Taj Hyderabad (Night 1)              │
│   ₹12,000 (hotel)                                  │
│ May 11: Lunch & Transport                          │
│   ₹3,000 (meal, transport)                         │
│ ...                                                │
│ [+ Add Cost]                                        │
└─────────────────────────────────────────────────────┘

[Map Tab]
┌─────────────────────────────────────────────────────┐
│ [Google Map Container]                             │
│ • Route 1: Chennai → Hyderabad (600 km)           │
│ • Route 2: Hyderabad → Bangalore (500 km)         │
│ • Markers: Schedule locations                      │
│                                                    │
│ [Legend]                                           │
│ ▬ Driving  ✈ Flight  🏨 Hotel  🚉 Transit        │
└─────────────────────────────────────────────────────┘
```

---

#### 화면: /travel/new (여행 추가)

```
┌─────────────────────────────────────────────────────┐
│ Create New Travel Record                           │
└─────────────────────────────────────────────────────┘

Travel Details
┌─────────────────────────────────────────────────────┐
│ Title: [India Visit 2026-05          ]              │
│ Description: [Business visit to plant            ] │
│ From: [May 10, 2026] To: [May 17, 2026]            │
│ Country: [India ▼]                                  │
│ Status: [Planning ▼]                               │
└─────────────────────────────────────────────────────┘

[Create] [Cancel]
```

---

### 6.4 모바일 반응형 설계

**원칙:**
- 탭 네비게이션: 상단 고정, 스와이프 가능
- 카드 레이아웃: 화면 너비에 맞춤 (2열 → 1열)
- 버튼: 충분한 터치 영역 (48px 최소)
- 폼: 풀 너비 입력 필드

---

## 7. 구현 로드맵 (Phase 기반)

### Phase 1: 레이아웃 변경 (1주)
**목표:** 3개 탭 네비게이션 완성

**작업:**
1. `components/Layout.jsx` 작성 (공통 헤더/탭/푸터)
2. `components/TabNavigation.jsx` 구현 (활성 탭 표시)
3. `/pages/index.js` 수정 (3개 탭 렌더링)
4. `/pages/career/`, `/pages/travel/` 디렉토리 생성
5. CSS: 모바일 반응형 (Tailwind / 기존 스타일 유지)

**산출물:**
- 모든 페이지에서 탭 전환 가능
- URL 기반 탭 활성화 (`?tab=personal`, `?tab=fms`, `?tab=travel`)
- 모바일 메뉴 축소 (햄버거 아이콘)

---

### Phase 2: Travel 모듈 — DB + CRUD (2주)
**목표:** 여행 기본 기능 완성

**작업:**
1. Supabase SQL 실행 (`travel_records`, `travel_schedules`, `travel_costs`, `travel_routes`)
2. `/pages/api/travel/*` 엔드포인트 구현
   - GET /api/travel (목록)
   - POST /api/travel (추가)
   - GET /api/travel/[id] (상세)
   - PUT /api/travel/[id] (편집)
   - DELETE /api/travel/[id] (삭제)
3. `/pages/travel/` UI 페이지
   - `/travel` (목록 + 필터)
   - `/travel/[id]` (상세 조회)
   - `/travel/new` (추가)
4. `components/travel/` 컴포넌트
   - TravelCard, TravelForm, TravelDetail

**산출물:**
- 여행 CRUD 완전 작동
- 여행 목록 페이지 (필터 포함)
- 여행 상세 페이지

---

### Phase 3: Travel 모듈 — 비용 + 일정 관리 (1주)
**목표:** 비용/일정 상세 기능

**작업:**
1. `/api/travel/[travel_id]/schedule` 엔드포인트
2. `/api/travel/[travel_id]/cost` 엔드포인트
3. Travel 상세 페이지에 3개 탭 구현
   - Schedule 탭 (일정 추가/편집/삭제)
   - Costs 탭 (비용 추가/편집/삭제, 통계)
   - Map 탭 (스켈레톤, 추후 구글맵 연동)
4. `components/travel/ScheduleEditor.jsx`, `CostTracker.jsx`

**산출물:**
- 여행별 일정 완전 관리
- 여행별 비용 추적 + 통계 (INR/KRW 환율 자동 계산)
- 비용 승인 워크플로우 (선택사항)

---

### Phase 4: Google Maps 통합 (1주)
**목표:** 이동 경로 지도 표시

**작업:**
1. Google Maps API 키 설정 (Vercel 환경변수)
2. `components/travel/TravelMap.jsx` 구현
   - Polyline 그리기 (routes)
   - Marker 표시 (schedules)
   - 범례 표시 (transport mode 색상 구분)
3. `/api/travel/[travel_id]/map` 엔드포인트
   - Google Directions API 연동 (optional)
   - Polyline 인코딩/저장

**산출물:**
- 여행 경로 지도 표시
- 일정/비용이 지도에 오버레이됨
- 거리/시간 자동 계산

---

### Phase 5: 추후 업데이트 (대기)
**미정 기능:**
- 여행 문서 첨부 (숙소 예약, 비자 등)
- 팀 공유 기능 (다른 사용자와 여행 일정 공유)
- 여행 템플릿 (자주 가는 경로)
- 환율 실시간 업데이트

---

## 8. 기술 스택 & 라이브러리

### 기존 유지
- **Framework:** Next.js 14
- **DB:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **UI:** Tailwind CSS (또는 기존 CSS)
- **Charts:** Recharts (KPI용)
- **Forms:** React Hook Form (선택사항)

### 신규 추가
- **Google Maps:** `@react-google-maps/api` (Phase 4)
- **Date Picker:** `react-datepicker` (여행 날짜 선택)
- **Icons:** Lucide React 또는 기존 사용 아이콘셋

### 버전 고정
```json
{
  "@react-google-maps/api": "^2.19.2",
  "react-datepicker": "^4.21.0",
  "lucide-react": "^0.294.0"
}
```

---

## 9. 파일 구조 변경

```
dsc-fms-portal/
├── db/
│   └── 21_travel_module.sql          (신규)
│
├── pages/
│   ├── api/
│   │   └── travel/
│   │       ├── index.js              (GET/POST /api/travel)
│   │       ├── [id].js               (GET/PUT/DELETE)
│   │       ├── [id]/
│   │       │   ├── schedule.js        (schedule CRUD)
│   │       │   ├── cost.js            (cost CRUD)
│   │       │   └── map.js             (polyline API)
│   │       └── (기존 다른 API는 유지)
│   │
│   ├── travel/
│   │   ├── index.js                  (여행 목록)
│   │   ├── [id].js                   (여행 상세 + 3탭)
│   │   ├── [id]/
│   │   │   ├── schedule.js            (일정 상세)
│   │   │   ├── costs.js               (비용 상세)
│   │   │   └── map.js                 (지도 상세)
│   │   └── new.js                    (여행 추가)
│   │
│   ├── career/                        (기존, 경로 변경 없음)
│   │   ├── index.js
│   │   ├── companies/
│   │   ├── projects/
│   │   └── achievements/
│   │
│   ├── index.js                       (메인 대시보드 - 3탭 렌더링)
│   └── (기존 다른 페이지는 유지)
│
├── components/
│   ├── Layout.jsx                     (공통 헤더/탭/푸터 - 신규)
│   ├── TabNavigation.jsx              (탭 버튼 - 신규)
│   │
│   ├── travel/                        (여행 모듈 - 신규)
│   │   ├── TravelDashboard.jsx
│   │   ├── TravelCard.jsx
│   │   ├── TravelForm.jsx
│   │   ├── TravelDetail.jsx
│   │   ├── ScheduleEditor.jsx
│   │   ├── CostTracker.jsx
│   │   ├── TravelMap.jsx
│   │   └── (subcomponents)
│   │
│   ├── career/                        (기존 유지, 필요시 추가)
│   │   ├── CareerDashboard.jsx
│   │   ├── CompanyCard.jsx
│   │   └── ...
│   │
│   └── (기존 다른 컴포넌트 유지)
│
├── lib/
│   ├── api-auth.js                    (기존)
│   ├── supabase.js                    (기존)
│   ├── travel-utils.js                (신규 - 날짜, 거리, 환율 유틸)
│   └── (기존 다른 유틸 유지)
│
└── (기존 파일 유지)
```

---

## 10. 데이터 흐름 (예시: 여행 추가)

### 시나리오: 사용자가 여행 추가

```
1. UI: /travel/new 페이지 방문
   └─ <TravelForm /> 렌더링
      └─ form 필드: title, description, start_date, end_date, country

2. 사용자: 폼 입력 + [Create] 클릭
   └─ onSubmit 콜백 호출

3. JavaScript (TravelForm.jsx):
   └─ POST /api/travel
      {
        title: "India Visit 2026-05",
        start_date: "2026-05-10",
        end_date: "2026-05-17"
      }

4. API Handler (/pages/api/travel/index.js):
   ├─ 요청 검증 (필드 확인)
   ├─ Supabase client 초기화 (JWT 토큰 검증)
   ├─ SQL INSERT: travel_records
   │  INSERT INTO travel_records (user_id, title, ...)
   │  VALUES (auth.uid(), ...) RETURNING id;
   └─ 응답: { id: "...", created_at: "..." }

5. JavaScript (TravelForm.jsx):
   ├─ 응답 처리 (success toast 표시)
   ├─ Redirect: /travel/[new_id]
   └─ useRouter().push("/travel/" + response.id)

6. UI: /travel/[id] 페이지 로드
   └─ GET /api/travel/[id] 호출 (서버사이드 또는 클라이언트)
   └─ <TravelDetail /> 렌더링
      └─ 3개 탭 (Schedule, Costs, Map)
```

---

## 11. 보안 고려사항

### 11.1 인증 (Authentication)

- Supabase Auth 사용 (기존)
- JWT 토큰을 Authorization 헤더에 전달
- API 엔드포인트에서 `auth.uid()` 검증

### 11.2 인가 (Authorization)

- **RLS 정책:** travel_records는 사용자 본인만 접근
- 모든 travel_* 테이블은 간접 필터링 (travel_id 참조)
- 삭제 권한: 생성자만

### 11.3 입력 검증

- 클라이언트: React Hook Form 또는 수동 검증
- 서버: Zod 또는 수동 검증
- SQL Injection: Parameterized queries (Supabase 자동 처리)

### 11.4 민감 데이터

- 환율 정보: 공개 (통계 용도)
- 비용 영수증: Supabase Storage (프라이빗)
- 승인자 정보: 레벨 기반 (필요시)

---

## 12. 엣지 케이스 & 예외 처리

### 12.1 여행 관련

| 케이스 | 처리 |
|--------|------|
| 여행 생성 실패 | 에러 메시지 + 재시도 버튼 |
| 중복된 여행명 | 경고 (같은 기간 다른 여행 제안) |
| 시작일 > 종료일 | 폼 검증 실패 (날짜 선택 제한) |
| 일정 없는 여행 | 경고: "Add at least one schedule" |
| 비용 0원 여행 | 허용 (선택사항) |
| 경로 계산 실패 | 스켈레톤 표시 + 수동 입력 폼 |
| 네트워크 오류 | 오프라인 모드 (localStorage) |

### 12.2 비용 관련

| 케이스 | 처리 |
|--------|------|
| 환율 미설정 | 기본값 사용 (15.5 INR/KRW) |
| 통화 변환 오류 | 원본 통화로만 표시 |
| 비용 타입 오류 | 드롭다운 선택만 허용 |
| 영수증 업로드 실패 | 선택사항 (필수 아님) |

### 12.3 지도 관련

| 케이스 | 처리 |
|--------|------|
| Google Maps API 키 없음 | 메시지: "Map unavailable" |
| 좌표 데이터 없음 | 주소 검색 후 자동 변환 |
| 경로 계산 초과 한계 | 상위 5개만 표시 |
| 오프라인 | 지도 컴포넌트 숨김 |

---

## 13. 성능 고려사항

### 13.1 쿼리 최적화

```sql
-- Travel 목록 조회 (페이지네이션)
SELECT 
  t.id, t.title, t.start_date, t.end_date,
  COUNT(s.id) as schedule_count,
  COUNT(c.id) as cost_count,
  COALESCE(SUM(c.amount), 0) as total_cost_inr
FROM travel_records t
LEFT JOIN travel_schedules s ON t.id = s.travel_id
LEFT JOIN travel_costs c ON t.id = c.travel_id
WHERE t.user_id = $1
GROUP BY t.id
ORDER BY t.start_date DESC
LIMIT 20 OFFSET $2;
```

### 13.2 캐싱

- 여행 목록: 5분 캐시 (ISR)
- 여행 상세: 1분 캐시 (자주 변경)
- 지도 폴리라인: 60분 캐시 (불변)

### 13.3 번들 크기

- Google Maps: 동적 import (필요시만 로드)
- 차트: recharts는 기존 유지 (KPI용)
- 아이콘: lucide-react (트리셰이킹 지원)

---

## 14. 테스트 전략

### 14.1 단위 테스트 (선택사항)
- API 엔드포인트 (request validation)
- 유틸 함수 (거리 계산, 환율 변환)

### 14.2 통합 테스트
- E2E: 여행 생성 → 일정 추가 → 비용 추가 → 지도 표시
- 폼 검증
- RLS 정책 (권한 없는 사용자 접근 차단)

### 14.3 수동 테스트
- 모바일 반응형 (iPhone, Android)
- 오프라인 모드
- 동시 편집 (2명 이상)

---

## 15. 배포 및 마이그레이션

### 15.1 단계별 배포

1. **Phase 1 (1주):** 레이아웃 변경 + 탭 네비게이션
   - Vercel 자동 배포
   - 영향: 모든 페이지 (기존 기능 변경 없음)

2. **Phase 2 (2주):** Travel 모듈 DB + API + 기본 UI
   - Supabase SQL 마이그레이션
   - API 엔드포인트 배포
   - /travel 페이지 공개

3. **Phase 3 (1주):** 비용/일정 상세
   - API 확장
   - UI 탭 추가

4. **Phase 4 (1주):** Google Maps
   - 환경변수 설정
   - 지도 컴포넌트 활성화

### 15.2 데이터 마이그레이션

- 기존 여행 기록이 없으므로 마이그레이션 불필요
- Supabase 테이블 신규 생성 (cascade 정책 적용)

### 15.3 롤백 계획

- Phase별 git tag 생성
- `db/` SQL 파일은 idempotent (재실행 안전)
- Vercel 이전 배포로 즉시 롤백 가능

---

## 16. 검수 기준

### Phase별 완료 기준

**Phase 1: 레이아웃**
- [ ] 3개 탭이 모든 페이지에서 렌더링됨
- [ ] 탭 전환이 부드럽고 활성 표시가 명확함
- [ ] 모바일에서 제대로 축소됨
- [ ] 기존 기능 동작 변경 없음

**Phase 2: Travel CRUD**
- [ ] /travel에서 여행 목록 조회 가능
- [ ] /travel/new에서 여행 추가 가능
- [ ] /travel/[id]에서 상세 조회 가능
- [ ] /travel/[id]에서 편집 가능
- [ ] 삭제 시 cascading 작동
- [ ] RLS 정책 검증 (다른 사용자 접근 불가)

**Phase 3: 비용/일정**
- [ ] 일정 CRUD 완전 작동
- [ ] 비용 CRUD 완전 작동
- [ ] 3개 탭 모두 표시 및 전환 가능
- [ ] 통계 계산 정확함 (합계, 환율 변환)

**Phase 4: 지도**
- [ ] 지도 렌더링됨
- [ ] 경로 polyline 표시됨
- [ ] Marker 표시됨
- [ ] 범례 표시됨

---

## 부록 A: Supabase SQL 실행 명령어

```bash
# Phase 2: Travel 테이블 생성
# Supabase Dashboard → SQL Editor → New query → 아래 붙여넣기 → Run

-- db/21_travel_module.sql 전체 내용 (이 설계서의 4.2절)

# 또는 CLI를 통해:
supabase db push
```

---

## 부록 B: 환경변수 (Phase 4)

```bash
# .env.local

# 기존
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# 신규 (Phase 4)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
GOOGLE_MAPS_API_SECRET=...  # 서버사이드 호출용 (선택)
```

---

## 부록 C: 예상 개발 시간

| Phase | 항목 | 예상 시간 | 담당 |
|-------|------|---------|------|
| 1 | 레이아웃 변경 | 3일 | 웹빌더 |
| 2 | Travel CRUD | 5일 | 웹빌더 |
| 3 | 비용/일정 | 3일 | 웹빌더 |
| 4 | 지도 통합 | 3일 | 웹빌더 |
| — | 검수/버그 수정 | 2일 | 웹빌더 + 평가자 |
| **총** | | **16일** | |

---

## 부록 D: 참고 문서

- **기존 설계:** `/dsc-fms-portal/DESIGN_BM.md` (BM 모듈)
- **기존 DB:** `/dsc-fms-portal/db/01_schema.sql` (Asset 마스터)
- **KPI 설계:** `STATUS.md` (Phase 별 구현 현황)

---

**문서 상태:** 최종 확정 ✅
**다음 단계:** 웹빌더 구현 시작 (Phase 1 부터)
