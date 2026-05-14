# 팀 현황판 개발 - 구현 체크리스트

**시작일**: 2026-05-14  
**예상 완료**: 2026-05-29  
**담당**: Web Builder → Evaluator → Deploy  

---

## Phase 1: 데이터베이스 설정 (1-2일)

### 1.1 DB 마이그레이션 스크립트 생성
- [ ] `db/24_team_status_dashboard.sql` 생성
- [ ] `team_members` 테이블 생성 (기본 정보, 부서, 직급)
- [ ] `team_status_updates` 테이블 생성 (상태 변화 로그)
- [ ] `team_blocking_reasons` 테이블 생성 (블로킹 추적)
- [ ] `team_task_assignments` 테이블 생성 (작업 할당 & ETA)
- [ ] `team_metrics` 테이블 생성 (일일 메트릭, 선택사항)
- [ ] 모든 인덱스 생성
  - `idx_team_members_department`
  - `idx_team_members_is_active`
  - `idx_team_status_updates_member_id`
  - `idx_team_status_updates_created_at`
  - `idx_team_status_updates_new_status`
  - `idx_team_blocking_reasons_member_id`
  - `idx_team_blocking_reasons_resolved_at`
  - `idx_team_blocking_reasons_blocked_since`
  - `idx_team_task_assignments_member_id`
  - `idx_team_task_assignments_status`
  - `idx_team_task_assignments_expected_completion_at`
  - `idx_team_metrics_metric_date`

### 1.2 RLS 정책 설정
- [ ] Enable RLS on all 5 tables
- [ ] `team_members` - "Select active team members" policy
- [ ] `team_members` - "Update own info" policy
- [ ] `team_status_updates` - "Update own status" policy (INSERT)
- [ ] `team_status_updates` - "View all status updates" policy (SELECT)
- [ ] `team_blocking_reasons` - View & Update policies
- [ ] `team_task_assignments` - View & Update policies
- [ ] Test RLS policies with test users

### 1.3 테스트 데이터 삽입
- [ ] 테스트 팀원 5명 추가 (부서별 분산)
- [ ] 샘플 상태 업데이트 로그 생성
- [ ] 샘플 블로킹 이유 생성
- [ ] 샘플 작업 할당 생성

---

## Phase 2: API 라우트 구현 (3-4일)

### 2.1 팀원 관리 API
- [ ] `app/api/team/members/route.ts` 구현
  - [ ] GET: 모든 활성 팀원 조회 (캐시: 5분)
  - [ ] GET ?department=생산: 부서별 필터링
  - [ ] GET ?id=uuid: 특정 팀원 조회
  - [ ] POST: 새 팀원 추가 (관리자만)
  - [ ] PUT: 팀원 정보 수정 (본인 또는 관리자)

### 2.2 상태 업데이트 API (핵심)
- [ ] `app/api/team/status-updates/route.ts` 구현
  - [ ] POST: 새 상태 업데이트
    - [ ] `team_status_updates` 레코드 생성
    - [ ] `team_task_assignments` 업데이트/생성
    - [ ] 블로킹이면 `team_blocking_reasons` 생성
    - [ ] Supabase Realtime 브로드캐스트
    - [ ] Response: 생성된 업데이트 정보 반환
  - [ ] GET: 상태 업데이트 로그 조회
    - [ ] 쿼리 파라미터 필터링
      - [ ] `?status=진행중&status=대기` (다중 선택)
      - [ ] `?member_id=uuid`
      - [ ] `?department=생산`
      - [ ] `?from=YYYY-MM-DD&to=YYYY-MM-DD`
    - [ ] 캐시: 1분 TTL
    - [ ] 페이지네이션: 최근 50개부터
    - [ ] 정렬: created_at DESC (최신순)

### 2.3 블로킹 관리 API
- [ ] `app/api/team/blocking-reasons/route.ts` 구현
  - [ ] GET: 모든 미해결 블로킹 조회
    - [ ] `?member_id=uuid`: 특정 팀원의 블로킹만
  - [ ] GET ?resolved=false: 진행 중인 블로킹만
  - [ ] POST: 블로킹 해결 처리
    - [ ] `resolved_at`, `resolved_by` 업데이트
    - [ ] Realtime 브로드캐스트

### 2.4 작업 할당 API
- [ ] `app/api/team/task-assignments/route.ts` 구현
  - [ ] GET: 팀원의 현재 작업 조회
    - [ ] `?status=진행중`: 진행 중인 작업만
    - [ ] `?member_id=uuid`
  - [ ] POST: 새 작업 할당
  - [ ] PUT: 작업 상태 업데이트 (완료, ETA 연장 등)

