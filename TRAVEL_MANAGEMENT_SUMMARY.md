# Travel Management 모듈 — 설계 요약 & 체크리스트

> **상태:** 플레너 최종 설계 → 웹개발자 구현 시작 단계  
> **작성일:** 2026-05-14  
> **담당:** 플레너 (설계 완료), 웹개발자 (구현 대기)

---

## 📌 핵심 설계 요약

### 목표
Na Kyeongtae의 베트남 호치민 여행 (2026-05-15 ~ 05-24)을 DSC Hub 포탈 내에서 **통합 관리**:
- 항공, 숙소, 식사 일정 추적
- 동반자 간 비용 정산
- 준비물 체크리스트
- 서류 보관 (비자, 항공권 등)
- 자동 알림 시스템

### 아키텍처
```
DSC Hub (포탈)
  ├─ Tab 1: Personal History (개인이력)
  ├─ Tab 2: DSC FMS (공장 업무)
  └─ Tab 3: Travel Records ← ★ 신규 모듈
       ├─ Travel List (여행 목록)
       └─ Travel Detail (6개 탭)
            ├─ Overview (기본 정보)
            ├─ Schedule (일정 + 캘린더 + 타임라인)
            ├─ Costs (비용 + 정산)
            ├─ Checklist (준비물)
            ├─ Documents (서류 보관)
            └─ Notifications (알림 설정)
```

### 주요 기능

| 기능 | 설명 | 상태 |
|------|------|------|
| **여행 CRUD** | 생성/수정/삭제 | 필수 |
| **멤버 관리** | 동반자 초대 + 권한 제어 | 필수 |
| **일정 관리** | 항공, 숙소, 식사 등 이벤트 | 필수 |
| **캘린더 뷰** | 월간 캘린더 + 타임라인 | 필수 |
| **비용 관리** | 항목별 비용 등록 | 필수 |
| **정산 계산** | 균등 분할, 비율 분할, 커스텀 | 필수 |
| **체크리스트** | 카테고리별 준비물 관리 | 필수 |
| **문서 보관** | 파일 업로드 (드래그 & 드롭) | 필수 |
| **자동 알림** | Cron 기반 예정 알림 | 필수 |
| **다중 채널** | 인앱, 이메일, Telegram | 필수 |
| **권한 제어** | Organizer/Companion/Guest | 필수 |
| **모바일 최적화** | 반응형 디자인 | 필수 |

---

## 🗄️ DB 스키마 (8개 테이블)

### 핵심 테이블

```
travels (여행 마스터)
  ├─ id, user_id, name, start_date, end_date, location, status
  └─ 관계: organizer는 auth.users(id)

travel_members (멤버/권한)
  ├─ id, travel_id, user_id, role, permission
  └─ unique(travel_id, user_id)

travel_events (일정/이벤트)
  ├─ id, travel_id, title, event_type, event_date, event_time, status
  └─ event_type: 'flight', 'hotel', 'meal', 'transport', 'other'

travel_costs (비용)
  ├─ id, travel_id, payer_id, title, amount, cost_type, cost_date
  └─ cost_type: 'flight', 'accommodation', 'meal', 'transport', 'other'

travel_cost_splits (비용 분담)
  ├─ id, cost_id, member_id, amount
  └─ unique(cost_id, member_id)

travel_checklist_items (체크리스트)
  ├─ id, travel_id, title, category, is_completed, priority
  └─ category: 'documents', 'clothing', 'toiletries', 'electronics', 'medicine', 'custom'

travel_documents (파일)
  ├─ id, travel_id, file_name, file_path (Supabase Storage), file_size, document_type
  └─ document_type: 'visa', 'passport', 'flight_ticket', 'hotel_booking', 'receipt', 'other'

travel_notifications (알림)
  ├─ id, travel_id, user_id, title, message, trigger_date, trigger_time, channels, is_sent
  └─ channels: JSON {in_app, email, telegram}

travel_notification_rules (알림 규칙)
  ├─ id, travel_id, rule_type, rule_config, is_enabled
  └─ rule_type: 'days_before_departure', 'event_time', 'checklist_reminder', 'custom'
```

