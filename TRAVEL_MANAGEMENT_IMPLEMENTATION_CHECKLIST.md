# Travel Management Module — 구현 체크리스트

> **상태:** 웹개발자 구현 시작  
> **작성일:** 2026-05-14  
> **담당:** 웹개발자  
> **설계:** TRAVEL_MANAGEMENT_DESIGN.md (기반)

---

## 📋 전체 구현 계획 (4주)

### Week 1: Backend & DB
- **주차 목표:** 데이터베이스 구축, API 엔드포인트 기본 구조 완성
- **예상 완료:** 2026-05-20

### Week 2: Frontend UI
- **주차 목표:** 모든 UI 컴포넌트 구현 완료
- **예상 완료:** 2026-05-27

### Week 3: 반응형 & 테스트
- **주차 목표:** 모바일 반응형 + 통합 테스트
- **예상 완료:** 2026-06-03

### Week 4: 알림 & 배포
- **주차 목표:** 알림 엔진 + Staging 테스트 + 프로덕션 배포
- **예상 완료:** 2026-06-10

---

## Phase 1: Backend & DB (Week 1)

### 📂 작업 구조
```
dsc-fms-portal/
├── db/
│   └── 24_travel_management_module.sql          [작성 중]
├── app/api/travels/
│   ├── route.ts                                  [작성 중]
│   ├── [id]/
│   │   ├── route.ts                              [작성 중]
│   │   ├── members/route.ts                      [작성 중]
│   │   ├── events/route.ts                       [작성 중]
│   │   ├── costs/route.ts                        [작성 중]
│   │   ├── checklist/route.ts                    [작성 중]
│   │   ├── documents/route.ts                    [작성 중]
│   │   └── notifications/route.ts                [작성 중]
├── lib/
│   ├── travel-service.ts                        [작성 중]
│   └── travel-settlement.ts                     [작성 중]
└── types/travel.ts                              [작성 중]
```

### DB 마이그레이션

- [ ] **작업 1.1:** travels 테이블 생성
  - [ ] 테이블 정의
  - [ ] 기본 필드 (id, user_id, name, start_date, end_date, location, status)
  - [ ] 타임스탬프 추가
  
- [ ] **작업 1.2:** travel_members 테이블 생성
  - [ ] 참여자 관리
  - [ ] 역할/권한 정의

- [ ] **작업 1.3:** travel_events 테이블 생성
  - [ ] 비행, 숙소, 식사 등 일정 이벤트

- [ ] **작업 1.4:** travel_costs 테이블 생성
  - [ ] 비용 항목 저장

- [ ] **작업 1.5:** travel_cost_splits 테이블 생성
  - [ ] 비용 분담 관계

- [ ] **작업 1.6:** travel_checklist_items 테이블 생성
  - [ ] 체크리스트 항목

- [ ] **작업 1.7:** travel_documents 테이블 생성
  - [ ] 파일 메타데이터

- [ ] **작업 1.8:** travel_notifications 테이블 생성
  - [ ] 알림 기록

- [ ] **작업 1.9:** travel_notification_rules 테이블 생성
  - [ ] 자동 알림 규칙

- [ ] **작업 1.10:** 인덱스 생성
  - [ ] travels.user_id
  - [ ] travel_members.travel_id
  - [ ] travel_events.travel_id, event_date
  - [ ] travel_costs.travel_id, payer_id
  - [ ] 기타 필요 인덱스

- [ ] **작업 1.11:** RLS 정책 설정
  - [ ] travels: 작성자 또는 멤버만 조회
  - [ ] travel_members: 해당 여행의 멤버만 조회
  - [ ] travel_events: 여행 멤버만 조회
  - [ ] travel_costs: 여행 멤버만 조회
  - [ ] 기타 테이블 RLS

### API 엔드포인트

#### 여행 관리 (4개)
- [ ] **작업 2.1:** GET /api/travels
  - [ ] 사용자 여행 목록 조회
  - [ ] 쿼리: status, sort_by
  
- [ ] **작업 2.2:** POST /api/travels
  - [ ] 새 여행 생성
  - [ ] 기본 일정 할당

- [ ] **작업 2.3:** GET /api/travels/[id]
  - [ ] 여행 상세 정보 + 관계 데이터

- [ ] **작업 2.4:** PUT /api/travels/[id]
  - [ ] 여행 정보 수정

- [ ] **작업 2.5:** DELETE /api/travels/[id]
  - [ ] 여행 삭제

#### 멤버 관리 (2개)
- [ ] **작업 3.1:** POST /api/travels/[id]/members
  - [ ] 멤버 추가

