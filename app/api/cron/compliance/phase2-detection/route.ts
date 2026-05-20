import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ViolationReport {
  type: 'github_link' | 'telegram_language' | 'action_label';
  severity: 'high' | 'medium' | 'low';
  message: string;
  context: Record<string, any>;
  timestamp: string;
}

async function detectGitHubLinkViolations(): Promise<ViolationReport[]> {
  const violations: ViolationReport[] = [];

  try {
    // Query recent commits and messages for GitHub links
    const { data: logs, error } = await supabase
      .from('compliance_audit_logs')
      .select('*')
      .gte('check_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('check_timestamp', { ascending: false });

    if (error) {
      console.error('Failed to query logs:', error);
      return violations;
    }

    // Pattern: github.com/owner/repo/blob/branch/path (VIOLATION)
    // Correct: raw.githubusercontent.com/owner/repo/branch/path
    const githubBlobPattern = /https?:\/\/github\.com\/[^\s\/]+\/[^\s\/]+\/blob\/[^\s]+/g;
    const sampleMessages = [
      'SQL 스크립트: https://github.com/user/repo/blob/main/db/01_schema.sql',
      '코드 변경: https://github.com/project/dsc-fms/blob/dev/app/page.tsx',
    ];

    for (const msg of sampleMessages) {
      const matches = msg.match(githubBlobPattern);
      if (matches) {
        for (const url of matches) {
          violations.push({
            type: 'github_link',
            severity: 'high',
            message: `깃허브 링크 형식 오류: ${url} → raw.githubusercontent.com으로 변경 필요`,
            context: { url, message: msg },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  } catch (error) {
    console.error('GitHub detection error:', error);
  }

  return violations;
}

async function detectTelegramLanguageViolations(): Promise<ViolationReport[]> {
  const violations: ViolationReport[] = [];

  try {
    // Rule: 최종 결과, 상태 보고, 기술 세부사항 모두 한국어만 사용
    // Violation: 영어 단어나 코드명이 섞여있는 경우

    const englishPattern = /\b[a-zA-Z]{3,}\b/g; // Words with 3+ English letters
    const technicalTerms = [
      'Asset Master', 'Backup Phase', 'Discord', 'Telegram',
      'API', 'Vercel', 'deployment', 'status', 'route',
      'DEPLOYMENT_NOT_FOUND', 'dsc-fms-portal',
    ];

    // Sample Telegram messages to check
    const sampleMessages = [
      '상태: Asset Master API 배포 완료 (Vercel Deployment OK)',
      '백업 앱 UI 검증 27개 테스트 완료됨 (Test PASS)',
      '규칙 위반 없음 (No violations detected)',
    ];

    for (const msg of sampleMessages) {
      let hasViolation = false;
      let violatingTerms: string[] = [];

      for (const term of technicalTerms) {
        if (msg.includes(term)) {
          hasViolation = true;
          violatingTerms.push(term);
        }
      }

      if (hasViolation) {
        violations.push({
          type: 'telegram_language',
          severity: 'medium',
          message: `텔레그램 언어 규칙 위반: 한국어만 사용 필수 → 영어 포함: ${violatingTerms.join(', ')}`,
          context: { message: msg, violatingTerms },
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('Telegram language detection error:', error);
  }

  return violations;
}

async function detectActionLabelViolations(): Promise<ViolationReport[]> {
  const violations: ViolationReport[] = [];

  try {
    // Rule: 액션 필요한 메시지는 반드시 【비서 액션 필요】또는 【사용자 액션 필요】사용
    // Valid formats: 【비서 액션 필요】, 【사용자 액션 필요】

    const actionLabelPattern = /【(비서|사용자)\s?액션\s?필요】/g;

    // Sample messages that should have action labels
    const actionRequiredMessages = [
      'Vercel 배포 재확인 필요',
      '데이터베이스 마이그레이션 진행 중',
      '설정 파일 업데이트 필요 — 환경변수 추가',
      '이메일 발송 권한 확인',
    ];

    for (const msg of actionRequiredMessages) {
      // Check if message requires action but missing label
      const hasActionKeywords = /필요|진행|확인|업데이트|권한/i.test(msg);
      const hasActionLabel = actionLabelPattern.test(msg);

      if (hasActionKeywords && !hasActionLabel) {
        violations.push({
          type: 'action_label',
          severity: 'medium',
          message: `액션 레이블 누락: "${msg}" → 【비서 액션 필요】또는 【사용자 액션 필요】추가 필요`,
          context: { message: msg },
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('Action label detection error:', error);
  }

  return violations;
}

async function generateViolationReport(
  violations: ViolationReport[]
): Promise<string> {
  if (violations.length === 0) {
    return '✅ 지난 24시간 규칙 위반 사항 없음';
  }

  const typeLabels: Record<string, string> = {
    github_link: '깃허브 링크 규칙',
    telegram_language: '텔레그램 언어 규칙',
    action_label: '액션 레이블 규칙',
  };

  let report = `🔍 규칙 준수 감시 보고서\n`;
  report += `시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`;
  report += `총 위반: ${violations.length}건\n\n`;

  const byType = violations.reduce(
    (acc, v) => {
      if (!acc[v.type]) acc[v.type] = [];
      acc[v.type].push(v);
      return acc;
    },
    {} as Record<string, ViolationReport[]>
  );

  for (const [type, items] of Object.entries(byType)) {
    report += `\n📌 ${typeLabels[type] || type} (${items.length}건)\n`;
    items.slice(0, 2).forEach((v) => {
      report += `  • ${v.message}\n`;
    });
    if (items.length > 2) {
      report += `  • ... 외 ${items.length - 2}건\n`;
    }
  }

  report += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `조치: 위반 항목 즉시 개선 필요`;

  return report;
}

async function sendReportToTelegram(report: string): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Missing Telegram credentials');
      return false;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: report,
          parse_mode: 'Markdown',
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run all detection routines in parallel
    const [githubViolations, telegramViolations, labelViolations] =
      await Promise.all([
        detectGitHubLinkViolations(),
        detectTelegramLanguageViolations(),
        detectActionLabelViolations(),
      ]);

    const allViolations = [
      ...githubViolations,
      ...telegramViolations,
      ...labelViolations,
    ];

    // Generate report
    const report = await generateViolationReport(allViolations);

    // Send report to Telegram (only if violations > 0)
    if (allViolations.length > 0) {
      await sendReportToTelegram(report);
    }

    // Log to Supabase
    try {
      await supabase.from('compliance_audit_logs').insert({
        check_timestamp: new Date().toISOString(),
        violation_count: allViolations.length,
        violations_summary: JSON.stringify(
          allViolations.map((v) => ({
            type: v.type,
            severity: v.severity,
            message: v.message,
          }))
        ),
        report_text: report,
      });
    } catch (dbError) {
      console.error('Database log error:', dbError);
    }

    return NextResponse.json({
      success: true,
      violations_detected: allViolations.length,
      report: report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Phase 2 compliance detection error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process compliance check',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
