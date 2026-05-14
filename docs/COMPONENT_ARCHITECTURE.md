# 팀 현황판 컴포넌트 아키텍처

## 📐 폴더 구조

```
app/
├── dashboard/
│   └── team-status/
│       ├── layout.tsx                    (공통 레이아웃)
│       ├── page.tsx                      (메인 대시보드)
│       ├── activity/
│       │   └── page.tsx                  (활동 로그)
│       └── [memberId]/
│           └── page.tsx                  (상세 보기)

components/
├── team/
│   ├── TeamStatusCard.tsx                (담당자 카드)
│   ├── TeamStatusSummary.tsx             (상태 요약)
│   ├── TeamStatusFilters.tsx             (필터 바)
│   ├── StatusUpdateModal.tsx             (모달)
│   ├── ActivityTimeline.tsx              (타임라인)
│   ├── MemberDetailView.tsx              (상세 보기)
│   └── StatusBadge.tsx                   (상태 배지)

hooks/
├── useTeamStatus.ts                      (상태 + Realtime)
├── useTeamFilters.ts                     (필터 관리)
└── useStatusUpdate.ts                    (업데이트 로직)

lib/
├── supabase/
│   ├── client.ts
│   └── server.ts
└── api/
    └── team-api.ts                       (API 클라이언트)

types/
└── team.ts                               (TypeScript 정의)
```

---

## 🎯 페이지별 구조

### 1. 메인 대시보드 (`app/dashboard/team-status/page.tsx`)

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useTeamStatus } from '@/hooks/useTeamStatus';
import { useTeamFilters } from '@/hooks/useTeamFilters';
import TeamStatusSummary from '@/components/team/TeamStatusSummary';
import TeamStatusFilters from '@/components/team/TeamStatusFilters';
import TeamStatusCardList from '@/components/team/TeamStatusCardList';

export default function TeamStatusPage() {
  const { members, statusUpdates, blockingReasons, loading } = useTeamStatus();
  const { filters, setFilters } = useTeamFilters();

  // 필터링된 팀원 목록
  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      if (filters.status && !statusOfMember(member.id)?.includes(filters.status)) return false;
      if (filters.department && member.department !== filters.department) return false;
      return true;
    });
  }, [members, filters]);

  // 상태별 요약 계산
  const summary = {
    total: members.length,
    inProgress: filteredMembers.filter(m => getCurrentStatus(m.id) === '진행중').length,
    waiting: filteredMembers.filter(m => getCurrentStatus(m.id) === '대기').length,
    idle: filteredMembers.filter(m => getCurrentStatus(m.id) === '유휴').length,
    completed: filteredMembers.filter(m => getCurrentStatus(m.id) === '완료').length,
  };

  if (loading) return <LoadingSpinner />;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">팀 현황판</h1>
          <a href="/dashboard/team-status/activity" className="text-blue-600">
            📊 활동 로그
          </a>
        </div>

        {/* 상태 요약 */}
        <TeamStatusSummary summary={summary} filters={filters} />

        {/* 필터 바 */}
        <TeamStatusFilters
          filters={filters}
          onFilterChange={setFilters}
          departments={[...new Set(members.map(m => m.department))]}
        />

        {/* 카드 목록 */}
        <TeamStatusCardList
          members={filteredMembers}
          blockingReasons={blockingReasons}
          onRefresh={() => {}}
        />
      </div>
    </main>
  );
}
```

### 2. 활동 로그 페이지 (`app/dashboard/team-status/activity/page.tsx`)

```typescript
'use client';

import { useState, useEffect } from 'react';
import ActivityTimeline from '@/components/team/ActivityTimeline';

export default function ActivityPage() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    memberId: null,
    status: null,
    from: null,
    to: null,
  });
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [filters, page]);

  const fetchLogs = async () => {
    const params = new URLSearchParams();
    if (filters.memberId) params.append('member_id', filters.memberId);
    if (filters.status) params.append('status', filters.status);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    params.append('limit', '50');
    params.append('offset', String(page * 50));

    const res = await fetch(`/api/team/status-updates?${params}`);
    const { data } = await res.json();
    setLogs(data);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">활동 로그</h1>

        {/* 필터 */}
        <div className="mb-6 flex gap-4">
          <input
            type="date"
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            type="date"
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
          <select onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">모든 상태</option>
            <option value="진행중">진행중</option>
            <option value="대기">대기</option>
            <option value="완료">완료</option>
            <option value="유휴">유휴</option>
          </select>
        </div>

        {/* 타임라인 */}
        <ActivityTimeline logs={logs} />

        {/* 페이지네이션 */}
        <div className="mt-8 flex justify-center gap-4">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
            ← 이전
          </button>
          <span>페이지 {page + 1}</span>
          <button onClick={() => setPage(page + 1)}>
            다음 →
          </button>
        </div>
      </div>
    </main>
  );
}
```

### 3. 상세 보기 페이지 (`app/dashboard/team-status/[memberId]/page.tsx`)

```typescript
'use client';

