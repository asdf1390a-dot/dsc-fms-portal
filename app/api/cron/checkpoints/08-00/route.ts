import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

interface CheckpointLog {
  date: string;
  time: string;
  status: string;
  message: string;
}

/**
 * 08:00 Checkpoint: CTB first update (blocking check)
 * - Read active_work_tracking.md
 * - Detect new blocking items
 * - Update CTB with checkpoint record
 * - Send Telegram notification
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ctbPath = join(process.cwd(), 'memory', 'active_work_tracking.md');
    let ctbContent = readFileSync(ctbPath, 'utf-8');

    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const kstTime = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Update CTB with 08:00 checkpoint record
    const checkpointRecord = `| 2026-05-20 | ${kstTime} ✅ |`;

    // Find and update the checkpoint table
    const checkpointTableStart = ctbContent.indexOf('| 날짜 | 08:00 |');
    if (checkpointTableStart !== -1) {
      // Find the line after the latest date entry
      const lines = ctbContent.split('\n');
      let tableStartIdx = -1;
      let insertIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('| 날짜 | 08:00 |')) {
          tableStartIdx = i;
        }
        if (tableStartIdx !== -1 && lines[i].includes('| 2026-05-20 |')) {
          insertIdx = i;
          break;
        }
      }

      if (insertIdx === -1 && tableStartIdx !== -1) {
        // Add new entry if 2026-05-20 doesn't exist yet
        // Find separator line after header
        const sepLineIdx = tableStartIdx + 1;
        if (sepLineIdx < lines.length && lines[sepLineIdx].includes('---')) {
          // Insert after the separator
          lines.splice(sepLineIdx + 1, 0, checkpointRecord);
          ctbContent = lines.join('\n');
        }
      } else if (insertIdx !== -1) {
        // Update existing entry
        const parts = lines[insertIdx].split('|');
        if (parts.length >= 3) {
          parts[2] = ` ${kstTime} ✅ `;
          lines[insertIdx] = parts.join('|');
          ctbContent = lines.join('\n');
        }
      }
    }

    // Write updated CTB
    writeFileSync(ctbPath, ctbContent, 'utf-8');

    // Send Telegram notification
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_SECRETARY_CHAT_ID;

    if (token && chatId) {
      const messageText = `【08:00 Checkpoint】✅ 완료\n` +
        `시간: ${kstTime}\n` +
        `상태: CTB 첫 갱신 (블로킹 확인)\n\n` +
        `📋 Action: active_work_tracking.md 갱신 완료`;

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
      message: '08:00 Checkpoint completed',
      timestamp: now,
      status: 'success',
    });
  } catch (error) {
    console.error('08:00 Checkpoint error:', error);
    return NextResponse.json(
      { error: 'Checkpoint failed', details: String(error) },
      { status: 500 }
    );
  }
}
