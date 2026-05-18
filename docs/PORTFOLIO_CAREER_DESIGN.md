# JEEPNEY 경력 포트폴리오 설계 (Career Portfolio)

**작성일:** 2026-05-15  
**설계 레벨:** Planner → Web-Builder 이행  
**개발 대상:** `/career` 라우트 (기존 네비게이션 통합)  
**완료 예상:** 3주 (개발 + 테스트)

---

## 1. 기능 개요

### 목적
사용자의 인도 첸나이 법인 2019~2024년 6년 경력을 정량화된 데이터와 시각화로 포트폴리오화하여 경영진/기술팀에 가시화

### 핵심 기능
1. **경력 요약 (Hero)** — 6년 경력, 5개 핵심 성과 카드
2. **성과 대시보드** — 연도별 KPI 트렌드 (4개 차트: 절감액, 효율, LOSS, 노무비율)
3. **성과 상세** — 5개 섹션 (원가절감, 생산성, 설비, 공정, 조직)
4. **경력 타임라인** — 2019~2024 연도별 사진/설명
5. **프로젝트 분류** — 회사별/카테고리별 필터링

### 사용자 시나리오
```
사용자 로그인
  ↓
/career 접속
  ↓
[경력 요약 보기] → 6년 경력, 총 325억 절감 한눈에 파악
  ↓
[성과 대시보드] → 연도별 트렌드 4개 차트 클릭으로 보기
  ↓
[상세 성과] → 5개 카테고리별 디테일 (숫자+설명)
  ↓
[타임라인] → 2019~2024 연도별 기억 남기기
  ↓
[프로젝트 필터] → 회사/카테고리별 검색
```

---

## 2. 화면 구조 (5개 메인 페이지)

### 2.1 Career 메인 페이지 (`/career`)

**구성:**
```
┌──────────────────────────────────────────┐
│  [뒤로]  /  경력 포트폴리오  /  [공유]    │  ← Header
├──────────────────────────────────────────┤
│                                          │
│  📊 경력 요약 (Hero Section)             │
│  ┌────────────────────────────────────┐  │
│  │  6년     5개     325억원   96%     │  │
│  │ 경력    성과    총절감    최고효율  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  🎯 핵심 성과 5개 (카드 그리드)           │
│  ┌──────────┬──────────┬──────────┐     │
│  │ 💰원가   │ 📈생산성 │ 🔧설비   │     │
│  │325억원  │66→96%   │50억절감  │     │
│  ├──────────┼──────────┼──────────┤     │
│  │ ⚙️공정  │ 👥조직   │          │     │
│  │가스절감  │2.2배성장 │          │     │
│  └──────────┴──────────┴──────────┘     │
│                                          │
│  [📊 대시보드] [📋 성과 상세]             │
│  [📅 타임라인] [🔍 프로젝트]             │
│                                          │
└──────────────────────────────────────────┘
```

**컴포넌트:**
- `CareerHeroSection` — 배경(DSC 공장 이미지 추천), 타이틀, 요약 4개 메트릭
- `AchievementCardsGrid` — 5개 성과 카드 (아이콘+제목+메인수치)
- `NavigationTabs` — 4개 탭으로 이동

**레이아웃:**
- 데스크톱: Hero 풀너비, 카드 3+2 그리드
- 모바일: Hero 풀너비, 카드 1열 스크롤 또는 2열

**데이터 출처:**
- `career_companies` — 회사명, 재직기간
- `career_achievements` — 총 10개 성과 (5개만 대표)

---

### 2.2 성과 대시보드 (`/career/dashboard`)

**목적:** 연도별 KPI 트렌드를 4개 차트로 시각화