---

## 🎨 UI/UX 핵심 설계

### 화면 구성 (모바일 퍼스트)

**Travel List (여행 목록)**
- 카드 뷰: 여행명, 기간, 지역, 인원, 총 비용
- 필터: 상태별 (upcoming/ongoing/completed)
- 정렬: 날짜순/비용순/이름순

**Travel Detail (여행 상세) - 6개 탭**

1. **Overview** — 기본 정보 (항공, 숙소, 인원, 비용)
2. **Schedule** — 일정 (캘린더 + 타임라인 + 이벤트 추가)
3. **Costs** — 경비 (항목 목록 + 정산 계산표)
4. **Checklist** — 준비물 (카테고리별 + 진행률)
5. **Documents** — 서류 (폴더별 파일 + 업로드)
6. **Notifications** — 알림 (규칙 활성화/채널 선택)

### 반응형 설계
- **모바일** (320~767px): 풀 너비 카드, 탭 드롭다운
- **태블릿** (768~1023px): 2열 레이아웃
- **데스크톱** (1024px+): 3열 레이아웃

---

## 🔌 API 명세 (20+ 엔드포인트)

### 주요 엔드포인트

```
Travel CRUD (4개)
  POST   /api/travels                   — 여행 생성
  GET    /api/travels                   — 목록 (필터/정렬)
  GET    /api/travels/[id]              — 상세 조회
  PUT    /api/travels/[id]              — 수정
  DELETE /api/travels/[id]              — 삭제

Members (2개)
  POST   /api/travels/[id]/members      — 멤버 추가
  DELETE /api/travels/[id]/members/[id] — 멤버 제거

Events (4개)
  POST   /api/travels/[id]/events       — 이벤트 추가
  GET    /api/travels/[id]/events       — 목록
  PUT    /api/travels/[id]/events/[id]  — 수정
  DELETE /api/travels/[id]/events/[id]  — 삭제

Costs (4개)
  POST   /api/travels/[id]/costs        — 비용 추가
  GET    /api/travels/[id]/costs        — 목록
  PUT    /api/travels/[id]/costs/[id]   — 수정
  GET    /api/travels/[id]/settlement   — 정산 계산표

Checklist (4개)
  POST   /api/travels/[id]/checklist    — 항목 추가
  GET    /api/travels/[id]/checklist    — 목록
  PUT    /api/travels/[id]/checklist/[id] — 수정
  DELETE /api/travels/[id]/checklist/[id] — 삭제

Documents (3개)
  POST   /api/travels/[id]/documents    — 파일 업로드
  GET    /api/travels/[id]/documents    — 목록
  DELETE /api/travels/[id]/documents/[id] — 삭제

Notifications (2개)
  GET    /api/travels/[id]/notifications — 규칙 + 대기 알림
  PUT    /api/travels/[id]/notifications/rules/[id] — 규칙 활성화/비활성화
```

---

## 🔐 권한 & 보안

### Role-Based Access Control (RBAC)

| Role | 권한 |
|------|------|
| **Organizer** (여행 주도자) | 모든 작업 (CRUD) |
| **Companion** (동반자) | 읽기 + 편집 + 비용 등록 |
| **Guest** (게스트) | 읽기 + 알림 설정만 |

### Supabase RLS (Row-Level Security)
- 각 테이블에 정책 설정
- 사용자는 본인이 참여한 여행만 조회/수정
- Organizer만 여행 삭제 가능

---

## 🔔 알림 시스템

### 자동 알림 규칙 (여행 생성 시 자동 생성)

```
1. 출발 7일 전 (자정) — 준비 시작 알림
2. 출발 1일 전 (18:00) — 짐 확인 알림
3. 출발 24시간 전 — 최종 알림
4. 출발 6시간 전 — 공항 출발 알림
5. 각 이벤트 1시간 전 — 개별 알림
6. 체크아웃 1일 전 (18:00) — 체크아웃 준비 알림
```

