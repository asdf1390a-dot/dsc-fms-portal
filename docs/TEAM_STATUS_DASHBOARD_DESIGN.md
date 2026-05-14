# 팀 현황판 Portal 대시보드 설계

## 1. 개요

팀 전체 상태를 실시간으로 추적하고, 담당자별 진행 상황, 블로킹 이유, 완료 예상 시간을 한눈에 볼 수 있는 대시보드입니다.

**주요 기능**
- 담당자별 상태 카드 (이름, 상태 이모지, 현재 작업, ETA, 블로킹 사유)
- 상태별 필터링 (진행중, 대기, 완료, 유휴)
- 담당자별 필터링
- 날짜별 필터링
- 활동 로그 (타임라인, 블로킹 추적)

**대상 사용자**
- 팀 리더/매니저 (진행 상황 모니터링)
- 각 팀원 (자신의 상태 업데이트)
- 경영진 (주간/월간 진행률 리포트)

**기술 스택**
- Frontend: Next.js 14 + React + TypeScript
- Backend: Supabase (PostgreSQL + RLS + Realtime)
- Deployment: Vercel

---

## 2. 데이터베이스 스키마

### 2.1 `team_members` 테이블
담당자 기본 정보

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  department VARCHAR(50), -- 생산/기술/보전/생산관리
  role VARCHAR(50), -- 엔지니어/플레너/분석가 등
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_department CHECK (department IN ('생산', '기술', '보전', '생산관리', NULL))
);

CREATE INDEX idx_team_members_department ON team_members(department);
CREATE INDEX idx_team_members_is_active ON team_members(is_active);
```

### 2.2 `team_status_updates` 테이블
상태 변화 로그 (진행중, 대기, 완료, 유휴)

```sql
CREATE TABLE team_status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  previous_status VARCHAR(20), -- 이전 상태
  new_status VARCHAR(20) NOT NULL, -- 새 상태: 진행중, 대기, 완료, 유휴
  reason VARCHAR(500), -- 상태 변경 사유
  updated_by UUID, -- 누가 업데이트했는가 (team_member_id 또는 NULL)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (new_status IN ('진행중', '대기', '완료', '유휴'))
);

CREATE INDEX idx_team_status_updates_member_id ON team_status_updates(team_member_id);
CREATE INDEX idx_team_status_updates_created_at ON team_status_updates(created_at DESC);
CREATE INDEX idx_team_status_updates_new_status ON team_status_updates(new_status);
```

### 2.3 `team_blocking_reasons` 테이블
블로킹 이유 및 필요 정보 추적

```sql
CREATE TABLE team_blocking_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  blocking_reason VARCHAR(255) NOT NULL, -- 블로킹 이유
  required_info VARCHAR(500), -- 필요 정보
  blocked_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE, -- NULL이면 미해결
  resolved_by UUID, -- 해결한 사람
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_team_blocking_reasons_member_id ON team_blocking_reasons(team_member_id);
CREATE INDEX idx_team_blocking_reasons_resolved_at ON team_blocking_reasons(resolved_at);
CREATE INDEX idx_team_blocking_reasons_blocked_since ON team_blocking_reasons(blocked_since DESC);
```

### 2.4 `team_task_assignments` 테이블
현재 담당 작업 및 완료 예상 시간

```sql
CREATE TABLE team_task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  task_name VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expected_completion_at TIMESTAMP WITH TIME ZONE,
  actual_completion_at TIMESTAMP WITH TIME ZONE, -- NULL이면 미완료
  priority VARCHAR(20) DEFAULT 'normal', -- 낮음, 보통, 높음
  status VARCHAR(20) NOT NULL DEFAULT '진행중', -- 진행중, 완료
  assigned_by UUID, -- 할당한 사람
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_priority CHECK (priority IN ('낮음', '보통', '높음')),
  CONSTRAINT valid_task_status CHECK (status IN ('진행중', '완료'))
);

CREATE INDEX idx_team_task_assignments_member_id ON team_task_assignments(team_member_id);
CREATE INDEX idx_team_task_assignments_status ON team_task_assignments(status);
CREATE INDEX idx_team_task_assignments_expected_completion_at ON team_task_assignments(expected_completion_at);
```

### 2.5 `team_metrics` 테이블 (선택)
일일 메트릭 집계

```sql
CREATE TABLE team_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE DEFAULT CURRENT_DATE,
  total_members INT,
  active_members INT,
  members_in_progress INT,
  members_waiting INT,
  members_completed INT,
  members_idle INT,
  total_blocking_count INT,
  avg_completion_time_hours NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(metric_date)
);

