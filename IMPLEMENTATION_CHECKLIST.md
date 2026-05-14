# DSC Hub 구현 체크리스트

> **대상:** 웹개발자
> **기반:** ARCHITECTURE_DSC_HUB.md
> **상태:** Phase 1 시작 전 확인용

---

## Phase 1: 레이아웃 변경 (1주)

### 목표
3개 탭 네비게이션 (Personal History, DSC FMS, Travel Records) 구현
- 모든 기존 페이지는 탭 안에 포함
- 탭 전환이 부드럽고 URL 기반으로 작동
- 모바일 반응형

### 구현 작업

#### 1.1 공통 레이아웃 컴포넌트 작성

- [ ] `components/Layout.jsx` 생성
  - Props: `children`, `activeTab` (기본값: 'fms')
  - 상단 고정 헤더 (로고 + 프로필)
  - 3개 탭 네비게이션 버튼
  - 푸터
  - 모바일: 햄버거 메뉴 토글

```jsx
// 구조 예시
export default function Layout({ children, activeTab = 'fms' }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TabNavigation activeTab={activeTab} />
      <main className="flex-1 container">
        {children}
      </main>
      <Footer />
    </div>
  );
}
```

#### 1.2 탭 네비게이션 컴포넌트

- [ ] `components/TabNavigation.jsx` 생성
  - Props: `activeTab` (personal | fms | travel)
  - 3개 탭 버튼 + 클릭 시 라우팅
  - 활성 탭 배경색/밑줄 표시
  - 반응형 (모바일에서 아이콘만 표시)

```jsx
// Tabs:
// Personal History → /career
// DSC FMS → / (또는 /dashboard)
// Travel → /travel
```

#### 1.3 헤더 컴포넌트

- [ ] `components/Header.jsx` 생성
  - 로고 "DSC Hub"
  - 프로필 드롭다운 (사용자명, 로그아웃)
  - 모바일: 햄버거 메뉴 표시 토글

#### 1.4 푸터 컴포넌트

- [ ] `components/Footer.jsx` 생성
  - 저작권 정보
  - 기존 링크 유지

---

### 페이지 수정

#### 1.5 메인 페이지 라우팅

- [ ] `/pages/index.js` 수정
  - Layout wrapper 추가 (activeTab='fms')
  - 기존 대시보드 콘텐츠 유지
  - 3개 탭 기반 라우팅 구현 (Client-side 또는 Server-side)

**라우팅 방식 선택 (2가지):**

**옵션 A: 쿼리 파라미터 (권장)**
```
/ → /index.js
/?tab=personal → Personal History 렌더링
/?tab=fms → DSC FMS 렌더링 (기본)
/?tab=travel → Travel Records 렌더링
```

**옵션 B: 별도 페이지**
```
/career → Personal History (Layout activeTab='personal')
/ → DSC FMS (Layout activeTab='fms')
/travel → Travel Records (Layout activeTab='travel')
```

권장: **옵션 A** (구조가 더 간단)

#### 1.6 기존 페이지 마이그레이션

- [ ] `/pages/career/` 페이지들
  - Layout wrapper 추가 (activeTab='personal')
  - 기존 Career 컴포넌트 유지

- [ ] `/pages/assets/`, `/pages/bm/`, `/pages/inventory/` 등
  - Layout wrapper 추가 (activeTab='fms')
  - 기존 기능 변경 없음

---

### 스타일링

#### 1.7 CSS 작업

- [ ] 탭 네비게이션 스타일
  - 활성 탭: 배경색 + 밑줄
  - 비활성 탭: 회색
  - 호버: 약간의 배경색 변화
  - 반응형: 모바일에서 아이콘 크기 조정

- [ ] 모바일 레이아웃
  - 헤더: 스택 가능
  - 탭: 수평 스크롤 또는 아이콘만 표시
  - 햄버거 메뉴: 토글 기능

**CSS 프레임워크:**
- Tailwind CSS 사용 (기존) 또는 CSS modules
- 기존 스타일과 일관성 유지

---

### 검수 기준

