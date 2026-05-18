# JEEPNEY 경력 포트폴리오 — 웹개발자 구현 체크리스트

**작성일:** 2026-05-15  
**대상:** web-builder (웹개발자)  
**예상 소요:** 14일 (2주)  
**우선순위:** 높음 (사용자의 5년 경력 데이터)

---

## 0. 사전 준비

### 0.1 설계서 리뷰
- [ ] PORTFOLIO_CAREER_DESIGN.md 읽기 (전체)
- [ ] PORTFOLIO_CAREER_DB_SCHEMA.sql 이해
- [ ] 컴포넌트 구조 확인 (섹션 5)
- [ ] 라우팅 구조 이해 (섹션 6)
- [ ] 의문사항 팀 채널에 기록

### 0.2 개발 환경 확인
- [ ] Node.js 18+ 설치 확인 (`node -v`)
- [ ] npm 설치 확인 (`npm -v`)
- [ ] Supabase CLI 설치 (`supabase --version`)
- [ ] 프로젝트 루트에서 `npm install` 실행
- [ ] `.env.local` 확인 (SUPABASE_URL, SUPABASE_ANON_KEY)
- [ ] `npm run dev` 실행 가능 확인

### 0.3 기존 코드 분석
- [ ] `/components/career/` 폴더 내 기존 컴포넌트 검토
  - `CareerSummaryCard.js` — 메인 메트릭 카드 (재사용)
  - `ProjectCard.js` — 프로젝트 카드 (재사용)
  - `careerStyles.js` — 색상/스타일 정의 (참고)
- [ ] `/app/layout.tsx` 구조 이해
- [ ] Recharts 사용 예제 검색 (`grep -r "Recharts" src/`)
- [ ] Supabase REST API 호출 패턴 검토 (`/app/assets/page.tsx` 참고)

### 0.4 라이브러리 확인
- [ ] `recharts` 설치 확인 (`npm list recharts`)
  - 미설치시: `npm install recharts`
- [ ] `next/image` 사용 가능 확인
- [ ] TypeScript 타입 정의 준비 (`lib/career/types.ts` 생성 예정)

---

## 1. Phase 1: DB 설정 (1일, 목금)

### 1.1 새 테이블 생성
- [ ] Supabase SQL Editor 접속
- [ ] `PORTFOLIO_CAREER_DB_SCHEMA.sql` 전체 복사
- [ ] portfolio_kpi_timeline 테이블 생성 실행
- [ ] portfolio_images 테이블 생성 실행
- [ ] RLS 정책 설정 확인
- [ ] 테이블 생성 로그 확인 (에러 없음)

### 1.2 샘플 데이터 삽입
- [ ] `SELECT * FROM auth.users` 실행 → user_id 확인
- [ ] `SELECT * FROM career_companies WHERE name LIKE 'DSC%'` → company_id 확인
- [ ] SAMPLE 데이터 쿼리 주석 제거
- [ ] {user_id}, {company_id} 값 교체
- [ ] portfolio_kpi_timeline INSERT 실행 (6개 행)
- [ ] career_projects INSERT 실행 (5개 프로젝트)
- [ ] career_achievements INSERT 실행 (10개 성과)
- [ ] 데이터 검증 쿼리 실행
  ```sql
  SELECT year, efficiency, loss_time FROM portfolio_kpi_timeline ORDER BY year;
  SELECT COUNT(*) FROM career_projects WHERE is_featured = true;
  SELECT COUNT(*) FROM career_achievements;
  ```

### 1.3 RLS 정책 테스트
- [ ] 로그인 후 자신의 데이터만 조회 가능 확인
- [ ] Supabase Studio > Auth > Users에서 테스트 유저 생성 (선택)
- [ ] 다른 유저로 조회 시 0행 반환 확인

---

## 2. Phase 2: TypeScript 타입 정의 (0.5일, 목)

### 2.1 타입 파일 생성
- [ ] `/lib/career/types.ts` 파일 생성
- [ ] 다음 타입 정의:
  ```typescript
  export type CareerCompany = { ... }
  export type CareerProject = { ... }
  export type CareerAchievement = { ... }
  export type KpiTimeline = { ... }
  export type PortfolioImage = { ... }
  ```
- [ ] TypeScript 컴파일 에러 확인