CREATE INDEX idx_team_metrics_metric_date ON team_metrics(metric_date DESC);
```

---

## 3. UI 와이어프레임

### 3.1 대시보드 메인 페이지 (`/dashboard/team-status`)

#### 레이아웃
```
┌─────────────────────────────────────────────────────┐
│  팀 현황판                     [필터]                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  상태별 요약                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ 🟢 진행중│ │ 🟡 대기  │ │ ⏸️  유휴│ │ ✅ 완료 │  │
│  │    5    │ │    2    │ │    1    │ │    8    │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  담당자 카드 목록                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 👤 김철수 (생산팀)                             │  │
│  │ 상태: 🟢 진행중                               │  │
│  │ 현재 작업: BOM 입고 데이터 정리                 │  │
│  │ ETA: 2026-05-16 14:00                         │  │
│  │ 블로킹 이유: -                                │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ 👤 이영희 (기술팀)                             │  │
│  │ 상태: 🟡 대기                                 │  │
│  │ 현재 작업: 성형기 검사 결과 분석                │  │
│  │ ETA: 2026-05-17 10:00                         │  │
│  │ 블로킹 이유: 시뮬레이션 데이터 전달 대기       │  │
│  │ 필요 정보: SAP ECC 추출본                     │  │
│  │ [✏️ 업데이트] [🔔 알림]                      │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ... (더 많은 카드)                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### 필터 바
- **상태별**: 전체 | 진행중 (🟢) | 대기 (🟡) | 유휴 (⏸️) | 완료 (✅)
- **담당자별**: 드롭다운 (부서별 그룹핑)
- **날짜 범위**: 시작일 ~ 종료일

### 3.2 담당자 상태 카드 컴포넌트

#### 기본 정보
- 이름 + 부서
- 현재 상태 (이모지 + 텍스트)
- 현재 작업 이름
- 예상 완료 시간

#### 블로킹 상태
- 블로킹 이유 (있으면 표시)
- 필요 정보
- 블로킹 시작 시간

#### 액션 버튼
- 📝 상태 업데이트
- 🔔 알림 설정
- 📊 상세 보기

### 3.3 활동 로그 페이지 (`/dashboard/team-status/activity`)

```
┌─────────────────────────────────────────────────────┐
│  활동 로그                      [필터] [다운로드]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [상태별 필터: 전체 ▼] [담당자별: 전체 ▼]            │
│                                                     │
│  타임라인                                           │
│  ────────────────────────────────────────────────  │
│                                                     │
│  2026-05-14 15:30  |  김철수: 진행중 → 완료         │
│                    |  작업: "JIG 검사 결과 리포트"   │
│                                                     │
│  2026-05-14 14:15  |  이영희: 유휴 → 대기          │
│                    |  이유: "성형기 검사 데이터 대기" │
│                    |  필요: SAP ECC 추출본         │
│                    |  ▶ [해결됨] (2026-05-14 15:00)│
│                                                     │
│  2026-05-14 10:30  |  박준호: 진행중 → 진행중       │
│                    |  작업: "BOM 입고 데이터 정리"   │
│                    |  ETA: 2026-05-16 14:00       │
│                                                     │
│  ... (더 많은 로그)                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.4 상태 업데이트 모달

```
┌─────────────────────────────┐
│  상태 업데이트              │
├─────────────────────────────┤
│                             │
│  담당자: 이영희 (기술팀)     │
│                             │
│  현재 상태: 🟡 대기         │
│                             │
│  새 상태:                    │
│  ○ 🟢 진행중               │
│  ● 🟡 대기                 │
│  ○ ⏸️  유휴                │
│  ○ ✅ 완료                 │
│                             │
│  현재 작업:                  │
│  [입력 필드]                │
│                             │
│  예상 완료 시간:            │
│  [날짜/시간 선택]          │
│                             │
│  블로킹 이유 (선택):        │
│  □ 데이터 전달 대기        │
│  □ 리뷰 대기               │
│  □ 환경 문제               │
│  □ 기타: [입력 필드]       │
│                             │
│  필요 정보:                 │
│  [입력 필드]               │
│                             │
│  [취소] [저장]             │
│                             │
└─────────────────────────────┘
```

### 3.5 상세 보기 페이지 (`/dashboard/team-status/[memberId]`)

```
┌─────────────────────────────────────────────────────┐
│  ◄ 김철수 상세 정보                [편집] [닫기]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  👤 기본 정보                                       │
│  ├─ 이름: 김철수                                   │
│  ├─ 부서: 생산팀                                   │
│  ├─ 직급: 엔지니어                                 │
│  └─ 이메일: kim.chulsu@dsc.com                    │
│                                                     │
│  📊 현재 상태                                       │
│  ├─ 상태: 🟢 진행중 (지난 3시간 5분)              │
│  ├─ 작업: BOM 입고 데이터 정리                      │
│  ├─ 우선순위: 높음                                 │
│  ├─ 예상 완료: 2026-05-16 14:00 (1일 23시간 후)   │
│  └─ 진행률: [████████░░] 80%                      │
│                                                     │
│  🚫 블로킹 (없음)                                   │
│                                                     │
│  📝 최근 활동                                       │
│  2026-05-14 15:30  진행중 → 완료  (작업 1)       │
│  2026-05-14 14:00  진행중         ETA 연장       │
│  2026-05-14 10:30  유휴 → 진행중 (작업 2 할당)   │
│                                                     │
│  🔔 알림 설정                                       │
│  □ 상태 변경 시 알림                              │
│  □ ETA 초과 시 알림                               │
│  □ 블로킹 발생 시 알림                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 4. 주요 기능 명세