**구성:**
```
┌────────────────────────────────────────────────┐
│ [← 돌아가기]  성과 대시보드  [다운로드]          │
├────────────────────────────────────────────────┤
│                                                │
│ 📅 연도 선택: [2019] [2020] [2021] ... [전체]  │
│                                                │
│ ┌─────────────────────────────────────────┐  │
│ │ 차트 1: 연간 절감액 (이중축 막대+꺾은선)  │  │
│ │ 2019  2020  2021  2022  2023  2024      │  │
│ │  ▁     ▂     ▃     ▄     ▅     ▆        │  │
│ │ 누적 절감액 → (우측축: 청색 꺾은선)      │  │
│ └─────────────────────────────────────────┘  │
│                                                │
│ ┌─────────────────────────────────────────┐  │
│ │ 차트 2: 생산효율 추이 (꺾은선)            │  │
│ │ 66% → 96% (+29.5%p 상승)                  │  │
│ │ 2019: 66% → 2024: 96%                   │  │
│ └─────────────────────────────────────────┘  │
│                                                │
│ ┌─────────────────────────────────────────┐  │
│ │ 차트 3: LOSS 시간 감소 (꺾은선, 역향)     │  │
│ │ 31.6% → 2.3% (-29.3%p 감소)              │  │
│ └─────────────────────────────────────────┘  │
│                                                │
│ ┌─────────────────────────────────────────┐  │
│ │ 차트 4: 매출 대비 노무비율 (꺾은선, 역향) │  │
│ │ 5.45% → 2.76% (-2.69%p 감소)             │  │
│ └─────────────────────────────────────────┘  │
│                                                │
│ 📊 주요 메트릭 요약표                          │
│ ├─────────────────────────────────────────┤  │
│ │ 항목           2019   2024   변화        │  │
│ │ 생산효율        66%    96%   +29.5%p    │  │
│ │ LOSS시간       31.6%  2.3%  -29.3%p    │  │
│ │ 노무비율        5.45%  2.76% -2.69%p   │  │
│ │ 설비수선비율    1.07%  0.58% -0.49%p   │  │
│ └─────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

**차트 라이브러리:** Recharts
- Chart 1: `<ComposedChart>` (막대+꺾은선)
- Chart 2,3,4: `<LineChart>`

**데이터 구조:**
```javascript
const kpiData = [
  { year: 2019, savings: 50, efficiency: 66, loss: 31.6, laborRatio: 5.45 },
  { year: 2020, savings: 120, efficiency: 78, loss: 18.2, laborRatio: 4.23 },
  // ... 2024까지
];
```

**컴포넌트:**
- `KpiDashboard` — 메인 컨테이너
- `KpiChart` — 4개 차트 (재사용 컴포넌트)
- `KpiMetricsTable` — 요약 테이블
- `YearFilter` — 연도 선택 (옵션: 필터링 기능)

---

### 2.3 성과 상세 (`/career/achievements`)

**목적:** 5개 핵심 성과를 카테고리별로 상세 설명

**구성:**
```
┌───────────────────────────────────────────────────┐
│ [← 돌아가기]  성과 상세  [편집]                    │
├───────────────────────────────────────────────────┤
│                                                   │
│ 📋 성과 분류: [전체] [원가절감] [생산성] [설비]   │
│              [공정] [조직]                        │
│                                                   │
│ ──────────────────────────────────────────────  │
│ 1️⃣ 원가 절감 리더십                              │
│ ──────────────────────────────────────────────  │
│ 💰 총 절감액: 325억원 (3개 카테고리)              │
│                                                   │
│ 📊 폭포수 차트 (Waterfall Chart)                  │
│     노무비     수선비    가스비    총절감         │
│    274억↓    50억↓    1.3억↓   325억↓        │
│                                                   │
│ 📝 상세 내용:                                     │
│ • 노무비 절감: 274억원 (2019년 대비 50% 감소)    │
│   - 자동화 도입으로 작업시간 30% 감축             │
│   - 야근/특근 제로화                             │
│ • 수선비 절감: 50억원 (설비 보전 최적화)          │
│ • 가스 소모량: 1.3억원 절감 (공정개선)           │
│                                                   │
│ ──────────────────────────────────────────────  │
│ 2️⃣ 생산성 혁신                                   │
│ ──────────────────────────────────────────────  │
│ 📈 생산효율: 66% → 96% (+29.5%p)                │
│ 📈 LOSS시간: 31.6% → 2.3% (-29.3%p)            │
│                                                   │
│ Before/After 비교 (좌측: 2019, 우측: 2024)      │
│ ┌──────────────┬──────────────┐               │
│ │  생산효율    │  생산효율    │               │
│ │    66%      │    96%      │               │
│ │ (LOSS시간)  │ (LOSS시간)   │               │
│ │   31.6%     │    2.3%     │               │
│ └──────────────┴──────────────┘               │
│                                                   │
│ 📝 상세 내용:                                     │
│ • 생산 라인 자동화 (3개 라인)                     │
│ • 작업 표준화 및 교육 강화                       │
│ • 장비 정비 주기 최적화                          │
│                                                   │
│ ──────────────────────────────────────────────  │
│ 3️⃣ 설비 보전 최적화                              │
│ ──────────────────────────────────────────────  │
│ 🔧 수선비 비율: 1.07% → 0.58% (-0.49%p)        │
│ 💰 절감액: 50억원                               │
│                                                   │
│ 📝 상세 내용:                                     │
│ • 예방 보전 시스템 도입 (Preventive Maintenance) │
│ • 설비 모니터링 IoT 센서 설치                    │
│ • 수선 비용 대폭 절감                            │
│                                                   │
│ ──────────────────────────────────────────────  │
│ 4️⃣ 공정 개선                                     │
│ ──────────────────────────────────────────────  │
│ ⚙️ 가스 소모량 절감: 1.3억원                     │
│                                                   │
│ 📝 상세 내용:                                     │
│ • 압축공기 누유 개선                             │
│ • 용접 공정 최적화                               │
│ • 온도 제어 시스템 개선                          │
│                                                   │
│ ──────────────────────────────────────────────  │
│ 5️⃣ 조직 성과 (매출×2.2배, 인원 효율화)          │
│ ──────────────────────────────────────────────  │
│ 📊 매출 성장: 2.2배 증가                         │
│ 👥 인원당 생산성: 대폭 상승                      │
│                                                   │
│ 📝 상세 내용:                                     │
│ • 6년간 매출 2.2배 성장 (비용 절감 + 신규고객) │
│ • 같은 인원으로 생산량 3배 증가                  │
│ • 직원 만족도 향상 (OT 감소)                     │
│                                                   │
└───────────────────────────────────────────────────┘
```

**컴포넌트:**
- `AchievementDetailSection` — 5개 섹션 컨테이너
- `WaterfallChart` (Recharts) — 절감액 비교
- `BeforeAfterCard` — 생산효율/LOSS 비교
- `MetricCard` — 각 성과별 메인 수치 + 설명
- `CategoryFilter` — 상단 필터 탭

**데이터:**
```javascript
const achievements = [
  {
    id: 'cost-reduction',
    title: '원가 절감 리더십',
    icon: '💰',
    mainMetric: '325억원',
    detail: '3개 카테고리 (노무비 274억 + 수선비 50억 + 가스비 1.3억)',
    breakdown: [
      { name: '노무비', value: 274 },
      { name: '수선비', value: 50 },
      { name: '가스비', value: 1.3 },
    ],
    description: '...',
  },
  // ... 4개 더
];
```

---

### 2.4 경력 타임라인 (`/career/timeline`)

**목적:** 2019~2024 연도별 주요 사건/성과를 시각적 타임라인으로 표현

**구성:**
```
┌──────────────────────────────────────────────┐
│ [← 돌아가기]  경력 타임라인  [다운로드]        │
├──────────────────────────────────────────────┤
│                                              │
│ 2019年 입사 ▼ (DSC 첸나이 법인)              │
│ ┌────────────────────────────────────────┐  │
│ │ 📅 2019.01 - 생산기술팀 배치            │  │
│ │ 위치: 인도 첸나이 법인                   │  │
│ │ 직책: 대리 (Senior Technician)          │  │
│ │ 부서: 생산/기술/보전/생산관리 (4개 담당) │  │
│ │ 📷 [이미지 - 공장 사진]                 │  │
│ │ 💬 "첫 해: 공정 최적화 프로젝트 시작"  │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ 2020年 ▼                                    │
│ ┌────────────────────────────────────────┐  │
│ │ 📈 성과: 생산효율 66% → 78%             │  │
│ │ 📊 절감: 120억원 (노무비 중심)          │  │
│ │ 📷 [이미지 - 자동화 라인]               │  │
│ │ 💬 "초기 자동화 도입으로 큰 효과"       │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ 2021年 ▼                                    │
│ ┌────────────────────────────────────────┐  │
│ │ 📈 성과: 생산효율 78% → 85%             │  │
│ │ 💰 절감: 150억원 (설비 보전 최적화)     │  │
│ │ 📷 [이미지 - 장비 점검]                 │  │
│ │ 💬 "예방 보전 시스템 도입"              │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ 2022年 ▼                                    │
│ ┌────────────────────────────────────────┐  │
│ │ 📈 성과: 생산효율 85% → 92%             │  │
│ │ 💰 절감: 175억원 (가스+공정 개선)       │  │
│ │ 📷 [이미지 - 팀 회의]                   │  │
│ │ 💬 "직원 교육 강화 + 작업표준화"        │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ 2023年 ▼                                    │
│ ┌────────────────────────────────────────┐  │
│ │ 📈 성과: 생산효율 92% → 94%             │  │
│ │ 💰 절감: 200억원 (누적)                 │  │
│ │ 📷 [이미지 - 시상]                      │  │
│ │ 💬 "성과 인정 및 팀 확대"                │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ 2024年 ▼                                    │
│ ┌────────────────────────────────────────┐  │
│ │ 📈 최종 성과: 생산효율 96%               │  │
│ │ 💰 총 절감: 325억원                     │  │
│ │ 📷 [이미지 - 최종 성과]                 │  │
│ │ 💬 "6년 경력 마무리 - 미래 도전"        │  │
│ └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

