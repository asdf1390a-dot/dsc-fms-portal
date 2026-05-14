# 팀 현황판 Portal 대시보드 설계 요약

**작성일:** 2026-05-14  
**대상:** Web Builder (웹 개발자)  
**예상 개발 기간:** 10-15일 (2026-05-25까지 완료 목표)  
**상태:** 설계 완료, 개발 대기 중

---

## 📋 프로젝트 개요

팀 전체의 업무 진행 상황을 **실시간**으로 추적하는 대시보드입니다.

### 주요 기능
1. **담당자별 상태 카드** - 이름, 상태(🟢🟡⏸️✅), 현재 작업, ETA, 블로킹 사유
2. **상태별 필터링** - 진행중/대기/완료/유휴
3. **담당자별 필터링** - 부서 그룹핑
4. **날짜별 필터링** - 기간 검색
5. **활동 로그** - 타임라인 + 블로킹 추적 (해결 시간 포함)
6. **상세 보기** - 개별 팀원의 전체 이력

---

## 📂 설계 산출물

### 1. 데이터베이스 스키마 (`db/24_team_status_dashboard.sql`)
- **테이블 4개** + 메트릭 테이블
  - `team_members` - 팀원 기본 정보
  - `team_status_updates` - 상태 변화 로그
  - `team_blocking_reasons` - 블로킹 정보 + 해결 추적
  - `team_task_assignments` - 작업 할당

- **RLS 정책** - 데이터 접근 권한 자동 제어
- **인덱싱** - 성능 최적화 (조인, 필터링 빠름)
- **Realtime 설정** - Supabase Realtime 자동 구독 가능

### 2. UI 와이어프레임 (`TEAM_STATUS_DASHBOARD_DESIGN.md` § 3)
- **메인 대시보드** - 상태 요약(4개 박스) + 카드 목록
- **담당자 카드** - 상태, 작업, ETA, 블로킹 표시
- **상태 업데이트 모달** - 상태/작업/ETA/블로킹 입력
- **활동 로그** - 타임라인 뷰 (블로킹 해결 시간 추적)
- **상세 보기** - 개인 프로필 + 이력

### 3. API 명세 (`TEAM_STATUS_API_GUIDE.md`)

| API | 메서드 | 용도 |
|-----|--------|------|
| `/api/team/members` | GET | 팀원 목록 조회 |
| `/api/team/status-updates` | POST | 상태 업데이트 + 작업/블로킹 함께 기록 |
| `/api/team/status-updates` | GET | 로그 조회 (필터 지원) |
| `/api/team/blocking-reasons` | GET | 블로킹 정보 조회 (해결 시간 계산) |
| `/api/team/task-assignments` | POST | 작업 할당 |

모든 API는 **완전한 구현 예시** 포함

---

## 🎯 주요 설계 결정

### 1. 상태 업데이트 원자성 (Atomicity)
```
POST /api/team/status-updates 한 번의 호출로:
  ✓ team_status_updates 기록
  ✓ team_task_assignments 생성 (작업명 있으면)
  ✓ team_blocking_reasons 생성 (대기 상태면)
  ✓ 이전 블로킹 해결 마크 (대기→다른 상태로 변경 시)
```

→ **장점:** DB 일관성 보장, 클라이언트 로직 단순화

### 2. 블로킹 시간 추적
```
blocked_since: 블로킹 시작 시각
resolved_at:   해결 시각 (NULL이면 진행중)
resolved_by:   해결한 사람
```

→ **장점:** SLA 추적 가능, 블로킹 패턴 분석 가능

### 3. Realtime 구독
```sql
ALTER TABLE team_status_updates REPLICA IDENTITY FULL;
ALTER TABLE team_blocking_reasons REPLICA IDENTITY FULL;
ALTER TABLE team_task_assignments REPLICA IDENTITY FULL;
```

→ **장점:** 모든 사용자에게 실시간 알림 가능

### 4. RLS (Row Level Security)
```
- 활성 팀원 정보: 모두 조회 가능
- 상태 업데이트: 자신만 작성 가능, 모두 조회 가능
- 블로킹 정보: 자신만 생성, 모두 조회 가능
```