- [ ] 3개 탭이 모든 페이지에서 렌더링됨
- [ ] 탭 전환 시 URL 변경됨
- [ ] 탭 전환 시 활성 표시가 변함
- [ ] 모바일 화면에서 탭이 축소됨
- [ ] 기존 기능 모두 동작함 (assets, bm, pm 등)
- [ ] 로그아웃 기능 동작함
- [ ] 페이지 새로고침해도 활성 탭이 유지됨

---

## Phase 2: Travel 모듈 DB + CRUD (2주)

### 목표
여행 기본 CRUD 완성 + API 엔드포인트 + 기본 UI

### 사전 작업

#### 2.0 Supabase SQL 실행

- [ ] Supabase Dashboard → SQL Editor에서 `db/21_travel_module.sql` 실행
  - travel_records, travel_schedules, travel_costs, travel_routes 테이블 생성
  - RLS 정책 설정
  - Views 생성
  - **확인:** 모든 테이블이 Supabase에 표시됨

---

### API 엔드포인트 구현

#### 2.1 Travel 목록 API

- [ ] `pages/api/travel/index.js` 생성
  ```
  GET /api/travel
  - Query params: page, limit, status (optional)
  - Response: { data: [...], count: N }
  - RLS: 사용자 본인 기록만
  ```

  ```
  POST /api/travel
  - Body: { title, description, start_date, end_date, country }
  - Response: { id, created_at }
  - Validation: 필드 확인, 날짜 형식 확인
  ```

#### 2.2 Travel 상세 API

- [ ] `pages/api/travel/[id].js` 생성
  ```
  GET /api/travel/[id]
  - Response: travel record + schedules + costs + routes
  - RLS: 사용자 본인만
  
  PUT /api/travel/[id]
  - Body: { title, description, ... }
  - Response: { success: true }
  
  DELETE /api/travel/[id]
  - Response: { success: true }
  - Cascade: schedules, costs, routes 함께 삭제
  ```

#### 2.3 Schedule API

- [ ] `pages/api/travel/[travel_id]/schedule.js` 생성
  ```
  GET /api/travel/[travel_id]/schedule
  - Query: sort=date (asc)
  - Response: [{ id, date, event_name, ... }]
  
  POST /api/travel/[travel_id]/schedule
  - Body: { date, event_name, location, latitude, longitude, start_time, end_time }
  - Response: { id, created_at }
  ```

#### 2.4 Cost API

- [ ] `pages/api/travel/[travel_id]/cost.js` 생성
  ```
  GET /api/travel/[travel_id]/cost
  - Query: cost_type (optional), sort=date
  - Response: [{ id, cost_type, amount, currency, ... }]
  
  POST /api/travel/[travel_id]/cost
  - Body: { cost_type, description, amount, currency, date, exchange_rate, receipt_url }
  - Response: { id, created_at }
  
  PUT /api/travel/[travel_id]/cost/[id]
  - Body: { ... }
  
  DELETE /api/travel/[travel_id]/cost/[id]
  ```

#### 2.5 Route API (Phase 4 연기 가능)

- [ ] `pages/api/travel/[travel_id]/map.js` 생성 (선택사항)
  ```
  GET /api/travel/[travel_id]/map
  - Response: { routes: [...] }
  
  POST /api/travel/[travel_id]/map
  - Body: { from_location, to_location, date }
  - Response: { polyline, distance_km, duration_hours }
  ```

---

### API 유틸 함수

#### 2.6 API 공통 함수

- [ ] `lib/api-auth.js` 확인/수정
  - `getAuthUser(req)` — JWT 토큰에서 user_id 추출
  - `requireAuth(req)` — 인증 필수 체크
  - Supabase client 생성

- [ ] `lib/travel-utils.js` 생성
  - `validateTravelInput(data)` — 필드 검증
  - `calculateDistance(lat1, lon1, lat2, lon2)` — 거리 계산 (optional, Phase 4)
  - `convertCurrency(amount, from, to, rate)` — 통화 변환

---

### UI 페이지 구현

#### 2.7 Travel 목록 페이지

