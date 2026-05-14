# Travel Management Module — Phase 2 Implementation Plan

> **상태:** 플레너 최종 설계 (웹개발자 구현 대기)
> **작성일:** 2026-05-14
> **타깃 배포:** 2026-05-27 (Vercel Production)
> **선행 산출물:** Phase 1 API (1,496 LOC) + DB 마이그레이션(24_create_travel_tables.sql) 완료
> **연관 문서:**
> - `TRAVEL_MANAGEMENT_PHASE1_COMPLETE.md`
> - `TRAVEL_MANAGEMENT_DESIGN.md`
> - `TRAVEL_MANAGEMENT_API_GUIDE.md`
> - `TRAVEL_MANAGEMENT_PHASE2_VOUCHER_PARSING_DESIGN.md` (별도 통합 예정)

---

## 📑 목차

1. [개요 (Overview)](#1-개요-overview)
2. [컴포넌트 설계 (Component Design)](#2-컴포넌트-설계-component-design)
3. [파일 구조 (File Structure)](#3-파일-구조-file-structure)
4. [개발 순서 (Development Sequence)](#4-개발-순서-development-sequence)
5. [통합 체크리스트 (Integration Checklist)](#5-통합-체크리스트-integration-checklist)

---

# 1. 개요 (Overview)

## 1.1 Phase 2 목표

Phase 1에서 완성된 11개 API 엔드포인트와 9개 DB 테이블을 바탕으로, **모바일 친화적이고 사용성 높은 9개 UI 컴포넌트**를 구현하여 DSC FMS 포탈에 통합한다. 핵심은 다음 3가지:

- **사용성 (Usability)** — Telegram 모바일 우선, 1초 안에 핵심 정보 확인 가능.
- **자율성 (Autonomy)** — 사용자가 외부 도움 없이 출장 전체 라이프사이클을 관리.
- **확장성 (Extensibility)** — 바우처 자동 파싱 모듈이 추후 끼어들 수 있는 훅 포인트(slot) 확보.

## 1.2 9개 컴포넌트 개요

| # | 컴포넌트 | 경로 | 핵심 책임 | 의존 API | 모바일 우선순위 |
|---|---------|------|----------|----------|--------------|
| 1 | **TravelList** | `/travels` | 여행 목록 카드뷰, 필터·정렬·검색 | `GET /api/travels` | ⭐⭐⭐ |
| 2 | **TravelDetail** | `/travels/[id]` | 6개 탭 컨테이너, 헤더, 권한 컨텍스트 | `GET /api/travels/[id]` | ⭐⭐⭐ |
| 3 | **CreateTravel** | `/travels/new` | 신규 여행 폼, 자동 저장(draft) | `POST /api/travels` | ⭐⭐ |
| 4 | **EventManagement** | `/travels/[id]/schedule` (탭 2) | 이벤트 CRUD, 타임라인·캘린더 뷰 | `*/events` (4) | ⭐⭐⭐ |
| 5 | **MemberManagement** | 모달 컴포넌트 | 멤버 초대·권한·삭제 | `*/members` (2) | ⭐⭐ |
| 6 | **ChecklistManagement** | `/travels/[id]/checklist` (탭 4) | 카테고리별 체크리스트, 진행률 | `*/checklist` (4) | ⭐⭐⭐ |
| 7 | **CostTracking** | `/travels/[id]/costs` (탭 3) | 비용 등록·분할·정산 대시보드 | `*/costs` (4) | ⭐⭐⭐ |
| 8 | **DocumentStorage** | `/travels/[id]/documents` (탭 5) | 파일 업로드·다운로드·공유 | `*/documents` (3) | ⭐⭐ |
| 9 | **TravelAnalytics** | `/travels/[id]/analytics` (탭 6) | 비용·일정 분석 차트 | `*/costs?endpoint=settlement` + 집계 | ⭐ |

> **참고:** 알림(Notifications) 탭은 `NotificationSettings`로 별도 작은 컴포넌트로 분리되어 TravelDetail 안에서 표시된다. 9개 핵심 외 부속.

## 1.3 개발 순서 (요약)

1. **공통 레이어 먼저** (1.5일) — types, hooks, API client, 디자인 토큰 매핑
2. **TravelList → CreateTravel → TravelDetail 쉘** (2일) — 입구·진입경로 확보
3. **탭 컨텐츠 6개** (6일) — Overview/Event/Cost/Checklist/Document/Analytics
4. **모달 컴포넌트** (1일) — MemberManagement, Cost Form, Event Form
5. **반응형/접근성/에러처리/QA** (2.5일)

총 **13일** (2026-05-15 ~ 05-27)

## 1.4 기술 결정사항

| 영역 | 선택 | 사유 |
|------|------|------|
| **상태관리** | **Zustand + SWR 하이브리드** | Zustand로 UI 상태(모달, 폼), SWR로 서버 캐시·재검증. React Query보다 가볍고 Next 14 App Router 호환 좋음 |
| **폼** | **React Hook Form + Zod** | DSC FMS 다른 모듈 패턴 통일. 강타입 검증 |
| **모달/Dialog** | **Radix UI Dialog** | shadcn/ui 기반, 키보드/접근성 무료 |
| **차트** | **Recharts** | 번들 작고, Recharts 라이트 트리쉐이킹 |
| **날짜** | **date-fns + react-day-picker** | dayjs보다 트리쉐이킹 우수, Recharts와 충돌 없음 |
| **파일업로드** | **react-dropzone + Supabase Storage SDK** | Phase 1 백엔드와 동일 패턴 |
| **알림 토스트** | **sonner** | shadcn 통합, 모바일 친화 |
| **아이콘** | **Lucide React** | 이미 portal 안에서 사용 중 |
| **테스트** | **Vitest + Playwright (E2E)** | Phase 1 API 회귀 방지 |

> **변경 사항:** Phase 2 Plan(2026-05-14)에서 React Context를 후보로 두었으나 **Zustand+SWR 하이브리드**로 확정. 이유는 (1) tab 전환 시 캐시 유지, (2) optimistic update 단순화, (3) 9개 컴포넌트가 같은 travel 객체를 공유해야 함.

## 1.5 보안·권한 컨텍스트

- 모든 페이지에서 `useTravelPermission(travelId)` 훅 호출 → `{ isOrganizer, canWrite, canDelete }` 반환.
- `canWrite=false`이면 UI 레벨에서 편집 버튼 자체를 숨김 (서버 403도 함께 방어).
- 민감 필드(여권/비자 문서)는 클라이언트 캐시에서 30초 후 evict.

## 1.6 성능 목표

| 지표 | 목표 | 측정 |
|------|------|------|
| TravelList 초기 로드 | < 1.5s | Lighthouse + Vercel Analytics |
| TravelDetail 캐시된 진입 | < 500ms | useSWR `revalidateOnFocus` 비활성화 |
| Bundle Size (travels 라우트) | < 180KB gzip | `@next/bundle-analyzer` |
| Lighthouse Performance | 90+ | CI에서 자동 측정 |
| CLS (Cumulative Layout Shift) | < 0.1 | skeleton placeholder |

## 1.7 디자인 시스템 매핑

DSC FMS 기존 토큰을 그대로 사용:

| 토큰 | 값 | 사용처 |
|------|---|-------|
| `--primary` | `#1E40AF` (blue-700) | CTA 버튼, 활성 탭 |
| `--success` | `#16A34A` (green-600) | 정산 받는 사람 배지 |
| `--danger` | `#DC2626` (red-600) | 정산 갚는 사람 배지, 삭제 |
| `--warning` | `#F59E0B` (amber-500) | 임박한 일정 |
| `--surface` | `#FFFFFF` / dark `#0F172A` | 카드 배경 |
| `--text-primary` | `#0F172A` / dark `#F1F5F9` | 본문 |
| `--text-secondary` | `#475569` / dark `#94A3B8` | 캡션 |
| `--border` | `#E2E8F0` / dark `#1E293B` | 카드 테두리 |

> Phase 1 BM 모듈에서 사용한 동일 토큰. 새 색상 추가 금지.

---

# 2. 컴포넌트 설계 (Component Design)

각 컴포넌트마다 다음 8개 섹션을 일관되게 작성한다:
**(a) 책임 (b) 라우트/위치 (c) UI 레이아웃 (d) Props 인터페이스 (e) 상태 모델 (f) API 연동 (g) 폼 검증 규칙 (h) 에러/엣지케이스**

---

## 2.1 TravelList — 여행 목록 페이지

### (a) 책임
사용자가 참여한 모든 여행을 카드 그리드로 표시하고, 필터·정렬·검색·페이지네이션을 제공. 신규 여행 생성 진입점.

### (b) 라우트/위치
- **경로:** `/travels`
- **파일:** `app/travels/page.tsx`
- **레이아웃:** `app/travels/layout.tsx` (탑바 + 사이드바)

### (c) UI 레이아웃 (모바일/데스크탑)

**모바일 (320–767px):**
```
┌──────────────────────────┐
│ ← 출장/여행      [+ 새여행] │  ← 헤더 (sticky)
├──────────────────────────┤
│ 🔍 [검색]                 │
│ [전체▼] [최신순▼]         │  ← 필터 chip + 정렬
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ 🌏 Ho Chi Minh City  │ │  ← Card 1 (TravelCard)
│ │ 05-15 ~ 05-24 · 9일  │ │
│ │ 👥 2명 · 💰 ₹148,771 │ │
│ │ [⏳ 진행중]          │ │
│ └──────────────────────┘ │
│ (더 많은 카드…)           │
└──────────────────────────┘
```

**데스크탑 (≥1024px):** 3-column grid (`grid-cols-3 gap-4`).

### (d) Props 인터페이스

```typescript
// 페이지는 props 없음 (Server Component)
// TravelCard는 내부 컴포넌트:
interface TravelCardProps {
  travel: Travel & {
    members: TravelMember[];
    totalCost: number;
  };
  onClick: (id: string) => void;
}
```

### (e) 상태 모델

```typescript
// Zustand store: useTravelListStore
interface TravelListState {
  filter: 'all' | 'upcoming' | 'ongoing' | 'completed';
  sort: 'date_desc' | 'date_asc' | 'cost_desc' | 'name_asc';
  search: string;
  page: number;
  pageSize: 12;
}

// 서버 상태 (SWR):
const { data, error, isLoading, mutate } = useSWR(
  ['/api/travels', filter, sort, search, page],
  fetcher
);
```

### (f) API 연동

| 액션 | 엔드포인트 | 메서드 | 페이로드 |
|------|----------|-------|--------|
| 목록 조회 | `/api/travels?status={filter}&sort={sort}&search={q}&page={n}&size=12` | GET | - |
| 카드 클릭 | router.push(`/travels/${id}`) | - | - |
| 새 여행 | router.push(`/travels/new`) | - | - |

### (g) 폼 검증 규칙
- 검색어는 300ms debounce, 빈 문자열은 무시.
- 필터/정렬 변경 시 page=1로 리셋.

### (h) 에러/엣지케이스
- **빈 상태:** "아직 등록된 여행이 없어요. [+ 새 여행] 버튼으로 시작하세요." 일러스트.
- **네트워크 오류:** "목록을 불러올 수 없습니다." + [재시도] 버튼.
- **권한 없음(401):** 로그인 페이지로 리다이렉트.
- **무한 로딩 방지:** 10초 후 fallback 메시지.
- **스켈레톤 카드:** 첫 페인트 시 12개 placeholder 카드.

### 핵심 코드 스니펫

```typescript
'use client';
import { useTravelList } from '@/hooks/useTravelList';
import { TravelCard } from '@/components/travels/TravelCard';
import { TravelListFilters } from '@/components/travels/TravelListFilters';

export default function TravelListPage() {
  const { travels, loading, error, filter, setFilter, sort, setSort } = useTravelList();
  if (error) return <ErrorState onRetry={() => mutate()} />;
  return (
    <>
      <TravelListFilters filter={filter} onFilter={setFilter} sort={sort} onSort={setSort} />
      {loading ? <CardSkeleton count={12} /> : (
        travels.length === 0
          ? <EmptyState />
          : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {travels.map(t => <TravelCard key={t.id} travel={t} />)}
            </div>
      )}
    </>
  );
}
```

---

## 2.2 TravelDetail — 여행 상세 (탭 컨테이너)

### (a) 책임
하나의 여행을 6개 탭으로 분해해 표시. URL 쿼리스트링(`?tab=`)으로 탭 상태 보존. 권한 컨텍스트 주입.

### (b) 라우트/위치
- **경로:** `/travels/[id]?tab=overview|schedule|costs|checklist|documents|analytics`
- **파일:** `app/travels/[id]/page.tsx`, `app/travels/[id]/layout.tsx`

### (c) UI 레이아웃

```
┌──────────────────────────────────────┐
│ ← Ho Chi Minh City   [편집] [공유]   │  ← Header
│ 2026-05-15 ~ 05-24 · 9일 · 👥 2명     │
├──────────────────────────────────────┤
│ [개요][일정][경비][준비물][문서][분석] │  ← TabBar (horizontal scroll mobile)
├──────────────────────────────────────┤
│                                       │
│   (탭별 컨텐츠)                       │
│                                       │
└──────────────────────────────────────┘
```

### (d) Props 인터페이스

```typescript
// 동적 라우트: { params: { id: string } }
interface TravelDetailLayoutProps {
  params: { id: string };
  children: ReactNode;
}

// Context로 자식에게 노출:
interface TravelContext {
  travel: TravelWithRelations;
  permission: { isOrganizer: boolean; canWrite: boolean; canDelete: boolean };
  refetch: () => Promise<void>;
}
```

### (e) 상태 모델
- 서버상태: `useSWR(['/api/travels/' + id], fetcher)` — full travel + relations.
- UI상태(zustand): `activeTab`, `isEditModalOpen`, `isMemberModalOpen`.

### (f) API 연동
- 진입 시 `GET /api/travels/[id]` 1회만 호출 (relations 포함).
- 탭 전환 시 추가 호출 없음 (전체 객체 보유).
- 편집/삭제: `PUT/DELETE /api/travels/[id]`.

### (g) 폼 검증 규칙
- 헤더 편집 모달: TravelForm 재사용 (2.3 참조).

### (h) 에러/엣지케이스
- **404:** "이 여행을 찾을 수 없거나 접근 권한이 없습니다." + 목록 복귀 버튼.
- **403:** 동일 처리 (정보 누설 방지).
- **존재하지만 멤버 0명:** 자동으로 organizer 단독 표시.
- **삭제 확인:** Radix AlertDialog 2단계 확인 ("정말 삭제? 모든 비용/문서 함께 삭제됩니다").
- **공유 버튼:** 모바일 navigator.share API, 데스크탑 URL 클립보드 복사.

### TabBar 구현 노트
- 모바일은 `overflow-x-auto`로 가로 스크롤, 활성 탭은 underline.
- 6개 탭은 lazy-load 처리: 진입한 탭만 컴포넌트 마운트 (Next.js Parallel Routes 사용 안함; 단순 조건부 렌더).

---

## 2.3 CreateTravel — 신규 여행 생성 폼

### (a) 책임
신규 여행 등록. 폼 검증, 자동 저장(localStorage draft), 멤버 즉시 초대(옵션).

### (b) 라우트/위치
- **경로:** `/travels/new`
- **파일:** `app/travels/new/page.tsx`
- **모달 변형:** TravelList의 [+ 새여행] 버튼이 모달로 띄울 수도 있음 (모바일=풀스크린, 데스크탑=모달).

### (c) UI 레이아웃

```
┌──────────────────────────────────────┐
│ ← 새 여행 만들기                       │
├──────────────────────────────────────┤
│ 여행 이름 *                          │
│ [____________________]               │
│                                       │
│ 출발일 *           도착일 *           │
│ [📅 2026-05-15]  [📅 2026-05-24]    │
│                                       │
│ 목적지                                │
│ [____________________]               │
│                                       │
│ 설명 (선택)                          │
│ [____________________]               │
│ [____________________]               │
│                                       │
│ ─────── 멤버 초대 (선택) ───────      │
│ [+ 동반자 추가]                      │
│                                       │
│ [취소]                      [만들기] │
└──────────────────────────────────────┘
```

### (d) Props 인터페이스

```typescript
interface CreateTravelFormProps {
  mode?: 'page' | 'modal';
  initialValues?: Partial<TravelFormValues>;
  onSuccess?: (travel: Travel) => void;
  onCancel?: () => void;
}

interface TravelFormValues {
  name: string;
  start_date: string;
  end_date: string;
  location?: string;
  description?: string;
  initial_members?: { email: string; permission: 'read_only' | 'read_write' }[];
}
```

### (e) 상태 모델
- React Hook Form + Zod resolver.
- localStorage draft 키: `travel-draft-v1`. 입력 후 500ms debounce로 저장. 제출 성공 시 삭제.
- 진입 시 draft 존재하면 "이전에 작성하던 여행이 있어요. 이어서 작성하시겠어요?" 확인.

### (f) API 연동

| 액션 | 엔드포인트 | 메서드 |
|------|----------|-------|
| 생성 | `POST /api/travels` | JSON body |
| 초기 멤버 추가 (옵션) | `POST /api/travels/[id]/members` × N | 생성 직후 chain |

### (g) 폼 검증 규칙 (Zod)

```typescript
const TravelSchema = z.object({
  name: z.string().min(2, '2자 이상').max(80, '80자 이하'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  initial_members: z.array(z.object({
    email: z.string().email(),
    permission: z.enum(['read_only', 'read_write']),
  })).optional(),
}).refine(d => d.end_date >= d.start_date, {
  message: '도착일은 출발일 이후여야 해요',
  path: ['end_date'],
});
```

### (h) 에러/엣지케이스
- **중복 이름:** 같은 사용자가 같은 이름의 여행을 만들 수 있음 (백엔드 허용). UI는 "유사한 여행이 있어요. 계속할까요?" 정보만 표시.
- **과거 날짜:** 등록 허용 (회고/사후 입력 케이스). 단, "출발일이 과거예요" 정보 톤 경고.
- **멤버 이메일 미가입:** 백엔드가 409 반환 → "초대장 이메일을 보낼까요?" 옵션 (Phase 3, 지금은 에러 메시지만).
- **네트워크 끊김:** 폼 데이터는 draft에 보존, "오프라인입니다" 토스트.

---

## 2.4 EventManagement — 일정 관리 (탭 2)

### (a) 책임
한 여행의 모든 이벤트(항공편/숙박/식사/이동/기타)를 타임라인+캘린더로 표시하고 CRUD 제공.

### (b) 라우트/위치
- **경로:** `/travels/[id]?tab=schedule`
- **파일:** `components/travels/EventManagement.tsx`

### (c) UI 레이아웃

**타임라인 뷰 (기본):**
```
일정                        [📅 캘린더] [+ 이벤트]
─────────────────────────────────────
📅 2026-05-15 (목요일)
  ┌─────────────────────────────────┐
  │ ✈️  23:50 항공편 TR 779/516     │
  │     Chennai → Singapore         │
  │     [✏️][🗑️]                    │
  └─────────────────────────────────┘
📅 2026-05-16 (금요일)
  ┌─────────────────────────────────┐
  │ 🏨  14:00 체크인 Lumiere        │
  │     Quận 2, HCMC                │
  └─────────────────────────────────┘
─────────────────────────────────────
```

**캘린더 뷰 (토글):**
- `react-day-picker` 월간 그리드, 점(dot)으로 이벤트 표시.
- 날짜 클릭 시 해당 일자 이벤트 목록 모달.

### (d) Props 인터페이스

```typescript
interface EventManagementProps {
  travelId: string;
  events: TravelEvent[];
  canWrite: boolean;
  onMutate: () => Promise<void>;
}

interface EventFormValues {
  title: string;
  event_type: 'flight' | 'hotel' | 'meal' | 'transport' | 'other';
  event_date: string;
  event_time: string | null;
  location?: string;
  description?: string;
  details?: Record<string, any>; // flight number, confirmation code etc.
  status: 'planned' | 'completed' | 'cancelled';
}
```

### (e) 상태 모델
- view: `'timeline' | 'calendar'` (localStorage 보존)
- 폼 모달: open/close + edit target
- Optimistic update: 추가/수정 시 즉시 로컬 캐시 갱신, 실패 시 rollback

### (f) API 연동

| 액션 | 엔드포인트 | 메서드 |
|------|----------|-------|
| 목록 | (TravelDetail 진입 시 함께 로드) | - |
| 생성 | `POST /api/travels/[id]/events` | JSON |
| 수정 | `PUT /api/travels/[id]/events/[eventId]` | JSON |
| 삭제 | `DELETE /api/travels/[id]/events/[eventId]` | - |

### (g) 폼 검증 규칙

```typescript
const EventSchema = z.object({
  title: z.string().min(1).max(120),
  event_type: z.enum(['flight','hotel','meal','transport','other']),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  location: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  details: z.record(z.any()).optional(),
  status: z.enum(['planned','completed','cancelled']).default('planned'),
}).refine(d => /* event_date within travel range */, '여행 기간을 벗어났어요');
```

### (h) 에러/엣지케이스
- **여행 기간 밖 일정:** 경고만 표시, 등록은 허용 (사전 답사 등).
- **시간 미지정:** 종일 일정으로 처리 (event_time=null).
- **이벤트 정렬:** `event_date ASC, event_time NULLS LAST, created_at ASC`.
- **체크박스로 status 변경:** "완료" 체크 시 PUT 호출, 실패 시 체크 복구.
- **이벤트 0개:** "일정을 추가해서 여행을 계획하세요." 빈 상태.
- **드래그&드롭(향후):** Phase 3에서 react-dnd로 시간 이동.

### 이벤트 타입별 details 스키마 (참고)

| event_type | details 필드 |
|-----------|-------------|
| flight | `{ airline, flight_no, departure_airport, arrival_airport, seat, pnr }` |
| hotel | `{ hotel_name, address, confirmation_code, room_no }` |
| meal | `{ restaurant_name, cuisine, address }` |
| transport | `{ mode, from, to, vehicle_no }` |
| other | 자유 텍스트 only |

**바우처 자동 파싱 통합 슬롯:** 이벤트 폼 상단에 [📎 바우처 붙여넣기/업로드] 버튼 자리 확보. 클릭 시 별도 파싱 모달(Phase 2.5)이 details를 채워준다. 지금은 버튼만 disable로 노출.

---

## 2.5 MemberManagement — 멤버 초대 및 관리

### (a) 책임
여행에 참여하는 동반자를 초대/제거하고 권한을 조정.

### (b) 라우트/위치
- **경로:** TravelDetail 헤더의 [👥 N명] 클릭 시 모달
- **파일:** `components/travels/MemberManagementModal.tsx`

### (c) UI 레이아웃 (모달)

```
┌──────────────────────────────────────┐
│ 동반자 관리             [✕]            │
├──────────────────────────────────────┤
│ 🟢 Na Kyeongtae (나)                  │
│    organizer · 모든 권한               │
│                                       │
│ 👤 Huishuwo Leiyawon                  │
│    companion · 편집 가능               │
│    [권한 변경▼] [🗑️ 제거]              │
│                                       │
│ ─────────────────────────             │
│ [+ 동반자 추가]                       │
│   📧 이메일: [_______________]        │
│   권한: [읽기 전용▼]                 │
│   [추가]                              │
└──────────────────────────────────────┘
```

### (d) Props 인터페이스

```typescript
interface MemberManagementModalProps {
  travelId: string;
  members: TravelMember[];
  isOrganizer: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutate: () => Promise<void>;
}
```

### (e) 상태 모델
- `addingMember: boolean`, `email: string`, `permission: 'read_only'|'read_write'`.
- 추가 중에는 폼 disable.

### (f) API 연동

| 액션 | 엔드포인트 | 메서드 |
|------|----------|-------|
| 추가 | `POST /api/travels/[id]/members` | `{ email, permission }` |
| 권한 변경 | `POST /api/travels/[id]/members` (upsert) | `{ email, permission }` |
| 제거 | `DELETE /api/travels/[id]/members` | `?user_id=` |

### (g) 폼 검증 규칙
- email z.string().email()
- permission z.enum
- 자기 자신은 제거 불가 (UI에서 버튼 숨김 + 백엔드 방어).

### (h) 에러/엣지케이스
- **미가입 이메일:** "이 이메일로 가입된 사용자가 없어요. 초대장을 보낼까요?" (지금은 정보 메시지).
- **중복 추가:** 백엔드 409 → "이미 멤버예요" 토스트.
- **organizer 본인 제거 시도:** 버튼 자체 숨김.
- **organizer 본인 권한 변경:** UI에 표시 안함.
- **마지막 organizer 제거 방지:** 백엔드 책임이지만 UI도 방어 (1명일 때 제거 비활성).

---

## 2.6 ChecklistManagement — 준비물 체크리스트 (탭 4)

### (a) 책임
카테고리별로 체크리스트를 관리. 진행률 표시, 우선순위 정렬, 메모.

### (b) 라우트/위치
- **경로:** `/travels/[id]?tab=checklist`
- **파일:** `components/travels/ChecklistManagement.tsx`

### (c) UI 레이아웃

```
준비물 체크리스트              진행률: 15/30 (50%)
[+ 항목 추가]                  [템플릿 적용▼]
─────────────────────────────────────
📋 서류                                3/5
  ☑ 여권 (만료일 2030-03-15)
  ☑ 비자 (2026-05-14 발급)
  ☐ 항공권 출력본 [🔴 높음]
  ☐ 호텔 확인서
  ☑ 여행자보험
👕 의류                                4/8
  ☑ 정장 1벌
  ☐ 반팔 4장
  …
🧴 세면도구                            5/7
🔌 전자기기                            3/5
🏥 의약품                              0/5
─────────────────────────────────────
```

### (d) Props 인터페이스

```typescript
interface ChecklistManagementProps {
  travelId: string;
  items: TravelChecklistItem[];
  canWrite: boolean;
  onMutate: () => Promise<void>;
}

interface ChecklistFormValues {
  title: string;
  category: 'documents' | 'clothing' | 'toiletries' | 'electronics' | 'medicine' | 'other';
  priority: 'low' | 'medium' | 'high';
  notes?: string;
}
```

### (e) 상태 모델
- 카테고리별 group: `useMemo`로 클라이언트 측 그룹핑
- 정렬: 우선순위(high→low) → created_at
- 진행률: `completed / total * 100`
- 템플릿 적용: 별도 모달, 선택 시 다중 POST

### (f) API 연동

| 액션 | 엔드포인트 | 메서드 |
|------|----------|-------|
| 토글 | `PUT /api/travels/[id]/checklist/[itemId]` | `{ is_completed }` |
| 추가 | `POST /api/travels/[id]/checklist` | JSON |
| 삭제 | `DELETE /api/travels/[id]/checklist/[itemId]` | - |

### (g) 폼 검증 규칙

```typescript
const ChecklistSchema = z.object({
  title: z.string().min(1).max(100),
  category: z.enum(['documents','clothing','toiletries','electronics','medicine','other']),
  priority: z.enum(['low','medium','high']).default('medium'),
  notes: z.string().max(300).optional(),
});
```

### (h) 에러/엣지케이스
- **체크박스 토글 실패:** UI에서 즉시 반전 + 실패 시 rollback + 토스트.
- **카테고리 0개:** 헤더 표시 안함.
- **템플릿:** 5종 기본 템플릿(국내출장/해외출장/장기여행/당일/가족여행). 적용 시 기존 항목과 dedup(title 동일 시 skip).
- **swipe-to-delete (모바일):** Phase 3.

### 기본 템플릿 예시 (해외출장)

```json
[
  { "category": "documents", "title": "여권", "priority": "high" },
  { "category": "documents", "title": "비자", "priority": "high" },
  { "category": "documents", "title": "항공권 출력본", "priority": "high" },
  { "category": "documents", "title": "여행자보험", "priority": "medium" },
  { "category": "clothing", "title": "정장 1벌", "priority": "medium" },
  { "category": "electronics", "title": "노트북 + 충전기", "priority": "high" },
  { "category": "electronics", "title": "휴대폰 충전기 (해외용)", "priority": "high" },
  { "category": "medicine", "title": "상비약 (소화제/감기약/진통제)", "priority": "medium" }
]
```

---

## 2.7 CostTracking — 비용 추적 및 정산 (탭 3)

### (a) 책임
비용 등록, 분할 방식 선택, 멤버별 정산 계산. 시각화 대시보드.

### (b) 라우트/위치
- **경로:** `/travels/[id]?tab=costs`
- **파일:** `components/travels/CostTracking.tsx`

### (c) UI 레이아웃

```
─── 요약 카드 ──────────────────────────
총 비용: ₹148,771    1인당: ₹74,385.50
정산 상태: ⏳ 미정산
[정산 보고서 PDF]  [정산 완료로 표시]

─── 정산 표 (Settlement) ───────────────
멤버               지불      분담      잔액
👤 Na Kyeongtae   ₹148,771  ₹74,385  +₹74,386  🟢
👤 Huishuwo       ₹0        ₹74,385  −₹74,385  🔴
                                      이체: Huishuwo → Na ₹74,385

─── 비용 항목 목록 ─────────────────────
[+ 비용 추가]  [필터: 카테고리▼]
┌─────────────────────────────────────┐
│ ✈️  2026-05-15 항공편 TR 779        │
│    ₹96,050 · Na Kyeongtae 결제      │
│    분할: 균등 (2명)                 │
│    [✏️][🗑️]                        │
└─────────────────────────────────────┘
(더 많은 항목…)
```

### (d) Props 인터페이스

```typescript
interface CostTrackingProps {
  travelId: string;
  costs: (TravelCost & { splits: TravelCostSplit[] })[];
  members: TravelMember[];
  settlement: SettlementSummary;
  canWrite: boolean;
  onMutate: () => Promise<void>;
}

interface CostFormValues {
  title: string;
  amount: number;
  currency: 'KRW' | 'INR' | 'USD' | 'VND' | 'JPY';
  cost_type: 'flight' | 'hotel' | 'meal' | 'transport' | 'shopping' | 'other';
  cost_date: string;
  paid_by_user_id: string;
  payment_method?: 'card' | 'cash' | 'transfer';
  splits: Array<{ user_id: string; amount: number }>;
  split_mode: 'equal' | 'custom' | 'percentage' | 'paid_by_one';
}
```

### (e) 상태 모델
- 필터: 카테고리, 결제자, 날짜 범위
- 모달: cost form open/close, edit target
- split 계산 헬퍼:
  - `equal`: amount/N, 마지막 멤버에 잔여(반올림 오차) 흡수
  - `custom`: 자유 입력, 합계 검증
  - `percentage`: 합계 100% 검증
  - `paid_by_one`: 결제자 100%

### (f) API 연동

| 액션 | 엔드포인트 | 메서드 |
|------|----------|-------|
| 정산 | `GET /api/travels/[id]/costs?endpoint=settlement` | - |
| 비용 추가 | `POST /api/travels/[id]/costs` | `{ ..., splits: [...] }` |
| 비용 수정 | `PUT /api/travels/[id]/costs/[costId]` | JSON |
| 비용 삭제 | `DELETE /api/travels/[id]/costs/[costId]` | - |

### (g) 폼 검증 규칙

```typescript
const CostSchema = z.object({
  title: z.string().min(1).max(120),
  amount: z.number().positive('0보다 커야 해요'),
  currency: z.enum(['KRW','INR','USD','VND','JPY']),
  cost_type: z.enum(['flight','hotel','meal','transport','shopping','other']),
  cost_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paid_by_user_id: z.string().uuid(),
  payment_method: z.enum(['card','cash','transfer']).optional(),
  splits: z.array(z.object({
    user_id: z.string().uuid(),
    amount: z.number().nonnegative(),
  })).min(1),
}).refine(d => Math.abs(d.splits.reduce((s,x)=>s+x.amount,0) - d.amount) < 0.01,
  '분할 합계가 총 금액과 일치해야 해요');
```

### (h) 에러/엣지케이스
- **소수 오차:** 분할 시 0.01 미만은 무시. 마지막 멤버에 흡수.
- **0원 비용:** 거부 (positive 검증).
- **비활성 멤버:** 떠난 멤버에 분할 배정 시 경고.
- **다중 통화:** 통화 단위로 그룹핑. 통합 환산은 Phase 3 (환율 API 필요).
- **정산 동작:** Phase 1의 `simplifySettlement()` 결과로 이체 지시 표시. 1단계만 (A→B만), 다단계 simplify는 Phase 3.
- **정산 완료 마킹:** travel.settled_at 컬럼 추가 (선택, Phase 1에 없으면 안 함). 지금은 클라이언트만 표시.
- **삭제 후 정산 재계산:** mutate 후 자동.

### 비용 차트 (요약 카드 아래)
- **카테고리별 파이차트** (Recharts `PieChart`): flight, hotel, meal, transport, shopping, other
- **일자별 누적 라인차트:** 여행 기간 동안 누적 지출
- 차트는 desktop only (`md:block hidden`), 모바일에서는 텍스트 통계로 대체

---

## 2.8 DocumentStorage — 문서 저장소 (탭 5)

### (a) 책임
여행 관련 파일(비자, 항공권 PDF, 영수증 사진 등) 업로드/다운로드/삭제. 카테고리 분류, 미리보기.

### (b) 라우트/위치
- **경로:** `/travels/[id]?tab=documents`
- **파일:** `components/travels/DocumentStorage.tsx`

### (c) UI 레이아웃

```
서류 보관함                    저장: 24.3MB / 100MB
[📎 업로드] [⬇ 전체 다운로드(ZIP)]
─────────────────────────────────────
📄 비자 & 여권 (3)
  ┌──────────────────────────────┐
  │ 🖼️ passport_KR.jpg            │
  │    2.4MB · 2026-05-10        │
  │    [👁️ 미리보기][⬇][🗑️]        │
  └──────────────────────────────┘
🎫 항공권 (2)
🏨 호텔 (1)
💳 영수증 (4)
📝 기타 (2)
─────────────────────────────────────
```

### (d) Props 인터페이스

```typescript
interface DocumentStorageProps {
  travelId: string;
  documents: TravelDocument[];
  canWrite: boolean;
  onMutate: () => Promise<void>;
}

interface DocumentUploadValues {
  file: File;
  doc_type: 'visa' | 'passport' | 'ticket' | 'hotel' | 'receipt' | 'other';
  description?: string;
}
```

### (e) 상태 모델
- react-dropzone으로 드래그&드롭
- 업로드 진행률: per-file `0..100%`
- 미리보기 모달: 이미지(img) 또는 PDF(iframe)
- 저장량 계산: 클라이언트 합산

### (f) API 연동

| 액션 | 엔드포인트 | 메서드 |
|------|----------|-------|
| 목록 | (탭 진입 시) | - |
| 업로드 | `POST /api/travels/[id]/documents` (multipart) | FormData |
| 삭제 | `DELETE /api/travels/[id]/documents/[docId]` | - |
| 다운로드 | Supabase Storage signed URL (백엔드가 제공) | GET |

### (g) 폼 검증 규칙
- 파일 크기: ≤ 10MB (Phase 1 service에 정의됨)
- 허용 타입: `image/jpeg|png|webp`, `application/pdf`
- 카테고리 필수
- 한 번에 최대 5개 동시 업로드

### (h) 에러/엣지케이스
- **용량 초과(저장소 100MB):** "저장 용량이 부족합니다. 불필요한 파일을 삭제하세요." 모달.
- **타입 거부:** 드롭 시 즉시 토스트.
- **업로드 실패:** 자동 1회 재시도, 그래도 실패하면 빨간 X 마크 + 재시도 버튼.
- **다운로드 링크 만료:** signed URL 60초. 클릭 시점에 갱신 fetch.
- **민감 정보:** 여권/비자 카테고리는 카드 표시 시 마스킹 옵션 (Phase 3).
- **공유:** Phase 3 (공유 링크 토큰 발급).

### 미리보기 처리
- 이미지: `<img>` 태그, 모달 안에서 lightbox 스타일.
- PDF: `<iframe src=signedUrl>` (모바일에선 외부 브라우저로 열림).

---

## 2.9 TravelAnalytics — 여행 분석/통계 (탭 6)

### (a) 책임
완료된 또는 진행 중인 여행의 비용/일정/체크리스트 진척도를 시각화. 회고용.

### (b) 라우트/위치
- **경로:** `/travels/[id]?tab=analytics`
- **파일:** `components/travels/TravelAnalytics.tsx`

### (c) UI 레이아웃

```
여행 분석                         [기간: 전체▼]
─────────────────────────────────────
📊 비용 분석
  ┌──────────────────┬──────────────────┐
  │ 카테고리별 (Pie) │ 일자별 (Line)    │
  └──────────────────┴──────────────────┘
  TOP 3 지출:
  1. 항공편 ₹96,050 (65%)
  2. 숙소 ₹47,721 (32%)
  3. 식사 ₹5,000 (3%)

🗓️ 일정 진행률
  완료: 7/15 (47%) ━━━━━━━━░░░░░░░░
  예정: 7 · 취소: 1

✅ 체크리스트 진행률
  서류: 5/5 (100%) ━━━━━━━━━━━━━━━━
  의류: 4/8 (50%)  ━━━━━━━━░░░░░░░░
  …

📤 내보내기
  [📄 PDF 리포트]  [📊 Excel 내보내기]
```

### (d) Props 인터페이스

```typescript
interface TravelAnalyticsProps {
  travel: TravelWithRelations;
  settlement: SettlementSummary;
}
```

### (e) 상태 모델
- 클라이언트 측 집계만 (별도 API 호출 없음, TravelDetail의 caches 활용).
- 필터: 비용 기간 (전체/이번주/이번달).

### (f) API 연동
- 신규 API 없음.
- PDF 내보내기: `jsPDF` 또는 서버 측 Puppeteer (Phase 3).

### (g) 폼 검증 규칙
- N/A (조회 전용).

### (h) 에러/엣지케이스
- **데이터 없음:** 각 위젯마다 "데이터가 부족해요" placeholder.
- **차트 라이브러리 SSR 회피:** `dynamic(() => import('./Charts'), { ssr: false })`.
- **Excel 내보내기:** Phase 3 (xlsx 라이브러리, 무거움).

---

## 2.10 보조 컴포넌트 (Phase 2 부속)

### NotificationSettings (탭 6 내부 또는 별도 컴포넌트)
- 알림 규칙 enable/disable, 채널 선택 (in_app/email/telegram).
- API: `GET/POST /api/travels/[id]/notifications`.
- 작은 컴포넌트라 별도 페이지 없음.

### TravelCard
- TravelList에서 사용. 121줄 기존 파일 재사용 + 디자인 손질.

### TravelHeader
- TravelDetail 상단. 이름·기간·인원·총비용·상태배지.

### CostSplitCalculator
- CostForm 안의 인터랙티브 위젯. 분할 방식 선택 + 미리보기.

---

# 3. 파일 구조 (File Structure)

## 3.1 Next.js 14 App Router 라우트

```
dsc-fms-portal/
├── app/
│   ├── layout.tsx                      # 루트 레이아웃 (기존)
│   ├── travels/                        # ✨ 신규 (현 travel/는 별도 마이그레이션)
│   │   ├── layout.tsx                  # 탑바 + 사이드바
│   │   ├── page.tsx                    # TravelList
│   │   ├── new/
│   │   │   └── page.tsx                # CreateTravel (풀페이지)
│   │   ├── [id]/
│   │   │   ├── layout.tsx              # TravelDetail 쉘 (탭바 포함)
│   │   │   ├── page.tsx                # 기본 = Overview 탭
│   │   │   ├── loading.tsx             # 스켈레톤
│   │   │   ├── error.tsx               # 에러 바운더리
│   │   │   └── not-found.tsx
│   │   └── error.tsx
│   └── api/                            # Phase 1 완료 (재사용)
│       └── travels/
│           ├── route.ts                # GET/POST
│           └── [id]/
│               ├── route.ts            # GET/PUT/DELETE
│               ├── members/route.ts
│               ├── events/route.ts
│               ├── events/[eventId]/route.ts
│               ├── costs/route.ts
│               ├── costs/[costId]/route.ts
│               ├── checklist/route.ts
│               ├── checklist/[itemId]/route.ts
│               ├── documents/route.ts
│               ├── documents/[docId]/route.ts
│               └── notifications/route.ts
```

> **참고:** 기존 `app/travel/` (단수)는 Phase 1 prototype. Phase 2에서 `app/travels/` (복수)로 전환. 기존 컴포넌트 6개(`components/travel/Travel*Tab.tsx`)는 살펴보고 재사용 가능한 부분만 가져온다.

## 3.2 컴포넌트 폴더

```
components/
├── travels/
│   ├── index.ts                        # 배럴 export
│   │
│   ├── TravelCard.tsx                  # 121줄 기존 (개선)
│   ├── TravelListFilters.tsx           # 검색·필터·정렬 chip
│   ├── TravelListEmptyState.tsx
│   │
│   ├── TravelHeader.tsx                # 상세 페이지 헤더
│   ├── TravelTabBar.tsx                # 6개 탭 가로 스크롤
│   ├── TravelStatusBadge.tsx
│   │
│   ├── form/
│   │   ├── TravelForm.tsx              # Create/Edit 공통 (RHF + Zod)
│   │   ├── EventForm.tsx
│   │   ├── CostForm.tsx
│   │   ├── ChecklistItemForm.tsx
│   │   └── DocumentUploadForm.tsx
│   │
│   ├── members/
│   │   ├── MemberManagementModal.tsx
│   │   ├── MemberAvatar.tsx
│   │   └── MemberRoleBadge.tsx
│   │
│   ├── tabs/
│   │   ├── TravelOverviewTab.tsx       # 기존 209줄 (리팩토링)
│   │   ├── EventManagement.tsx
│   │   ├── CostTracking.tsx
│   │   ├── ChecklistManagement.tsx
│   │   ├── DocumentStorage.tsx
│   │   ├── TravelAnalytics.tsx
│   │   └── NotificationSettings.tsx
│   │
│   ├── costs/
│   │   ├── CostList.tsx
│   │   ├── CostListItem.tsx
│   │   ├── SettlementTable.tsx
│   │   ├── CostSplitCalculator.tsx
│   │   └── CostCategoryChart.tsx       # dynamic import
│   │
│   ├── events/
│   │   ├── EventTimeline.tsx
│   │   ├── EventCalendarView.tsx       # react-day-picker
│   │   ├── EventCard.tsx
│   │   └── EventTypeIcon.tsx
│   │
│   ├── checklist/
│   │   ├── ChecklistGroup.tsx
│   │   ├── ChecklistItem.tsx
│   │   ├── ChecklistProgressBar.tsx
│   │   └── ChecklistTemplateModal.tsx
│   │
│   ├── documents/
│   │   ├── DocumentGroup.tsx
│   │   ├── DocumentCard.tsx
│   │   ├── DocumentDropzone.tsx        # react-dropzone
│   │   ├── DocumentPreviewModal.tsx
│   │   └── DocumentTypeIcon.tsx
│   │
│   └── analytics/
│       ├── AnalyticsCostPie.tsx        # Recharts
│       ├── AnalyticsCostLine.tsx
│       ├── AnalyticsTopExpenses.tsx
│       └── AnalyticsProgressBar.tsx
```

## 3.3 훅 / 라이브러리 / 타입

```
hooks/
├── useTravelList.ts                    # SWR + Zustand filter state
├── useTravelDetail.ts                  # SWR for single travel
├── useTravelPermission.ts              # derive isOrganizer/canWrite
├── useCostSettlement.ts                # SWR + memoized computation
├── useEventForm.ts                     # RHF + Zod
├── useDebounce.ts                      # 공용
└── useLocalStorageDraft.ts             # CreateTravel auto-save

lib/
├── travel/
│   ├── settlement.ts                   # Phase 1 (재사용)
│   ├── service.ts                      # Phase 1 (재사용)
│   ├── client.ts                       # fetch wrapper (Authorization header)
│   ├── schemas.ts                      # Zod 스키마 모음
│   ├── currencies.ts                   # 통화 포맷팅
│   ├── checklist-templates.ts          # 5종 기본 템플릿
│   └── voucher-slot.ts                 # 향후 파싱 통합 점 (now noop)
├── api-client.ts                       # 공용 fetch wrapper
└── format.ts                           # 날짜·금액 포맷

types/
├── travel.ts                           # Phase 1 (재사용)
└── travel-ui.ts                        # UI 전용 타입 (Form values 등)

stores/
└── travelStore.ts                      # Zustand: UI 상태
```

## 3.4 테스트 구조

```
__tests__/
└── travels/
    ├── TravelList.test.tsx             # Vitest + Testing Library
    ├── TravelDetail.test.tsx
    ├── CostSettlement.test.ts          # 정산 알고리즘 (Phase 1 로직)
    ├── EventForm.test.tsx
    └── e2e/
        ├── travel-crud.spec.ts         # Playwright
        ├── cost-settlement.spec.ts
        └── checklist-template.spec.ts
```

## 3.5 정적 자산

```
public/
└── travels/
    ├── empty-state.svg                 # 빈 상태 일러스트
    └── voucher-sample.png              # 바우처 파싱 예시 (Phase 2.5)
```

---

# 4. 개발 순서 (Development Sequence)

각 단계는 **개발 완료 → 평가자 1회차 검증 → 다음 단계** 사이클.

## 4.1 단계 1: 기반 작업 (2026-05-15, 1.5일)

**산출물:**
- [ ] `lib/api-client.ts` — fetch wrapper (auth header, 에러 노멀라이즈)
- [ ] `lib/travel/client.ts` — 11개 API 메서드 클라이언트
- [ ] `lib/travel/schemas.ts` — 모든 Zod 스키마
- [ ] `lib/travel/currencies.ts`, `lib/format.ts`
- [ ] `types/travel-ui.ts` — Form values 등
- [ ] `stores/travelStore.ts` — Zustand 슬라이스
- [ ] `hooks/useTravelList.ts`, `useTravelDetail.ts`, `useTravelPermission.ts`
- [ ] 디자인 토큰 매핑 확인 (tailwind.config 검토)
- [ ] 패키지 설치: `zustand swr react-hook-form zod @hookform/resolvers recharts react-day-picker react-dropzone sonner @radix-ui/react-dialog @radix-ui/react-alert-dialog date-fns`

**완료 기준:** TypeScript 컴파일 에러 0, API client에서 모든 11개 엔드포인트 호출 가능.

## 4.2 단계 2: 진입경로 — List/Create/Detail Shell (2026-05-16, 2일)

**산출물:**
- [ ] `app/travels/page.tsx` (TravelList)
- [ ] `components/travels/TravelCard.tsx` (리팩토링)
- [ ] `components/travels/TravelListFilters.tsx`
- [ ] `components/travels/TravelListEmptyState.tsx`
- [ ] `app/travels/new/page.tsx` (CreateTravel)
- [ ] `components/travels/form/TravelForm.tsx`
- [ ] `app/travels/[id]/layout.tsx` (탭바 포함 쉘)
- [ ] `app/travels/[id]/page.tsx` (= Overview redirect)
- [ ] `app/travels/[id]/loading.tsx`, `error.tsx`, `not-found.tsx`
- [ ] `components/travels/TravelHeader.tsx`, `TravelTabBar.tsx`

**완료 기준:**
- 사용자가 목록 → 생성 → 상세 진입까지 클릭만으로 가능
- 6개 탭이 표시되고 빈 placeholder로 전환됨

## 4.3 단계 3: Overview 탭 + MemberManagement (2026-05-17, 1일)

**산출물:**
- [ ] `components/travels/tabs/TravelOverviewTab.tsx` (기존 209줄 리팩토링)
- [ ] `components/travels/members/MemberManagementModal.tsx`
- [ ] `components/travels/members/MemberAvatar.tsx`
- [ ] 헤더 [편집] 모달 동작 (TravelForm 재사용)
- [ ] 헤더 [삭제] 확인 다이얼로그

**완료 기준:** 기본 정보 표시 + 멤버 추가/제거/권한 변경 작동.

## 4.4 단계 4: EventManagement (Schedule 탭) (2026-05-18, 1.5일)

**산출물:**
- [ ] `components/travels/tabs/EventManagement.tsx`
- [ ] `components/travels/events/EventTimeline.tsx`
- [ ] `components/travels/events/EventCalendarView.tsx`
- [ ] `components/travels/events/EventCard.tsx`
- [ ] `components/travels/events/EventTypeIcon.tsx`
- [ ] `components/travels/form/EventForm.tsx`
- [ ] 바우처 파싱 슬롯 disabled 버튼 추가

**완료 기준:** 이벤트 추가/수정/삭제, 타임라인/캘린더 토글, 상태 변경.

## 4.5 단계 5: CostTracking (Costs 탭) (2026-05-19~20, 2일)

**산출물:**
- [ ] `components/travels/tabs/CostTracking.tsx`
- [ ] `components/travels/costs/CostList.tsx`, `CostListItem.tsx`
- [ ] `components/travels/costs/SettlementTable.tsx`
- [ ] `components/travels/costs/CostSplitCalculator.tsx`
- [ ] `components/travels/costs/CostCategoryChart.tsx`
- [ ] `components/travels/form/CostForm.tsx`
- [ ] `hooks/useCostSettlement.ts`
- [ ] 정산 알고리즘 회귀 테스트 (Phase 1 service 호출)

**완료 기준:** 균등/사용자정의/100%지불 분할 모두 가능, 정산표 정확, optimistic update 동작.

## 4.6 단계 6: ChecklistManagement (2026-05-21, 1일)

**산출물:**
- [ ] `components/travels/tabs/ChecklistManagement.tsx`
- [ ] `components/travels/checklist/ChecklistGroup.tsx`, `ChecklistItem.tsx`, `ChecklistProgressBar.tsx`
- [ ] `components/travels/checklist/ChecklistTemplateModal.tsx`
- [ ] `lib/travel/checklist-templates.ts`
- [ ] `components/travels/form/ChecklistItemForm.tsx`

**완료 기준:** 카테고리 그룹핑, 진행률, 5종 템플릿 적용.

## 4.7 단계 7: DocumentStorage (2026-05-22, 1일)

**산출물:**
- [ ] `components/travels/tabs/DocumentStorage.tsx`
- [ ] `components/travels/documents/DocumentGroup.tsx`, `DocumentCard.tsx`
- [ ] `components/travels/documents/DocumentDropzone.tsx`
- [ ] `components/travels/documents/DocumentPreviewModal.tsx`
- [ ] `components/travels/documents/DocumentTypeIcon.tsx`
- [ ] `components/travels/form/DocumentUploadForm.tsx`

**완료 기준:** 파일 업로드(진행률), 다운로드(signed URL), 미리보기, 삭제.

## 4.8 단계 8: TravelAnalytics + NotificationSettings (2026-05-23, 1일)

**산출물:**
- [ ] `components/travels/tabs/TravelAnalytics.tsx`
- [ ] `components/travels/analytics/AnalyticsCostPie.tsx`, `AnalyticsCostLine.tsx`
- [ ] `components/travels/analytics/AnalyticsTopExpenses.tsx`
- [ ] `components/travels/analytics/AnalyticsProgressBar.tsx`
- [ ] `components/travels/tabs/NotificationSettings.tsx`
- [ ] PDF/Excel 내보내기는 stub (Phase 3)

**완료 기준:** 차트 렌더링, SSR 회피, 알림 규칙 토글.

## 4.9 단계 9: 반응형/접근성/에러처리 (2026-05-24, 1일)

- [ ] 모든 페이지 320/768/1024/1440 4종 viewport 검수
- [ ] 키보드 네비게이션 (Tab, Esc, Enter)
- [ ] aria-label/role 부착
- [ ] 컬러 contrast WCAG AA
- [ ] 모든 비동기 액션에 loading/error/success 토스트
- [ ] 라우트 에러 바운더리 검증
- [ ] 30+ skeleton placeholder 점검

## 4.10 단계 10: QA + 회귀 + 통합 (2026-05-25~26, 2일)

- [ ] Vitest 단위 테스트 (최소 80% 카버리지, 정산/검증 로직 중심)
- [ ] Playwright E2E 3종 (CRUD/정산/체크리스트)
- [ ] Lighthouse 90+ 확인
- [ ] 번들 크기 ≤180KB gzip 확인
- [ ] 평가자 3회차 반복 검증 통과
- [ ] Vercel preview 배포 → 스테이징 검증

## 4.11 단계 11: 배포 (2026-05-27, 0.5일)

- [ ] Vercel production 배포
- [ ] DNS/캐시 확인
- [ ] 실제 데이터로 smoke test (Na Kyeongtae 본인 출장 1건 등록)
- [ ] 사용자 가이드 1페이지 (간단)
- [ ] Phase 2 종료 보고서 작성

---

# 5. 통합 체크리스트 (Integration Checklist)

> 각 항목은 **체크박스 + 검증 방법 + 책임자** 3요소.

## 5.1 컴포넌트 구현 (24항목)

### TravelList
- [ ] (T-L01) `/travels` 라우트 정상 로드 (200) — Playwright
- [ ] (T-L02) 빈 상태 일러스트 표시 — 신규 계정 진입
- [ ] (T-L03) 카드 클릭 시 상세로 이동 — 라우터 push
- [ ] (T-L04) 검색 debounce 300ms 동작 — DevTools network 패널
- [ ] (T-L05) 4가지 필터(all/upcoming/ongoing/completed) 동작 — 각각 1건씩 등록 후 확인
- [ ] (T-L06) 4가지 정렬 옵션 동작 — 5건 이상 등록 후 확인
- [ ] (T-L07) 페이지네이션 (12개 단위) — 13건 이상 데이터로 확인
- [ ] (T-L08) 스켈레톤 카드 12개 표시 — 느린 3G throttling

### CreateTravel
- [ ] (T-C01) `/travels/new` 폼 정상 로드 — Playwright
- [ ] (T-C02) Zod 검증 에러 표시 (이름 1자, 종료일<시작일) — 수동 입력
- [ ] (T-C03) 제출 성공 시 상세 페이지 이동 — 라우터 history
- [ ] (T-C04) localStorage draft 자동 저장 — 새로고침 후 복원 확인
- [ ] (T-C05) 초기 멤버 동시 초대 — 폼에서 이메일 추가

### TravelDetail
- [ ] (T-D01) 탭 6개 모두 렌더링 — 클릭 순회
- [ ] (T-D02) URL `?tab=` 동기화 — 새로고침 후 탭 유지
- [ ] (T-D03) 헤더 편집 모달 동작 — organizer 권한
- [ ] (T-D04) 삭제 2단계 확인 — AlertDialog
- [ ] (T-D05) 공유 버튼 (navigator.share / 클립보드) — 모바일/데스크탑 모두
- [ ] (T-D06) 404 페이지 (없는 ID) — `/travels/00000...`

### EventManagement
- [ ] (T-E01) 타임라인 뷰 정렬(날짜·시간 asc) — 3개 이벤트 등록 후
- [ ] (T-E02) 캘린더 뷰 토글 + 날짜 클릭 — react-day-picker
- [ ] (T-E03) 5종 event_type 폼 동작 — 각각 1개씩 등록
- [ ] (T-E04) 시간 미지정(종일) 처리 — null 저장 확인
- [ ] (T-E05) 여행 기간 밖 경고 표시(허용) — start_date-2일 등록
- [ ] (T-E06) 상태 변경(planned↔completed) — 체크박스
- [ ] (T-E07) 바우처 파싱 슬롯 disabled 버튼 — UI 확인

### MemberManagement
- [ ] (T-M01) 멤버 모달 열림/닫힘 — Radix Dialog
- [ ] (T-M02) 이메일 추가 (실제 사용자) — 백엔드 200
- [ ] (T-M03) 미가입 이메일 시 안내 — 백엔드 409
- [ ] (T-M04) 권한 변경 (read_only↔read_write) — drop-down
- [ ] (T-M05) 본인 제거 버튼 숨김 — UI 검증
- [ ] (T-M06) 멤버 제거 후 비용 정산 재계산 — mutate 확인

### ChecklistManagement
- [ ] (T-CL01) 6 카테고리 그룹핑 — 각 카테고리 1개씩 등록
- [ ] (T-CL02) 진행률 정확 (완료/전체) — 토글 후 즉시 갱신
- [ ] (T-CL03) 5종 템플릿 적용 — 각각 시도, dedup 동작
- [ ] (T-CL04) 우선순위 색상 (high=red, medium=amber, low=gray) — 시각 검수
- [ ] (T-CL05) 체크 토글 실패 시 rollback — 네트워크 차단

### CostTracking
- [ ] (T-CT01) 비용 추가 (균등 분할) — 2명 ₹100 → 50/50
- [ ] (T-CT02) 비용 추가 (사용자정의 분할) — 30/70 검증
- [ ] (T-CT03) 비용 추가 (100% 결제자 분할) — 결제자 100%
- [ ] (T-CT04) 비용 추가 (퍼센트 분할) — 합계 100% 검증
- [ ] (T-CT05) 정산표 잔액 계산 정확 — Phase 1 로직 검증
- [ ] (T-CT06) 다중 통화 그룹핑 — KRW, INR 1개씩
- [ ] (T-CT07) 비용 삭제 후 정산 갱신 — mutate
- [ ] (T-CT08) 카테고리 파이차트 렌더 (데스크탑) — Recharts
- [ ] (T-CT09) 일자별 라인차트 렌더 — Recharts
- [ ] (T-CT10) optimistic update 후 실패 rollback — 네트워크 차단

### DocumentStorage
- [ ] (T-DS01) 드래그&드롭 업로드 — react-dropzone
- [ ] (T-DS02) 파일 선택 업로드 — input[type=file]
- [ ] (T-DS03) 업로드 진행률 표시 — fake slow upload
- [ ] (T-DS04) 5MB 이미지 정상 업로드 — Supabase Storage 확인
- [ ] (T-DS05) 10MB 초과 거부 — Phase 1 validation
- [ ] (T-DS06) 잘못된 타입 거부 (.exe) — toast
- [ ] (T-DS07) PDF 미리보기 (iframe) — 모달
- [ ] (T-DS08) 이미지 미리보기 (img) — 모달
- [ ] (T-DS09) signed URL 다운로드 — 60초 만료 확인
- [ ] (T-DS10) 5개 동시 업로드 — UI 카운트
- [ ] (T-DS11) 카테고리 그룹핑 — 6종 분류

### TravelAnalytics
- [ ] (T-A01) 비용 파이차트 정확한 비율 — 수동 계산과 비교
- [ ] (T-A02) 일자별 라인차트 누적 — 정확성
- [ ] (T-A03) TOP 3 지출 표시 — 정렬 검증
- [ ] (T-A04) 일정 진행률 (완료/예정/취소) — 카운트 정확
- [ ] (T-A05) 체크리스트 카테고리별 진행률 — 정확
- [ ] (T-A06) 데이터 0건 시 placeholder — 신규 여행

### NotificationSettings
- [ ] (T-NS01) 알림 규칙 목록 표시 — Phase 1 default rules
- [ ] (T-NS02) 토글 활성/비활성 — POST 확인
- [ ] (T-NS03) 채널별 (in_app/email/telegram) 토글 — 독립 동작

## 5.2 API 연동 검증 (12항목)

- [ ] (API-01) 모든 GET 200 응답 — Playwright + DevTools
- [ ] (API-02) 모든 POST 201 응답 — 신규 생성
- [ ] (API-03) 모든 PUT 200 응답 — 수정
- [ ] (API-04) 모든 DELETE 204 응답 — 삭제
- [ ] (API-05) 401 → 로그인 리다이렉트 — 토큰 제거 후
- [ ] (API-06) 403 → 권한 없음 페이지 — read_only가 PUT 시도
- [ ] (API-07) 404 → not-found 페이지 — 존재하지 않는 ID
- [ ] (API-08) 500 → 에러 토스트 + 재시도 — 백엔드 mocking
- [ ] (API-09) 멤버 추가 후 SWR 캐시 자동 mutate — UI 즉시 반영
- [ ] (API-10) 비용 추가 후 정산 자동 재계산 — 캐시 invalidate
- [ ] (API-11) 파일 업로드 signed URL — Supabase Storage 정책
- [ ] (API-12) 정산 API `?endpoint=settlement` — 정확한 balance 계산

## 5.3 모바일 반응형 검증 (10항목)

- [ ] (RWD-01) iPhone SE (375px) — TravelList 1열 그리드
- [ ] (RWD-02) iPhone 14 (390px) — 모든 페이지 가독성
- [ ] (RWD-03) iPad (768px) — TravelList 2열
- [ ] (RWD-04) Desktop (1024px+) — TravelList 3열
- [ ] (RWD-05) Tab bar 가로 스크롤 (모바일) — 6개 탭
- [ ] (RWD-06) 모달 풀스크린 전환 (모바일) — Radix Dialog
- [ ] (RWD-07) 폼 입력 시 키보드 가림 없음 — `viewport-fit=cover`
- [ ] (RWD-08) 차트 모바일에서 텍스트 통계로 대체 — `hidden md:block`
- [ ] (RWD-09) 카드 탭 영역 ≥44px — Touch target
- [ ] (RWD-10) 가로 모드(landscape) 깨짐 없음 — 1차 검수

## 5.4 에러 핸들링 (10항목)

- [ ] (ERR-01) 네트워크 오프라인 토스트 — `online`/`offline` 이벤트
- [ ] (ERR-02) 폼 검증 실패 메시지 한글화 — Zod customize
- [ ] (ERR-03) 백엔드 500 시 자동 1회 재시도 — SWR `errorRetryCount`
- [ ] (ERR-04) 무한 로딩 방지 (10초 타임아웃) — `AbortController`
- [ ] (ERR-05) Optimistic update 실패 시 rollback + 토스트 — useSWR mutate optimisticData
- [ ] (ERR-06) 파일 업로드 실패 재시도 버튼 — UI 노출
- [ ] (ERR-07) 라우트 에러 바운더리 (`error.tsx`) — 강제 throw 테스트
- [ ] (ERR-08) 빈 상태 일러스트 (모든 컬렉션) — 신규 여행 진입
- [ ] (ERR-09) 토스트 동시 표시 3개 제한 — sonner config
- [ ] (ERR-10) 모든 비동기 버튼에 loading spinner — UX 검수

## 5.5 접근성 (8항목)

- [ ] (A11Y-01) 컬러 contrast WCAG AA (4.5:1) — axe DevTools
- [ ] (A11Y-02) 키보드 Tab navigation 순서 자연스러움 — 수동
- [ ] (A11Y-03) Esc로 모달 닫힘 — Radix 기본
- [ ] (A11Y-04) Enter로 폼 제출 — 모든 폼
- [ ] (A11Y-05) aria-label / role 부착 — Lighthouse Accessibility
- [ ] (A11Y-06) 스크린 리더 카드 읽기 — VoiceOver
- [ ] (A11Y-07) Focus ring 시각화 — Tailwind `focus-visible:ring`
- [ ] (A11Y-08) 동작 가능 영역 ≥44px — Touch target

## 5.6 성능 (8항목)

- [ ] (PERF-01) Lighthouse Performance 90+ — production build
- [ ] (PERF-02) Bundle size ≤180KB gzip — `next build --analyze`
- [ ] (PERF-03) TravelList 초기 로드 <1.5s — Lighthouse
- [ ] (PERF-04) TravelDetail 캐시된 진입 <500ms — Vercel Analytics
- [ ] (PERF-05) CLS <0.1 — skeleton placeholders
- [ ] (PERF-06) FCP <1.0s — Core Web Vitals
- [ ] (PERF-07) Recharts dynamic import (no SSR) — `next/dynamic`
- [ ] (PERF-08) 이미지 lazy load + next/image — 문서 미리보기

## 5.7 보안 (8항목)

- [ ] (SEC-01) JWT 토큰 만료 시 자동 로그아웃 — Supabase Auth
- [ ] (SEC-02) RLS 정책 검증 (Phase 1 SQL) — 다른 사용자 ID 조회 시 403
- [ ] (SEC-03) XSS 방지 (사용자 입력 escape) — React 기본 + 추가 sanitize
- [ ] (SEC-04) 파일 업로드 MIME 검증 — 클라이언트 + Phase 1 백엔드 둘 다
- [ ] (SEC-05) signed URL 만료 60초 — Supabase config
- [ ] (SEC-06) CORS 정책 — Vercel config
- [ ] (SEC-07) 환경변수 노출 안됨 — `NEXT_PUBLIC_` 접두사 점검
- [ ] (SEC-08) 비밀번호/토큰 console.log 없음 — grep -r

## 5.8 배포 전 QA (10항목)

- [ ] (QA-01) Vitest 80%+ 커버리지 — `vitest --coverage`
- [ ] (QA-02) Playwright E2E 3종 통과 — CI
- [ ] (QA-03) TypeScript strict mode 0 에러 — `tsc --noEmit`
- [ ] (QA-04) ESLint 0 경고 — `next lint`
- [ ] (QA-05) Prettier 포맷팅 — pre-commit
- [ ] (QA-06) Vercel preview 환경 배포 — PR auto
- [ ] (QA-07) 스테이징 데이터로 smoke test — Na Kyeongtae 직접 입력
- [ ] (QA-08) 평가자 1·2·3회차 모두 통과 — feedback log
- [ ] (QA-09) PHASE2 회귀 테스트 (BM, Asset 모듈) — 다른 라우트 정상
- [ ] (QA-10) production 환경변수 점검 — Supabase URL/Key 정확

## 5.9 문서 / 인수인계 (6항목)

- [ ] (DOC-01) `TRAVEL_MANAGEMENT_PHASE2_COMPLETE.md` 작성 — 본 문서와 매칭
- [ ] (DOC-02) CHANGELOG 갱신 — Phase 2 항목 추가
- [ ] (DOC-03) 사용자 가이드 1페이지 — README 형식
- [ ] (DOC-04) API client 사용 예시 (lib/travel/client.ts JSDoc) — 4개 이상
- [ ] (DOC-05) 스토리북(선택) — 핵심 컴포넌트 5개만 (Phase 3 이월 가능)
- [ ] (DOC-06) Phase 3 백로그 정리 — 바우처 파싱/Realtime/공유링크

## 5.10 Phase 2.5: 바우처 파싱 통합 슬롯 (4항목, 별도 일정)

> 별도 설계 문서가 도착하면 통합. Phase 2 본체는 슬롯만 확보.

- [ ] (VPS-01) `lib/travel/voucher-slot.ts` — 비어있는 interface export
- [ ] (VPS-02) EventForm 내 [📎 바우처 붙여넣기] disabled 버튼
- [ ] (VPS-03) 결과 콜백 시그니처 합의 — `(parsed: EventFormValues[]) => void`
- [ ] (VPS-04) 통합 후 회귀 테스트 — Phase 2 본체 깨짐 없음

---

## 📌 마무리 노트 (Notes for Web-Builder)

1. **이 문서를 처음부터 끝까지 읽고 전체 scope 파악.** 컴포넌트 9개 + 보조 4~5개 + 폼/모달 5종 + 훅 7개 + 차트 4개 ≈ **총 50+ 파일**.
2. **API Spec(`TRAVEL_MANAGEMENT_API_GUIDE.md`)을 옆에 두고 작업.** Phase 1 백엔드는 변경하지 않는다 (필요시 플레너에게 요청).
3. **각 단계 완료 후 평가자에게 즉시 검증 요청.** 단계별 통과 후에만 다음 단계 진행.
4. **모바일 우선.** 모든 컴포넌트 320px부터 디자인, 데스크탑은 확장.
5. **Optimistic update를 적극 활용.** SWR `mutate` + `optimisticData`로 즉시 반영.
6. **DSC FMS 디자인 토큰만 사용.** 새 색상 추가 금지.
7. **2026-05-27 Production 배포 목표.** 일정에서 1일 이상 지연 발생 시 즉시 플레너에게 보고.
8. **Phase 3 백로그 후보** (확장 영역, 지금은 건드리지 말 것):
   - Supabase Realtime 구독 (탭 간 자동 동기화)
   - 공유 링크 토큰 발급 (외부 게스트 view)
   - Excel/PDF 정산 리포트 내보내기
   - 다중 통화 환산 (환율 API)
   - 멤버 초대 이메일 전송
   - swipe-to-delete 모바일 제스처

---

**작성:** 플레너 (Subagent)
**작성일:** 2026-05-14
**다음 단계:** 웹개발자 검토 → Phase 2 단계 1 시작 (2026-05-15)
**최종 검증:** 평가자 3회차 검증 통과 → 배포 (2026-05-27)