→ **장점:** 서버 권한 검사 불필요, DB 레벨 보안

---

## 🏗️ 컴포넌트 구조

```
app/dashboard/team-status/
├── page.tsx                    (메인 대시보드)
│   ├── TeamStatusSummary       (🟢5 🟡2 ⏸️1 ✅8)
│   ├── TeamStatusFilters       (상태/담당자/날짜 필터)
│   └── TeamStatusCardList      (담당자 카드 목록)
│
├── activity/page.tsx           (활동 로그)
│   └── ActivityTimeline        (타임라인)
│
└── [memberId]/page.tsx         (상세 보기)
    └── MemberDetailView        (프로필 + 이력)

components/team/
├── TeamStatusCard.tsx          (개별 카드)
├── StatusUpdateModal.tsx       (상태 업데이트)
├── ActivityTimeline.tsx        (로그)
└── ...

hooks/
├── useTeamStatus.ts           (상태 조회 + Realtime)
├── useTeamFilters.ts          (필터 상태 관리)
└── useStatusUpdate.ts         (업데이트 로직)
```

---

## 🔧 개발 순서 (추천)

### 1주차 (2026-05-20 ~ 5-24)
- [ ] **Day 1-2:** DB 마이그레이션 + RLS 정책
  - `db/24_team_status_dashboard.sql` 실행
  - 초기 팀원 데이터 입력
  - RLS 정책 테스트

- [ ] **Day 3:** API 라우트 작성 (5개 endpoint)
  - `/api/team/members` - GET
  - `/api/team/status-updates` - POST, GET
  - `/api/team/blocking-reasons` - GET
  - `/api/team/task-assignments` - POST

- [ ] **Day 4-5:** 프론트엔드 기본 구조
  - 페이지 3개 생성 (main, activity, detail)
  - 컴포넌트 뼈대 (TypeScript 타입 포함)
  - useTeamStatus 훅 구현

### 2주차 (2026-05-27 ~ 5-31)
- [ ] **Day 6-8:** UI 컴포넌트 완성
  - TeamStatusCard (상태 카드)
  - StatusUpdateModal (모달)
  - ActivityTimeline (로그)
  - MemberDetailView (상세 보기)

- [ ] **Day 9:** Realtime 통합
  - Supabase Realtime 구독
  - 실시간 업데이트

- [ ] **Day 10:** 테스트 + 디버깅
  - 모든 필터 동작 확인
  - 모바일 반응형 테스트
  - 성능 최적화

---

## ✅ 개발 체크리스트

### DB & API
- [ ] 마이그레이션 파일 실행
- [ ] RLS 정책 검증
- [ ] 5개 API 라우트 완성
- [ ] TypeScript 타입 정의 (types/team.ts)
- [ ] API 에러 처리 + 로깅
- [ ] 인증 미들웨어 (모든 API에 적용)

### 프론트엔드
- [ ] 3개 페이지 구성
- [ ] 6개 컴포넌트 개발
- [ ] 3개 커스텀 훅 구현
- [ ] Realtime 구독
- [ ] 필터링 (상태/담당자/날짜)
- [ ] 무한 스크롤 (대시보드)
- [ ] 페이지네이션 (활동 로그)

### 스타일 & UX
- [ ] Tailwind CSS 스타일
- [ ] 모바일 반응형
- [ ] 로딩 상태
- [ ] 에러 메시지
- [ ] 토스트 알림 (상태 변경 시)

### 테스트
- [ ] 유닛 테스트 (훅)
- [ ] 통합 테스트 (API + DB)
- [ ] E2E 테스트 (주요 흐름)
- [ ] 성능 테스트 (대량 데이터)

### 배포
- [ ] Staging 배포 + QA
- [ ] 보안 검토 (RLS, 인증)
- [ ] 프로덕션 배포
- [ ] 모니터링 설정

---

## 📊 데이터 예시