import { useState, useEffect } from 'react';
import MemberDetailView from '@/components/team/MemberDetailView';

export default function MemberDetailPage({ params }: { params: { memberId: string } }) {
  const [member, setMember] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchMemberData();
  }, [params.memberId]);

  const fetchMemberData = async () => {
    const memberRes = await fetch(`/api/team/members?id=${params.memberId}`);
    const memberData = await memberRes.json();
    setMember(memberData.data[0]);

    const logsRes = await fetch(
      `/api/team/status-updates?member_id=${params.memberId}&limit=100`
    );
    const logsData = await logsRes.json();
    setLogs(logsData.data);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <a href="/dashboard/team-status" className="text-blue-600 mb-4">
          ← 뒤로 가기
        </a>

        {member && <MemberDetailView member={member} logs={logs} />}
      </div>
    </main>
  );
}
```

---

## 🧩 컴포넌트 상세 명세

### TeamStatusCard.tsx

```typescript
interface TeamStatusCardProps {
  member: {
    id: string;
    name: string;
    department: string;
    role: string;
  };
  currentStatus: '진행중' | '대등' | '완료' | '유휴';
  currentTask?: string;
  eta?: string;
  blocking?: {
    reason: string;
    requiredInfo: string;
    blockedSince: string;
  };
  onUpdate: () => void;
}

export default function TeamStatusCard({
  member,
  currentStatus,
  currentTask,
  eta,
  blocking,
  onUpdate,
}: TeamStatusCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const statusConfig = {
    진행중: { emoji: '🟢', color: 'bg-green-50', textColor: 'text-green-700' },
    대기: { emoji: '🟡', color: 'bg-yellow-50', textColor: 'text-yellow-700' },
    완료: { emoji: '✅', color: 'bg-blue-50', textColor: 'text-blue-700' },
    유휴: { emoji: '⏸️', color: 'bg-gray-50', textColor: 'text-gray-700' },
  };

  const config = statusConfig[currentStatus];

  return (
    <>
      <div className={`${config.color} rounded-lg p-4 border border-gray-200`}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-bold text-lg">{member.name}</h3>
            <p className="text-sm text-gray-600">{member.department}</p>
          </div>
          <span className={`${config.textColor} font-bold`}>
            {config.emoji} {currentStatus}
          </span>
        </div>

        {currentTask && (
          <p className="text-sm mb-2">
            <strong>작업:</strong> {currentTask}
          </p>
        )}

        {eta && (
          <p className="text-sm mb-2">
            <strong>ETA:</strong> {new Date(eta).toLocaleString('ko-KR')}
          </p>
        )}

        {blocking && (
          <div className="bg-red-100 border border-red-300 rounded p-2 mb-3 text-sm">
            <p>🚫 <strong>{blocking.reason}</strong></p>
            <p className="text-gray-700">필요: {blocking.requiredInfo}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            📝 업데이트
          </button>
          <button className="flex-1 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400">
            → 상세보기
          </button>
        </div>
      </div>

      {isModalOpen && (
        <StatusUpdateModal
          member={member}
          onClose={() => setIsModalOpen(false)}
          onUpdate={async () => {
            onUpdate();
            setIsModalOpen(false);
          }}
        />
      )}
    </>
  );
}
```

### StatusUpdateModal.tsx

```typescript
interface StatusUpdateModalProps {
  member: { id: string; name: string };
  onClose: () => void;
  onUpdate: (data: StatusUpdatePayload) => Promise<void>;
}

export default function StatusUpdateModal({
  member,
  onClose,
  onUpdate,
}: StatusUpdateModalProps) {
  const [formData, setFormData] = useState({
    new_status: '진행중',
    task_name: '',
    expected_completion_at: '',
    blocking_reason: '',
    required_info: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onUpdate({
        team_member_id: member.id,
        ...formData,
      });

      // 토스트 알림
      alert('상태가 업데이트되었습니다');
      onClose();
    } catch (error) {
      alert('오류가 발생했습니다');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">상태 업데이트</h2>
        <p className="text-gray-600 mb-4">{member.name}</p>

        <form onSubmit={handleSubmit}>
          {/* 새 상태 */}
          <div className="mb-4">
            <label className="block font-bold mb-2">새 상태</label>
            <div className="flex gap-2">
              {['진행중', '대기', '완료', '유휴'].map((status) => (
                <label key={status} className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value={status}
                    checked={formData.new_status === status}
                    onChange={(e) =>
                      setFormData({ ...formData, new_status: e.target.value })
                    }
                  />
                  <span className="ml-2">{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 작업명 */}
          <div className="mb-4">
            <label className="block font-bold mb-2">작업명</label>
            <input
              type="text"
              value={formData.task_name}
              onChange={(e) =>
                setFormData({ ...formData, task_name: e.target.value })
              }
              className="w-full border rounded px-2 py-1"
              placeholder="BOM 입고 데이터 정리"
            />
          </div>

          {/* ETA */}
          <div className="mb-4">
            <label className="block font-bold mb-2">예상 완료 시간</label>
            <input
              type="datetime-local"
              value={formData.expected_completion_at}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expected_completion_at: e.target.value,
                })
              }
              className="w-full border rounded px-2 py-1"
            />
          </div>

          {/* 블로킹 (대기 상태인 경우만) */}
          {formData.new_status === '대기' && (
            <>
              <div className="mb-4">
                <label className="block font-bold mb-2">블로킹 이유</label>
                <input
                  type="text"
                  value={formData.blocking_reason}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      blocking_reason: e.target.value,
                    })
                  }
                  className="w-full border rounded px-2 py-1"
                  placeholder="데이터 전달 대기"
                />
              </div>

              <div className="mb-4">
                <label className="block font-bold mb-2">필요 정보</label>
                <input
                  type="text"
                  value={formData.required_info}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      required_info: e.target.value,
                    })
                  }
                  className="w-full border rounded px-2 py-1"
                  placeholder="SAP ECC 추출본"
                />
              </div>
            </>
          )}

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-800 py-2 rounded"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded"
              disabled={loading}
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 🪝 Custom Hooks