### 2.2 Supabase 클라이언트 타입
- [ ] `lib/supabase/types.ts` 확인 (또는 생성)
- [ ] 기존 타입 참고: `lib/assets/types.ts`
- [ ] 필요시 타입 확장

---

## 3. Phase 3: 컴포넌트 개발 (5일, 금~수)

### 3.1 Hero Section 컴포넌트
**파일:** `/components/career/portfolio/CareerHeroSection.tsx`

```typescript
// 기능:
// - 배경 이미지 (DSC 공장 추천)
// - 타이틀: "경력 포트폴리오"
// - 메인 메트릭 4개:
//   - 6년 (경력)
//   - 5개 (성과 수)
//   - 325억원 (총 절감)
//   - 96% (최고 효율)

// 입력: 
// - company: CareerCompany
// - achievements: CareerAchievement[]
// - projects: CareerProject[]

// 출력: JSX (반응형 배치)
```

**구현 체크:**
- [ ] 배경 이미지 로드 (Next.js Image 사용)
- [ ] 메트릭 4개 데이터 계산
  - [ ] 경력 = (end_date - start_date) / 년
  - [ ] 성과 수 = achievements.length
  - [ ] 총 절감 = sum(achievements.metric_after) 또는 portfolio_kpi_timeline 합계
  - [ ] 최고 효율 = max(efficiency from portfolio_kpi_timeline)
- [ ] 반응형: 데스크톱(1024px+) / 모바일(≤768px)
- [ ] 다크테마 색상 적용 (careerStyles.C 참고)
- [ ] 로딩 상태 처리 (Skeleton)

**스타일 참고:**
```javascript
// careerStyles.js 사용
import { C, calcYears } from './careerStyles';

// S.hero = { ... } 스타일 객체 작성
```

---

### 3.2 성과 카드 그리드 컴포넌트
**파일:** `/components/career/portfolio/AchievementCardsGrid.tsx`

```typescript
// 기능:
// - 5개 성과를 카드로 표시
// - 각 카드: 아이콘 + 제목 + 메인 수치 + 클릭 이벤트

// 입력:
// - achievements: CareerAchievement[] (상위 5개, is_featured = true)

// 출력: 3+2 그리드 (데스크톱) / 1열 스크롤 (모바일)
```

**구현 체크:**
- [ ] 상위 5개 featured 성과만 필터
- [ ] 카드별 아이콘 매핑 (💰, 📈, 🔧, ⚙️, 👥)
- [ ] 메인 수치 표시 (metric_after, kpi_value)
- [ ] 그리드 레이아웃
  - [ ] 데스크톱: `gridTemplateColumns: 'repeat(3, 1fr)'` + 2행
  - [ ] 모바일: `gridTemplateColumns: '1fr'` (스크롤)
- [ ] 클릭 핸들러 → `/career/achievements#achievement-id` 이동
- [ ] 호버 효과 (배경색 변경)

**카드 구조:**
```
┌────────────┐
│    💰      │ ← 아이콘
│  원가 절감  │ ← 제목
│  325억원   │ ← 메인 수치
│  [클릭]     │
└────────────┘
```

---

### 3.3 KPI 대시보드 컴포넌트
**파일:** `/components/career/portfolio/KpiDashboard.tsx`

```typescript
// 기능:
// - 4개 차트 표시 (Recharts)
// - 요약 테이블 (2019 vs 2024 비교)
// - 연도 필터 (선택 사항)

// 입력:
// - kpiData: KpiTimeline[] (6년 데이터)

// 출력: 차트 + 테이블 컨테이너
```

**구현 체크:**

#### 차트 1: 절감액 (ComposedChart)
- [ ] 막대: savings_total (2019~2024)
- [ ] 꺾은선: 누적 절감액 (누적합계)
- [ ] Y축 좌측: 억원 단위
- [ ] Y축 우측: 누적 스케일
- [ ] 범례 표시

```javascript
<ComposedChart data={kpiData}>
  <CartesianGrid />
  <XAxis dataKey="year" />
  <YAxis yAxisId="left" label={{ value: '억원', angle: -90, position: 'insideLeft' }} />
  <YAxis yAxisId="right" orientation="right" />
  <Tooltip />
  <Legend />
  <Bar yAxisId="left" dataKey="savings_total" fill="#3b82f6" name="연간 절감액" />
  <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#ef4444" name="누적 절감액" />
</ComposedChart>
```

