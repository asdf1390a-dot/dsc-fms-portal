import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { formatInTimeZone } from 'date-fns-tz';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface CheckpointResponse {
  success: boolean;
  checkpoint: {
    scheduledTime: string;
    actualTime: string;
    status: 'completed' | 'missed' | 'delayed';
    delayMinutes?: number;
  };
  reliability: number;
  message: string;
}

/**
 * Checkpoint Cron Handler
 * Path: /api/cron/checkpoint/[time]
 * Triggered by Vercel at specific times (08:00, 09:00, 12:00, 14:00, 15:00, 18:00 KST)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CheckpointResponse>
) {
  // Verify Vercel Cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({
      success: false,
      checkpoint: {
        scheduledTime: '',
        actualTime: '',
        status: 'missed',
      },
      reliability: 0,
      message: 'Unauthorized',
    });
  }

  const { time } = req.query;
  const timeStr = time as string;

  try {
    // Get current KST time
    const nowKST = formatInTimeZone(new Date(), 'Asia/Seoul', 'HH:mm');
    const dateKST = formatInTimeZone(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');

    // Normalize scheduled time (e.g., "08-00" -> "08:00")
    const scheduledTime = timeStr.replace('-', ':');

    // Determine status based on time difference
    const [nowHour, nowMin] = nowKST.split(':').map(Number);
    const [schedHour, schedMin] = scheduledTime.split(':').map(Number);
    const delayMinutes = (nowHour * 60 + nowMin) - (schedHour * 60 + schedMin);

    let status: 'completed' | 'missed' | 'delayed';
    if (delayMinutes <= 5) {
      status = 'completed';
    } else if (delayMinutes <= 15) {
      status = 'delayed';
    } else {
      status = 'missed';
    }

    // Log checkpoint to database
    const { error: insertError } = await supabase.from('checkpoint_logs').insert([
      {
        date: dateKST,
        scheduled_time: scheduledTime,
        actual_time: nowKST,
        status,
        delay_minutes: Math.max(0, delayMinutes),
        timestamp: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      console.error('Error logging checkpoint:', insertError);
    }

    // Calculate reliability for today
    const { data: todayLogs, error: queryError } = await supabase
      .from('checkpoint_logs')
      .select('*')
      .eq('date', dateKST);

    let reliability = 0;
    if (!queryError && todayLogs) {
      const completed = todayLogs.filter(log => log.status === 'completed').length;
      reliability = todayLogs.length > 0 ? Math.round((completed / todayLogs.length) * 100) : 0;
    }

    // Send Telegram notification
    const telegramMessage = `
📍 **Daily Checkpoint #${scheduledTime.replace(':', '')}**

⏰ **Scheduled:** ${scheduledTime} KST
⏱ **Actual:** ${nowKST} KST
📊 **Status:** ${status}${delayMinutes > 0 ? ` (+${delayMinutes}분)` : ''} ${
      status === 'completed' ? '✅' : '⚠️'
    }
🎯 **Reliability:** ${reliability}%

━━━━━━━━━━━━━━━━━━━━━━━━
**Next Checkpoint:** Follow schedule
    `.trim();

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: telegramMessage,
          parse_mode: 'Markdown',
        });
      } catch (telegramError) {
        console.error('Telegram notification failed:', telegramError);
      }
    }

    res.status(200).json({
      success: true,
      checkpoint: {
        scheduledTime,
        actualTime: nowKST,
        status,
        delayMinutes: Math.max(0, delayMinutes),
      },
      reliability,
      message: `Checkpoint ${scheduledTime} recorded (Status: ${status}, Reliability: ${reliability}%)`,
    });
  } catch (error) {
    console.error('Checkpoint error:', error);
    res.status(500).json({
      success: false,
      checkpoint: {
        scheduledTime: '',
        actualTime: '',
        status: 'missed',
      },
      reliability: 0,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