### useTeamStatus.ts

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useTeamStatus() {
  const [members, setMembers] = useState([]);
  const [statusUpdates, setStatusUpdates] = useState([]);
  const [blockingReasons, setBlockingReasons] = useState([]);
  const [loading, setLoading] = useState(true);

  // 초기 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [membersRes, statusRes, blockingRes] = await Promise.all([
          fetch('/api/team/members'),
          fetch('/api/team/status-updates?limit=1000'),
          fetch('/api/team/blocking-reasons'),
        ]);

        const members = await membersRes.json();
        const status = await statusRes.json();
        const blocking = await blockingRes.json();

        setMembers(members.data);
        setStatusUpdates(status.data);
        setBlockingReasons(blocking.data);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Realtime 구독
  useEffect(() => {
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    members,
    statusUpdates,
    blockingReasons,
    loading,
  };
}
```

### useTeamFilters.ts

```typescript
import { useState } from 'react';

export function useTeamFilters() {
  const [filters, setFilters] = useState({
    status: null,
    department: null,
    from: null,
    to: null,
  });

  const updateFilter = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return { filters, setFilters: updateFilter };
}
```

---

## 📝 TypeScript 타입 정의

### types/team.ts

```typescript
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  department: '생산' | '기술' | '보전' | '생산관리';
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StatusUpdate {
  id: string;
  team_member_id: string;
  team_member_name: string;
  previous_status: StatusType | null;
  new_status: StatusType;
  reason?: string;
  updated_by?: string;
  updated_by_name?: string;
  created_at: string;
}

export type StatusType = '진행중' | '대기' | '완료' | '유휴';

export interface BlockingReason {
  id: string;
  team_member_id: string;
  team_member_name: string;
  blocking_reason: string;
  required_info?: string;
  blocked_since: string;
  blocking_duration_minutes?: number;
  resolved_at?: string;
  resolved_by?: string;
}

export interface TaskAssignment {
  id: string;
  team_member_id: string;
  task_name: string;
  description?: string;
  assigned_at: string;
  expected_completion_at?: string;
  actual_completion_at?: string;
  priority: 'lowness' | 'normal' | 'high';
  status: '진행중' | '완료';
  assigned_by?: string;
  created_at: string;
  updated_at: string;
}
```

---

## 🎨 스타일 가이드

### Tailwind CSS 클래스 규칙

```typescript
// 상태별 배색
const statusStyles = {
  진행중: 'bg-green-50 border-green-300 text-green-700',
  대기: 'bg-yellow-50 border-yellow-300 text-yellow-700',
  완료: 'bg-blue-50 border-blue-300 text-blue-700',
  유휴: 'bg-gray-50 border-gray-300 text-gray-700',
};

// 버튼
const buttonStyles = {
  primary: 'bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700',
  secondary: 'bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400',
  danger: 'bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700',
};
```

---

## 🧪 테스트 전략

### 단위 테스트 (useTeamStatus)
```typescript
describe('useTeamStatus', () => {
  it('should load members on mount', async () => {
    const { result } = renderHook(() => useTeamStatus());
    
    await waitFor(() => {
      expect(result.current.members.length).toBeGreaterThan(0);
    });
  });

  it('should subscribe to realtime updates', async () => {
    const { result } = renderHook(() => useTeamStatus());
    
    // Realtime 이벤트 시뮬레이션
    // 상태 업데이트 확인
  });
});
```

---

**버전:** 1.0  
**작성일:** 2026-05-14  
**대상:** 웹 개발자 (Web Builder)