### 2.5 메트릭 API
- [ ] `app/api/team/metrics/route.ts` 구현
  - [ ] GET: 일일 메트릭 조회
    - [ ] `?date=YYYY-MM-DD`: 특정 날짜
    - [ ] `?range=7`: 최근 N일 통계
  - [ ] POST: 일일 메트릭 집계 (Cron 전용)
    - [ ] 매일 자동 실행 (Vercel Cron)
    - [ ] `total_members`, `active_members` 집계
    - [ ] 상태별 카운트 집계
    - [ ] 평균 완료 시간 계산

### 2.6 API 공통 기능
- [ ] 모든 API에 에러 핸들링 추가
- [ ] 모든 API에 요청 검증 추가
- [ ] 모든 API에 로깅 추가
- [ ] CORS 설정 확인
- [ ] Rate limiting 검토

---

## Phase 3: 커스텀 훅 (Hooks) 개발 (1.5일)

### 3.1 useTeamStatus 훅
- [ ] `hooks/useTeamStatus.ts` 생성
  - [ ] 팀원 및 상태 데이터 조회
  - [ ] Supabase Realtime 구독
    - [ ] `team_status_updates` 테이블 감시
    - [ ] 변경 시 자동 리렌더링
  - [ ] 데이터 상태 관리 (loading, error, data)
  - [ ] Cleanup: 언마운트 시 구독 해제

### 3.2 useTeamFilters 훅
- [ ] `hooks/useTeamFilters.ts` 생성
  - [ ] 필터 상태 관리 (상태, 담당자, 날짜)
  - [ ] URL 쿼리 파라미터와 동기화
  - [ ] 필터 적용 함수
  - [ ] 필터 초기화 함수

### 3.3 useStatusUpdate 훅
- [ ] `hooks/useStatusUpdate.ts` 생성
  - [ ] 상태 업데이트 API 호출
  - [ ] 폼 검증
  - [ ] 로딩/에러 상태 관리
  - [ ] 성공 콜백

### 3.4 유틸리티 함수
- [ ] `utils/statusUtils.ts` 생성
  - [ ] 상태별 이모지 매핑 (🟢, 🟡, ⏸️, ✅)
  - [ ] 상태 한글화 함수
  - [ ] ETA 시간 포맷팅 함수
  - [ ] 블로킹 시간 계산 함수 (시간:분 형식)
  - [ ] 우선순위 색상 매핑

---

## Phase 4: 컴포넌트 개발 (3-4일)

### 4.1 상태 요약 컴포넌트
- [ ] `components/team/TeamStatusSummary.tsx` 생성
  - [ ] 4개 상태별 카드 (진행중, 대기, 유휴, 완료)
  - [ ] 각 카드에 카운트 표시
  - [ ] 로딩 상태 처리
  - [ ] 실시간 업데이트

### 4.2 담당자 상태 카드
- [ ] `components/team/TeamStatusCard.tsx` 생성
  - [ ] 팀원 기본 정보 (이름, 부서)
  - [ ] 현재 상태 이모지 + 텍스트
  - [ ] 현재 작업명
  - [ ] ETA 표시
  - [ ] 블로킹 이유 및 필요 정보 (조건부 표시)
  - [ ] 액션 버튼 (📝 업데이트, 🔔 알림, 📊 상세)
  - [ ] 상태별 배경색 구분
  - [ ] 반응형 디자인

### 4.3 필터 바
- [ ] `components/team/TeamStatusFilters.tsx` 생성
  - [ ] 상태별 필터 (라디오/체크박스)
  - [ ] 담당자별 필터 (드롭다운, 부서별 그룹핑)
  - [ ] 날짜 범위 필터 (DatePicker)
  - [ ] 필터 적용 버튼
  - [ ] 필터 초기화 버튼
  - [ ] URL 쿼리 파라미터 자동 업데이트

### 4.4 상태 업데이트 모달
- [ ] `components/team/StatusUpdateModal.tsx` 생성
  - [ ] 담당자명 및 현재 상태 표시
  - [ ] 새 상태 선택 (라디오 4개)
  - [ ] 현재 작업명 입력 필드
  - [ ] ETA 날짜/시간 선택
  - [ ] 블로킹 이유 체크박스 (5개 옵션)
  - [ ] 필요 정보 텍스트 필드
  - [ ] 폼 검증
  - [ ] 제출 로딩 상태
  - [ ] 성공/에러 메시지
  - [ ] 취소/저장 버튼

### 4.5 활동 타임라인
- [ ] `components/team/ActivityTimeline.tsx` 생성
  - [ ] 상태 변경 타임라인
  - [ ] 시간 표시 (날짜 + 시간)
  - [ ] 담당자명 + 상태 변경 (`진행중 → 완료`)
  - [ ] 작업명 표시
  - [ ] 블로킹 정보 (있으면 표시)
  - [ ] 블로킹 해결 시간 표시 (해결됨)
  - [ ] 최신순 정렬
  - [ ] 페이지네이션 또는 무한 스크롤