**컴포넌트:**
- `TimelineContainer` — 세로 타임라인
- `TimelineCard` — 각 연도별 카드
  - 날짜 배지
  - 핵심 성과 수치 (아이콘+숫자)
  - 이미지 (옵션)
  - 설명 텍스트

**데이터:**
```javascript
const timeline = [
  {
    year: 2019,
    title: '생산기술팀 배치',
    metrics: [
      { label: '생산효율', value: '66%' },
    ],
    description: '첫 해: 공정 최적화 프로젝트 시작',
    imageUrl: null,
  },
  {
    year: 2020,
    title: '초기 자동화',
    metrics: [
      { label: '생산효율', from: '66%', to: '78%' },
      { label: '절감액', value: '120억원' },
    ],
    description: '초기 자동화 도입으로 큰 효과',
    imageUrl: null,
  },
  // ... 2024까지
];
```

---

### 2.5 프로젝트 목록 (`/career/projects`)

**목적:** 5개 성과(프로젝트)를 리스트/카드 뷰로 검색/필터링

**구성:**
```
┌─────────────────────────────────────────────┐
│ [← 돌아가기]  프로젝트 목록                   │
├─────────────────────────────────────────────┤
│                                             │
│ 🔍 검색: [________검색_________]             │
│ 📌 필터:                                     │
│   카테고리: [전체] [원가절감] [생산성]       │
│           [설비] [공정] [조직]              │
│   정렬: [최신순▼] [가나다순▼] [효과큰순▼]  │
│                                             │
│ 결과: 10개 프로젝트 found                    │
│ ├────────────────────────────────────────┤  │
│ │ 1. 노무비 절감 프로젝트                  │  │
│ │    카테고리: 원가절감  |  2019-2024     │  │
│ │    성과: 274억원 절감 (최대 효과)         │  │
│ │    상태: 완료                            │  │
│ │    [더보기]                             │  │
│ ├────────────────────────────────────────┤  │
│ │ 2. 생산효율 개선 프로젝트                │  │
│ │    카테고리: 생산성  |  2019-2024       │  │
│ │    성과: 66% → 96% (+29.5%p)           │  │
│ │    상태: 완료                            │  │
│ │    [더보기]                             │  │
│ ├────────────────────────────────────────┤  │
│ │ 3. 설비 보전 최적화                      │  │
│ │    카테고리: 설비  |  2021-2024          │  │
│ │    성과: 50억원 절감                     │  │
│ │    상태: 완료                            │  │
│ │    [더보기]                             │  │
│ ├────────────────────────────────────────┤  │
│ │ 4. 공정 개선 (가스 소모)                 │  │
│ │    카테고리: 공정  |  2020-2024          │  │
│ │    성과: 1.3억원 절감                    │  │
│ │    상태: 완료                            │  │
│ │    [더보기]                             │  │
│ ├────────────────────────────────────────┤  │
│ │ 5. 조직 성과 (매출×2.2배)               │  │
│ │    카테고리: 조직  |  2019-2024          │  │
│ │    성과: 매출 2.2배, 인원 효율 3배      │  │
│ │    상태: 완료                            │  │
│ │    [더보기]                             │  │
│ └────────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**컴포넌트:**
- `ProjectListPage` — 메인 컨테이너
- `SearchBar` — 검색 입력
- `FilterPanel` — 카테고리/정렬 필터
- `ProjectCard` — 프로젝트 카드
- `Pagination` (옵션) — 10개 이상 시

---

## 3. 데이터 모델 (기존 DB 활용)

### 3.1 기존 테이블 활용 현황

**career_companies**
```sql
-- DSC 첸나이 법인 1개 회사
id              uuid
user_id         uuid
name            "DSC Mannur, Chennai"
title           "생산기술팀 대리"
country         "India"
city            "Chennai"
start_date      2019-01-01
end_date        NULL
is_current      true
```

**career_projects** (5개 프로젝트)
```sql
id              uuid
user_id         uuid
company_id      uuid (DSC)
title           "원가 절감 리더십" / "생산성 혁신" / ...
category        'cost_reduction' / 'improvement' / ...
start_date      2019-01-01
end_date        2024-12-31
kpi_label       "절감액" / "생산효율" / ...
kpi_value       "325억원" / "96%" / ...
is_featured     true (상단 5개는 모두 featured)
```

**career_achievements** (10개 세부 성과)
```sql
id               uuid
user_id          uuid
company_id       uuid (DSC)
project_id       uuid (위 5개 프로젝트 중 하나)
title            "노무비 절감" / "생산효율 상승" / ...
metric_label     "절감액" / "효율" / ...
metric_before    "예) 5.45% (노무비율)"
metric_after     "예) 2.76% (노무비율)"
achieved_at      2019-01-01 부터 2024-12-31
```

### 3.2 신규 추가 (확장 범위)

**portfolio_kpi_timeline** (선택 사항 — 차트 데이터 캐싱)
```sql
-- 연도별 KPI 메트릭 (성능 최적화 위해 집계 테이블 선택)
id              uuid
user_id         uuid
company_id      uuid
year            int (2019~2024)
savings_amount  numeric (절감액 총합)
efficiency      numeric (생산효율 %)
loss_time       numeric (LOSS 시간 %)
labor_ratio     numeric (노무비 비율 %)
equipment_ratio numeric (설비수선비 비율 %)
created_at      timestamptz
```

**portfolio_images** (선택 사항 — 타임라인 이미지 저장)
```sql
id              uuid
user_id         uuid
year            int
image_url       text (Supabase Storage)
title           text
description     text
created_at      timestamptz
```

---

## 4. UI/UX 설계 상세

### 4.1 반응형 디자인

#### 데스크톱 (≥1024px)
```
┌────────────────────────────────────────────┐
│ [Logo]  /Career  [공유] [편집] [로그아웃]   │ ← Header (고정)
├────────────────────────────────────────────┤
│                                            │
│ [Hero Full-Width]                          │
│ 6년 경력 | 5개 성과 | 325억원 | 96%       │
│                                            │
│ [Cards 3+2 Grid]                           │
│ 💰원가 | 📈생산성 | 🔧설비                 │
│ ⚙️공정 | 👥조직                            │
│                                            │
│ [Navigation Tabs - 4개]                    │
│ │ 📊 대시보드 │ 📋 성과상세 │ 📅 타임라인 │  │
│                                            │
│ [콘텐츠 영역 1024px 제한]                   │
│                                            │
│ [Footer]                                   │
│                                            │
├─ 하단 ─────────────────────────────────────┤
│ 🏠Home | 🔧BM | 📋PM | 🏭자산 | 📊KPI |   │
│ 📈경영실적 | 👤내정보 (네비게이션 고정)     │
└────────────────────────────────────────────┘
```

#### 모바일 (≤768px)
```
┌─────────────────────────┐
│ [☰] /Career [⋯]        │ ← Hamburger Nav
├─────────────────────────┤
│                         │
│ [Hero 풀너비 - 세로]    │
│ 6년 경력                │
│ 5개 성과                │
│ 325억원                 │
│ 96%                     │
│                         │
│ [Cards 1열 스크롤]      │
│ 💰원가 절감             │
│ 📈생산성 혁신           │
│ 🔧설비 보전             │
│ ⚙️공정 개선             │
│ 👥조직 성과             │
│                         │
│ [수평 스크롤 탭]        │
│ 📊 | 📋 | 📅 | 🔍      │
│                         │
├─────────────────────────┤
│ 🏠 | 🔧 | 📋 | 🏭 |    │ (BottomNav - 모바일 고정)
│ 📊 | 📈 | 👤            │
└─────────────────────────┘
```

### 4.2 색상 및 스타일링

**기존 패턴 유지:**
```javascript
// DSC FMS Portal 기존 색상 (from careerStyles.js)
export const C = {
  card: {
    background: '#1e293b',      // 진한 파랑-회색
    borderRadius: 8,
    border: '1px solid #334155',
    padding: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  text: {
    primary: '#f8fafc',    // 거의 흰색
    secondary: '#cbd5e1',  // 밝은 회색
    tertiary: '#94a3b8',   // 중간 회색
    accent: '#ef4444',     // 빨강 (강조)
  },
  metric: {
    value: 24,             // fontSize
    label: 14,
    color: '#f8fafc',
  },
};
```

### 4.3 차트 설정 (Recharts)

**공통 설정:**
```javascript
const chartConfig = {
  margin: { top: 20, right: 30, bottom: 20, left: 0 },
  cartesianGrid: { strokeDasharray: '3 3', stroke: '#334155' },
  tooltip: {
    contentStyle: {
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: 4,
      color: '#f8fafc',
    },
  },
  legend: {
    wrapperStyle: { paddingTop: 20, color: '#94a3b8' },
  },
};
```

**각 차트별:**
- **절감액 (ComposedChart):** 막대(파란색) + 누적 꺾은선(빨강)
- **생산효율 (LineChart):** 꺾은선 상승(초록색), 범위 채우기
- **LOSS시간 (LineChart):** 꺾은선 하강(주황색)
- **노무비율 (LineChart):** 꺾은선 하강(보라색)

---

## 5. 컴포넌트 구조 (React)

### 5.1 신규 컴포넌트 (6개)

```
components/
├── career/
│   ├── portfolio/
│   │   ├── CareerHeroSection.tsx      ← 메인 Hero (배경 + 4 메트릭)
│   │   ├── AchievementCardsGrid.tsx   ← 5개 성과 카드 그리드
│   │   ├── AchievementDetailSection.tsx ← 5개 섹션 (폭포수 + Before/After)
│   │   ├── KpiDashboard.tsx           ← 4개 차트 + 요약 테이블
│   │   ├── TimelineContainer.tsx      ← 타임라인 (세로)
│   │   └── TimelineCard.tsx           ← 연도별 카드
│   │
│   ├── CareerPage.tsx                 ← /career (메인 페이지)
│   ├── AchievementDetailsPage.tsx     ← /career/achievements
│   ├── DashboardPage.tsx              ← /career/dashboard
│   ├── TimelinePage.tsx               ← /career/timeline
│   └── ProjectListPage.tsx            ← /career/projects
│
└── (기존)
    ├── CareerSummaryCard.js           ← 그대로 사용
    ├── ProjectCard.js                 ← 그대로 사용
    └── ...
```

### 5.2 데이터 흐름

```
App Layout
  ↓
LanguageProvider (i18n)
  ↓
CareerPage (/career)
  ├→ CareerHeroSection (useEffect로 achievements 로드)
  ├→ AchievementCardsGrid (상위 5개 featured)
  └→ NavigationTabs (4개 탭)
       ├→ [탭 1] KpiDashboard (차트 4개)
       ├→ [탭 2] AchievementDetailSection (상세 설명)
       ├→ [탭 3] TimelineContainer (연도별)
       └→ [탭 4] ProjectListPage (전체 목록)
```

### 5.3 상태 관리

**Context API 사용:**
```javascript
// lib/career/CareerContext.tsx
type CareerContextType = {
  company: CareerCompany | null;
  achievements: CareerAchievement[];
  projects: CareerProject[];
  loading: boolean;
  error: string | null;
};

export const CareerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(careerReducer, initialState);
  
  useEffect(() => {
    // 데이터 로드 (Supabase)
  }, []);
  
  return <CareerContext.Provider value={state}>{children}</CareerContext.Provider>;
};
```

**또는 직접 fetch (간단한 경우):**
```javascript
// components/career/CareerPage.tsx
const [company, setCompany] = useState(null);
const [achievements, setAchievements] = useState([]);
const [projects, setProjects] = useState([]);