### 알림 채널
- **인앱 알림** (즉시)
- **이메일** (SendGrid/Resend)
- **Telegram** (Bot API)
- **SMS** (향후 지원)

### 구현
- Cron Job (매일 자정 UTC)
- travel_notifications 테이블 자동 생성
- 각 채널별 발송 파이프라인

---

## 💰 정산 알고리즘

### 계산 방식
```
1. 총 비용 계산: SUM(모든 비용)
2. 각 멤버의 몫 계산: 총 비용 / 멤버 수 (또는 비율 분할)
3. Balance 계산: 각 멤버_지출액 - 각 멤버_몫
   - balance > 0 : 받을 금액
   - balance < 0 : 줄 금액
4. 간단한 정산: 그리디 알고리즘으로 최소 이체 계산
```

### 예시 (Na Kyeongtae의 여행)
```
총 비용: ₹148,771
멤버: 2명 (Na Kyeongtae, Huishuwo Leiyawon)
1인당 몫: ₹74,385.50

Na Kyeongtae:
  - 지출: ₹148,771
  - 몫: ₹74,385.50
  - Balance: ₹74,385.50 (받을 금액)

Huishuwo Leiyawon:
  - 지출: ₹0
  - 몫: ₹74,385.50
  - Balance: -₹74,385.50 (줄 금액)

정산: Huishuwo → Na Kyeongtae ₹74,385.50
```

---

## 📋 구현 로드맵 (4주)

### Week 1: Backend & DB
- [ ] DB 마이그레이션 (8개 테이블)
- [ ] API 엔드포인트 (20개) 구현
- [ ] RLS 정책 설정
- [ ] 정산 알고리즘 구현
- [ ] 파일 저장소 (Supabase Storage) 설정

### Week 2: Frontend UI (Part 1)
- [ ] TravelList 컴포넌트
- [ ] TravelDetail 레이아웃
- [ ] TravelOverview 탭
- [ ] TravelSchedule 탭 (캘린더 + 타임라인)

### Week 3: Frontend UI (Part 2) & 알림
- [ ] TravelCosts 탭 (정산 테이블)
- [ ] TravelChecklist 탭
- [ ] TravelDocuments 탭 (업로드)
- [ ] TravelNotifications 탭
- [ ] 알림 엔진 구현

### Week 4: 반응형 & 배포
- [ ] 모바일 반응형 디자인
- [ ] E2E 테스트
- [ ] 성능 최적화
- [ ] Staging 배포 & QA
- [ ] Production 배포

**완료 예상:** 2026-06-11

---

## 📁 파일 구조

```
dsc-fms-portal/
├─ TRAVEL_MANAGEMENT_DESIGN.md      (이 문서 — 완전 설계서)
├─ TRAVEL_MANAGEMENT_API_GUIDE.md   (API 상세 명세)
├─ TRAVEL_MANAGEMENT_SUMMARY.md     (요약 & 체크리스트 ← 지금)
│
├─ app/
│  └─ (dsc-hub)/
│     └─ travel/
│        ├─ page.tsx                (Travel List)
│        └─ [id]/
│           ├─ page.tsx             (Travel Detail)
│           ├─ components/
│           │  ├─ Overview.tsx
│           │  ├─ Schedule.tsx
│           │  ├─ Costs.tsx
│           │  ├─ Checklist.tsx
│           │  ├─ Documents.tsx
│           │  └─ Notifications.tsx
│           └─ (nested tabs)
│
├─ app/api/travels/
│  ├─ route.ts                     (GET/POST /api/travels)
│  ├─ [id]/
│  │  ├─ route.ts                  (GET/PUT/DELETE)
│  │  ├─ members/
│  │  │  └─ route.ts               (POST/DELETE members)
│  │  ├─ events/
│  │  │  └─ route.ts               (GET/POST events)
│  │  ├─ costs/
│  │  │  └─ route.ts               (GET/POST costs)
│  │  ├─ settlement/
│  │  │  └─ route.ts               (GET settlement)
│  │  ├─ checklist/
│  │  │  └─ route.ts               (GET/POST checklist)
│  │  ├─ documents/
│  │  │  └─ route.ts               (POST/GET/DELETE documents)
│  │  └─ notifications/
│  │     └─ route.ts               (GET/PUT notifications)
│
├─ lib/
│  ├─ travel-api.ts                (클라이언트 API 함수)
│  ├─ schemas/travel.ts            (Zod 검증)
│  └─ types/travel.ts              (TypeScript 타입)
│
├─ db/
│  └─ migrations/
│     └─ 024_create_travel_tables.sql (DB 스키마)
│
└─ public/
   └─ docs/
      └─ TRAVEL_MANAGEMENT_DESIGN.md (이 설계서)
```