### 4.6 상세 보기 컴포넌트
- [ ] `components/team/MemberDetailView.tsx` 생성
  - [ ] 기본 정보 섹션
  - [ ] 현재 상태 섹션 (상태, 작업, 우선순위, ETA, 진행률)
  - [ ] 블로킹 정보 섹션
  - [ ] 최근 활동 섹션 (최근 10개)
  - [ ] 알림 설정 섹션 (3개 옵션)
  - [ ] 뒤로가기/편집/닫기 버튼

---

## Phase 5: 페이지 구성 (2일)

### 5.1 메인 대시보드 페이지
- [ ] `app/dashboard/team-status/page.tsx` 생성
  - [ ] Layout: 필터 바 + 상태 요약 + 카드 목록
  - [ ] useTeamStatus 훅으로 데이터 조회
  - [ ] useTeamFilters 훅으로 필터링 적용
  - [ ] 초기 로드: 20개 카드
  - [ ] 무한 스크롤 또는 페이지네이션
  - [ ] 로딩 스켈레톤
  - [ ] 빈 상태 메시지
  - [ ] 에러 페이 폴백

### 5.2 활동 로그 페이지
- [ ] `app/dashboard/team-status/activity/page.tsx` 생성
  - [ ] 필터 바 (상태, 담당자, 날짜)
  - [ ] 다운로드 버튼 (CSV/PDF)
  - [ ] ActivityTimeline 컴포넌트
  - [ ] 최근 50개 이벤트 초기 로드
  - [ ] 페이지네이션
  - [ ] 로딩/에러 처리

### 5.3 상세 보기 페이지
- [ ] `app/dashboard/team-status/[memberId]/page.tsx` 생성
  - [ ] Dynamic route로 memberId 처리
  - [ ] MemberDetailView 컴포넌트
  - [ ] 팀원 정보 조회
  - [ ] 최근 활동 조회
  - [ ] 편집 모드 토글 (관리자만)
  - [ ] 데이터 로딩 상태
  - [ ] 에러 처리 (존재하지 않는 팀원)

---

## Phase 6: 실시간 기능 & 통합 (1.5일)

### 6.1 Realtime 구독 통합
- [ ] Supabase 클라이언트 설정 확인
- [ ] `useTeamStatus` 훅에서 Realtime 구독
- [ ] 상태 변경 감지 시 자동 리렌더링
- [ ] 다중 탭/세션 간 동기화 테스트

### 6.2 모달 통합
- [ ] StatusUpdateModal을 TeamStatusCard에 통합
- [ ] 모달 열기/닫기 상태 관리
- [ ] 폼 제출 시 API 호출
- [ ] 성공 시 대시보드 자동 갱신
- [ ] Realtime 푸시 대기

### 6.3 필터 통합
- [ ] TeamStatusFilters 상태를 대시보드에 통합
- [ ] 필터 변경 시 API 쿼리 재실행
- [ ] 쿼리 파라미터 URL 동기화
- [ ] 페이지 새로고침 시 필터 복원

### 6.4 내비게이션
- [ ] 대시보드 → 상세 페이지 링크
- [ ] 상세 페이지 → 대시보드 뒤로가기
- [ ] 활동 로그 페이지 링크 추가
- [ ] 네비게이션 메뉴 업데이트

---

## Phase 7: 성능 최적화 (1일)

### 7.1 캐싱 전략
- [ ] 팀원 목록: React Query with 5분 TTL
- [ ] 상태 요약: 1분 TTL (자주 변함)
- [ ] 개별 팀원 상세: 필요시 온디맨드

### 7.2 쿼리 최적화
- [ ] API 응답에서 필요한 필드만 선택
- [ ] 불필요한 조인 제거
- [ ] N+1 쿼리 문제 확인 및 해결
- [ ] 인덱스 활용도 확인

### 7.3 번들 최적화
- [ ] 컴포넌트 코드 스플릿팅 검토
- [ ] 불필요한 임포트 제거
- [ ] 번들 크기 측정

### 7.4 이미지 & 미디어
- [ ] 프로필 이미지 최적화 (선택사항)
- [ ] 스켈레톤 로딩 추가
- [ ] 다크모드 지원 검토

---

## Phase 8: 테스트 & QA (2-3일)

### 8.1 단위 테스트
- [ ] 유틸리티 함수 테스트 (statusUtils)
- [ ] 훅 테스트 (useTeamStatus, useTeamFilters)
- [ ] 컴포넌트 렌더링 테스트

### 8.2 통합 테스트
- [ ] API 엔드포인트 테스트
  - [ ] GET /api/team/members
  - [ ] POST /api/team/status-updates
  - [ ] GET /api/team/status-updates with filters
  - [ ] GET /api/team/blocking-reasons
  - [ ] POST /api/team/blocking-reasons (resolve)
  - [ ] GET /api/team/metrics