### 팀원 카드 표시
```
┌─────────────────────────────────────────┐
│ 👤 김철수 (생산팀)                       │
│ 🟢 진행중 (지난 3시간)                 │
│ 작업: BOM 입고 데이터 정리              │
│ ETA: 2026-05-16 14:00 (23시간 후)      │
│ 블로킹: 없음                            │
│ [📝 업데이트] [🔔 알림] [→ 상세보기]   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 👤 이영희 (기술팀)                       │
│ 🟡 대기 (지난 1시간 25분)               │
│ 작업: 성형기 검사 결과 분석              │
│ ETA: 2026-05-17 10:00 (26시간 후)      │
│ 🚫 블로킹: SAP ECC 추출본 전달 대기    │
│    └─ ▶ 해결됨 (2026-05-14 15:00)    │
│ [📝 업데이트] [🔔 알림] [→ 상세보기]   │
└─────────────────────────────────────────┘
```

### 필터 예시
```
[전체 ▼] [부서: 전체 ▼] [2026-05-10 ~ 2026-05-14]

결과: 
  ✅ 완료: 8명
  🟢 진행중: 5명
  🟡 대기: 2명
  ⏸️  유휴: 1명
```

---

## 🚀 성능 목표

| 메트릭 | 목표 | 달성 방법 |
|--------|------|---------|
| API 응답 | < 200ms | 인덱싱, 페이지네이션 |
| 대시보드 로드 | < 1s | 초기 로드 20개 + 무한 스크롤 |
| Realtime 지연 | < 1s | Supabase Realtime |
| 메모리 | < 50MB | 가상화 스크롤 |

---

## 📚 참고 자료

1. **DB 스키마:** `TEAM_STATUS_DASHBOARD_DESIGN.md` § 2
2. **UI 와이어프레임:** `TEAM_STATUS_DASHBOARD_DESIGN.md` § 3
3. **API 명세:** `TEAM_STATUS_API_GUIDE.md`
4. **SQL 스크립트:** `db/24_team_status_dashboard.sql`

---

## 🎓 팀원을 위한 팁

### Web Builder가 놓치기 쉬운 부분
1. **POST 상태 업데이트 시** - 작업/블로킹/상태 변경을 **원자적으로** 처리
   ```typescript
   // ❌ 잘못된 예
   await updateStatus();    // 상태만 변경
   await createTask();      // 작업 생성 (분리됨)
   
   // ✅올바른 예
   await POST /api/team/status-updates { // 한 번에 모두
     new_status, task_name, blocking_reason
   }
   ```

2. **블로킹 추적** - `resolved_at` NULL 체크 필수
   ```sql
   SELECT * FROM team_blocking_reasons
   WHERE team_member_id = ? AND resolved_at IS NULL
   ```

3. **Realtime 구독** - 초기 데이터 + 변경사항 분리
   ```typescript
   // 1. 초기 로드
   const { data: initial } = await supabase.from(...).select();
   
   // 2. 변경사항 구독
   supabase.channel('team_status').on('INSERT', ...);
   ```

4. **필터링 쿼리** - 범위 검색은 `.gte()`, `.lte()` 사용
   ```typescript
   query.gte('created_at', from)
        .lte('created_at', to)
   ```

### Evaluator가 검증할 부분
- [ ] 상태 업데이트 후 DB에 3개 테이블 모두 기록되었는지
- [ ] 블로킹 발생 후 상태 변경 시 `resolved_at` 자동 기록
- [ ] 필터 조합 (상태+담당자+날짜 동시 적용)
- [ ] Realtime 자동 갱신 (다른 탭에서 변경 시)
- [ ] 모바일에서 카드가 모두 보이는가

---

## 📝 향후 고려사항 (Phase 2)

1. **권한 기반 액세스** - 매니저만 타인 상태 수정 가능
2. **알림 시스템** - Email/Slack 통합 알림
3. **주간 리포트** - 자동 생성 + 다운로드
4. **통계 대시보드** - 팀 성과 차트
5. **1:1 채팅** - 블로킹 이유 논의

---

**설계 완료일:** 2026-05-14  
**웹개발자 시작 예정:** 2026-05-20  
**예상 완료:** 2026-05-29  
**배포 대상:** Vercel (production)