- [ ] **작업 3.2:** DELETE /api/travels/[id]/members/[member_id]
  - [ ] 멤버 제거

#### 일정 관리 (4개)
- [ ] **작업 4.1:** POST /api/travels/[id]/events
  - [ ] 이벤트 추가

- [ ] **작업 4.2:** GET /api/travels/[id]/events
  - [ ] 여행의 모든 이벤트 조회
  - [ ] 날짜순 정렬

- [ ] **작업 4.3:** PUT /api/travels/[id]/events/[event_id]
  - [ ] 이벤트 수정

- [ ] **작업 4.4:** DELETE /api/travels/[id]/events/[event_id]
  - [ ] 이벤트 삭제

#### 비용 관리 (4개)
- [ ] **작업 5.1:** POST /api/travels/[id]/costs
  - [ ] 비용 추가 + 비용 분담 생성

- [ ] **작업 5.2:** GET /api/travels/[id]/costs
  - [ ] 여행의 모든 비용 조회

- [ ] **작업 5.3:** GET /api/travels/[id]/settlement
  - [ ] 정산 계산표 반환
  - [ ] 각 멤버의 지출/분담/잔액 계산

- [ ] **작업 5.4:** PUT /api/travels/[id]/costs/[cost_id]
  - [ ] 비용 수정 (단, 정산 완료 항목은 불가)

- [ ] **작업 5.5:** DELETE /api/travels/[id]/costs/[cost_id]
  - [ ] 비용 삭제

#### 체크리스트 (4개)
- [ ] **작업 6.1:** POST /api/travels/[id]/checklist
  - [ ] 체크리스트 항목 추가

- [ ] **작업 6.2:** GET /api/travels/[id]/checklist
  - [ ] 모든 항목 조회
  - [ ] 카테고리별 그룹

- [ ] **작업 6.3:** PUT /api/travels/[id]/checklist/[item_id]
  - [ ] 항목 체크 상태/내용 수정

- [ ] **작업 6.4:** DELETE /api/travels/[id]/checklist/[item_id]
  - [ ] 항목 삭제

#### 문서 (3개)
- [ ] **작업 7.1:** POST /api/travels/[id]/documents
  - [ ] 파일 업로드 (Supabase Storage)
  - [ ] 메타데이터 저장

- [ ] **작업 7.2:** GET /api/travels/[id]/documents
  - [ ] 업로드된 문서 목록

- [ ] **작업 7.3:** DELETE /api/travels/[id]/documents/[doc_id]
  - [ ] 문서 삭제

#### 알림 (3개)
- [ ] **작업 8.1:** POST /api/travels/[id]/notifications/setup
  - [ ] 여행 생성 시 기본 알림 규칙 자동 생성

- [ ] **작업 8.2:** PUT /api/travels/[id]/notifications/rules/[rule_id]
  - [ ] 알림 규칙 활성화/비활성화

- [ ] **작업 8.3:** GET /api/travels/[id]/notifications
  - [ ] 여행의 모든 알림 조회

### 비즈니스 로직

- [ ] **작업 9.1:** 정산 알고리즘 구현 (`lib/travel-settlement.ts`)
  - [ ] 각 멤버의 총 지출 계산
  - [ ] 각 멤버의 총 분담 계산
  - [ ] 잔액 계산 (누가 누구에게 얼마를 받아야 하는지)
  - [ ] 엣지 케이스: 동시 비용 등록, 멤버 추가/제거 중 비용 처리

- [ ] **작업 9.2:** 알림 규칙 엔진 구현
  - [ ] 여행 생성 시 기본 규칙 3개 생성
    - [ ] "여행 출발 7일 전" 알림
    - [ ] "여행 시작일" 알림
    - [ ] "여행 종료일" 알림
  - [ ] 알림 채널 지정 (in_app, email, telegram)

- [ ] **작업 9.3:** 권한 검증 미들웨어
  - [ ] 여행 작성자 확인
  - [ ] 멤버 권한 확인 (read_only vs read_write)
  - [ ] 모든 API에 적용

- [ ] **작업 9.4:** 입력 검증
  - [ ] 날짜 범위 검증 (종료 >= 시작)
  - [ ] 금액 검증 (음수 방지)
  - [ ] 파일 크기/형식 검증
  - [ ] 사용자 ID 존재 여부 확인

### 타입 정의 (`types/travel.ts`)