- [ ] DB 트랜잭션 테스트

### 8.3 UI/UX 테스트 (평가자)
- [ ] 상태 업데이트 흐름 테스트 (5회 반복)
- [ ] 필터링 기능 테스트 (모든 필터 조합)
- [ ] Realtime 업데이트 테스트 (다중 탭)
- [ ] 모바일 반응형 테스트 (iOS, Android)
- [ ] 로딩 상태 UX 확인
- [ ] 에러 메시지 명확성 확인
- [ ] 접근성 검토 (WCAG AA)

### 8.4 성능 테스트
- [ ] 페이지 로드 시간 측정
- [ ] Lighthouse 스코어 확인 (목표: 90+)
- [ ] 실시간 업데이트 지연 측정
- [ ] 대량 데이터 조회 성능 (1000+ 레코드)

### 8.5 보안 테스트
- [ ] RLS 정책 검증 (권한 없는 접근 차단)
- [ ] XSS 취약점 확인
- [ ] CSRF 토큰 확인
- [ ] SQL injection 불가능 확인 (prepared statements)

---

## Phase 9: 배포 (1일)

### 9.1 프로덕션 환경 준비
- [ ] 환경 변수 설정 확인
  - [ ] NEXT_PUBLIC_SUPABASE_URL
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
  - [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] 데이터베이스 마이그레이션 실행 (프로덕션)
- [ ] Vercel 설정 확인

### 9.2 배포 실행
- [ ] main 브랜치로 PR 생성
- [ ] 코드 리뷰 완료
- [ ] 모든 테스트 통과 확인
- [ ] main 브랜치에 병합
- [ ] Vercel 자동 배포 대기
- [ ] 프로덕션 배포 확인

### 9.3 배포 후 검증
- [ ] 프로덕션 URL에서 대시보드 접근 테스트
- [ ] 실시간 업데이트 확인
- [ ] 필터링 기능 확인
- [ ] API 응답 시간 확인
- [ ] 에러 로그 확인 (Sentry 또는 유사)

### 9.4 배포 후 모니터링
- [ ] 첫 24시간 모니터링
- [ ] 사용자 피드백 수집
- [ ] 버그 리포트 대응

---

## 의존성 및 우선순위

### 크리티컬 경로
1. **DB 마이그레이션** (Phase 1) → 2-3일
2. **API 라우트** (Phase 2) → 3-4일
3. **훅 + 유틸** (Phase 3) → 1-2일
4. **컴포넌트** (Phase 4) → 3-4일
5. **페이지 구성** (Phase 5) → 1-2일
6. **Realtime 통합** (Phase 6) → 1-2일
7. **QA & 테스트** (Phase 8) → 2-3일
8. **배포** (Phase 9) → 1일

### 병렬 가능 작업
- Phase 4 (컴포넌트) 중 API 완료 후 병렬 진행 가능
- Phase 7 (성능 최적화)는 Phase 6 완료 후 병렬 가능

---

## 주의사항

### 데이터 검증
- 모든 입력값 서버사이드 검증 (클라이언트 검증만으로 부족)
- 날짜/시간 형식 통일 (ISO 8601)
- 상태값 enum 정의로 관리

### 에러 처리
- API 에러 응답에 명확한 메시지 포함
- 클라이언트에서 에러 상태 UI 표시
- 네트워크 오류 시 재시도 로직

### 보안
- RLS 정책 철저히 테스트
- 민감한 정보(이메일 등) 접근 권한 확인
- API 속도 제한(Rate Limit) 설정

### 문서
- 각 컴포넌트의 Props 인터페이스 명확히
- API 엔드포인트 요청/응답 명세 작성
- 환경 변수 설정 가이드 작성

---

## 예상 시간 분배

| 단계 | 일정 | 누적 |
|------|------|------|
| Phase 1 (DB) | 1-2일 | 1-2일 |
| Phase 2 (API) | 3-4일 | 4-6일 |
| Phase 3 (Hooks) | 1-2일 | 5-8일 |
| Phase 4 (Components) | 3-4일 | 8-12일 |
| Phase 5 (Pages) | 1-2일 | 9-14일 |
| Phase 6 (Realtime) | 1-2일 | 10-16일 |
| Phase 7 (Optimization) | 1일 | 11-17일 |
| Phase 8 (QA) | 2-3일 | 13-20일 |
| Phase 9 (Deploy) | 1일 | 14-21일 |

**총 예상**: 10-15 업무일 (2026-05-14 ~ 2026-05-29)

---

**다음 단계**
1. Web Builder가 TEAM_STATUS_DASHBOARD_DESIGN.md 리뷰
2. Web Builder가 이 체크리스트 리뷰 및 수정
3. 즉시 Phase 1 (DB 마이그레이션) 시작
