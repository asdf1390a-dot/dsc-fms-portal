/**
 * Telegram Notification Configuration
 * Central config for all automated Telegram notifications
 */

export const TELEGRAM_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  endpoint: 'https://api.telegram.org/bot',
};

export const CHECKPOINT_NOTIFICATION_TEMPLATE = {
  emoji: '📍',
  title: 'Daily Checkpoint',
  fields: {
    scheduled: '⏰ Scheduled',
    actual: '⏱ Actual',
    status: '📊 Status',
    reliability: '🎯 Reliability',
  },
  statuses: {
    completed: { icon: '✅', label: 'On Time' },
    delayed: { icon: '⏳', label: 'Delayed' },
    missed: { icon: '❌', label: 'Missed' },
  },
};

export const GCS_VIOLATION_NOTIFICATION_TEMPLATE = {
  emoji: '⚠️',
  title: 'GCS Violation Detected',
  fields: {
    violation: '❌ Violation',
    commit: '📝 Commit',
    expected: '✅ Expected',
  },
};

export const CTB_SYNC_NOTIFICATION_TEMPLATE = {
  emoji: '🔄',
  title: 'CTB Synchronized',
  fields: {
    timestamp: '⏱ Timestamp',
    updates: '📊 Updates',
    status: '✅ Status',
  },
};

/**
 * Format checkpoint notification
 */
export function formatCheckpointNotification(
  scheduledTime: string,
  actualTime: string,
  status: 'completed' | 'missed' | 'delayed',
  reliability: number,
  delayMinutes?: number
): string {
  const statusInfo = CHECKPOINT_NOTIFICATION_TEMPLATE.statuses[status];

  return `
${CHECKPOINT_NOTIFICATION_TEMPLATE.emoji} **Daily Checkpoint #${scheduledTime.replace(':', '')}**

${CHECKPOINT_NOTIFICATION_TEMPLATE.fields.scheduled} ${scheduledTime} KST
${CHECKPOINT_NOTIFICATION_TEMPLATE.fields.actual} ${actualTime} KST
${CHECKPOINT_NOTIFICATION_TEMPLATE.fields.status} ${statusInfo.icon} ${statusInfo.label}${delayMinutes ? ` (+${delayMinutes}분)` : ''}
${CHECKPOINT_NOTIFICATION_TEMPLATE.fields.reliability} ${reliability}%

━━━━━━━━━━━━━━━━━━━━━━━━
**Phase:** Daily Tracking
**Target:** 95% reliability
    `.trim();
}

/**
 * Format GCS violation notification
 */
export function formatGCSViolationNotification(
  violations: Array<{ commit: string; reason: string }>
): string {
  const violationList = violations.map(v => `  ❌ ${v.commit}: ${v.reason}`).join('\n');

  return `
${GCS_VIOLATION_NOTIFICATION_TEMPLATE.emoji} **GCS Violation Detected**

${violationList}

━━━━━━━━━━━━━━━━━━━━━━━━
**Standard:** <type>(<scope>): <subject>
**Body:** Refs: <task_id> + Stage: <DESIGN|DB|API|UI|DEPLOY|VERIFY>
**Action:** Amend commit or rebase to fix
    `.trim();
}

/**
 * Format CTB sync notification
 */
export function formatCTBSyncNotification(
  timestamp: string,
  updateCount: number,
  missingCheckpoints: string[]
): string {
  return `
${CTB_SYNC_NOTIFICATION_TEMPLATE.emoji} **CTB Synchronized**

${CTB_SYNC_NOTIFICATION_TEMPLATE.fields.timestamp} ${timestamp}
${CTB_SYNC_NOTIFICATION_TEMPLATE.fields.updates} ${updateCount} records synced
${CTB_SYNC_NOTIFICATION_TEMPLATE.fields.status} ✅ Success

${
    missingCheckpoints.length > 0
      ? `⚠️ **Missing Checkpoints:** ${missingCheckpoints.join(', ')}`
      : '✅ **All checkpoints recorded**'
  }

━━━━━━━━━━━━━━━━━━━━━━━━
**Next Sync:** Automatic
    `.trim();
}

/**
 * Send Telegram notification
 */
export async function sendTelegramNotification(
  message: string,
  botToken?: string,
  chatId?: string
): Promise<{ success: boolean; error?: string }> {
  const token = botToken || TELEGRAM_CONFIG.botToken;
  const chat = chatId || TELEGRAM_CONFIG.chatId;

  if (!token || !chat) {
    return { success: false, error: 'Telegram credentials not configured' };
  }

  try {
    const response = await fetch(`${TELEGRAM_CONFIG.endpoint}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