- [ ] `/pages/travel/index.js` 생성
  - Layout wrapper (activeTab='travel')
  - 여행 카드 목록 표시
  - 필터 (All, Planning, Ongoing, Completed)
  - [+ New Trip] 버튼
  - 로딩/에러 상태 처리

```jsx
// 컴포넌트 구조
<Layout activeTab="travel">
  <div>
    <h1>Travel Records</h1>
    <TravelFilters />
    <TravelCardList />
    <NewTravelButton />
  </div>
</Layout>
```

#### 2.8 Travel 추가 페이지

- [ ] `/pages/travel/new.js` 생성
  - `<TravelForm />` 컴포넌트 사용
  - 필드: title, description, start_date, end_date, country
  - [Create] [Cancel] 버튼
  - 성공 시: /travel/[id]로 리다이렉트

#### 2.9 Travel 상세 페이지

- [ ] `/pages/travel/[id].js` 생성
  - Layout wrapper
  - 여행 정보 헤더 (제목, 기간, 비용 합계)
  - 3개 탭 (Schedule, Costs, Map)
  - [Edit] [Delete] 버튼

---

### 컴포넌트 작성

#### 2.10 Travel 컴포넌트 작성

- [ ] `components/travel/TravelCard.jsx`
  - Props: travel object
  - 표시: 제목, 기간, 거리, 비용, 일정/비용 개수
  - 클릭: /travel/[id]로 이동

- [ ] `components/travel/TravelForm.jsx`
  - Props: onSubmit, initialData (optional)
  - 필드: title, description, start_date, end_date, country
  - 유효성 검사 (클라이언트)
  - 로딩/에러 표시

- [ ] `components/travel/TravelDetail.jsx`
  - Props: travel id
  - 데이터 fetch (useEffect)
  - 3개 탭 렌더링

- [ ] `components/travel/TravelCardList.jsx`
  - Props: travels array, onDelete callback
  - 각 여행을 TravelCard로 렌더링
  - 페이지네이션 (optional)

---

### 검수 기준

- [ ] /travel에서 여행 목록 조회 가능
- [ ] [+ New Trip] 클릭 → /travel/new으로 이동
- [ ] /travel/new에서 여행 추가 가능
- [ ] 추가 후 /travel/[id]로 자동 이동
- [ ] /travel/[id]에서 여행 정보 조회 가능
- [ ] [Edit] 클릭 → 수정 폼 표시
- [ ] [Delete] 클릭 → 삭제 (확인 다이얼로그)
- [ ] 삭제 후 /travel로 이동
- [ ] RLS 검증: 다른 사용자의 여행은 접근 불가
- [ ] 오류 시 사용자 친화적 메시지 표시

---

## Phase 3: Travel 모듈 — 비용 + 일정 (1주)

### 목표
Travel 상세 페이지의 Schedule, Costs 탭 구현

### 구현 작업

#### 3.1 Schedule 탭

- [ ] `components/travel/ScheduleEditor.jsx` 생성
  - 일정 목록 (날짜순)
  - [+ Add Event] 버튼 → 인라인 폼
  - 각 일정: [Edit] [Delete] 버튼
  - 수정 시 인라인 폼 전환
  - 저장/취소 버튼

- [ ] `/pages/travel/[id].js`에 Schedule 탭 추가
  - 탭 전환 (useState)
  - <ScheduleEditor /> 렌더링
  - 로딩/에러 상태

#### 3.2 Costs 탭

- [ ] `components/travel/CostTracker.jsx` 생성
  - 비용 합계 표시 (INR + KRW)
  - 필터 (All, Flight, Hotel, Meal, Transport, Other)
  - 비용 목록
  - [+ Add Cost] 버튼

- [ ] 비용 통계 카드
  - 카테고리별 합계 (차트 또는 테이블)
  - 환율 표시 (15.5 INR/KRW)

- [ ] `/pages/travel/[id].js`에 Costs 탭 추가

---

### API 수정

#### 3.3 Schedule CRUD API

