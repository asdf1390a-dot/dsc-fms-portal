'use client';

import { useEffect, useState } from 'react';

interface DashboardMetrics {
  completionRate: number;
  reliabilityScore: number;
  blockingItems: number;
  teamUtilization: number;
  activeProjects: number;
  teamMembers: number;
}

interface Project {
  id: string;
  name: string;
  status: 'completed' | 'in-progress' | 'blocked';
  progress: number;
  owner: string;
  eta?: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  utilization: number;
  currentTask?: string;
  status: 'active' | 'idle' | 'blocked';
}

export default function CEODashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    completionRate: 77.8,
    reliabilityScore: 97,
    blockingItems: 0,
    teamUtilization: 80,
    activeProjects: 7,
    teamMembers: 15,
  });

  const [projects, setProjects] = useState<Project[]>([
    { id: '1', name: 'Asset Master Phase 2 UI', status: 'completed', progress: 100, owner: 'Web Dev #1', eta: '2026-05-29' },
    { id: '2', name: 'Team Dashboard P1 API', status: 'completed', progress: 100, owner: 'Secretary AI', eta: '2026-05-30' },
    { id: '3', name: 'BM Phase 1', status: 'completed', progress: 100, owner: 'QA Specialist', eta: '2026-05-29' },
    { id: '4', name: 'Discord Bot Phase 1', status: 'completed', progress: 100, owner: 'Web Dev #1', eta: '2026-05-27' },
    { id: '5', name: 'Travel Phase 2 UI', status: 'completed', progress: 100, owner: 'Web Dev #1', eta: '2026-05-27' },
    { id: '6', name: 'Phase 2C (Trust Score)', status: 'completed', progress: 100, owner: 'Memory Specialist', eta: '2026-05-30' },
    { id: '7', name: 'Backup Phase 2 UI', status: 'in-progress', progress: 80, owner: 'Web Dev #1', eta: '2026-05-30' },
    { id: '8', name: 'Team Dashboard Phase 2 UI', status: 'in-progress', progress: 55, owner: 'Planner', eta: '2026-06-02' },
  ]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: '1', name: 'CEO (Kyeongtae)', role: '회장', utilization: 100, status: 'active', currentTask: 'Overall Strategy' },
    { id: '2', name: 'Web Dev #1', role: '웹개발자', utilization: 90, status: 'active', currentTask: 'Travel Phase 2' },
    { id: '3', name: 'Web Dev #2', role: '웹개발자', utilization: 85, status: 'active', currentTask: 'Team Dashboard' },
    { id: '4', name: 'Data Analyst', role: '데이터분석가', utilization: 75, status: 'active', currentTask: 'Weekly Reports' },
    { id: '5', name: 'Secretary AI', role: '비서', utilization: 100, status: 'active', currentTask: 'Coordination' },
    { id: '6', name: 'Translator', role: '번역가', utilization: 30, status: 'idle', currentTask: 'On Demand' },
    { id: '7', name: 'DevOps Engineer', role: '개발운영', utilization: 70, status: 'active', currentTask: 'Infrastructure' },
    { id: '8', name: 'QA Specialist', role: 'QA', utilization: 80, status: 'active', currentTask: 'Integration Testing' },
    { id: '9', name: 'Project Planner', role: '프로젝트관리', utilization: 85, status: 'active', currentTask: 'Cross-Project Coordination' },
    { id: '10', name: 'Memory Specialist', role: '메모리관리', utilization: 75, status: 'active', currentTask: 'Memory Phase 2B' },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Auto-refresh every 5 minutes
      setMetrics((prev) => ({
        ...prev,
        completionRate: Math.min(100, prev.completionRate + 0.5),
      }));
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      completed: { color: 'bg-green-100 text-green-800', label: '✅ 완료' },
      'in-progress': { color: 'bg-yellow-100 text-yellow-800', label: '🟡 진행중' },
      blocked: { color: 'bg-red-100 text-red-800', label: '🔴 대기' },
      active: { color: 'bg-green-100 text-green-800', label: '활성' },
      idle: { color: 'bg-gray-100 text-gray-800', label: '유휴' },
    };
    return statusMap[status] || { color: 'bg-gray-100 text-gray-800', label: status };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">CEO 대시보드</h1>
            <p className="text-slate-400">실시간 프로젝트 & 팀 모니터링</p>
          </div>
          <a
            href="/dashboard/team-status"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            → 팀 현황 상세보기
          </a>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-6">
          <div className="text-slate-300 text-sm font-medium mb-2">완료율</div>
          <div className="text-3xl font-bold text-white">{metrics.completionRate.toFixed(1)}%</div>
          <div className="text-slate-400 text-xs mt-1">{metrics.activeProjects}/9 프로젝트</div>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-6">
          <div className="text-slate-300 text-sm font-medium mb-2">신뢰도</div>
          <div className="text-3xl font-bold text-green-400">{metrics.reliabilityScore}%</div>
          <div className="text-slate-400 text-xs mt-1">일정 준수율</div>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-6">
          <div className="text-slate-300 text-sm font-medium mb-2">블로킹</div>
          <div className="text-3xl font-bold text-blue-400">{metrics.blockingItems}건</div>
          <div className="text-slate-400 text-xs mt-1">해결 필요</div>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-6">
          <div className="text-slate-300 text-sm font-medium mb-2">팀 활용률</div>
          <div className="text-3xl font-bold text-purple-400">{metrics.teamUtilization}%</div>
          <div className="text-slate-400 text-xs mt-1">{metrics.teamMembers}명 팀원</div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">프로젝트 상태</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((project) => {
            const badge = getStatusBadge(project.status);
            return (
              <div key={project.id} className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-4 hover:bg-white/10 transition">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-white font-semibold">{project.name}</h3>
                    <p className="text-slate-400 text-sm">담당: {project.owner}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>{badge.label}</span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>진도율</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
                {project.eta && <p className="text-slate-400 text-xs">ETA: {project.eta}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Workload */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">팀원 활용률</h2>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/10 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-slate-300">이름</th>
                <th className="px-4 py-3 text-left text-slate-300">역할</th>
                <th className="px-4 py-3 text-left text-slate-300">현재 작업</th>
                <th className="px-4 py-3 text-right text-slate-300">활용률</th>
                <th className="px-4 py-3 text-center text-slate-300">상태</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => {
                const statusBadge = getStatusBadge(member.status);
                return (
                  <tr key={member.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-4 py-3 text-white">{member.name}</td>
                    <td className="px-4 py-3 text-slate-400">{member.role}</td>
                    <td className="px-4 py-3 text-slate-400">{member.currentTask || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white font-semibold">{member.utilization}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.color}`}>{statusBadge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-slate-400 text-sm">
        <p>마지막 갱신: {new Date().toLocaleString('ko-KR')} | 5분 주기 자동 새로고침</p>
      </div>
    </div>
  );
}