---

## 🚀 구현 시 체크리스트

### Phase 1: DB & API (일주일)

**DB 마이그레이션**
- [ ] travels 테이블 생성
- [ ] travel_members 테이블
- [ ] travel_events 테이블
- [ ] travel_costs 테이블
- [ ] travel_cost_splits 테이블
- [ ] travel_checklist_items 테이블
- [ ] travel_documents 테이블
- [ ] travel_notifications 테이블
- [ ] travel_notification_rules 테이블
- [ ] 인덱스 생성
- [ ] RLS 정책 설정

**API 구현**
- [ ] Travel CRUD (4개)
- [ ] Members 관리 (2개)
- [ ] Events CRUD (4개)
- [ ] Costs 관리 (4개)
- [ ] Checklist CRUD (4개)
- [ ] Documents 관리 (3개)
- [ ] Notifications 관리 (2개)
- [ ] 에러 처리 & 유효성 검증
- [ ] Rate limiting 설정

**기타**
- [ ] Supabase Storage 설정 (파일 업로드)
- [ ] 정산 알고리즘 구현 & 테스트
- [ ] 권한 검증 로직

### Phase 2: Frontend UI (일주일)

**레이아웃 & 기본 컴포넌트**
- [ ] TravelList 페이지
  - [ ] 카드 뷰
  - [ ] 필터/정렬
  - [ ] 새 여행 추가 버튼

**TravelDetail 페이지**
- [ ] 6개 탭 레이아웃
- [ ] Tab: Overview
  - [ ] 항공 정보
  - [ ] 숙소 정보
  - [ ] 인원 및 비용 요약

- [ ] Tab: Schedule
  - [ ] 캘린더 뷰 (react-calendar 또는 date-fns)
  - [ ] 타임라인 뷰
  - [ ] 이벤트 추가 모달

- [ ] Tab: Costs
  - [ ] 비용 요약 카드
  - [ ] 비용 항목 목록
  - [ ] 정산 계산표
  - [ ] 비용 추가 모달

- [ ] Tab: Checklist
  - [ ] 카테고리별 항목
  - [ ] 체크박스 & 메모
  - [ ] 진행률 바
  - [ ] 항목 추가

- [ ] Tab: Documents
  - [ ] 폴더별 파일 뷰
  - [ ] 드래그 & 드롭 업로드
  - [ ] 파일 미리보기
  - [ ] 다운로드 & 삭제

- [ ] Tab: Notifications
  - [ ] 알림 규칙 목록
  - [ ] 활성화/비활성화 토글
  - [ ] 채널 선택 (인앱/이메일/Telegram)
  - [ ] 커스텀 규칙 추가

### Phase 3: 반응형 & 알림 (일주일)

**반응형 디자인**
- [ ] 모바일 (320~767px) 최적화
- [ ] 태블릿 (768~1023px) 레이아웃
- [ ] 데스크톱 (1024px+) 레이아웃
- [ ] 터치 제스처 최적화

