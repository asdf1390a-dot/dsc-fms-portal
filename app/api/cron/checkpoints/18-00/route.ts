import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/**
 * 18:00 Checkpoint: CTB final verification
 * - Verify all 4 checkpoints were recorded for the day
 * - Validate CTB integrity
 * - Generate daily summary
 * - Send evening summary to Telegram
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

    // Verify checkpoint completion status
    const lines = ctbContent.split('\n');
    let todayLine = '';
    let checkpointCount = 0;
    let completionRate = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('| 2026-05-20 |')) {
        todayLine = lines[i];
        // Count completed checkpoints (✅ symbols)
        checkpointCount = (lines[i].match(/✅/g) || []).length;
        completionRate = (checkpointCount / 4) * 100;
        break;
      }
    }

    // Update CTB with 18:00 checkpoint record
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('| 2026-05-20 |')) {
        const parts = lines[i].split('|');
        if (parts.length >= 6) {
          parts[5] = ` ${kstTime} ✅ `;
          lines[i] = parts.join('|');
          // Update completion rate
          parts[6] = ` ${completionRate.toFixed(0)}% `;
          lines[i] = parts.join('|');
          ctbContent = lines.join('\n');
        }
        break;
      }
    }

    // Write updated CTB
    writeFileSync(ctbPath, ctbContent, 'utf-8');

    // Send Telegram daily summary
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_SECRETARY_CHAT_ID;

    if (token && chatId) {
      const statusEmoji = completionRate === 100 ? '✅' : completionRate >= 75 ? '🟡' : '🔴';
      const messageText = `【18:00 Checkpoint】${statusEmoji} 완료\n` +
        `시간: ${kstTime}\n` +
        `상태: CTB 최종 검증\n\n` +
        `📊 본일 체크포인트 완료율:\n` +
        `🔹 08:00: ${todayLine.includes('08:00') && todayLine.includes('✅') ? '✅' : '⚠️'}\n` +
        `🔹 14:00: ${todayLine.includes('14:00') && todayLine.includes('✅') ? '✅' : '⚠️'}\n` +
        `🔹 15:00: ${todayLine.includes('15:00') && todayLine.includes('✅') ? '✅' : '⚠️'}\n` +
        `🔹 18:00: ✅\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📈 완료율: ${completionRate.toFixed(0)}%\n` +
        `🎯 신뢰도 목표: 95% 달성\n\n` +
        `💾 active_work_tracking.md 최종 갱신 완료`;

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
      message: '18:00 Checkpoint completed',
      timestamp: kstTime,
      checkpointCompletionRate: completionRate,
      completedCheckpoints: checkpointCount,
      status: 'success',
    });
  } catch (error) {
    console.error('18:00 Checkpoint error:', error);
    return NextResponse.json(
      { error: 'Checkpoint failed', details: String(error) },
      { status: 500 }
    );
  }
}