useEffect(() => {
  async function loadData() {
    const token = localStorage.getItem('sb-token');
    
    // 1. 회사 정보
    const companyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/career_companies?user_id=eq.${userId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    // 2. 성과 데이터
    const achievementRes = await fetch(
      `${SUPABASE_URL}/rest/v1/career_achievements?user_id=eq.${userId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    // 3. 프로젝트 데이터
    const projectRes = await fetch(
      `${SUPABASE_URL}/rest/v1/career_projects?user_id=eq.${userId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    setCompany(await companyRes.json());
    setAchievements(await achievementRes.json());
    setProjects(await projectRes.json());
  }
  
  loadData();
}, []);
```

---

## 6. 라우팅 구조

### 기존 (Pages Router)
```
app/
├── career/
│   ├── page.tsx                    ← /career (메인)
│   ├── dashboard/
│   │   └── page.tsx                ← /career/dashboard
│   ├── achievements/
│   │   └── page.tsx                ← /career/achievements
│   ├── timeline/
│   │   └── page.tsx                ← /career/timeline
│   └── projects/
│       └── page.tsx                ← /career/projects
```

### 또는 Next.js App Router 구조 (현재 프로젝트)
```
app/
└── career/
    ├── layout.tsx                  ← Career 섹션 레이아웃 (헤더/푸터)
    ├── page.tsx                    ← /career (메인)
    ├── dashboard/
    │   └── page.tsx                ← /career/dashboard
    ├── achievements/
    │   └── page.tsx                ← /career/achievements
    ├── timeline/
    │   └── page.tsx                ← /career/timeline
    └── projects/
        └── page.tsx                ← /career/projects
```

---

## 7. API 엔드포인트 (기존 Supabase REST 활용)

### 7.1 필요한 REST 호출

```javascript
// 1. 회사 정보 조회
GET /rest/v1/career_companies?user_id=eq.{userId}&select=*

// 2. 프로젝트 조회
GET /rest/v1/career_projects
  ?user_id=eq.{userId}
  &select=*
  &order=start_date.desc

// 3. 성과 조회
GET /rest/v1/career_achievements
  ?user_id=eq.{userId}
  &select=*
  &order=achieved_at.desc

// 4. 성과 상세 (특정 프로젝트)
GET /rest/v1/career_achievements
  ?project_id=eq.{projectId}
  &select=*
```

### 7.2 신규 API (선택)

```javascript
// Edge Function으로 캐싱된 KPI 데이터 제공
// /api/career/kpi-timeline.js (선택 사항)
export default async function handler(req, res) {
  const { userId } = req.query;
  const token = req.headers.authorization;
  
  // Supabase에서 achievement 데이터 집계
  const achievements = await getAchievements(userId, token);
  
  // 연도별로 그룹화하여 반환
  const timeline = aggregateByYear(achievements);
  
  res.status(200).json(timeline);
}
```

---

## 8. 엣지 케이스 및 처리 방안

### 8.1 데이터 없을 때
```javascript
if (!achievements || achievements.length === 0) {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p>아직 등록된 성과가 없습니다.</p>
      <button onClick={() => router.push('/career/projects')}>
        프로젝트 추가 →
      </button>
    </div>
  );
}
```

### 8.2 로딩 상태
```javascript
if (loading) {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <Skeleton variant="text" width="80%" style={{ margin: '10px auto' }} />
      <Skeleton variant="rectangular" height={200} style={{ margin: '20px auto' }} />
    </div>
  );
}
```

### 8.3 에러 처리
```javascript
if (error) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
      <p>데이터 로드 실패: {error}</p>
      <button onClick={() => window.location.reload()}>다시 시도</button>
    </div>
  );
}
```

### 8.4 권한 확인
```javascript
useEffect(() => {
  const token = localStorage.getItem('sb-token');
  if (!token) {
    router.push('/auth/login');
    return;
  }
  
  // userId 확인
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    router.push('/auth/login');
  }
}, [router]);
```

### 8.5 차트 데이터 부재
```javascript
// 데이터가 1년만 있으면?
const years = Array.from(new Set(achievements.map(a => a.achieved_at?.split('-')[0])));

