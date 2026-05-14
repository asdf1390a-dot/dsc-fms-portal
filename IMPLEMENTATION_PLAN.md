# JEEPNEY 포탈 — 구현 계획서

> **대상:** 웹개발자  
> **상태:** Phase 1 준비 완료  
> **시작일:** 2026-05-13

---

## 📌 빠른 참조

### 필수 문서 3개

1. **JEEPNEY_PORTAL_DESIGN.md** — 전체 아키텍처 & 페이지 설계
2. **DESIGN_SYSTEM.md** — 색상, 타이포그래피, 컴포넌트 상세 규격
3. **IMPLEMENTATION_PLAN.md** — 이 파일 (진행 상황 추적)

### URL 구조 (한눈에 보기)

```
/ (홈)
├── /dsc-hub (DSC Hub 메인)
│   ├── /dsc-hub/fms (FMS 섹션 - 기존)
│   └── /dsc-hub/travel (여행 기록)
├── /jeepney-personal (개인이력)
├── /settings (설정)
└── /login, /status (기존)
```

### 핵심 변경사항

| 항목 | 상태 | 비고 |
|------|------|------|
| JeepneyHeader 확장 | 🔧 수정 | 메인 탭 추가: [DSC HUB][Personal][Settings] |
| 신규 UI 컴포넌트 | 🆕 신규 | Button, Card, Input, Modal, Avatar, etc. |
| DB 테이블 추가 | 🆕 신규 | user_companies, user_projects, user_achievements, travel_trips 등 |
| 페이지 신규 | 🆕 신규 | /jeepney-personal/*, /dsc-hub/travel/* 등 |

---

## 🎯 Phase 1: UI 프레임워크 (1주 일정)

### 목표
기본 UI 컴포넌트 구축 + 디자인 시스템 적용 + 메인 레이아웃 완성

### 작업 항목 & 체크리스트

#### 1.1 디자인 토큰 정의
- [ ] `lib/design-tokens.js` 생성
  - 색상 (16가지)
  - 간격 (8가지: xs~4xl)
  - 타이포그래피 (폰트, 크기, 가중치)
  - 보더레이디우스, 그림자, 트랜지션
- [ ] CSS 변수 선언 (`globals.css` 또는 `_document.js`)
- [ ] 다음 코드 예시 추가:
  ```javascript
  // lib/design-tokens.js
  export const colors = {
    bgPrimary: '#0f172a',
    bgSecondary: '#1e293b',
    textPrimary: '#f8fafc',
    accentCyan: '#06b6d4',
    // ... 나머지 16가지
  };
  ```

#### 1.2 기본 컴포넌트 구현

**Button 컴포넌트**
- [ ] `components/ui/Button.js` 생성
  - 4가지 variant: primary, secondary, danger, ghost
  - 3가지 size: sm, md, lg
  - 상태: normal, hover, active, disabled, loading
  - 테스트: 모든 조합 수동 테스트
  
**검수 기준:**
```
✅ Primary 버튼: 클릭 시 밝기 -10% 변화
✅ Ghost 버튼: 투명 배경 + 테두리 1px
✅ Loading 상태: 스피너 + 텍스트 비활성
✅ Disabled 상태: opacity 50%, cursor: not-allowed
```

**Card 컴포넌트**
- [ ] `components/ui/Card.js` 생성
  - header, body, footer 슬롯
  - hoverable 옵션
  - 그림자 + 테두리 렌더링
  - 테스트: 3가지 레이아웃 (header만, footer만, 전체)

**Input 컴포넌트**
- [ ] `components/ui/Input.js` 생성
  - label, placeholder, error, helperText
  - 포커스 시 사이안 테두리 + 박스셰도우
  - 에러 상태: 빨간 테두리 + 빨간 에러 메시지
  - 테스트: 입력, 에러, 포커스 상태

**Avatar 컴포넌트**
- [ ] `components/ui/Avatar.js` 생성
  - 이미지 URL 또는 initials (예: "JP")
  - 3가지 size: sm (32px), md (48px), lg (64px)
  - 테스트: 모든 크기 렌더링

**Spinner 컴포넌트**
- [ ] `components/ui/Spinner.js` 생성
  - 선형 회전 애니메이션 (1s, 무한)
  - 3가지 크기: sm, md, lg

#### 1.3 레이아웃 컴포넌트 확장

**JeepneyHeader (기존 → 확장)**
- [ ] `components/jeepney/JeepneyHeader.js` 수정
  - 좌측: 로고 + "JEEPNEY" 텍스트
  - 중앙: 3개 탭 ([DSC HUB] [Personal] [Settings])
  - 우측: 프로필 메뉴 (아바타 + 드롭다운)
  - 모바일: 햄버거 메뉴로 접음
  - 색상: 어두운 배경 (#0f172a) + 사이안 활성 탭

**검수 기준:**
```
✅ 데스크톱: 3개 탭 모두 보임
✅ 모바일 (< 640px): 햄버거 메뉴로 수렴
✅ 활성 탭: 사이안 밑줄 (2px)
✅ 프로필 드롭다운: 3개 항목 (프로필 | 설정 | 로그아웃)
```

**TabNav 컴포넌트 (신규)**
- [ ] `components/jeepney/TabNav.js` 생성
  - 여러 탭 렌더링
  - activeTab 상태 표시
  - 언더라인 애니메이션
  - 모바일 스크롤 지원

**JeepneyLayout (신규)**
- [ ] `components/jeepney/JeepneyLayout.js` 생성
  - 구조: Header + Main + BottomNav
  - SafeArea inset 지원 (모바일)
  - 색상: 어두운 배경 전체 적용

#### 1.4 추가 UI 컴포넌트

**Modal 컴포넌트**
- [ ] `components/ui/Modal.js` 생성
  - 3가지 크기: sm (320px), md (480px), lg (720px)
  - 반투명 오버레이 + 블러 효과
  - 닫기 버튼
  - header, body, footer 슬롯
  - 테스트: ESC 키로 닫기, 배경 클릭 닫기

**BottomSheet 컴포넌트 (모바일)**
- [ ] `components/ui/BottomSheet.js` 생성
  - 하단에서 미끄러짐
  - 드래그 핸들 (상단 회색 바)
  - 배경 클릭으로 닫기
  - 모바일 safe-area-inset 지원
  - 테스트: iOS/Android 시뮬레이터에서 동작

**StatCard 컴포넌트**
- [ ] `components/ui/StatCard.js` 생성
  - 제목, 숫자, 변화율 표시
  - 색상 코딩 (성공 초록, 위험 빨강 등)
  - 사용처: DSC Hub 대시보드

#### 1.5 폰트 로딩

- [ ] `pages/_document.js` 수정
  - Google Fonts: Inter (영어) + Noto Sans KR (한글) 로드
  - `font-display: swap` 설정

#### 1.6 반응형 테스트

- [ ] 모바일 (< 640px): 500x812 (iPhone SE)
- [ ] 태블릿 (640~1023px): 800x1024 (iPad)
- [ ] 데스크톱 (≥ 1024px): 1440x900

**검수 기준:**
```
✅ 모바일: BottomNav 보임, 글꼴 읽기 편함
✅ 태블릿: 탭 2개씩 보임, 여백 적절
✅ 데스크톱: 풀 레이아웃, 최대 너비 1280px
```

### 산출물 & 제출

**파일 목록:**
- `lib/design-tokens.js` ✅ 완성
- `components/ui/Button.js` ✅ 완성
- `components/ui/Card.js` ✅ 완성
- `components/ui/Input.js` ✅ 완성
- `components/ui/Avatar.js` ✅ 완성
- `components/ui/Spinner.js` ✅ 완성
- `components/ui/Modal.js` ✅ 완성
- `components/ui/BottomSheet.js` ✅ 완성
- `components/ui/StatCard.js` ✅ 완성
- `components/jeepney/TabNav.js` ✅ 완성
- `components/jeepney/JeepneyHeader.js` 🔧 수정 완료
- `components/jeepney/JeepneyLayout.js` ✅ 완성
- `pages/_document.js` 🔧 수정 (폰트 로드)

**문서:**
- Figma 또는 스크린샷: 모든 컴포넌트의 상태 (normal, hover, active, disabled)
- COMPONENT_LIBRARY.md: 사용 예시 + 소품(props) 설명서

**데모 페이지:**
- `/components/demo` (선택사항): 모든 컴포넌트를 한 페이지에서 볼 수 있는 페이지

---

## 🎯 Phase 2: 메인 페이지 & 네비게이션 (1주 일정)

### 목표
JEEPNEY 홈 + DSC Hub 대시보드 + 설정 페이지 기본 구조 완성

### 작업 항목

#### 2.1 홈 페이지 (/)
- [ ] `pages/index.js` 수정
  - WelcomeCard: "Welcome, [User Name]"
  - AppCard x 3: DSC Hub, Personal, Travel (바로가기)
  - RecentActivityList: 최근 활동 (BM, PM, 프로젝트 등)
  - BottomNav: 고정 네비게이션
  - 색상: 어두운 배경
  - 테스트: 로그인 후 접근 가능

**검수 기준:**
```
✅ 사용자 이름 표시됨
✅ 3개 카드 클릭 시 해당 페이지로 이동
✅ 최근 활동이 최신순으로 정렬됨
✅ BottomNav의 Home 활성
```

#### 2.2 DSC Hub 메인 (/dsc-hub)
- [ ] `pages/dsc-hub/index.js` 생성
  - 3개 탭: [Personal] [DSC FMS] [Travel]
  - FMS 탭 기본값: 4개 StatCard (설비 상태, BM 이력, PM 현황, KPI 실적)
  - 최근 활동 피드
  - 색상: 어두운 배경
  - 테스트: DSC Hub 탭 클릭 시 렌더링

**검수 기준:**
```
✅ 3개 탭 렌더링 및 전환 가능
✅ 각 탭의 콘텐츠가 다름
✅ BottomNav의 DSC Hub 활성
```

#### 2.3 설정 페이지 (/settings)
- [ ] `pages/settings/index.js` 생성
  - 5개 탭: [Profile] [Language] [Theme] [Notifications] [Privacy]
  - 각 탭의 기본 폼 구조
  - 저장/취소 버튼
  - 색상: 어두운 배경
  - 테스트: 모든 탭 렌더링

**검수 기준:**
```
✅ 5개 탭 모두 렌더링
✅ 각 탭의 폼 필드 (Input, Checkbox, Radio) 표시
✅ 저장 버튼 클릭 가능 (데이터 저장은 Phase 5)
```

#### 2.4 API 엔드포인트 (기본 틀)
- [ ] `pages/api/user/profile.js` 생성
  - GET: 현재 사용자 프로필 조회
  - PUT: 프로필 업데이트 (Phase 5에서 구현)
  - 요청/응답 형식:
    ```javascript
    // GET /api/user/profile
    // Response:
    {
      id: "uuid",
      email: "user@example.com",
      full_name: "John Park",
      profile_image_url: "https://...",
      bio: "Software engineer at DSC",
      phone: "+91 98765 43210",
      theme: "dark",
      language: "en"
    }
    ```

#### 2.5 네비게이션 로직
- [ ] BottomNav 상태 업데이트
  - 현재 경로 감지
  - 활성 아이콘 강조 (빨강색)
  - 클릭 시 페이지 이동
  - 모바일에서 SafeArea 고려

#### 2.6 라우팅 테스트
- [ ] / → /dsc-hub → /jeepney-personal → /settings 이동 가능
- [ ] 뒤로가기 버튼 작동
- [ ] BottomNav 클릭으로 페이지 이동
- [ ] 모바일 에뮬레이터에서 모두 테스트

### 산출물

**파일:**
- `pages/index.js` 🔧 수정
- `pages/dsc-hub/index.js` ✅ 신규
- `pages/settings/index.js` ✅ 신규
- `pages/api/user/profile.js` ✅ 신규
- `components/ui/WelcomeCard.js` ✅ 신규
- `components/ui/AppCard.js` ✅ 신규
- `components/ui/ActivityFeed.js` ✅ 신규

**데모:**
- 홈 페이지 스크린샷
- DSC Hub 3개 탭 스크린샷
- 설정 페이지 5개 탭 스크린샷

---

## 🎯 Phase 3: 개인이력 (Personal History) (2주 일정)

### 목표
회사, 프로젝트, 성과 관리 + 타임라인 통합 페이지 완성

### 1단계: DB 스키마 생성

- [ ] Supabase에서 다음 테이블 생성:
  1. `user_companies`
  2. `user_career`
  3. `user_projects`
  4. `user_achievements`
  
- [ ] 각 테이블에 RLS 정책 설정 (자신의 데이터만 접근)
- [ ] 테스트 데이터 5~10건 삽입
- [ ] 테스트:
  ```sql
  SELECT * FROM user_companies WHERE user_id = auth.uid();
  -- → 자신의 데이터만 반환
  ```

### 2단계: API 엔드포인트

**회사 관리:**
- [ ] `pages/api/career/companies.js` (GET, POST)
- [ ] `pages/api/career/companies/[id].js` (GET, PUT, DELETE)

**프로젝트 관리:**
- [ ] `pages/api/career/projects.js` (GET, POST)
- [ ] `pages/api/career/projects/[id].js` (GET, PUT, DELETE)

**성과 관리:**
- [ ] `pages/api/career/achievements.js` (GET, POST)
- [ ] `pages/api/career/achievements/[id].js` (GET, PUT, DELETE)

### 3단계: 페이지 구현

**회사 목록 페이지**
- [ ] `pages/jeepney-personal/career/companies.js` 생성
  - 검색바 + [+ New Company] 버튼
  - 회사 카드 목록 (회사명, 직책, 기간, 설명)
  - 카드 클릭 시 상세 페이지로 이동
  - 색상: 어두운 배경 + 사이안 강조

**회사 상세 페이지**
- [ ] `pages/jeepney-personal/career/companies/[id].js` 생성
  - 회사 정보 표시
  - 편집/삭제 버튼
  - 이 회사에서의 프로젝트 목록
  - 돌아가기 버튼

**회사 추가/편집 폼**
- [ ] `pages/jeepney-personal/career/companies/new.js` 생성
  - Input 필드: 회사명, 직책, 산업, 부서, 기간, 설명
  - 폼 검증: 회사명, 기간 필수
  - 저장/취소 버튼
  - 성공 메시지

**프로젝트 관리 (회사와 동일한 구조)**
- [ ] `pages/jeepney-personal/career/projects.js` (목록)
- [ ] `pages/jeepney-personal/career/projects/new.js` (추가)
- [ ] `pages/jeepney-personal/career/projects/[id].js` (상세)
- [ ] 추가 필드: tech_stack (배열), impact (결과)

**성과 관리**
- [ ] `pages/jeepney-personal/career/achievements.js` (목록)
- [ ] 4개 탭: [All] [Skills] [Certifications] [Awards]
- [ ] 각 탭에서 해당 유형만 필터링

**타임라인 페이지**
- [ ] `pages/jeepney-personal/timeline.js` 생성
  - 연도별 + 항목별 통합 타임라인
  - 모든 회사, 프로젝트, 성과가 시간 순서로 렌더링
  - 마크다운 형식: "2026년 5월 — Project A 시작 (Daechang Seat)"
  - "Load More" 버튼 (페이지네이션)

### 4단계: 컴포넌트

- [ ] `components/career/PersonalTabNav.js` (4개 탭)
- [ ] `components/career/CompanyCard.js`
- [ ] `components/career/ProjectCard.js`
- [ ] `components/career/AchievementCard.js`
- [ ] `components/career/TimelineItem.js`

### 검수 기준

```
✅ 회사 추가 → 목록에 나타남
✅ 프로젝트 추가 시 회사 선택 가능
✅ 성과 유형별 필터 동작
✅ 타임라인: 최신순 정렬
✅ 모바일: 카드 전체 너비 사용
✅ 모든 페이지 조회, 수정, 삭제 가능 (동시성 제어 X)
```

---

## 🎯 Phase 4: 여행기록 (Travel Records) (2주 일정)

### 목표
여행 관리 + 일정 + 비용 + 사진 + 지도 기능 완성

### 1단계: DB 스키마

- [ ] `travel_trips` 테이블
- [ ] `travel_itinerary` 테이블 (일정)
- [ ] `travel_expenses` 테이블 (비용)
- [ ] `travel_photos` 테이블 (사진)
- [ ] RLS 정책 설정

### 2단계: API 엔드포인트

- [ ] `pages/api/travel/trips.js`
- [ ] `pages/api/travel/trips/[id].js`
- [ ] `pages/api/travel/trips/[id]/itinerary.js` (일정 CRUD)
- [ ] `pages/api/travel/trips/[id]/expenses.js` (비용 CRUD)
- [ ] `pages/api/travel/trips/[id]/photos.js` (사진 CRUD)

### 3단계: 페이지

**여행 목록**
- [ ] `pages/dsc-hub/travel/index.js`
  - 검색 + 필터 (상태, 목적)
  - 여행 카드 (출발-도착, 날짜, 상태, 예산)
  - [+ New Trip] 버튼

**여행 상세 (5개 탭)**
- [ ] `pages/dsc-hub/travel/[id]/index.js` (Overview)
- [ ] `pages/dsc-hub/travel/[id]/schedule.js` (일정)
- [ ] `pages/dsc-hub/travel/[id]/costs.js` (비용 + 차트)
- [ ] `pages/dsc-hub/travel/[id]/photos.js` (갤러리)
- [ ] `pages/dsc-hub/travel/[id]/map.js` (지도)

**여행 추가/편집**
- [ ] `pages/dsc-hub/travel/new.js`
  - 여행명, 출발지, 도착지, 날짜, 목적, 예산

### 4단계: 외부 라이브러리

- [ ] 지도: Leaflet + react-leaflet (또는 Google Maps API)
- [ ] 차트: Recharts (기존 설치됨)
- [ ] 갤러리: 커스텀 그리드 또는 react-medium-image-zoom

### 5단계: 컴포넌트

- [ ] `components/travel/TravelCard.js`
- [ ] `components/travel/TravelTabNav.js`
- [ ] `components/travel/ItineraryEvent.js`
- [ ] `components/travel/ExpenseBreakdown.js` (차트)
- [ ] `components/travel/PhotoGallery.js`
- [ ] `components/travel/Map.js`

### 검수 기준

```
✅ 여행 생성 → 목록에 나타남
✅ 일정 추가 시 날짜순 정렬
✅ 비용 탭: 카테고리별 합계 + 차트
✅ 사진 탭: 촬영 날짜순 정렬
✅ 지도: 출발지-도착지 경로 표시
✅ 모바일: 모든 탭이 세로로 쌓여 스크롤
```

---

## 🎯 Phase 5: 설정 & 사용자 관리 (1주 일정)

### 목표
프로필, 언어, 테마, 알림, 프라이버시 설정 완성

### 작업 항목

- [ ] `pages/settings/profile.js` — 프로필 편집
- [ ] `pages/settings/language.js` — 언어 선택
- [ ] `pages/settings/theme.js` — 다크/라이트 모드 + 악센트 색상
- [ ] `pages/settings/notifications.js` — 알림 설정
- [ ] `pages/settings/privacy.js` — 프라이버시

- [ ] API: `pages/api/user/profile.js` (PUT 구현)
- [ ] API: `pages/api/user/settings.js` (GET, PUT)

### 검수 기준

```
✅ 프로필 수정 → 저장 후 반영
✅ 언어 선택 → 즉시 전체 UI 변경
✅ 테마 선택 → localStorage에 저장, 새로고침 후에도 유지
✅ 알림 체크박스 → Supabase에 저장
✅ 프라이버시: "Download Data" 링크 작동
```

---

## 🎯 Phase 6: 통합 & 최적화 (1주 일정)

### 목표
전체 포탈 통합 검수 + 성능 최적화

### 작업 항목

#### 6.1 다국어 지원
- [ ] i18n 라이브러리 선택 (next-i18next)
- [ ] 4가지 언어: en, ko, hi, ta
- [ ] 모든 페이지에 다국어 적용
- [ ] 언어 설정 페이지에서 전환
- [ ] 테스트: 각 언어로 1개 페이지씩 확인

#### 6.2 에러 핸들링
- [ ] ErrorBoundary 컴포넌트 추가
- [ ] 404 페이지 커스텀
- [ ] 500 에러 페이지 커스텀
- [ ] API 오류 시 토스트 메시지
- [ ] 네트워크 끊김 감지 + 재시도

#### 6.3 성능 최적화
- [ ] Lighthouse 점수 측정 (Chrome DevTools)
- [ ] 목표:
  - Performance: ≥ 80
  - Accessibility: ≥ 95
  - Best Practice: ≥ 90
  - SEO: ≥ 90
- [ ] 이미지 최적화 (Next.js Image)
- [ ] 코드 분할 (dynamic imports)
- [ ] 캐싱 전략 (next/image, API 응답)

#### 6.4 SEO & 메타 태그
- [ ] `pages/_app.js` 또는 각 페이지에 Head 추가
- [ ] 기본 메타 태그:
  ```jsx
  <Head>
    <title>JEEPNEY — Personal Portal</title>
    <meta name="description" content="Unified personal and business portal" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta property="og:title" content="JEEPNEY" />
    <meta property="og:image" content="/logo-og.png" />
  </Head>
  ```

#### 6.5 모바일 테스트
- [ ] iOS: Safari on iPhone (최신 2개 버전)
- [ ] Android: Chrome (최신 2개 버전)
- [ ] 체크 항목:
  - 터치 반응성
  - SafeArea 존중
  - 폼 입력 (선택, 입력, 전송)
  - 뒤로가기 버튼
  - 장시간 사용 (배터리, 메모리)

#### 6.6 크로스 브라우저 테스트
- [ ] Chrome/Chromium (최신)
- [ ] Safari (최신)
- [ ] Firefox (최신)
- [ ] 체크: 색상 렌더링, 레이아웃, 애니메이션

#### 6.7 문서 작성
- [ ] README.md: 프로젝트 개요 + 설치 + 실행 방법
- [ ] API_DOCS.md: 모든 엔드포인트 문서화
- [ ] TROUBLESHOOTING.md: 일반적인 문제 + 해결방법

### 산출물

**파일:**
- i18n 설정 파일
- ErrorBoundary 컴포넌트
- 커스텀 404, 500 페이지

**문서:**
- Lighthouse 점수 스크린샷
- 모바일 테스트 결과 (체크리스트 + 스크린샷)
- README.md, API_DOCS.md

---

## 📊 전체 진행 상황 추적

### 타임라인 (총 8주)

```
Week 1 (May 13-19):   Phase 1 — UI 프레임워크 ████████░░
Week 2 (May 20-26):   Phase 2 — 메인 페이지 ████████░░
Week 3-4 (May 27-Jun 9): Phase 3 — 개인이력 ██████░░░░
Week 5-6 (Jun 10-23): Phase 4 — 여행기록 ██████░░░░
Week 7 (Jun 24-30):   Phase 5 — 설정 ████░░░░░░
Week 8 (Jul 1-7):     Phase 6 — 통합 & 최적화 ████░░░░░░
```

### 위험 요소 & 완화 전략

| 위험 | 영향 | 완화 전략 |
|------|------|---------|
| 외부 라이브러리 호환성 문제 | 높음 | Phase 1 초반 테스트, 필요시 대체 라이브러리 검토 |
| 모바일 레이아웃 복잡도 | 중간 | 초반에 모바일 에뮬레이터로 자주 테스트 |
| RLS 정책 보안 문제 | 높음 | Supabase 공식 문서 참고, 전담 검수 |
| 성능 회귀 | 중간 | 매 Phase 종료 시 Lighthouse 측정 |
| 다국어 누락 | 낮음 | 한 번에 모든 다국어 적용 (한곳 변경 시 모두 반영) |

---

## 제출 규칙

### 각 Phase 종료 시 제출 내용

1. **코드**
   - PR 링크 (GitHub)
   - 모든 파일이 main 브랜치에 병합됨
   - 커밋 메시지는 구체적 (예: "feat: Add Button component with 4 variants")

2. **문서**
   - 위의 "산출물" 섹션의 모든 파일
   - 스크린샷 (PC + 모바일 에뮬레이터)
   - 테스트 체크리스트 (위의 "검수 기준" 확인)

3. **테스트**
   - 수동 테스트: 모든 항목 체크
   - 자동 테스트 (선택): Jest 테스트 코드

---

## 👤 연락처 & 지원

- **플레너 (설계)**: 구체적인 설계 변경 시 상담 필요
- **데이터 애널리스트**: DB 스키마 검증 (Phase 3-4)
- **평가자**: 최종 검수 전 사전 리뷰 (각 Phase 종료 후)

---

**다음:** Phase 1 시작! 첫 번째 작업은 `lib/design-tokens.js` 생성입니다.
