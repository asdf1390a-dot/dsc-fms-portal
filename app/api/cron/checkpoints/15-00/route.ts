import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

/**
 * 15:00 Checkpoint: Asset Master Phase 2 daily report
 * - Check for Asset Master commits
 * - Verify Phase 2 implementation progress
 * - Update CTB with checkpoint record and progress
 * - Send daily report to Telegram
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

    // Check for Asset Master Phase 2 commits
    let assetCommits: string[] = [];
    try {
      const gitLog = execSync('git log --oneline -50 --grep="asset\\|Asset" --since="24 hours ago"', {
        cwd: process.cwd(),
        encoding: 'utf-8',
      });
      assetCommits = gitLog.split('\n').filter(line => line.trim());
    } catch (e) {
      console.error('Git asset check error:', e);
    }

    // Update CTB with 15:00 checkpoint record
    const lines = ctbContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('| 2026-05-20 |')) {
        const parts = lines[i].split('|');
        if (parts.length >= 5) {
          parts[4] = ` ${kstTime} ✅ `;
          lines[i] = parts.join('|');
          ctbContent = lines.join('\n');
          break;
        }
      }
    }

    // Write updated CTB
    writeFileSync(ctbPath, ctbContent, 'utf-8');

    // Send Telegram notification with Asset Master report
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_SECRETARY_CHAT_ID;

    if (token && chatId) {
      const assetProgress = assetCommits.length > 0
        ? `✅ Day 1 진행: ${assetCommits.length}개 커밋\n\n${assetCommits.slice(0, 3).map(c => `  • ${c}`).join('\n')}`
        : '⚠️ Day 1 진행: 커밋 없음';

      const messageText = `【15:00 Checkpoint】✅ 완료\n` +
        `시간: ${kstTime}\n` +
        `상태: Asset Master Phase 2 일일 리포트\n\n` +
        `📊 진행률:\n${assetProgress}\n\n` +
        `🎯 목표: 16개 MVP API 구현\n` +
        `📅 ETA: 2026-05-24 18:00`;

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
      message: '15:00 Checkpoint completed',
      timestamp: kstTime,
      assetMasterCommits: assetCommits.length,
      status: 'success',
    });
  } catch (error) {
    console.error('15:00 Checkpoint error:', error);
    return NextResponse.json(
      { error: 'Checkpoint failed', details: String(error) },
      { status: 500 }
    );
  }
}