if (years.length < 2) {
  return (
    <div>
      <p>⚠️ 2년 이상의 데이터가 필요합니다. 현재 {years.length}년 데이터</p>
    </div>
  );
}
```

---

## 9. 성능 최적화

### 9.1 이미지 최적화
```javascript
import Image from 'next/image';

<Image
  src={imageUrl}
  alt="Career milestone"
  width={800}
  height={400}
  loading="lazy"
  placeholder="blur"
/>
```

### 9.2 차트 최적화
```javascript
// Recharts는 기본적으로 충분히 최적화되어 있음
// 하지만 데이터 많으면 responsiveContainer 사용

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="year" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="value" stroke="#8884d8" />
  </LineChart>
</ResponsiveContainer>
```

### 9.3 데이터 페칭 최적화
```javascript
// Supabase 쿼리 최적화
const response = await fetch(
  `${SUPABASE_URL}/rest/v1/career_achievements?
    user_id=eq.${userId}
    &select=id,title,metric_label,metric_before,metric_after,achieved_at
    &order=achieved_at.desc`,
  { headers }
);

// 불필요한 컬럼 제외
```

---

## 10. 웹개발자 체크리스트

### Phase 1: 설계 리뷰 (1일)
- [ ] PORTFOLIO_CAREER_DESIGN.md 검토
- [ ] PORTFOLIO_CAREER_DB_SCHEMA.sql 검토
- [ ] 컴포넌트 구조 확인
- [ ] 질문사항 정리 (Slack/Discord)

### Phase 2: DB 설정 (1일)
- [ ] Supabase에 portfolio_kpi_timeline 테이블 생성 (선택)
- [ ] portfolio_images 테이블 생성 (선택)
- [ ] 샘플 데이터 삽입
- [ ] RLS 정책 확인

### Phase 3: 컴포넌트 개발 (5일)
- [ ] CareerHeroSection 개발
- [ ] AchievementCardsGrid 개발
- [ ] KpiDashboard (4개 차트) 개발
- [ ] AchievementDetailSection 개발
- [ ] TimelineContainer 개발

### Phase 4: 페이지 통합 (3일)
- [ ] /career/page.tsx 메인 페이지
- [ ] /career/dashboard/page.tsx
- [ ] /career/achievements/page.tsx
- [ ] /career/timeline/page.tsx
- [ ] /career/projects/page.tsx (기존 ProjectListPage 활용)

### Phase 5: 스타일링 & 반응형 (2일)
- [ ] 데스크톱 레이아웃
- [ ] 모바일 반응형 (≤768px)
- [ ] 다크테마 확인
- [ ] 접근성 (a11y) 검토

### Phase 6: 테스트 & 배포 (2일)
- [ ] 데이터 로드 확인
- [ ] 차트 렌더링 확인
- [ ] 모바일 테스트
- [ ] Vercel 배포
- [ ] 라이브 환경 검증

**예상 소요 시간:** 14일 (2주)

---

## 11. 참고 사항

### 11.1 기존 컴포넌트 재사용
```javascript
// 이미 있는 컴포넌트 활용
import CareerSummaryCard from '@/components/career/CareerSummaryCard';
import ProjectCard from '@/components/career/ProjectCard';
import { C, calcYears } from '@/components/career/careerStyles';
```

### 11.2 다국어 지원
```javascript
import { useLanguage } from '@/lib/i18n/context';
import { t } from '@/lib/i18n/translations';