- [ ] 기존 `pages/api/travel/[travel_id]/schedule.js` 확장
  ```
  PUT /api/travel/[travel_id]/schedule/[id]
  DELETE /api/travel/[travel_id]/schedule/[id]
  ```

#### 3.4 Cost CRUD API

- [ ] 기존 `pages/api/travel/[travel_id]/cost.js` 확장
  ```
  PUT /api/travel/[travel_id]/cost/[id]
  DELETE /api/travel/[travel_id]/cost/[id]
  ```

---

### 검수 기준

- [ ] Schedule 탭에서 일정 목록 조회 가능
- [ ] [+ Add Event] 클릭 → 인라인 폼 표시
- [ ] 일정 추가/수정/삭제 모두 작동
- [ ] Costs 탭에서 비용 목록 조회 가능
- [ ] 비용 합계 정확하게 계산됨
- [ ] 환율 변환 정확함 (INR → KRW)
- [ ] 비용 필터 작동
- [ ] [+ Add Cost] 클릭 → 인라인 폼 표시
- [ ] 비용 추가/수정/삭제 모두 작동

---

## Phase 4: Google Maps 통합 (1주)

### 목표
Travel 상세 페이지의 Map 탭 구현

### 사전 작업

#### 4.0 환경변수 설정

- [ ] Vercel 대시보드에서 환경변수 추가
  ```
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-api-key>
  ```
  - Google Cloud Console에서 Maps JavaScript API 활성화
  - API 키 생성 (제한: Next.js 도메인)

---

### 라이브러리 설치

#### 4.1 의존성 추가

- [ ] 패키지 설치
  ```bash
  npm install @react-google-maps/api @googlemaps/js-client-library
  ```

- [ ] `package.json` 확인
  ```json
  {
    "@react-google-maps/api": "^2.19.2"
  }
  ```

---

### 컴포넌트 작성

#### 4.2 Map 컴포넌트

- [ ] `components/travel/TravelMap.jsx` 생성
  - Props: travel object (with routes and schedules)
  - Google Map 렌더링 (Center: 첫 일정 위치)
  - Polyline 그리기 (각 route)
  - Markers 표시 (각 schedule)
  - 범례 (transport modes)
  - 로딩 상태

```jsx
// 기본 구조
import { GoogleMap, LoadScript, Polyline, Marker } from '@react-google-maps/api';

export default function TravelMap({ travel }) {
  const mapContainerStyle = { width: '100%', height: '400px' };
  const center = { lat: 13.0827, lng: 80.2707 }; // Chennai default
  
  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={8}>
        {/* Polylines for routes */}
        {travel.routes?.map(route => (
          <Polyline key={route.id} path={decodePolyline(route.polyline)} />
        ))}
        {/* Markers for schedules */}
        {travel.schedules?.map(schedule => (
          <Marker key={schedule.id} position={{ lat: schedule.latitude, lng: schedule.longitude }} />
        ))}
      </GoogleMap>
    </LoadScript>
  );
}
```

#### 4.3 Polyline 유틸

- [ ] `lib/polyline-utils.js` 생성
  - `decodePolyline(encoded)` — Google Directions API 응답 디코딩
  - `encodePolyline(path)` — 경로를 인코딩된 polyline으로 변환

---

### API 수정

#### 4.4 Route API 구현

- [ ] `/pages/api/travel/[travel_id]/map.js` 재구현
  ```
  POST /api/travel/[travel_id]/map
  - Body: { from_location, to_location, date }
  - Google Directions API 호출
  - Response: { polyline, distance_km, duration_hours }
  ```

  - Google Directions API 인증 (API 키 또는 서비스 어카운트)
  - 요청 파라미터: origin, destination, mode=driving
  - 응답 추출: polyline, distance, duration
  - 데이터 저장: travel_routes 테이블

---

### Map 탭 페이지

#### 4.5 Map 탭 UI

- [ ] `/pages/travel/[id].js`의 Map 탭 업데이트
  - <TravelMap /> 렌더링
  - 범례 표시 (transport modes 색상)
  - 로딩 상태 (Skeleton)
  - 에러 상태 ("Map unavailable")

---

### 검수 기준