### 4.1 상태 업데이트 흐름

1. 사용자가 상태 카드의 "📝 업데이트" 버튼 클릭
2. 모달 열기 (현재 상태, 새 상태, 작업명, ETA, 블로킹 이유)
3. API 호출: `POST /api/team/status-updates`
4. DB에 기록: `team_status_updates`, `team_task_assignments`, `team_blocking_reasons`
5. Realtime 푸시: 관련 모든 사용자에게 실시간 알림
6. 모달 닫기 및 대시보드 갱신

### 4.2 블로킹 추적

1. 상태를 "대기"로 변경할 때 블로킹 이유 + 필요 정보 입력
2. DB: `team_blocking_reasons` 테이블에 `blocked_since` 기록
3. 다시 "진행중" 또는 다른 상태로 변경하면 `resolved_at` + `resolved_by` 기록
4. 대시보드에서 블로킹 시간 계산 및 표시
5. 활동 로그에서 블로킹 해결 시간 추적

### 4.3 필터링

- **상태별**: 쿼리 파라미터 `status=진행중&status=대기` 지원
- **담당자별**: `member_id=uuid` 또는 `department=생산`
- **날짜별**: `from=2026-05-10&to=2026-05-14`

### 4.4 실시간 업데이트

- Supabase Realtime으로 `team_status_updates` 테이블 구독
- 상태 변경 시 모든 접속 사용자에게 실시간 푸시
- 대시보드 자동 갱신

---

## 5. 컴포넌트 아키텍처

### 5.1 페이지
- `app/dashboard/team-status/page.tsx` - 메인 대시보드
- `app/dashboard/team-status/activity/page.tsx` - 활동 로그
- `app/dashboard/team-status/[memberId]/page.tsx` - 상세 보기

### 5.2 컴포넌트
- `components/team/TeamStatusCard.tsx` - 담당자 상태 카드
- `components/team/TeamStatusSummary.tsx` - 상태 요약 (4개 박스)
- `components/team/TeamStatusFilters.tsx` - 필터 바
- `components/team/StatusUpdateModal.tsx` - 상태 업데이트 모달
- `components/team/ActivityTimeline.tsx` - 활동 로그 타임라인
- `components/team/MemberDetailView.tsx` - 상세 보기

### 5.3 훅 (Custom Hooks)
- `hooks/useTeamStatus.ts` - 팀 상태 조회 + Realtime 구독
- `hooks/useTeamFilters.ts` - 필터 상태 관리
- `hooks/useStatusUpdate.ts` - 상태 업데이트 로직

### 5.4 API Routes
- `app/api/team/members/route.ts` - GET 팀원 목록
- `app/api/team/status-updates/route.ts` - POST 상태 업데이트, GET 로그
- `app/api/team/blocking-reasons/route.ts` - GET/POST 블로킹 정보
- `app/api/team/task-assignments/route.ts` - GET/POST 작업 할당
- `app/api/team/metrics/route.ts` - GET 일일 메트릭

