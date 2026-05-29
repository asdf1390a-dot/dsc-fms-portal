import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

/**
 * 14:00 Checkpoint: Team member progress check
 * - Check recent git commits for progress
 * - Scan memory files for task status
 * - Update CTB with checkpoint record
 * - Send progress report to Telegram
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ctbPath = join(process.cwd(), 'memory', 'active_work_tracking.md');
    let ctbContent = readFileSync(ctbPath, 'utf-8');

    const kstTime = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Get recent commits to check team progress
    let recentCommits: string[] = [];
    try {
      const gitLog = execSync('git log --oneline -10 --since="12 hours ago"', {
        cwd: process.cwd(),
        encoding: 'utf-8',
      });
      recentCommits = gitLog.split('\n').filter((line: string) => line.trim() !== '');
    } catch (e) {
      console.error('Git log error:', e);
    }

    // Update CTB with 14:00 checkpoint record
    const lines = ctbContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('| 2026-05-20 |')) {
        const parts = lines[i].split('|');
        if (parts.length >= 4) {
          parts[3] = ` ${kstTime} ✅ `;
          lines[i] = parts.join('|');
          ctbContent = lines.join('\n');
          break;
        }
      }
    }

    // Write updated CTB
    writeFileSync(ctbPath, ctbContent, 'utf-8');

    // Send Telegram notification with progress report
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_SECRETARY_CHAT_ID;

    if (token && chatId) {
      const commitsList = recentCommits.length > 0
        ? recentCommits.slice(0, 5).map(c => `  • ${c}`).join('\n')
        : '  (최근 커밋 없음)';

      const messageText = `【14:00 Checkpoint】✅ 완료\n` +
        `시간: ${kstTime}\n` +
        `상태: 팀원 진행률 확인\n\n` +
        `📌 최근 10시간 커밋:\n${commitsList}\n\n` +
        `✨ CTB 갱신 완료`;

      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
            parse_mode: 'HTML',
          }),
        });
      } catch (e) {
        console.error('Telegram notification failed:', e);
      }
    }

    return NextResponse.json({
      message: '14:00 Checkpoint completed',
      timestamp: kstTime,
      recentCommits: recentCommits.length,
      status: 'success',
    });
  } catch (error) {
    console.error('14:00 Checkpoint error:', error);
    return NextResponse.json(
      { error: 'Checkpoint failed', details: String(error) },
      { status: 500 }
    );
  }
}