#### 차트 2: 생산효율 (LineChart)
- [ ] 데이터: efficiency (66% → 96%)
- [ ] 색상: 초록색 (#10b981)
- [ ] 범위: 0~100%
- [ ] 데이터 포인트 표시 (dot)

#### 차트 3: LOSS시간 (LineChart)
- [ ] 데이터: loss_time (31.6% → 2.3%)
- [ ] 색상: 주황색 (#f97316)
- [ ] 범위: 0~100%
- [ ] 역향 (감소 = 좋음) 주석 추가

#### 차트 4: 노무비율 (LineChart)
- [ ] 데이터: labor_ratio (5.45% → 2.76%)
- [ ] 색상: 보라색 (#a855f7)
- [ ] 역향 주석

**요약 테이블 구현:**
- [ ] 2열 (2019 vs 2024)
- [ ] 4행 (4개 지표)
- [ ] 변화량 계산 (2024 - 2019)
- [ ] 백분포인트 표시 (%p)

```
항목           2019   2024   변화
생산효율        66%    96%   +29.5%p
LOSS시간       31.6%  2.3%  -29.3%p
노무비율        5.45%  2.76% -2.69%p
설비수선비율    1.07%  0.58% -0.49%p
```

**추가 기능:**
- [ ] 모바일: 차트 높이 400px → 250px 조정
- [ ] 차트 마진 최적화 (모바일에서 라벨 안잘림)
- [ ] 로딩 상태: `<Skeleton>` 4개

---

### 3.4 성과 상세 섹션 컴포넌트
**파일:** `/components/career/portfolio/AchievementDetailSection.tsx`

```typescript
// 기능:
// - 5개 섹션 펼칠 수 있도록 표시 (Accordion)
// - 각 섹션별:
//   - 제목 + 아이콘
//   - 메인 메트릭 (큰 숫자)
//   - Before/After 비교 또는 폭포수 차트
//   - 상세 설명 (텍스트)

// 입력:
// - achievements: CareerAchievement[]

// 출력: Accordion 또는 Tab 기반 5개 섹션
```

**구현 체크:**

#### 섹션 1: 원가 절감 리더십
- [ ] 메인 메트릭: 325억원
- [ ] 폭포수 차트 (Recharts BarChart)
  - 노무비: 274억
  - 수선비: 50억
  - 가스비: 1.3억
  - 총합: 325.3억
- [ ] 텍스트 설명 3줄

```javascript
// Waterfall 구현 (BarChart 또는 ComposedChart)
// x축: 3개 항목
// y축: 억원
// 스택: 누적 효과 표시
```

#### 섹션 2: 생산성 혁신
- [ ] Before/After 카드 (좌측 vs 우측)
  ```
  ┌─────────────┬─────────────┐
  │   2019      │   2024      │
  │ 생산효율    │ 생산효율    │
  │    66%      │    96%      │
  │ LOSS시간    │ LOSS시간    │
  │   31.6%     │    2.3%     │
  └─────────────┴─────────────┘
  ```
- [ ] 데스크톱: 좌우 배치
- [ ] 모바일: 위아래 배치
- [ ] 설명 텍스트

#### 섹션 3: 설비 보전 최적화
- [ ] 메인 메트릭: 1.07% → 0.58%
- [ ] 차트: LineChart (수선비 비율 추이)
- [ ] 설명

#### 섹션 4: 공정 개선
- [ ] 메인 메트릭: 1.3억원
- [ ] 간단한 텍스트 설명

#### 섹션 5: 조직 성과
- [ ] 메인 메트릭: 2.2배 (매출)
- [ ] 추가 메트릭: 3배 (인원 효율)
- [ ] 설명

**Accordion 또는 Tabs:**
- [ ] 클릭하면 펼침/접힘
- [ ] 한 번에 1개만 펼침 (또는 동시 허용)
- [ ] 모바일: 기본 모두 펼침 (스크롤 용이)

---

### 3.5 타임라인 컨테이너 컴포넌트
**파일:** `/components/career/portfolio/TimelineContainer.tsx`

```typescript
// 기능:
// - 세로 타임라인 (2019~2024)
// - 각 연도별 마일스톤 카드
// - 좌측 날짜 표시 / 우측 콘텐츠

// 입력:
// - timeline: TimelineItem[] (6개 연도)

// 출력: 세로 선 + 카드 배치
```

**구현 체크:**
- [ ] 세로 선 그리기 (SVG 또는 CSS 가상 요소)
- [ ] 각 연도 원형 배지 (연도 텍스트)
- [ ] 카드 배치 (좌측-우측-좌측-우측 번갈아)
- [ ] 데스크톱: 좌-우 번갈아 배치
- [ ] 모바일: 모두 우측 배치 (단일 열)
- [ ] 각 카드: TimelineCard 컴포넌트 사용

**TimelineCard 개별 컴포넌트:**
```typescript
// 입력:
// - year: number
// - title: string
// - metrics: { label: string, value: string }[]
// - description: string
// - imageUrl?: string

// 출력:
// ┌──────────────────────┐
// │ 📅 2019: 입사         │
// │ 생산효율: 66%        │
// │ [이미지]             │
// │ "첫 해: 공정 최적화..." │
// └──────────────────────┘
```

**스타일:**
```javascript
const S = {
  timeline: {
    position: 'relative',
    paddingLeft: 40,
    paddingRight: 40,
  },
  line: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    background: '#334155',
  },
  card: {
    marginBottom: 40,
    // 데스크톱: flex-direction row
    // 모바일: flex-direction column
  },
};
```

---

### 3.6 프로젝트 목록 페이지 컴포넌트
**파일:** `/components/career/portfolio/ProjectListPage.tsx`

```typescript
// 기능:
// - 전체 프로젝트 목록 (10개)
// - 검색 바
// - 카테고리 필터
// - 정렬 (최신, 가나다, 효과)
// - 프로젝트 카드 그리드

// 입력:
// - projects: CareerProject[]
// - achievements: CareerAchievement[]

// 출력: 필터링된 카드 그리드
```

**구현 체크:**
- [ ] 검색 입력 (title, description 검색)
- [ ] 필터 탭: [전체] [원가절감] [생산성] [설비] [공정] [조직]
- [ ] 정렬 드롭다운: 최신순 / 가나다순 / 효과큰순
- [ ] ProjectCard 컴포넌트 재사용
- [ ] 페이지네이션 (선택, 10개 이상 시)
- [ ] 검색 결과 개수 표시
- [ ] 결과 없을 때 메시지

---

## 4. Phase 4: 페이지 통합 (3일, 목~토)

### 4.1 메인 페이지 (`/app/career/page.tsx`)
- [ ] 파일 생성: `/app/career/page.tsx`
- [ ] 'use client' 지시문 추가
- [ ] 컴포넌트 임포트:
  ```typescript
  import CareerHeroSection from '@/components/career/portfolio/CareerHeroSection';
  import AchievementCardsGrid from '@/components/career/portfolio/AchievementCardsGrid';
  ```
- [ ] useEffect에서 데이터 로드
  ```typescript
  const [company, setCompany] = useState<CareerCompany | null>(null);
  const [achievements, setAchievements] = useState<CareerAchievement[]>([]);
  const [projects, setProjects] = useState<CareerProject[]>([]);
  const [loading, setLoading] = useState(true);
  ```
- [ ] Supabase REST API 호출 3개
  - [ ] GET career_companies
  - [ ] GET career_projects
  - [ ] GET career_achievements
- [ ] 에러 처리 (try-catch)
- [ ] 로딩 상태 표시 (Skeleton)
- [ ] 로그인 확인 (token + userId)
- [ ] 렌더링:
  ```jsx
  <>
    <CareerHeroSection {...} />
    <AchievementCardsGrid {...} />
    <NavigationTabs>
      <Tab1>대시보드</Tab1>
      <Tab2>성과상세</Tab2>
      <Tab3>타임라인</Tab3>
      <Tab4>프로젝트</Tab4>
    </NavigationTabs>
  </>
  ```

### 4.2 대시보드 페이지 (`/app/career/dashboard/page.tsx`)
- [ ] 파일 생성
- [ ] KpiDashboard 컴포넌트 임포트
- [ ] portfolio_kpi_timeline 데이터 로드
  ```typescript
  const response = await fetch(
    `/rest/v1/portfolio_kpi_timeline?user_id=eq.${userId}&order=year.asc`,
    { headers: authHeaders }
  );
  ```
- [ ] 차트 데이터 변환 (필요시)
- [ ] 렌더링

### 4.3 성과 상세 페이지 (`/app/career/achievements/page.tsx`)
- [ ] 파일 생성
- [ ] AchievementDetailSection 컴포넌트 임포트
- [ ] 5개 성과 데이터 로드
- [ ] 카테고리별 필터 UI
- [ ] 렌더링

### 4.4 타임라인 페이지 (`/app/career/timeline/page.tsx`)
- [ ] 파일 생성
- [ ] TimelineContainer 임포트
- [ ] timeline 데이터 변환 (portfolio_kpi_timeline + 텍스트)
  ```typescript
  const timelineData = kpiData.map(year => ({
    year: year.year,
    title: getTitleForYear(year.year),
    metrics: [
      { label: '생산효율', value: `${year.efficiency}%` },
      ...
    ],
    description: getDescriptionForYear(year.year),
    imageUrl: null, // 선택 사항
  }));
  ```
- [ ] 렌더링

### 4.5 프로젝트 목록 페이지 (`/app/career/projects/page.tsx`)
- [ ] 파일 생성
- [ ] ProjectListPage 컴포넌트 임포트 (또는 기존 재사용)
- [ ] 렌더링

### 4.6 네비게이션 탭 구현
- [ ] NavigationTabs 컴포넌트 생성 (또는 라이브러리 사용)
- [ ] 4개 탭: [📊 대시보드] [📋 성과상세] [📅 타임라인] [🔍 프로젝트]
- [ ] 탭 클릭 시 URL 변경 또는 콘텐츠 전환
- [ ] 활성 탭 강조 표시 (빨강 색상)

---

## 5. Phase 5: 스타일링 및 반응형 (2일, 일~월)

### 5.1 데스크톱 레이아웃 (≥1024px)
- [ ] Hero section: 풀너비 + 배경 이미지
- [ ] 카드 그리드: 3+2 배치
- [ ] 차트: 각 600px × 300px
- [ ] Before/After 카드: 좌우 배치
- [ ] 타임라인: 중앙 선 + 좌우 번갈아
- [ ] 최대 너비 1024px 제한 (레이아웃 컨테이너)
- [ ] 패딩/마진 일관성

### 5.2 모바일 레이아웃 (≤768px)
- [ ] Hero section: 세로 스택 (타이틀 + 메트릭 4개)
- [ ] 카드 그리드: 1열 스크롤
- [ ] 차트: 높이 250px으로 축소
- [ ] Before/After 카드: 위아래 배치
- [ ] 타임라인: 모두 우측 (중앙 선 불필요)
- [ ] 패딩: 16px (좌우)
- [ ] 폰트 크기: 줄임 (body 14px → 13px)

### 5.3 다크테마 검증
- [ ] careerStyles.C 색상 사용
  - 배경: #1e293b
  - 텍스트: #f8fafc
  - 보조: #94a3b8
  - 강조: #ef4444
- [ ] 차트 배경: #0f172a
- [ ] 그리드: #334155
- [ ] 모든 컴포넌트에 적용

### 5.4 BottomNav 통합 확인
- [ ] `/career` 라우트 활성화 시 빨강 색상
- [ ] 아이콘: UserIcon (기존)
- [ ] 레이블: "내정보"
- [ ] 다른 탭과 일관성

### 5.5 CSS 최적화
- [ ] 중복 스타일 제거
- [ ] Tailwind 또는 CSS Modules 사용 (기존 패턴 따르기)
- [ ] 성능: 불필요한 리렌더 제거 (useMemo, useCallback)

---

## 6. Phase 6: 테스트 및 배포 (2일, 월~화)

### 6.1 기능 테스트
- [ ] 로그인 후 `/career` 접속 가능 확인
- [ ] 데이터 로드 성공 (요청 200 응답)
- [ ] 각 탭 클릭 시 콘텐츠 변경
- [ ] 검색/필터 동작 확인
- [ ] 차트 렌더링 (Recharts)
- [ ] 로딩 상태 표시 (데이터 지연 시뮬레이션)
- [ ] 에러 상태 표시 (API 실패 시뮬레이션)

### 6.2 반응형 테스트
- [ ] 데스크톱 (1920×1080): 모든 페이지
- [ ] 태블릿 (768×1024): 모든 페이지
- [ ] 모바일 (375×667): 모든 페이지
  - [ ] Chrome DevTools 모바일 에뮬레이터
  - [ ] 실제 폰 (iOS/Android)
- [ ] 회전: 가로←→세로

### 6.3 크로스 브라우저 테스트
- [ ] Chrome 최신판
- [ ] Safari 최신판
- [ ] Firefox 최신판
- [ ] Edge 최신판

### 6.4 성능 테스트
- [ ] Lighthouse: Performance ≥80
- [ ] FCP (First Contentful Paint) < 2s
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] 번들 크기: 확인 (`npm run build`)

### 6.5 접근성 (a11y) 테스트
- [ ] 탭 순서 (Tab 키로 네비게이션)
- [ ] 화면 판독기: VoiceOver (Mac) 또는 NVDA (Windows)
- [ ] 색상 대비: WCAG AA 이상
- [ ] 버튼 크기: 최소 44×44px (모바일)

### 6.6 배포 전 체크리스트
- [ ] `npm run build` 성공 (빌드 에러 없음)
- [ ] `npm run lint` 통과 (ESLint 경고 없음)
- [ ] 환경 변수 확인 (.env.local, Vercel secrets)
- [ ] 깃 커밋: 기능별로 분리
  ```
  feat(career): add hero section
  feat(career): add kpi dashboard
  feat(career): add achievement details
  feat(career): add timeline
  feat(career): add project list
  ```
- [ ] PR 생성 (Planner/평가자 리뷰)
- [ ] 리뷰 피드백 반영

### 6.7 Vercel 배포
- [ ] `git push origin career-portfolio` (브랜치)
- [ ] Vercel 자동 Preview 배포 대기
- [ ] Preview URL 확인
- [ ] 모든 테스트 통과 후 병합 (Merge PR)
- [ ] Main 브랜치 자동 배포 대기
- [ ] 라이브 환경 확인: https://dsc-fms-portal.vercel.app/career

### 6.8 라이브 환경 검증
- [ ] `/career` 로드 < 2s
- [ ] 데이터 표시 정확
- [ ] 모든 차트 렌더링
- [ ] 모바일 반응형 동작
- [ ] 에러 로그 없음 (브라우저 Console)

---

## 7. 구현 팁 및 참고 코드

### 7.1 Supabase 데이터 로드 패턴
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CareerPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const token = localStorage.getItem('sb-token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/career_projects?user_id=eq.${userId}&select=*`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load data');
        }

        const data = await response.json();
        setData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <NoData />;

  return <CareerContent data={data} />;
}
```

### 7.2 Recharts 사용 예제
```typescript
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// 간단한 라인 차트
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={kpiData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
    <XAxis dataKey="year" stroke="#94a3b8" />
    <YAxis stroke="#94a3b8" />
    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
    <Legend />
    <Line
      type="monotone"
      dataKey="efficiency"
      stroke="#10b981"
      strokeWidth={2}
      dot={{ fill: '#10b981', r: 4 }}
    />
  </LineChart>
</ResponsiveContainer>
```

### 7.3 반응형 조건부 렌더링
```typescript
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const handleResize = () => setIsMobile(window.innerWidth <= 768);
  window.addEventListener('resize', handleResize);
  handleResize(); // 초기값

  return () => window.removeEventListener('resize', handleResize);
}, []);