---

## 6. 데이터 흐름 다이어그램

```
Frontend                    API Layer               Supabase
─────────────────────────────────────────────────────────────

[Dashboard] ──┐
              ├─→ GET /api/team/members
              ├─→ GET /api/team/status-updates  ──→ [DB Query]
              ├─→ Realtime Subscribe              ──→ [Realtime]
              │
[Status Card] ──→ POST /api/team/status-updates ──→ [Insert]
              │                                      ├─ team_status_updates
              │                                      ├─ team_task_assignments
              │                                      └─ team_blocking_reasons
              │
[Status Modal] ──→ POST /api/team/status-updates ──→ [Broadcast to all clients]
              │
[Activity Log] ──→ GET /api/team/status-updates?filter ──→ [DB Query with filters]
```

---

## 7. RLS (Row Level Security) 정책

### 팀원 기본 정보 조회
```sql
-- 모든 활성 팀원은 다른 팀원 정보 조회 가능
CREATE POLICY "Select active team members" 
  ON team_members FOR SELECT
  USING (is_active = true);

-- 자신의 정보는 수정 가능
CREATE POLICY "Update own info"
  ON team_members FOR UPDATE
  USING (auth.uid() = id);
```

### 상태 업데이트 권한
```sql
-- 자신의 상태만 업데이트
CREATE POLICY "Update own status"
  ON team_status_updates FOR INSERT
  WITH CHECK (auth.uid() = team_member_id);

-- 모든 팀원은 다른 사람의 상태 업데이트 보기 가능
CREATE POLICY "View all status updates"
  ON team_status_updates FOR SELECT
  USING (true);
```

---

## 8. 성능 최적화

### 인덱싱
- `team_status_updates(team_member_id, created_at DESC)` - 담당자별 최근 로그 조회
- `team_blocking_reasons(team_member_id, resolved_at)` - 미해결 블로킹만 조회
- `team_task_assignments(team_member_id, status, expected_completion_at)` - 진행중 작업 조회

### 캐싱
- 팀원 목록: 5분 TTL (거의 변하지 않음)
- 상태 요약: 1분 TTL (자주 변함)
- 활동 로그: Realtime으로 실시간 업데이트

### 페이지 로드
- 대시보드: 초기 20개 카드 로드, 스크롤 시 무한 스크롤
- 활동 로그: 최근 50개 이벤트, 페이지네이션

---

## 9. 배포 및 환경 변수

### 필수 환경 변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Vercel 배포
- 자동 배포: main 브랜치 push 시
- 미리보기: PR 생성 시

---

## 10. 개발 일정 (예상)

| 단계 | 기간 | 담당 |
|------|------|------|
| DB 마이그레이션 | 1-2일 | Web Builder |
| API 구현 (5 endpoints) | 3-4일 | Web Builder |
| Frontend 컴포넌트 | 3-4일 | Web Builder |
| Realtime 통합 | 1-2일 | Web Builder |
| 테스트 & 버그 수정 | 2-3일 | Evaluator |
| 배포 | 1일 | Web Builder |
| **총 예상 기간** | **10-15일** | |

**예상 완료**: 2026-05-29

---

## 11. 체크리스트 (웹 개발자용)

- [ ] DB 스키마 생성 (`db/24_team_status_dashboard.sql`)
- [ ] RLS 정책 설정
- [ ] API 라우트 5개 구현
- [ ] useTeamStatus 훅 작성
- [ ] useTeamFilters 훅 작성
- [ ] TeamStatusCard 컴포넌트 개발
- [ ] TeamStatusSummary 컴포넌트 개발
- [ ] TeamStatusFilters 컴포넌트 개발
- [ ] StatusUpdateModal 컴포넌트 개발
- [ ] ActivityTimeline 컴포넌트 개발
- [ ] 메인 대시보드 페이지 구성
- [ ] 활동 로그 페이지 구성
- [ ] 상세 보기 페이지 구성
- [ ] Realtime 구독 테스트
- [ ] 필터링 기능 테스트
- [ ] 모바일 반응형 확인
- [ ] 배포 및 QA

---

## 12. 문서 참고

- [Next.js 14 Docs](https://nextjs.org/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
