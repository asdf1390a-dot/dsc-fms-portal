/**
 * Cron Checkpoint Manager
 * Handles daily checkpoint scheduling and CTB (Central Task Board) synchronization
 * Triggered by Vercel Cron at 08:00, 09:00, 12:00, 14:00, 15:00, 18:00 KST
 *
 * Responsibilities:
 * 1. Record checkpoint execution time
 * 2. Update active_work_tracking.md (CTB)
 * 3. Send Telegram notifications
 * 4. Track checkpoint reliability (95% target)
 * 5. Auto-recover missed checkpoints
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { zonedTimeToUtc, formatInTimeZone } from 'date-fns-tz';

interface CheckpointConfig {
  scheduleTimes: string[]; // ["08:00", "09:00", "12:00", "14:00", "15:00", "18:00"]
  timezone: string; // "Asia/Seoul"
  ctbPath: string; // path to active_work_tracking.md
  telegramToken: string;
  telegramChatId: string;
}

interface CheckpointEvent {
  timestamp: string; // ISO 8601
  scheduledTime: string; // HH:MM format
  actualTime: string; // HH:MM format
  status: 'completed' | 'missed' | 'delayed';
  delayMinutes?: number;
}

class CronCheckpointManager {
  private config: CheckpointConfig;
  private supabase: ReturnType<typeof createClient>;

  constructor(config: CheckpointConfig) {
    this.config = config;
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  /**
   * Get current KST time in HH:MM format
   */
  private getNowKST(): { time: string; date: string } {
    const nowKST = formatInTimeZone(new Date(), 'Asia/Seoul', 'HH:mm');
    const dateKST = formatInTimeZone(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    return { time: nowKST, date: dateKST };
  }

  /**
   * Determine which scheduled time this checkpoint is for
   */
  private getScheduledTimeForNow(): string {
    const { time } = this.getNowKST();
    const [hour, minute] = time.split(':').map(Number);

    // Find the closest scheduled time within ±10 minutes
    for (const scheduledTime of this.config.scheduleTimes) {
      const [sHour, sMinute] = scheduledTime.split(':').map(Number);
      const diffMinutes = Math.abs(hour * 60 + minute - (sHour * 60 + sMinute));

      if (diffMinutes <= 10) {
        return scheduledTime;
      }
    }

    // If no scheduled time found within 10 minutes, log as off-schedule
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate checkpoint reliability
   * Reliability = (completed checkpoints / scheduled checkpoints) × 100%
   */
  private async calculateReliability(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('checkpoint_logs')
        .select('status')
        .eq('date', this.getNowKST().date);

      if (error) {
        console.error('Error fetching checkpoint logs:', error);
        return 0;
      }

      const logs: CheckpointEvent[] = data || [];
      const completed = logs.filter(log => log.status === 'completed').length;
      const reliability = logs.length > 0 ? (completed / logs.length) * 100 : 0;

      return Math.round(reliability);
    } catch (err) {
      console.error('Error calculating reliability:', err);
      return 0;
    }
  }

  /**
   * Update CTB (active_work_tracking.md) with checkpoint event
   */
  private async updateCTB(event: CheckpointEvent): Promise<boolean> {
    try {
      const delayInfo = event.status === 'delayed' ? `(+${event.delayMinutes}분 지연)` : '';
      const ctbEntry = `| ${this.getNowKST().date} | ${event.scheduledTime} | ${event.actualTime} ✅ | ${event.status} ${delayInfo} |`;

      // Log to database instead of modifying .md file directly
      const { error } = await this.supabase.from('checkpoint_logs').insert([
        {
          date: this.getNowKST().date,
          scheduled_time: event.scheduledTime,
          actual_time: event.actualTime,
          status: event.status,
          delay_minutes: event.delayMinutes || 0,
          timestamp: event.timestamp,
        },
      ] as any);

      if (error) {
        console.error('Error updating CTB:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error in updateCTB:', err);
      return false;
    }
  }

  /**
   * Send Telegram notification
   */
  private async sendTelegramNotification(message: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.config.telegramToken}/sendMessage`;

      const response = await axios.post(url, {
        chat_id: this.config.telegramChatId,
        text: message,
        parse_mode: 'Markdown',
      });

      return response.status === 200;
    } catch (err) {
      console.error('Error sending Telegram notification:', err);
      return false;
    }
  }

  /**
   * Generate checkpoint notification message
   */
  private async generateNotificationMessage(event: CheckpointEvent): Promise<string> {
    const reliability = await this.calculateReliability();

    return `
📍 **Daily Checkpoint #${event.scheduledTime.replace(':', '')}**

⏰ **Scheduled:** ${event.scheduledTime} KST
⏱ **Actual:** ${event.actualTime} KST
📊 **Status:** ${event.status}${event.delayMinutes ? ` (${event.delayMinutes}분 지연)` : ' ✅'}
🎯 **Reliability:** ${reliability}%

━━━━━━━━━━━━━━━━━
**Next Checkpoint:** Next scheduled time
    `.trim();
  }

  /**
   * Execute checkpoint (main entry point)
   */
  async execute(): Promise<{
    success: boolean;
    checkpoint: CheckpointEvent;
    reliability: number;
  }> {
    const { time: actualTime, date } = this.getNowKST();
    const scheduledTime = this.getScheduledTimeForNow();

    const [aHour, aMin] = actualTime.split(':').map(Number);
    const [sHour, sMin] = scheduledTime.split(':').map(Number);
    const delayMinutes = aHour * 60 + aMin - (sHour * 60 + sMin);

    const event: CheckpointEvent = {
      timestamp: new Date().toISOString(),
      scheduledTime,
      actualTime,
      status: delayMinutes <= 5 ? 'completed' : delayMinutes <= 15 ? 'delayed' : 'missed',
      delayMinutes: Math.max(0, delayMinutes),
    };

    // Update CTB
    const ctbUpdated = await this.updateCTB(event);

    // Calculate reliability
    const reliability = await this.calculateReliability();

    // Send notification
    const notificationMsg = await this.generateNotificationMessage(event);
    const notificationSent = await this.sendTelegramNotification(notificationMsg);

    console.log(`[Checkpoint ${scheduledTime}] Status: ${event.status}, Reliability: ${reliability}%`);

    return {
      success: ctbUpdated && notificationSent,
      checkpoint: event,
      reliability,
    };
  }

  /**
   * Batch execute all pending checkpoints (for recovery)
   */
  async recoverMissedCheckpoints(): Promise<CheckpointEvent[]> {
    const { date } = this.getNowKST();
    const recoveredEvents: CheckpointEvent[] = [];

    try {
      // Fetch today's log
      const { data, error } = await this.supabase
        .from('checkpoint_logs')
        .select('scheduled_time')
        .eq('date', date);

      if (error) throw error;

      const logs: Array<{ scheduled_time: string }> = data || [];
      const completedTimes = new Set(logs.map(log => log.scheduled_time));

      // Check which scheduled times are missing
      for (const scheduledTime of this.config.scheduleTimes) {
        if (!completedTimes.has(scheduledTime)) {
          const event: CheckpointEvent = {
            timestamp: new Date().toISOString(),
            scheduledTime,
            actualTime: this.getNowKST().time,
            status: 'missed',
          };

          await this.updateCTB(event);
          recoveredEvents.push(event);
        }
      }

      if (recoveredEvents.length > 0) {
        await this.sendTelegramNotification(
          `🔄 **Recovered ${recoveredEvents.length} missed checkpoints** for ${date}`
        );
      }
    } catch (err) {
      console.error('Error recovering missed checkpoints:', err);
    }

    return recoveredEvents;
  }
}

export default CronCheckpointManager;