// 렌더링
{isMobile ? <MobileLayout /> : <DesktopLayout />}
```

### 7.4 TypeScript 타입 사용
```typescript
import type { CareerCompany, CareerProject, CareerAchievement } from '@/lib/career/types';

interface CareerHeroSectionProps {
  company: CareerCompany;
  achievements: CareerAchievement[];
  projects: CareerProject[];
}

export default function CareerHeroSection({
  company,
  achievements,
  projects,
}: CareerHeroSectionProps) {
  // ...
}
```

---

## 8. 자주 하는 실수 및 해결책

### ❌ 실수 1: 하드코딩된 데이터
```typescript
// 나쁜 예
const achievements = [
  { title: '원가절감', value: '325억원' },
  // ...
];
```

✅ **해결:** API에서 동적으로 로드
```typescript
const [achievements, setAchievements] = useState([]);
useEffect(() => {
  const data = await fetch('/api/achievements');
  setAchievements(data);
}, []);
```

### ❌ 실수 2: 반응형 미지원
```typescript
// 나쁜 예
const S = {
  card: { width: 1024 }, // 고정 너비
};
```

✅ **해결:** 미디어 쿼리 또는 CSS Modules
```typescript
const S = {
  card: {
    width: '100%',
    maxWidth: 1024,
    '@media (max-width: 768px)': {
      padding: 12,
    },
  },
};
```

### ❌ 실수 3: 차트 데이터 형식 오류
```typescript
// 나쁜 예
const data = { year: 2019, efficiency: '66%' }; // 문자열
```

✅ **해결:** 숫자 형식으로 변환
```typescript
const data = { year: 2019, efficiency: 66 }; // 숫자
```

### ❌ 실수 4: 토큰/인증 누락
```typescript
// 나쁜 예
const response = await fetch('/rest/v1/careers');
// Authorization 헤더 없음
```

✅ **해결:** 토큰 포함
```typescript
const token = localStorage.getItem('sb-token');
const response = await fetch('/rest/v1/careers', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### ❌ 실수 5: 로딩/에러 상태 미처리
```typescript
// 나쁜 예
return <div>{data.title}</div>; // data가 undefined면 크래시
```

✅ **해결:** 상태 확인
```typescript
if (loading) return <Skeleton />;
if (error) return <ErrorMessage />;
if (!data) return <NoData />;
return <div>{data.title}</div>;
```

---

## 9. 질문 및 문제 해결

### Q1: Recharts 설치가 안 되는 경우
```bash
npm install --save recharts
npm list recharts
```

### Q2: Supabase API 호출 401 Unauthorized
- [ ] 토큰이 localStorage에 있는지 확인
- [ ] 토큰 만료 시간 확인
- [ ] Supabase RLS 정책 확인

### Q3: 차트가 렌더링되지 않음
- [ ] ResponsiveContainer 높이 확인
- [ ] 데이터 형식 확인 (숫자 vs 문자열)
- [ ] 브라우저 Console 에러 확인

### Q4: 모바일에서 레이아웃 깨짐
- [ ] viewport meta 태그 확인
- [ ] 최대 너비 제한 적용
- [ ] CSS 미디어 쿼리 확인

---

## 10. 완료 후 체크리스트

### 최종 확인
- [ ] 모든 페이지 로드 성공
- [ ] 데이터 정확성 검증
- [ ] 모바일 반응형 동작
- [ ] 에러 처리 완료
- [ ] 성능 최적화 (Lighthouse ≥80)
- [ ] 배포 성공 (Vercel)
- [ ] 라이브 환경 검증

### 문서화
- [ ] 코드 주석 추가 (복잡한 로직)
- [ ] README.md 업데이트 (구현 내용)
- [ ] 이슈/PR 정리

### 팀 보고
- [ ] Slack/Discord: 완료 알림
- [ ] Telegram: 최종 결과 링크 공유
- [ ] 피드백 수렴 (사용자, Planner)

---

## 예상 완료 일정

| 단계 | 기간 | 예상 완료 |
|------|------|---------|
| Phase 1 (DB) | 1일 | 2026-05-16 |
| Phase 2 (타입) | 0.5일 | 2026-05-16 |
| Phase 3 (컴포넌트) | 5일 | 2026-05-21 |
| Phase 4 (페이지) | 3일 | 2026-05-24 |
| Phase 5 (스타일) | 2일 | 2026-05-26 |
| Phase 6 (테스트/배포) | 2일 | 2026-05-28 |
| **총** | **13.5일** | **2026-05-28** |

---

## 마무리

이 체크리스트는 PORTFOLIO_CAREER_DESIGN.md의 설계를 구현하기 위한 단계별 가이드입니다.

**핵심:**
1. 설계서를 꼼꼼히 읽기
2. Phase별로 진행 (병렬 작업 최소화)
3. 테스트는 건너뛰지 말기
4. 문제 발생 시 즉시 팀에 보고

**지원:**
- Planner (설계 검토)
- 평가자 (코드 리뷰)
- 사용자 (최종 검증)

행운을 빕니다! 🚀