**알림 시스템**
- [ ] Cron job 설정 (매일 자정)
- [ ] 알림 규칙 자동 생성 (여행 생성 시)
- [ ] 인앱 알림 폴링/실시간 구현
- [ ] 이메일 발송 (SendGrid/Resend)
- [ ] Telegram 메시지 발송

**테스트 & 최적화**
- [ ] E2E 테스트 (여행 생성 → 완료)
- [ ] 성능 최적화 (번들 크기, 로딩)
- [ ] 접근성 테스트 (A11y)

### Phase 4: 배포 (1주일 이상)

- [ ] Staging 환경 테스트
- [ ] QA & 버그 수정
- [ ] 보안 감사
- [ ] Production 배포
- [ ] 모니터링 설정
- [ ] 사용자 문서 작성

---

## ⚠️ 주의사항 & 고려사항

### 보안
1. **파일 업로드 검증:** PDF, 이미지만 허용, 크기 제한 (50MB)
2. **저장소 용량:** 사용자당 1GB 또는 여행당 100MB
3. **RLS 정책:** 데이터 접근 제어 철저히
4. **민감 정보:** 파일명 암호화 (선택사항)

### 성능
1. **이미지 최적화:** 문서 미리보기 시 썸네일
2. **캘린더 성능:** 월간 뷰로 제한 (일일 뷰는 선택사항)
3. **파일 다운로드:** 스트리밍 vs 저장 결정
4. **정산 계산:** 멤버 > 10명일 경우 최적화 필요

### 다국어 지원 (향후)
- i18n 라이브러리 (next-i18next)
- 모든 텍스트를 key 기반으로 변환
- 날짜/통화 지역화

### 확장 기능 (순차 개발)
1. 지도 통합 (여행 경로)
2. 예산 추적 (차트)
3. 사진 앨범 (공유)
4. 공동 노트 (팁 공유)
5. 결제 연동 (카드 자동 추적)
6. 오프라인 모드 (캐시)

---

## 📞 참고자료

| 문서 | 설명 |
|------|------|
| `TRAVEL_MANAGEMENT_DESIGN.md` | 완전한 설계서 (520줄) |
| `TRAVEL_MANAGEMENT_API_GUIDE.md` | API 상세 명세 (650줄) |
| `ARCHITECTURE_DSC_HUB.md` | 포탈 아키텍처 |
| `JEEPNEY_PORTAL_DESIGN.md` | 포탈 전체 설계 |
| `travel_plan_2026_05_hcmc.md` | 실제 여행 데이터 |

---

## 📊 예상 개발 통계

| 항목 | 수치 |
|------|------|
| **DB 테이블** | 8개 |
| **API 엔드포인트** | 20+ |
| **React 컴포넌트** | 15+ |
| **예상 코드량** | ~3,000줄 (TS/TSX) |
| **예상 기간** | 4주 (풀타임) |
| **예상 테스트** | E2E, Unit, Integration |

---

## ✅ 최종 체크

설계서 작성 완료:
- [x] 완전 설계서 (520줄, TRAVEL_MANAGEMENT_DESIGN.md)
- [x] API 명세 (650줄, TRAVEL_MANAGEMENT_API_GUIDE.md)
- [x] 요약 & 체크리스트 (이 문서)
- [x] DB 스키마 (8개 테이블, RLS 정책)
- [x] UI/UX 프로토타입 (모든 탭 스크린샷)
- [x] 권한 모델 (RBAC)
- [x] 알림 시스템 설계
- [x] 정산 알고리즘

**상태:** ✅ 플레너 설계 완료 → 웹개발자 구현 대기

---

**작성자:** 플레너 (비서)  
**최종 수정:** 2026-05-14  
**웹개발자 진행 순서:**
1. TRAVEL_MANAGEMENT_DESIGN.md 리뷰
2. TRAVEL_MANAGEMENT_API_GUIDE.md 리뷰
3. DB 마이그레이션 (024_create_travel_tables.sql)
4. API 구현 시작
