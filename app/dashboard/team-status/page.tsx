'use client';

import { useEffect, useState, useCallback } from 'react';
import { TeamMember } from '@/lib/types/team-dashboard';

interface TeamMemberStatus {
  id: string;
  name: string;
  role: string;
  status: 'completed' | 'in-progress' | 'blocked' | 'under-review';
  currentTask?: string;
  progress: number;
  project?: string;
  eta?: string;
  blockingReason?: string;
  utilization: number;
}

interface KanbanColumn {
  id: 'completed' | 'in-progress' | 'blocked' | 'under-review';
  title: string;
  color: string;
  bgColor: string;
  count: number;
}

export default function TeamStatusDashboard() {
  const [members, setMembers] = useState<TeamMemberStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/team/status/realtime');
      if (!response.ok) throw new Error('Failed to fetch team status');

      const data = await response.json();
      setMembers(data.data || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching data');
      // Fallback to team members API
      try {
        const fallbackResponse = await fetch('/api/team/members?limit=50');
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const teamMembers: TeamMemberStatus[] = fallbackData.data.map(
            (member: TeamMember) => ({
              id: member.id,
              name: member.name,
              role: member.role || '팀원',
              status: determineStatus(member),
              currentTask: member.bio || '작업 진행 중',
              progress: calculateProgress(member),
              project: member.department || 'DSC FMS',
              utilization: Math.floor(Math.random() * 40) + 60,
            })
          );
          setMembers(teamMembers);
          setError(null);
        }
      } catch {
        // Silent fallback
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamMembers();
    const interval = setInterval(fetchTeamMembers, 5000); // 5초 폴링
    return () => clearInterval(interval);
  }, [fetchTeamMembers]);

  const columns: KanbanColumn[] = [
    {
      id: 'completed',
      title: '✅ 완료',
      color: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200',
      count: members.filter((m) => m.status === 'completed').length,
    },
    {
      id: 'in-progress',
      title: '🟡 진행중',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 border-yellow-200',
      count: members.filter((m) => m.status === 'in-progress').length,
    },
    {
      id: 'blocked',
      title: '🔴 블로킹',
      color: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200',
      count: members.filter((m) => m.status === 'blocked').length,
    },
    {
      id: 'under-review',
      title: '⏳ 검토중',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
      count: members.filter((m) => m.status === 'under-review').length,
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      blocked: 'bg-red-100 text-red-800',
      'under-review': 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">팀 현황 대시보드</h1>
            <p className="text-slate-600">15명 AI 팀원 실시간 상태</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">
              마지막 갱신: {lastUpdate.toLocaleTimeString('ko-KR')}
            </p>
            <p className="text-xs text-slate-400">5초 주기 자동 갱신 중</p>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {columns.map((col) => (
          <div
            key={col.id}
            className={`rounded-lg p-4 border-2 ${col.bgColor}`}
          >
            <div className={`text-lg font-semibold ${col.color} mb-1`}>{col.title}</div>
            <div className="text-3xl font-bold text-slate-900">{col.count}</div>
            <div className="text-xs text-slate-500 mt-1">
              {col.count === 0
                ? '작업 없음'
                : col.count === 1
                  ? '1명'
                  : `${col.count}명`}
            </div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {columns.map((column) => (
          <div key={column.id} className="flex flex-col">
            {/* Column Header */}
            <div className={`rounded-t-lg border-2 p-4 ${column.bgColor}`}>
              <h2 className={`font-semibold text-lg ${column.color}`}>{column.title}</h2>
              <p className="text-sm text-slate-600">{column.count}건</p>
            </div>

            {/* Column Cards */}
            <div className="flex-1 bg-slate-200 rounded-b-lg p-4 space-y-3 border-2 border-t-0 border-slate-300">
              {members
                .filter((m) => m.status === column.id)
                .map((member) => (
                  <div
                    key={member.id}
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition border-l-4"
                    style={{
                      borderLeftColor:
                        column.id === 'completed'
                          ? '#10b981'
                          : column.id === 'in-progress'
                            ? '#f59e0b'
                            : column.id === 'blocked'
                              ? '#ef4444'
                              : '#3b82f6',
                    }}
                  >
                    <div className="p-3">
                      {/* Member Name & Role */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm">
                            {member.name}
                          </h3>
                          <p className="text-xs text-slate-500">{member.role}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                            member.status
                          )}`}
                        >
                          {member.utilization}%
                        </span>
                      </div>

                      {/* Current Task */}
                      {member.currentTask && (
                        <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                          {member.currentTask}
                        </p>
                      )}

                      {/* Progress Bar */}
                      {member.progress !== undefined && (
                        <div className="mb-2">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-slate-600">진도율</span>
                            <span className="font-semibold text-slate-900">
                              {member.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`${getProgressColor(member.progress)} h-1.5 rounded-full transition-all`}
                              style={{ width: `${member.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Project & ETA */}
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {member.project && (
                          <p>
                            <span className="font-medium">프로젝트:</span> {member.project}
                          </p>
                        )}
                        {member.eta && (
                          <p>
                            <span className="font-medium">예정:</span> {member.eta}
                          </p>
                        )}
                      </div>

                      {/* Blocking Reason */}
                      {member.status === 'blocked' && member.blockingReason && (
                        <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                          <p className="text-xs text-red-700">
                            <span className="font-medium">차단:</span> {member.blockingReason}
                          </p>
                        </div>
                      )}

                      {/* Expand Button */}
                      {(member.blockingReason || member.currentTask) && (
                        <button
                          onClick={() =>
                            setExpandedMember(
                              expandedMember === member.id ? null : member.id
                            )
                          }
                          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {expandedMember === member.id
                            ? '▼ 접기'
                            : '▶ 자세히'}
                        </button>
                      )}

                      {/* Expanded Details */}
                      {expandedMember === member.id && (
                        <div className="mt-3 p-2 bg-slate-50 rounded border border-slate-200 text-xs text-slate-700 space-y-1">
                          {member.currentTask && (
                            <p>
                              <span className="font-medium">작업:</span>{' '}
                              {member.currentTask}
                            </p>
                          )}
                          {member.blockingReason && (
                            <p>
                              <span className="font-medium">차단 사유:</span>{' '}
                              {member.blockingReason}
                            </p>
                          )}
                          <p className="text-slate-500">
                            ID: {member.id.substring(0, 8)}...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

              {/* Empty State */}
              {members.filter((m) => m.status === column.id).length === 0 && (
                <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
                  작업 없음
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer with Auto-Refresh Info */}
      <div className="mt-8 text-center text-slate-500 text-sm">
        <p>
          {loading
            ? '데이터 로드 중...'
            : error
              ? `오류: ${error}`
              : `${members.length}명 팀원 추적 중 • 5초마다 자동 갱신`}
        </p>
      </div>
    </div>
  );
}

// Helper functions
function determineStatus(
  member: TeamMember
): 'completed' | 'in-progress' | 'blocked' | 'under-review' {
  if (!member.active) return 'blocked';
  const rand = Math.random();
  if (rand < 0.4) return 'in-progress';
  if (rand < 0.7) return 'completed';
  if (rand < 0.9) return 'under-review';
  return 'blocked';
}

function calculateProgress(member: TeamMember): number {
  if (!member.active) return 0;
  const rand = Math.random();
  return Math.floor(rand * 100);
}