const { language } = useLanguage();

return <h1>{t('career.dashboard.title', language)}</h1>;
```

### 11.3 Recharts 설치 확인
```bash
# 이미 설치되어 있을 가능성 높음
npm list recharts

# 없으면 설치
npm install recharts
```

### 11.4 타입 정의 (TypeScript)
```typescript
// lib/career/types.ts
export type CareerCompany = {
  id: string;
  user_id: string;
  name: string;
  title: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
};

export type CareerProject = {
  id: string;
  title: string;
  category: 'cost_reduction' | 'improvement' | 'quality' | 'safety' | 'digital' | 'automation' | 'other';
  start_date?: string;
  end_date?: string;
  kpi_label?: string;
  kpi_value?: string;
  is_featured: boolean;
};

export type CareerAchievement = {
  id: string;
  title: string;
  metric_label?: string;
  metric_before?: string;
  metric_after?: string;
  achieved_at?: string;
  achievement_type: string;
};
```

---

## 12. 향후 확장 가능성

1. **PDF 다운로드** — career_profiles.pdf_generated_at 활용
2. **공개 포트폴리오** — is_public 플래그로 public profile 생성
3. **평가 점수** — 각 성과에 별점 또는 영향도 평가 추가
4. **동료 추천서** — recommendations 테이블 추가
5. **기술 스택** — career_skills 활용하여 기술 매트릭스 표시
6. **실시간 알림** — 새 성과 추가 시 Telegram 알림

---

## 마무리

이 설계서는 기존 DSC FMS Portal의 구조와 스타일을 따르면서 사용자의 6년 경력을 정량화된 데이터로 시각화합니다. 

**핵심 특징:**
- **이미 존재하는 DB 테이블 활용** (career_companies, career_projects, career_achievements)
- **기존 컴포넌트 스타일 유지** (careerStyles.js, BottomNav)
- **차트 기반 시각화** (Recharts)
- **모바일 퍼스트 반응형 설계**
- **5개 메인 페이지** (메인 + 대시보드 + 상세 + 타임라인 + 프로젝트)

웹개발자는 이 설계를 기반으로 React/TypeScript로 구현하면 됩니다.