- [ ] Map 탭에서 구글 지도 렌더링됨
- [ ] Routes가 polyline으로 표시됨
- [ ] Schedules가 marker로 표시됨
- [ ] 범례가 표시됨 (색상 구분)
- [ ] 모바일에서도 지도가 반응형으로 표시됨
- [ ] 좌표 데이터 없을 때 안내 메시지 표시
- [ ] Google Maps API 오류 시 사용자 친화적 에러 메시지 표시

---

## Phase 5: 최종 검수 및 배포

### 검수 작업

#### 5.1 기능 검수

- [ ] Phase 1-4 모든 항목 검증
- [ ] 크로스 브라우저 테스트 (Chrome, Safari, Firefox)
- [ ] 모바일 테스트 (iOS Safari, Android Chrome)
- [ ] 오프라인 모드 테스트

#### 5.2 보안 검수

- [ ] RLS 정책 검증 (다른 사용자 접근 불가)
- [ ] SQL Injection 테스트
- [ ] API 인증 검증 (토큰 없이 접근 불가)
- [ ] CORS 설정 확인

#### 5.3 성능 검수

- [ ] 페이지 로드 속도 (Lighthouse)
- [ ] 이미지 최적화
- [ ] Bundle 크기 확인

---

### 배포

#### 5.4 Git 커밋 및 배포

- [ ] Phase별 git commit
  - Phase 1: "feat: DSC Hub 탭 네비게이션 구현"
  - Phase 2: "feat: Travel 모듈 CRUD"
  - Phase 3: "feat: Travel 일정 및 비용 관리"
  - Phase 4: "feat: Google Maps 통합"

- [ ] Vercel 배포
  - 자동 배포 또는 수동 배포
  - 환경변수 설정 확인

#### 5.5 Post-Deploy 검증

- [ ] 배포된 URL에서 모든 기능 테스트
- [ ] 에러 로그 확인 (Sentry, Vercel Analytics)
- [ ] 사용자 피드백 수집

---

## 부록 A: 자주 사용하는 코드 스니펫

### 인증된 요청

```javascript
// pages/api/travel/index.js
export default async function handler(req, res) {
  const { data: { user } } = await supabase.auth.getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  // 쿼리 실행
  const { data, error } = await supabase
    .from('travel_records')
    .select('*')
    .eq('user_id', user.id);
}
```

### 클라이언트 fetch

```javascript
// pages/travel/new.js
const handleSubmit = async (formData) => {
  const res = await fetch('/api/travel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });
  if (!res.ok) throw new Error('Failed to create travel');
  const { id } = await res.json();
  router.push(`/travel/${id}`);
};
```

### 환율 변환

```javascript
// lib/travel-utils.js
export function convertToKRW(amountINR, exchangeRate = 15.5) {
  return Math.round(amountINR * exchangeRate);
}
```

---

## 부록 B: 마이그레이션 체크리스트

### Before Deployment

- [ ] Supabase SQL 실행 (21_travel_module.sql)
- [ ] RLS 정책 확인 (Supabase Dashboard)
- [ ] 환경변수 설정 (Google Maps API 키)
- [ ] 백업 생성 (Supabase 자동)

### After Deployment

- [ ] 데이터 동기화 확인 (travel_records 테이블)
- [ ] RLS 정책 테스트 (다른 사용자 계정)
- [ ] API 엔드포인트 응답 확인 (Vercel logs)

---

## 부록 C: 문제 해결 가이드

| 문제 | 원인 | 해결 방법 |
|------|------|---------|
| Travel 목록이 비어있음 | RLS 정책이 너무 제한적 | Supabase SQL 재실행 |
| API 401 Unauthorized | JWT 토큰 누락 | 로그인 후 재시도 |
| Google Map 렌더링 안됨 | API 키 없음 | NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 확인 |
| 폼 제출 실패 | 필드 검증 오류 | 콘솔 에러 메시지 확인 |
| 스타일이 적용 안됨 | Tailwind CSS 설정 | next.config.js 확인 |

---

**최종 상태:** 구현 준비 완료 ✅
