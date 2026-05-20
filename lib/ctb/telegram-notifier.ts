/**
 * Telegram notification system for CTB real-time updates
 * Sends alerts about schedule adjustments to the secretary chat
 */

interface NotificationPayload {
  taskName: string;
  stage?: string;
  completionTime: string;
  commitHash: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  timeDelta?: number;
  isAccelerated?: boolean;
  nextTaskName?: string;
  newETA?: string;
  originalETA?: string;
}

/**
 * Send Telegram notification about task completion
 */
export async function sendTelegramNotification(payload: NotificationPayload): Promise<boolean> {
  const {
    taskName,
    stage,
    completionTime,
    commitHash,
    estimatedMinutes,
    actualMinutes,
    timeDelta,
    isAccelerated,
    nextTaskName,
    newETA,
    originalETA,
  } = payload;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_SECRETARY_CHAT_ID;

  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_SECRETARY_CHAT_ID');
    return false;
  }

  // Build message based on whether there's a schedule adjustment
  let messageText = '';

  if (isAccelerated && nextTaskName && newETA && originalETA) {
    // Schedule acceleration case (Phase 1-3: with ETA adjustment)
    messageText = `【일정 앞당김】\n` +
      `✅ 작업: ${taskName}${stage ? ` (${stage})` : ''}\n` +
      `⏰ 완료: ${completionTime}\n` +
      `⚡ 단축: ${timeDelta}분\n\n` +
      `📋 다음 작업: ${nextTaskName}\n` +
      `🔄 새 ETA: ${originalETA} → ${newETA}\n` +
      `🔗 Commit: ${commitHash}`;
  } else if (isAccelerated && estimatedMinutes && actualMinutes !== undefined) {
    // Time delta notification (Phase 1-2: showing acceleration without ETA adjustment yet)
    messageText = `【작업 완료】\n` +
      `✅ ${taskName}${stage ? ` (${stage})` : ''}\n` +
      `⏰ ${completionTime}\n` +
      `⏱️ 예정: ${estimatedMinutes}분 | 실제: ${actualMinutes}분\n` +
      `⚡ 단축: +${timeDelta}분\n` +
      `🔗 Commit: ${commitHash}`;
  } else {
    // Standard completion notification
    messageText = `【작업 완료】\n` +
      `✅ ${taskName}${stage ? ` (${stage})` : ''}\n` +
      `⏰ ${completionTime}\n` +
      `🔗 Commit: ${commitHash}`;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Telegram API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    return false;
  }
}

/**
 * Send batch notification for daily summary
 */
export async function sendDailySummaryNotification(
  pulledTasks: Array<{ taskName: string; timeDelta: number }>,
  totalTimePulled: number
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_SECRETARY_CHAT_ID;

  if (!token || !chatId || pulledTasks.length === 0) {
    return false;
  }

  const tasksList = pulledTasks.map((task) => `  • ${task.taskName}: +${task.timeDelta}분`).join('\n');

  const messageText = `【2026-05-18 일정 당겨온 현황】\n\n` +
    `${tasksList}\n\n` +
    `───────────────────\n` +
    `📊 일일 총 단축: ${totalTimePulled}분\n` +
    `✨ 효과: 예정 대비 ${totalTimePulled}분 조기 완료`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send daily summary notification:', error);
    return false;
  }
}