- [ ] **작업 10.1:** TypeScript 인터페이스 정의
  - [ ] Travel
  - [ ] TravelMember
  - [ ] TravelEvent
  - [ ] TravelCost
  - [ ] TravelCostSplit
  - [ ] TravelChecklistItem
  - [ ] TravelDocument
  - [ ] TravelNotification
  - [ ] TravelNotificationRule
  - [ ] SettlementRecord

---

## Phase 2: Frontend UI (Week 2)

### 페이지 구조

- [ ] **작업 11.1:** TravelList 페이지
  - [ ] 여행 목록 조회 및 표시
  - [ ] 카드 레이아웃
  - [ ] 필터/정렬 (상태, 날짜)

- [ ] **작업 11.2:** TravelDetail 페이지 (6개 탭)
  - [ ] Overview 탭
  - [ ] Schedule 탭
  - [ ] Costs 탭
  - [ ] Checklist 탭
  - [ ] Documents 탭
  - [ ] Notifications 탭

### UI 컴포넌트

- [ ] **작업 12.1:** TravelCard
- [ ] **작업 12.2:** TravelForm (생성/수정 모달)
- [ ] **작업 12.3:** MemberList & MemberForm
- [ ] **작업 12.4:** EventList & EventForm
- [ ] **작업 12.5:** CostList & CostForm & SettlementTable
- [ ] **작업 12.6:** ChecklistItems & ChecklistForm
- [ ] **작업 12.7:** DocumentUploader & DocumentList
- [ ] **작업 12.8:** NotificationRuleManager

### 상태 관리

- [ ] **작업 13.1:** React Context 또는 Zustand
  - [ ] 여행 데이터 캐싱
  - [ ] 로딩 상태
  - [ ] 오류 상태

### 실시간 업데이트

- [ ] **작업 14.1:** Supabase Realtime 구독
  - [ ] 여행 멤버 변경 실시간 감지
  - [ ] 비용 추가/수정 실시간 반영

---

## Phase 3: 반응형 & 테스트 (Week 3)

### 반응형 디자인

- [ ] **작업 15.1:** 모바일 (320px ~ 767px)
- [ ] **작업 15.2:** 태블릿 (768px ~ 1023px)
- [ ] **작업 15.3:** 데스크톱 (1024px+)

### 모바일 최적화

- [ ] **작업 16.1:** 터치 인터페이스 (더 큰 버튼 등)
- [ ] **작업 16.2:** 성능 최적화 (번들 크기, 로딩 시간)

### 테스트

- [ ] **작업 17.1:** E2E 테스트
  - [ ] 여행 생성 → 멤버 추가 → 이벤트 추가 → 비용 등록 → 정산 확인
- [ ] **작업 17.2:** 컴포넌트 단위 테스트
- [ ] **작업 17.3:** 접근성 테스트 (키보드 네비게이션, 스크린리더)

---

## Phase 4: 알림 & 배포 (Week 4)

### 알림 시스템

- [ ] **작업 18.1:** Cron job 구현
  - [ ] 매일 자정 실행
  - [ ] 조건에 맞는 알림 자동 생성 및 발송

- [ ] **작업 18.2:** 이메일 발송
- [ ] **작업 18.3:** Telegram 발송
- [ ] **작업 18.4:** 인앱 알림 표시

### 배포

- [ ] **작업 19.1:** Staging 환경 테스트
- [ ] **작업 19.2:** 데이터 마이그레이션 (기존 여행 데이터 있으면)
- [ ] **작업 19.3:** Vercel 배포
- [ ] **작업 19.4:** 프로덕션 모니터링

---

## 리스크 & 주의사항

| 항목 | 위험도 | 대응 |
|------|--------|------|
| **정산 알고리즘 오류** | 🔴 높음 | 여러 번 검증 + 테스트 케이스 작성 |
| **동시성 문제** | 🟡 중간 | Optimistic UI + 충돌 감지 |
| **파일 저장소 용량** | 🟡 중간 | 저장소 할당량 관리 + 삭제 정책 |
| **알림 발송 실패** | 🟡 중간 | 재시도 로직 + 실패 로그 |
| **권한 우회** | 🔴 높음 | RLS 정책 꼼꼼히 설정 + API 권한 검증 |

---

## 참고

- **설계 문서:** `TRAVEL_MANAGEMENT_DESIGN.md`
- **기존 API 패턴:** `app/api/` 디렉토리 참고
- **DB 마이그레이션 예:** `db/` 디렉토리의 다른 마이그레이션 파일 참고

---

**작성자:** 웹개발자  
**최종 수정일:** 2026-05-14  
**상태:** Phase 1 시작 (DB & API)
