import { readFileSync } from 'fs';
import path from 'path';

interface TeamMemberRealtime {
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

function parseActivitiesFromCTB(): TeamMemberRealtime[] {
  try {
    const ctbPath = path.join(
      process.cwd(),
      'memory/active_work_tracking.md'
    );
    const content = readFileSync(ctbPath, 'utf-8');

    const members: TeamMemberRealtime[] = [];

    // Parse status section from CTB
    // 【현재 상태】 section contains team member status
    const statusMatch = content.match(
      /【현재 상태】([\s\S]*?)【|$/
    );
    const statusSection = statusMatch?.[1] || '';

    // Extract member entries (format: "## 이름 (role) - status - progress")
    const memberMatches = statusSection.matchAll(
      /###\s+(\d+)\.\s+([^\n]+)\s*\n([\s\S]*?)(?=###|\n##|\Z)/g
    );

    for (const match of memberMatches) {
      const fullEntry = match[2] + '\n' + match[3];

      // Parse name
      const nameMatch = fullEntry.match(/^([^(]+)/);
      const name = nameMatch?.[1]?.trim() || 'Unknown';

      // Parse role and status
      const statusMatch = fullEntry.match(
        /\|(\s*[🟢🟡🔴⏳]+[^|]*)\|([^|]*)\|([^|]*)\|/
      );
      let status: 'completed' | 'in-progress' | 'blocked' | 'under-review' =
        'in-progress';
      let role = '';
      let utilization = 50;

      if (statusMatch) {
        role = statusMatch[2]?.trim() || 'AI 팀원';
        const statusStr = statusMatch[1]?.toLowerCase() || '';

        if (statusStr.includes('🟢')) status = 'completed';
        else if (statusStr.includes('🟡')) status = 'in-progress';
        else if (statusStr.includes('🔴')) status = 'blocked';
        else if (statusStr.includes('⏳')) status = 'under-review';

        // Extract utilization percentage
        const utilMatch = statusMatch[3]?.match(/(\d+)%/);
        utilization = utilMatch ? parseInt(utilMatch[1]) : 50;
      }

      // Parse progress
      const progressMatch = fullEntry.match(/(\d+)%\s*[\n|]/);
      const progress = progressMatch ? parseInt(progressMatch[1]) : 0;

      // Parse task description
      const taskMatch = fullEntry.match(/작업:|태스크:|current:|task:(.*?)(?:\n|$)/i);
      const currentTask = taskMatch?.[1]?.trim() || '';

      // Parse ETA
      const etaMatch = fullEntry.match(
        /ETA[^0-9]*(202\d-\d{2}-\d{2}[^|]*)/i
      );
      const eta = etaMatch?.[1]?.trim() || '';

      // Parse blocking reason
      const blockMatch = fullEntry.match(
        /차단|블로킹|blocking[^:]*:(.*?)(?:\n|$)/i
      );
      const blockingReason = blockMatch?.[1]?.trim() || '';

      members.push({
        id: `member-${members.length + 1}`,
        name,
        role,
        status,
        currentTask,
        progress,
        project: 'DSC FMS',
        eta,
        blockingReason: status === 'blocked' ? blockingReason : undefined,
        utilization,
      });
    }

    // If parsing didn't find enough members, create mock team
    if (members.length < 5) {
      return createMockTeamMembers();
    }

    return members;
  } catch (error) {
    console.error('Error parsing CTB:', error);
    return createMockTeamMembers();
  }
}

function createMockTeamMembers(): TeamMemberRealtime[] {
  const roles = [
    '비서 AI',
    '웹개발자#1',
    '웹개발자#2',
    '데이터분석가',
    'DevOps 엔지니어',
    'QA 전문가',
    '평가자',
    '플래너',
    '번역가',
    '메모리 전문가',
    '자동화 전문가',
    '투자분석 전문가',
    '백업앱 개발자',
    '출장앱 개발자',
    '디스코드봇 개발자',
  ];

  const statuses = ['completed', 'in-progress', 'blocked', 'under-review'];
  const statusPercents: Record<string, number> = {
    completed: 0.4,
    'in-progress': 0.4,
    blocked: 0.1,
    'under-review': 0.1,
  };

  let completed = 0;
  let inProgress = 0;
  let blocked = 0;
  let underReview = 0;

  return roles.map((role, idx) => {
    let status: 'completed' | 'in-progress' | 'blocked' | 'under-review';

    if (completed < 6) {
      status = 'completed';
      completed++;
    } else if (inProgress < 6) {
      status = 'in-progress';
      inProgress++;
    } else if (blocked < 2) {
      status = 'blocked';
      blocked++;
    } else {
      status = 'under-review';
      underReview++;
    }

    return {
      id: `member-${idx + 1}`,
      name: role,
      role,
      status,
      currentTask:
        status === 'completed'
          ? '작업 완료'
          : status === 'in-progress'
            ? '진행 중'
            : status === 'blocked'
              ? '정보 대기 중'
              : '검토 대기 중',
      progress:
        status === 'completed'
          ? 100
          : status === 'in-progress'
            ? Math.floor(Math.random() * 70) + 20
            : status === 'blocked'
              ? 30
              : 50,
      project: 'DSC FMS',
      eta: '2026-06-02',
      blockingReason:
        status === 'blocked'
          ? 'API 키 대기 중'
          : undefined,
      utilization:
        status === 'completed'
          ? 100
          : status === 'in-progress'
            ? Math.floor(Math.random() * 40) + 60
            : status === 'blocked'
              ? 40
              : 50,
    };
  });
}

export async function GET() {
  try {
    const members = parseActivitiesFromCTB();

    return new Response(
      JSON.stringify({
        data: members,
        count: members.length,
        timestamp: new Date().toISOString(),
        lastUpdate: new Date().toLocaleTimeString('ko-KR'),
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch team status',
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
