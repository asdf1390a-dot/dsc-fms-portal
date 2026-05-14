# 팀 현황판 API 구현 가이드

## 개요

팀 현황판 대시보드를 위한 5가지 API 엔드포인트 명세입니다. 모든 API는 Next.js App Router를 사용합니다.

## API 목록

1. `GET /api/team/members` - 팀원 목록 조회
2. `POST /api/team/status-updates` - 상태 업데이트 기록
3. `GET /api/team/status-updates` - 상태 업데이트 로그 조회 (필터 지원)
4. `GET /api/team/blocking-reasons` - 블로킹 정보 조회
5. `POST /api/team/task-assignments` - 작업 할당 (or 업데이트)

---

## 1. GET /api/team/members

팀원 목록을 조회합니다. 활성 팀원만 반환됩니다.

### 요청

```bash
GET /api/team/members?department=생산&is_active=true
```

### 쿼리 파라미터

| 파라미터 | 타입 | 설명 | 필수 |
|---------|------|------|------|
| `department` | string | 부서 필터 (생산/기술/보전/생산관리) | X |
| `is_active` | boolean | 활성 여부 필터 | X |

### 응답 성공 (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "김철수",
      "email": "kim.chulsu@dsc.com",
      "department": "생산",
      "role": "엔지니어",
      "is_active": true,
      "created_at": "2026-05-10T08:00:00Z",
      "updated_at": "2026-05-14T12:30:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "이영희",
      "email": "lee.younghee@dsc.com",
      "department": "기술",
      "role": "분석가",
      "is_active": true,
      "created_at": "2026-05-10T08:00:00Z",
      "updated_at": "2026-05-14T12:30:00Z"
    }
  ],
  "count": 2
}
```

### 응답 실패 (500 Server Error)

```json
{
  "success": false,
  "error": "팀원 목록 조회 중 오류가 발생했습니다"
}
```

### 구현 예시 (TypeScript)

```typescript
// app/api/team/members/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    const department = searchParams.get('department');
    const is_active = searchParams.get('is_active') === 'true';

    let query = supabase
      .from('team_members')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (department) {
      query = query.eq('department', department);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      { success: false, error: '팀원 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

---

## 2. POST /api/team/status-updates

팀원의 상태를 업데이트합니다.

### 요청

```bash
POST /api/team/status-updates
Content-Type: application/json

{
  "team_member_id": "550e8400-e29b-41d4-a716-446655440000",
  "new_status": "진행중",
  "previous_status": "대기",
  "reason": "BOM 입고 데이터 정리 시작",
  "task_name": "BOM 입고 데이터 정리",
  "expected_completion_at": "2026-05-16T14:00:00Z",
  "blocking_reason": null,
  "required_info": null
}
```

### 요청 본문

| 필드 | 타입 | 설명 | 필수 |
|------|------|------|------|
| `team_member_id` | UUID | 팀원 ID | O |
| `new_status` | string | 새 상태 (진행중/대기/완료/유휴) | O |
| `previous_status` | string | 이전 상태 | X |
| `reason` | string | 변경 사유 | X |
| `task_name` | string | 작업명 | X |
| `expected_completion_at` | ISO8601 | 예상 완료 시간 | X |
| `blocking_reason` | string | 블로킹 이유 (status=대기일 때) | X |
| `required_info` | string | 필요 정보 (status=대기일 때) | X |

### 응답 성공 (201 Created)

```json
{
  "success": true,
  "data": {
    "status_update_id": "550e8400-e29b-41d4-a716-446655440010",
    "team_member_id": "550e8400-e29b-41d4-a716-446655440000",
    "new_status": "진행중",
    "previous_status": "대기",
    "created_at": "2026-05-14T15:30:00Z",
    "task_assignment_id": "550e8400-e29b-41d4-a716-446655440020"
  },
  "message": "상태가 성공적으로 업데이트되었습니다"
}
```

### 응답 실패 (400 Bad Request)

```json
{
  "success": false,
  "error": "유효하지 않은 상태입니다. (진행중/대기/완료/유휴 중 선택)",
  "code": "INVALID_STATUS"
}
```

### 구현 예시 (TypeScript)

```typescript
// app/api/team/status-updates/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const VALID_STATUSES = ['진행중', '대기', '완료', '유휴'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      team_member_id,
      new_status,
      previous_status,
      reason,
      task_name,
      expected_completion_at,
      blocking_reason,
      required_info,
    } = await request.json();

    // 유효성 검사
    if (!team_member_id || !new_status) {
      return NextResponse.json(
        {
          success: false,
          error: '필수 필드가 누락되었습니다',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(new_status)) {
      return NextResponse.json(
        {
          success: false,
          error: `유효하지 않은 상태입니다. (${VALID_STATUSES.join('/')})`,
          code: 'INVALID_STATUS',
        },
        { status: 400 }
      );
    }

    // 상태 업데이트 기록
    const { data: statusUpdate, error: statusError } = await supabase
      .from('team_status_updates')
      .insert([
        {
          team_member_id,
          previous_status,
          new_status,
          reason,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        },
      ])
      .select()
      .single();

    if (statusError) throw statusError;

    // 작업 할당 기록 (task_name이 있으면)
    let task_assignment_id = null;
    if (task_name) {
      const { data: taskAssignment, error: taskError } = await supabase
        .from('team_task_assignments')
        .insert([
          {
            team_member_id,
            task_name,
            expected_completion_at,
            status: new_status === '완료' ? '완료' : '진행중',
            assigned_by: (await supabase.auth.getUser()).data.user?.id,
          },
        ])
        .select()
        .single();

      if (taskError) throw taskError;
      task_assignment_id = taskAssignment?.id;
    }

    // 블로킹 정보 기록 (새 상태가 대기이면)
    if (new_status === '대기' && blocking_reason) {
      const { error: blockingError } = await supabase
        .from('team_blocking_reasons')
        .insert([
          {
            team_member_id,
            blocking_reason,
            required_info,
          },
        ]);

      if (blockingError) throw blockingError;
    }

    // 이전 상태가 대기이고 새 상태가 다르면 해결 마크
    if (previous_status === '대기' && new_status !== '대기') {
      const { error: resolveError } = await supabase
        .from('team_blocking_reasons')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('team_member_id', team_member_id)
        .is('resolved_at', null);

      if (resolveError) throw resolveError;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          status_update_id: statusUpdate.id,
          team_member_id,
          new_status,
          previous_status,
          created_at: statusUpdate.created_at,
          task_assignment_id,
        },
        message: '상태가 성공적으로 업데이트되었습니다',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json(
      { success: false, error: '상태 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

---

## 3. GET /api/team/status-updates

상태 업데이트 로그를 조회합니다. 필터링 지원.

### 요청

```bash
GET /api/team/status-updates?member_id=550e8400-e29b-41d4-a716-446655440000&status=진행중&limit=50&offset=0&from=2026-05-10&to=2026-05-14
```

### 쿼리 파라미터

| 파라미터 | 타입 | 설명 | 필수 |
|---------|------|------|------|
| `member_id` | UUID | 팀원 ID 필터 | X |
| `status` | string | 상태 필터 (진행중/대기/완료/유휴) | X |
| `limit` | number | 반환 개수 (기본 50) | X |
| `offset` | number | 스킵할 개수 (기본 0) | X |
| `from` | ISO8601 | 시작 날짜 | X |
| `to` | ISO8601 | 종료 날짜 | X |

### 응답 성공 (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "team_member_id": "550e8400-e29b-41d4-a716-446655440000",
      "team_member_name": "김철수",
      "previous_status": "대기",
      "new_status": "완료",
      "reason": "BOM 입고 데이터 정리 완료",
      "updated_by": "550e8400-e29b-41d4-a716-446655440001",
      "updated_by_name": "이영희",
      "created_at": "2026-05-14T15:30:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440011",
      "team_member_id": "550e8400-e29b-41d4-a716-446655440001",
      "team_member_name": "이영희",
      "previous_status": "유휴",
      "new_status": "대기",
      "reason": "성형기 검사 결과 분석 대기",
      "updated_by": null,
      "updated_by_name": null,
      "created_at": "2026-05-14T14:15:00Z"
    }
  ],
  "count": 2,
  "total": 25
}
```

### 구현 예시 (TypeScript)

```typescript
// app/api/team/status-updates/route.ts (GET)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    const member_id = searchParams.get('member_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase
      .from('team_status_updates')
      .select(
        `
        id,
        team_member_id,
        team_members(name),
        previous_status,
        new_status,
        reason,
        updated_by,
        created_at
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (member_id) {
      query = query.eq('team_member_id', member_id);
    }

    if (status) {
      query = query.eq('new_status', status);
    }

    if (from) {
      query = query.gte('created_at', from);
    }

    if (to) {
      query = query.lte('created_at', to);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    // team_members 조인으로 이름 추가
    const enrichedData = await Promise.all(
      data.map(async (item: any) => {
        const updatedByUser = item.updated_by
          ? await supabase
              .from('team_members')
              .select('name')
              .eq('id', item.updated_by)
              .single()
          : null;

        return {
          ...item,
          team_member_name: item.team_members?.name,
          updated_by_name: updatedByUser?.data?.name,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedData,
      count: data.length,
      total: count,
    });
  } catch (error) {
    console.error('Error fetching status updates:', error);
    return NextResponse.json(
      { success: false, error: '로그 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

---

## 4. GET /api/team/blocking-reasons

현재 활성 블로킹 정보를 조회합니다.

### 요청

```bash
GET /api/team/blocking-reasons?member_id=550e8400-e29b-41d4-a716-446655440000&resolved=false
```

### 쿼리 파라미터

| 파라미터 | 타입 | 설명 | 필수 |
|---------|------|------|------|
| `member_id` | UUID | 팀원 ID 필터 | X |
| `resolved` | boolean | 미해결만 조회 (기본 false) | X |

### 응답 성공 (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "team_member_id": "550e8400-e29b-41d4-a716-446655440001",
      "team_member_name": "이영희",
      "blocking_reason": "성형기 검사 데이터 전달 대기",
      "required_info": "SAP ECC 추출본",
      "blocked_since": "2026-05-14T14:15:00Z",
      "blocking_duration_minutes": 75,
      "resolved_at": null,
      "resolved_by": null
    }
  ],
  "count": 1,
  "total_blocking_minutes": 75
}
```

### 구현 예시 (TypeScript)

```typescript
// app/api/team/blocking-reasons/route.ts
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    const member_id = searchParams.get('member_id');
    const resolved = searchParams.get('resolved') === 'true';

    let query = supabase
      .from('team_blocking_reasons')
      .select('*, team_members(name)', { count: 'exact' })
      .order('blocked_since', { ascending: false });

    if (member_id) {
      query = query.eq('team_member_id', member_id);
    }

    if (!resolved) {
      query = query.is('resolved_at', null);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const enrichedData = data.map((item: any) => {
      const blockedSince = new Date(item.blocked_since);
      const now = new Date();
      const durationMs = now.getTime() - blockedSince.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));

      return {
        ...item,
        team_member_name: item.team_members?.name,
        blocking_duration_minutes: durationMinutes,
      };
    });

    const totalBlockingMinutes = enrichedData.reduce(
      (sum: number, item: any) => sum + (item.blocking_duration_minutes || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: enrichedData,
      count: data.length,
      total: count,
      total_blocking_minutes: totalBlockingMinutes,
    });
  } catch (error) {
    console.error('Error fetching blocking reasons:', error);
    return NextResponse.json(
      { success: false, error: '블로킹 정보 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

---

## 5. POST /api/team/task-assignments

작업을 할당하거나 업데이트합니다.

### 요청 (작업 할당)

```bash
POST /api/team/task-assignments
Content-Type: application/json

{
  "team_member_id": "550e8400-e29b-41d4-a716-446655440000",
  "task_name": "JIG 검사 결과 리포트",
  "description": "정밀도 검사 결과를 종합 분석하여 리포트 작성",
  "expected_completion_at": "2026-05-15T17:00:00Z",
  "priority": "높음"
}
```

### 요청 본문

| 필드 | 타입 | 설명 | 필수 |
|------|------|------|------|
| `team_member_id` | UUID | 팀원 ID | O |
| `task_name` | string | 작업명 | O |
| `description` | string | 작업 설명 | X |
| `expected_completion_at` | ISO8601 | 예상 완료 시간 | X |
| `priority` | string | 우선순위 (낮음/보통/높음) | X |

### 응답 성공 (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "team_member_id": "550e8400-e29b-41d4-a716-446655440000",
    "task_name": "JIG 검사 결과 리포트",
    "status": "진행중",
    "priority": "높음",
    "expected_completion_at": "2026-05-15T17:00:00Z",
    "assigned_at": "2026-05-14T15:30:00Z",
    "created_at": "2026-05-14T15:30:00Z"
  },
  "message": "작업이 성공적으로 할당되었습니다"
}
```

### 구현 예시 (TypeScript)

```typescript
// app/api/team/task-assignments/route.ts
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      team_member_id,
      task_name,
      description,
      expected_completion_at,
      priority = 'normal',
    } = await request.json();

    if (!team_member_id || !task_name) {
      return NextResponse.json(
        {
          success: false,
          error: '필수 필드가 누락되었습니다',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('team_task_assignments')
      .insert([
        {
          team_member_id,
          task_name,
          description,
          expected_completion_at,
          priority,
          status: '진행중',
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        data,
        message: '작업이 성공적으로 할당되었습니다',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating task assignment:', error);
    return NextResponse.json(
      { success: false, error: '작업 할당 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

---

## 공통 사항

### 인증 (Authentication)

모든 API는 Supabase 세션을 통해 인증됩니다. 클라이언트는 유효한 JWT 토큰을 가져야 합니다.

```typescript
// app/api/middleware
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const {
  data: { user },
  error,
} = await supabase.auth.getUser();

if (error || !user) {
  return NextResponse.json(
    { success: false, error: '인증이 필요합니다' },
    { status: 401 }
  );
}
```

### 에러 처리

모든 API는 일관된 에러 응답 형식을 사용합니다:

```json
{
  "success": false,
  "error": "오류 메시지",
  "code": "ERROR_CODE",
  "details": {} // 선택사항
}
```

### 레이트 제한

- 분당 60요청 (추후 조정 가능)
- 시간당 1000요청

### 응답 시간

- 목표: 200ms 이하
- 모니터링: Vercel Analytics

---

## 프론트엔드 사용 예시

### React Hook (useTeamStatus)

```typescript
// hooks/useTeamStatus.ts
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useTeamStatus() {
  const [members, setMembers] = useState([]);
  const [statusUpdates, setStatusUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
    subscribeToStatusUpdates();
  }, []);

  const fetchMembers = async () => {
    const res = await fetch('/api/team/members');
    const { data } = await res.json();
    setMembers(data);
    setLoading(false);
  };

  const updateStatus = useCallback(async (payload) => {
    const res = await fetch('/api/team/status-updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }, []);

  const subscribeToStatusUpdates = () => {
    supabase
      .channel('team_status')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_status_updates',
        },
        (payload) => {
          setStatusUpdates((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();
  };

  return { members, statusUpdates, loading, updateStatus };
}
```

### 컴포넌트 (TeamStatusCard)

```typescript
// components/team/TeamStatusCard.tsx
export function TeamStatusCard({ member, onUpdate }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="card">
        <h3>{member.name}</h3>
        <p>Status: {member.current_status}</p>
        <button onClick={() => setIsModalOpen(true)}>업데이트</button>
      </div>

      {isModalOpen && (
        <StatusUpdateModal
          member={member}
          onUpdate={async (payload) => {
            await onUpdate(payload);
            setIsModalOpen(false);
          }}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
```

---

## 배포 체크리스트

- [ ] Supabase 마이그레이션 실행 (`db/24_team_status_dashboard.sql`)
- [ ] API 라우트 5개 모두 구현
- [ ] TypeScript 타입 정의 (types/team.ts)
- [ ] 에러 처리 및 로깅 추가
- [ ] 로컬 테스트 완료
- [ ] staging 환경 배포
- [ ] 성능 테스트 (응답 시간, 메모리 사용)
- [ ] 보안 검토 (RLS 정책, 인증 확인)
- [ ] 프로덕션 배포

---

## 테스트

```bash
# 팀원 목록 조회
curl -X GET http://localhost:3000/api/team/members

# 상태 업데이트
curl -X POST http://localhost:3000/api/team/status-updates \
  -H "Content-Type: application/json" \
  -d '{
    "team_member_id": "550e8400-e29b-41d4-a716-446655440000",
    "new_status": "진행중",
    "task_name": "테스트 작업"
  }'

# 상태 로그 조회
curl -X GET "http://localhost:3000/api/team/status-updates?limit=10"

# 블로킹 정보 조회
curl -X GET "http://localhost:3000/api/team/blocking-reasons"
```

---

**문서 버전:** 1.0  
**마지막 업데이트:** 2026-05-14  
**다음 검토:** 개발 중 수정사항 반영 후 1.1 버전 계획
